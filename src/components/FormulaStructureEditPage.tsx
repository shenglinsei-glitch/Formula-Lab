import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Undo,
  Redo,
} from "lucide-react";
import { dataStore } from "../store/dataStore";
import FormulaKeyboard, {
  type KeyboardApi,
} from "./FormulaKeyboard";

interface FormulaStructureEditPageProps {
  formulaId: string | null;
  onNext: (expression: string, structureData?: any) => void;
  onCancel: () => void;
  /** draft values when returning from info-edit (unsaved) */
  draftExpression?: string;
  draftStructureData?: any;
}

type Container = {
  children: FormulaNode[];
};

type FormulaNode =
  | { type: "symbol"; value: string }
  | { type: "number"; text: string }
  | {
      type: "fraction";
      numerator: Container;
      denominator: Container;
    }
  | {
      type: "superscript";
      base: Container;
      exponent: Container;
    }
  | { type: "subscript"; base: Container; index: Container }
  | { type: "sqrt"; content: Container }
  | {
      type: "sum";
      lower: Container;
      upper: Container;
      body: Container;
    }
  | {
      type: "integral";
      lower: Container;
      upper: Container;
      body: Container;
    }
  | { type: "function"; name: string; argument: Container }
  | { type: "abs"; content: Container };

type FormulaRoot = Container;

type Cursor = {
  path: (number | string)[];
  index: number;
};

type HistoryState = {
  root: FormulaRoot;
  cursor: Cursor;
};

export default function FormulaStructureEditPage({
  formulaId,
  onNext,
  onCancel,
  draftExpression,
  draftStructureData,
}: FormulaStructureEditPageProps) {
  const existingFormula = formulaId
    ? dataStore.getFormula(formulaId)
    : null;

  const initialRoot: FormulaRoot = draftStructureData
    ? draftStructureData
    : existingFormula?.structureData
      ? existingFormula.structureData
      : {
          children:
            (draftExpression ?? existingFormula?.expression)
              ? [
                  {
                    type: "symbol",
                    value: (draftExpression ??
                      existingFormula?.expression) as string,
                  },
                ]
              : [],
        };

  const [root, setRoot] = useState<FormulaRoot>(initialRoot);
  const [cursor, setCursor] = useState<Cursor>({
    path: [],
    index: 0,
  });
  const [highlightedForDeletion, setHighlightedForDeletion] =
    useState<(number | string)[] | null>(null);
  const [history, setHistory] = useState<HistoryState[]>([
    { root: initialRoot, cursor: { path: [], index: 0 } },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  const [keyboardInset, setKeyboardInset] = useState(0);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(0);
  const bottomPanelRef = useRef<HTMLDivElement>(null);

  const focusHiddenInput = () => {
    if (isCoarsePointer) return;
    const el = hiddenInputRef.current;
    if (!el) return;
    el.focus();
  };

  useEffect(() => {
    const mq = window.matchMedia
      ? window.matchMedia("(pointer: coarse)")
      : null;
    const update = () => setIsCoarsePointer(!!mq && mq.matches);
    update();
    if (!mq) return;
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const clearHiddenInput = () => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = "";
    }
  };

  useEffect(() => {
    // Mobile uses custom keyboard only (no OS keyboard). visualViewport on mobile
    // is heavily affected by browser toolbars and can create huge false insets.
    if (isCoarsePointer) {
      setKeyboardInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop,
      );
      setKeyboardInset(inset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isCoarsePointer]);

  useEffect(() => {
    const el = bottomPanelRef.current;
    if (!el) return;
    const update = () =>
      setBottomPanelHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const saveHistory = (
    newRoot: FormulaRoot,
    newCursor: Cursor,
  ) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      root: JSON.parse(JSON.stringify(newRoot)),
      cursor: { ...newCursor },
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setRoot(JSON.parse(JSON.stringify(prevState.root)));
      setCursor({ ...prevState.cursor });
      setHistoryIndex(historyIndex - 1);
      setHighlightedForDeletion(null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setRoot(JSON.parse(JSON.stringify(nextState.root)));
      setCursor({ ...nextState.cursor });
      setHistoryIndex(historyIndex + 1);
      setHighlightedForDeletion(null);
    }
  };

  const getContainerAtPath = (
    node: FormulaRoot | FormulaNode,
    path: (number | string)[],
  ): Container | null => {
    if (path.length === 0)
      return "children" in node ? (node as Container) : null;
    const [first, ...rest] = path;
    if ("children" in node) {
      const container = node as Container;
      if (
        typeof first === "number" &&
        container.children[first]
      ) {
        return getContainerAtPath(
          container.children[first],
          rest,
        );
      }
    }
    if (typeof first === "string" && first in (node as any)) {
      const subContainer = (node as any)[first];
      if (subContainer && "children" in subContainer)
        return getContainerAtPath(subContainer, rest);
    }
    return null;
  };

  const isNumberTextCursor = (c: Cursor) =>
    c.path.length >= 2 &&
    c.path[c.path.length - 1] === "text" &&
    typeof c.path[c.path.length - 2] === "number";

  const getNumberTextContext = (
    workingRoot: FormulaRoot,
    c: Cursor,
  ): {
    parentPath: (number | string)[];
    parent: Container;
    nodeIndex: number;
    node: { type: "number"; text: string };
  } | null => {
    if (!isNumberTextCursor(c)) return null;
    const parentPath = c.path.slice(0, -2);
    const nodeIndex = c.path[c.path.length - 2] as number;
    const parent = getContainerAtPath(workingRoot, parentPath);
    if (!parent) return null;
    const node = parent.children[nodeIndex];
    if (!node || node.type !== "number") return null;
    return { parentPath, parent, nodeIndex, node };
  };

  const insertCharacter = (char: string) => {
    if (!char) return;
    for (const ch of Array.from(char)) {
      insertSmartChar(ch);
    }
  };

  const isDigit = (ch: string) =>
    ch.length === 1 && ch >= "0" && ch <= "9";

  const insertSmartChar = (ch: string) => {
    const newRoot = JSON.parse(JSON.stringify(root));

    // If the cursor is "inside" a number node (editing its text), edit the text in-place.
    const numberCtx = getNumberTextContext(newRoot, cursor);
    if (numberCtx) {
      const caret = Math.max(
        0,
        Math.min(cursor.index, numberCtx.node.text.length),
      );

      if (isDigit(ch) || ch === ".") {
        // Prevent duplicate decimal points.
        if (ch === "." && numberCtx.node.text.includes("."))
          return;

        // Auto-prepend 0 when inserting '.' at the start of a number.
        const insert = ch === "." && caret === 0 ? "0." : ch;

        const before = numberCtx.node.text.slice(0, caret);
        const after = numberCtx.node.text.slice(caret);
        numberCtx.node.text = before + insert + after;

        const newCursor: Cursor = {
          path: cursor.path,
          index: caret + insert.length,
        };
        setRoot(newRoot);
        setCursor(newCursor);
        saveHistory(newRoot, newCursor);
        setHighlightedForDeletion(null);
        return;
      }

      // Non-number character: exit the number (to the right) and insert normally.
      const exitCursor: Cursor = {
        path: numberCtx.parentPath,
        index: numberCtx.nodeIndex + 1,
      };
      // Continue insertion below using exitCursor.
      const container = getContainerAtPath(
        newRoot,
        exitCursor.path,
      );
      if (!container) return;

      container.children.splice(exitCursor.index, 0, {
        type: "symbol",
        value: ch,
      });
      const newCursor: Cursor = {
        ...exitCursor,
        index: exitCursor.index + 1,
      };
      setRoot(newRoot);
      setCursor(newCursor);
      saveHistory(newRoot, newCursor);
      setHighlightedForDeletion(null);
      return;
    }

    const container = getContainerAtPath(newRoot, cursor.path);
    if (!container) return;

    // Number merging: digits and '.' become a single number node when typed consecutively.
    if (isDigit(ch) || ch === ".") {
      const prev =
        cursor.index > 0
          ? container.children[cursor.index - 1]
          : null;
      const next =
        cursor.index < container.children.length
          ? container.children[cursor.index]
          : null;

      // If '.' is typed at start (or after a non-number), auto-prepend 0.
      if (ch === "." && (!prev || prev.type !== "number")) {
        container.children.splice(cursor.index, 0, {
          type: "number",
          text: "0.",
        });
        const newCursor = {
          ...cursor,
          index: cursor.index + 1,
        };
        setRoot(newRoot);
        setCursor(newCursor);
        saveHistory(newRoot, newCursor);
        setHighlightedForDeletion(null);
        return;
      }

      if (prev && prev.type === "number") {
        // Prevent duplicate decimal points.
        if (ch === "." && prev.text.includes(".")) {
          return;
        }
        prev.text += ch;
        const newCursor = { ...cursor, index: cursor.index };
        setRoot(newRoot);
        setCursor(newCursor);
        saveHistory(newRoot, newCursor);
        setHighlightedForDeletion(null);
        return;
      }

      // If we're at the beginning of a number node and inserting a digit, allow prepend.
      if (next && next.type === "number" && isDigit(ch)) {
        next.text = ch + next.text;
        const newCursor = {
          ...cursor,
          index: cursor.index + 1,
        };
        setRoot(newRoot);
        setCursor(newCursor);
        saveHistory(newRoot, newCursor);
        setHighlightedForDeletion(null);
        return;
      }

      container.children.splice(cursor.index, 0, {
        type: "number",
        text: ch,
      });
      const newCursor = { ...cursor, index: cursor.index + 1 };
      setRoot(newRoot);
      setCursor(newCursor);
      saveHistory(newRoot, newCursor);
      setHighlightedForDeletion(null);
      return;
    }

    container.children.splice(cursor.index, 0, {
      type: "symbol",
      value: ch,
    });
    const newCursor = { ...cursor, index: cursor.index + 1 };
    setRoot(newRoot);
    setCursor(newCursor);
    saveHistory(newRoot, newCursor);
    setHighlightedForDeletion(null);
  };

  const replacePrevAtom = (text: string): boolean => {
    if (!text) return false;
    if (cursor.index <= 0) return false;
    const newRoot = JSON.parse(JSON.stringify(root));
    const container = getContainerAtPath(newRoot, cursor.path);
    if (!container) return false;

    const prevIndex = cursor.index - 1;
    const prevNode = container.children[prevIndex];
    if (!prevNode) return false;

    // Only replace "atom" nodes (single symbol or single-digit number).
    if (prevNode.type === "symbol") {
      prevNode.value = text;
      setRoot(newRoot);
      saveHistory(newRoot, cursor);
      setHighlightedForDeletion(null);
      return true;
    }
    if (prevNode.type === "number") {
      if (prevNode.text.length !== 1) return false;
      // If replacing with a digit/dot keep number; otherwise convert to symbol.
      if (isDigit(text) || text === ".") {
        prevNode.text = text === "." ? "0." : text;
      } else {
        container.children[prevIndex] = {
          type: "symbol",
          value: text,
        };
      }
      setRoot(newRoot);
      saveHistory(newRoot, cursor);
      setHighlightedForDeletion(null);
      return true;
    }
    return false;
  };

  const insertStructure = (structureType: string) => {
    let newNode: FormulaNode;
    switch (structureType) {
      case "fraction":
        newNode = {
          type: "fraction",
          numerator: { children: [] },
          denominator: { children: [] },
        };
        break;
      case "superscript":
        newNode = {
          type: "superscript",
          base: { children: [] },
          exponent: { children: [] },
        };
        break;
      case "subscript":
        newNode = {
          type: "subscript",
          base: { children: [] },
          index: { children: [] },
        };
        break;
      case "sqrt":
        newNode = { type: "sqrt", content: { children: [] } };
        break;
      case "sum":
        newNode = {
          type: "sum",
          lower: { children: [] },
          upper: { children: [] },
          body: { children: [] },
        };
        break;
      case "integral":
        newNode = {
          type: "integral",
          lower: { children: [] },
          upper: { children: [] },
          body: { children: [] },
        };
        break;
      case "abs":
        newNode = { type: "abs", content: { children: [] } };
        break;
      default:
        return;
    }
    const newRoot = JSON.parse(JSON.stringify(root));
    const container = getContainerAtPath(newRoot, cursor.path);
    if (container) {
      container.children.splice(cursor.index, 0, newNode);
      const firstSubPath =
        getFirstSubContainerPath(structureType);
      const newCursor = firstSubPath
        ? {
            path: [...cursor.path, cursor.index, firstSubPath],
            index: 0,
          }
        : { ...cursor, index: cursor.index + 1 };
      setRoot(newRoot);
      setCursor(newCursor);
      saveHistory(newRoot, newCursor);
      setHighlightedForDeletion(null);
      requestAnimationFrame(focusHiddenInput);
    }
  };

  const getFirstSubContainerPath = (
    structureType: string,
  ): string | null => {
    switch (structureType) {
      case "fraction":
        return "numerator";
      case "superscript":
      case "subscript":
        return "base";
      case "sqrt":
      case "abs":
        return "content";
      case "function":
        return "argument";
      case "sum":
      case "integral":
        return "lower";
      default:
        return null;
    }
  };

  const deleteAtCursor = () => {
    const newRoot = JSON.parse(JSON.stringify(root));

    // If editing inside a number node, delete a single character.
    const numberCtx = getNumberTextContext(newRoot, cursor);
    if (numberCtx) {
      const caret = Math.max(
        0,
        Math.min(cursor.index, numberCtx.node.text.length),
      );
      if (caret === 0) {
        setHighlightedForDeletion(null);
        return;
      }

      const before = numberCtx.node.text.slice(0, caret - 1);
      const after = numberCtx.node.text.slice(caret);
      const nextText = before + after;

      if (nextText.length === 0) {
        // Remove the number node entirely and place cursor before it.
        numberCtx.parent.children.splice(
          numberCtx.nodeIndex,
          1,
        );
        const newCursor: Cursor = {
          path: numberCtx.parentPath,
          index: numberCtx.nodeIndex,
        };
        setRoot(newRoot);
        setCursor(newCursor);
        saveHistory(newRoot, newCursor);
        setHighlightedForDeletion(null);
        return;
      }

      numberCtx.node.text = nextText;
      const newCursor: Cursor = { ...cursor, index: caret - 1 };
      setRoot(newRoot);
      setCursor(newCursor);
      saveHistory(newRoot, newCursor);
      setHighlightedForDeletion(null);
      return;
    }

    if (cursor.index === 0 && cursor.path.length === 0) {
      setHighlightedForDeletion(null);
      return;
    }
    const container = getContainerAtPath(newRoot, cursor.path);
    if (!container) return;

    if (cursor.index > 0) {
      const prevIndex = cursor.index - 1;
      const prevNodePath = [...cursor.path, prevIndex];
      const prevNode = container.children[prevIndex];
      const isHighlighted =
        highlightedForDeletion &&
        JSON.stringify(highlightedForDeletion) ===
          JSON.stringify(prevNodePath);

      if (
        prevNode.type === "symbol" ||
        prevNode.type === "number"
      ) {
        container.children.splice(prevIndex, 1);
        const newCursor = {
          ...cursor,
          index: cursor.index - 1,
        };
        setRoot(newRoot);
        setCursor(newCursor);
        saveHistory(newRoot, newCursor);
        setHighlightedForDeletion(null);
      } else {
        if (isHighlighted) {
          container.children.splice(prevIndex, 1);
          const newCursor = {
            ...cursor,
            index: cursor.index - 1,
          };
          setRoot(newRoot);
          setCursor(newCursor);
          saveHistory(newRoot, newCursor);
          setHighlightedForDeletion(null);
        } else {
          setHighlightedForDeletion(prevNodePath);
        }
      }
    } else if (cursor.path.length > 0) {
      const lastKey = cursor.path[cursor.path.length - 1];
      if (typeof lastKey === "string") {
        const structPath = cursor.path.slice(0, -1);
        const structIndex = structPath[structPath.length - 1];
        if (typeof structIndex === "number") {
          const parentContainerPath = structPath.slice(0, -1);
          const parentContainer = getContainerAtPath(
            newRoot,
            parentContainerPath,
          );
          if (parentContainer) {
            const structNodePath = structPath;
            const isHighlighted =
              highlightedForDeletion &&
              JSON.stringify(highlightedForDeletion) ===
                JSON.stringify(structNodePath);
            if (isHighlighted) {
              parentContainer.children.splice(structIndex, 1);
              const newCursor = {
                path: parentContainerPath,
                index: structIndex,
              };
              setRoot(newRoot);
              setCursor(newCursor);
              saveHistory(newRoot, newCursor);
              setHighlightedForDeletion(null);
            } else {
              setHighlightedForDeletion(structNodePath);
            }
          }
        }
      }
    }
  };

  const moveOut = () => {
    // Exit from number-text editing back to the parent container.
    const numberCtx = getNumberTextContext(root, cursor);
    if (numberCtx) {
      setCursor({
        path: numberCtx.parentPath,
        index: numberCtx.nodeIndex + 1,
      });
      setHighlightedForDeletion(null);
      focusHiddenInput();
      return;
    }

    if (cursor.path.length === 0) return;
    const structPath = cursor.path.slice(0, -1);
    const structIndex = structPath[structPath.length - 1];
    if (typeof structIndex !== "number") return;
    setCursor({
      path: structPath.slice(0, -1),
      index: structIndex + 1,
    });
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

  const moveIn = () => {
    // If already inside a number-text edit, do nothing (numbers are "leaf" structures).
    if (isNumberTextCursor(cursor)) return;

    const container = getContainerAtPath(root, cursor.path);
    if (!container) return;
    const targetIdx =
      cursor.index > 0
        ? cursor.index - 1
        : container.children[cursor.index]
          ? cursor.index
          : -1;
    if (targetIdx === -1) return;
    const targetNode = container.children[targetIdx];

    // Allow entering a number node to edit its internal text (e.g., decimals).
    if (targetNode.type === "number") {
      setCursor({
        path: [...cursor.path, targetIdx, "text"],
        index: targetNode.text.length,
      });
      setHighlightedForDeletion(null);
      focusHiddenInput();
      return;
    }

    if (targetNode.type === "symbol") return;

    const first = getFirstSubContainerPath(targetNode.type);
    if (!first) return;
    setCursor({
      path: [...cursor.path, targetIdx, first],
      index: 0,
    });
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

  const moveLeft = () => {
    const numberCtx = getNumberTextContext(root, cursor);
    if (numberCtx) {
      if (cursor.index > 0) {
        setCursor({ ...cursor, index: cursor.index - 1 });
      } else {
        // Move to before the number node in its parent container.
        setCursor({
          path: numberCtx.parentPath,
          index: numberCtx.nodeIndex,
        });
      }
      setHighlightedForDeletion(null);
      focusHiddenInput();
      return;
    }

    if (cursor.index > 0) {
      setCursor({ ...cursor, index: cursor.index - 1 });
    } else if (cursor.path.length > 0) {
      const structPath = cursor.path.slice(0, -1);
      const structIndex = structPath[structPath.length - 1];
      if (typeof structIndex === "number")
        setCursor({
          path: structPath.slice(0, -1),
          index: structIndex,
        });
    }
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

  const moveRight = () => {
    const numberCtx = getNumberTextContext(root, cursor);
    if (numberCtx) {
      const len = numberCtx.node.text.length;
      if (cursor.index < len) {
        setCursor({ ...cursor, index: cursor.index + 1 });
      } else {
        // Move to after the number node in its parent container.
        setCursor({
          path: numberCtx.parentPath,
          index: numberCtx.nodeIndex + 1,
        });
      }
      setHighlightedForDeletion(null);
      focusHiddenInput();
      return;
    }

    const container = getContainerAtPath(root, cursor.path);
    if (container && cursor.index < container.children.length) {
      setCursor({ ...cursor, index: cursor.index + 1 });
    } else if (cursor.path.length > 0) {
      const structPath = cursor.path.slice(0, -1);
      const structIndex = structPath[structPath.length - 1];
      if (typeof structIndex === "number")
        setCursor({
          path: structPath.slice(0, -1),
          index: structIndex + 1,
        });
    }
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

  // IME / beforeinput: 最終確定文字を確実に拾う（Chrome/Safari差異対策）
  const handleHiddenBeforeInput = (
    e: React.FormEvent<HTMLTextAreaElement>,
  ) => {
    const ne = e.nativeEvent as InputEvent;
    const t = ne.inputType || "";
    // 変換中の中間文字は無視（insertCompositionText など）
    if (t === "insertCompositionText") return;

    const data = (ne as any).data as string | null | undefined;
    if (t === "insertFromComposition" && data) {
      for (const ch of Array.from(data)) insertCharacter(ch);
      requestAnimationFrame(() => {
        clearHiddenInput();
      });
    }
  };

  const handleHiddenInput = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    if (isComposingRef.current) return;

    const val = e.target.value;
    if (!val) return;

    for (const char of Array.from(val)) {
      insertCharacter(char);
    }
    clearHiddenInput();
  };

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    isComposingRef.current = false;

    const data = (e as any).data as string | undefined;
    const v = (e.currentTarget as HTMLTextAreaElement).value;
    const finalText = data && data.length > 0 ? data : v;

    if (finalText) {
      for (const ch of Array.from(finalText)) {
        insertCharacter(ch);
      }
    }

    requestAnimationFrame(() => {
      clearHiddenInput();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComposingRef.current) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      deleteAtCursor();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveLeft();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveRight();
    }
  };

  const generateExpression = (
    node: FormulaRoot | FormulaNode,
  ): string => {
    if ("children" in node && !("type" in node))
      return node.children
        .map((child) => generateExpression(child))
        .join("");
    const n = node as FormulaNode;
    switch (n.type) {
      case "symbol":
        return n.value;
      case "number":
        return n.text;
      case "fraction":
        return `(${generateExpression(n.numerator)})/(${generateExpression(n.denominator)})`;
      case "superscript":
        return `${generateExpression(n.base)}^{${generateExpression(n.exponent)}}`;
      case "subscript":
        return `${generateExpression(n.base)}_{${generateExpression(n.index)}}`;
      case "sqrt":
        return `√(${generateExpression(n.content)})`;
      case "abs":
        return `|${generateExpression(n.content)}|`;
      case "function":
        return `${n.name}(${generateExpression(n.argument)})`;
      case "sum":
        return `Σ[${generateExpression(n.lower)}→${generateExpression(n.upper)}](${generateExpression(n.body)})`;
      case "integral":
        return `∫[${generateExpression(n.lower)}→${generateExpression(n.upper)}](${generateExpression(n.body)})`;
      default:
        return "";
    }
  };

  const renderContainer = (
    container: Container,
    path: (number | string)[],
  ): JSX.Element => {
    const isCursorHere =
      JSON.stringify(cursor.path) === JSON.stringify(path);
    return (
      <div className="inline-flex items-center gap-0.5 min-h-[1.5em]">
        {container.children.length === 0 ? (
          <span
            className={`inline-block w-4 h-6 border border-dashed ${isCursorHere ? "border-primary bg-primary/10" : "border-muted-foreground/30"} rounded cursor-text`}
            onClick={(e) => {
              e.stopPropagation();
              setCursor({ path, index: 0 });
              focusHiddenInput();
            }}
          />
        ) : (
          container.children.map((child, i) => (
            <React.Fragment key={i}>
              {isCursorHere && cursor.index === i && (
                <span className="inline-block w-0.5 h-6 bg-primary animate-pulse" />
              )}
              {renderNode(child, [...path, i])}
            </React.Fragment>
          ))
        )}
        {isCursorHere &&
          cursor.index === container.children.length && (
            <span className="inline-block w-0.5 h-6 bg-primary animate-pulse" />
          )}
      </div>
    );
  };

  const renderNode = (
    node: FormulaNode,
    path: (number | string)[],
  ): JSX.Element => {
    const isHighlighted =
      highlightedForDeletion &&
      JSON.stringify(highlightedForDeletion) ===
        JSON.stringify(path);
    const highlightClass = isHighlighted
      ? "ring-2 ring-destructive bg-destructive/10"
      : "";
    const clickHandler = (e: React.MouseEvent) => {
      e.stopPropagation();
      const parentPath = path.slice(0, -1);
      const index = path[path.length - 1] as number;
      setCursor({ path: parentPath, index: index + 1 });
      setHighlightedForDeletion(null);
      focusHiddenInput();
    };

    switch (node.type) {
      case "symbol":
        return (
          <span
            className={`inline-block px-0.5 cursor-text hover:bg-muted rounded ${highlightClass}`}
            onClick={clickHandler}
          >
            {node.value}
          </span>
        );
      case "number": {
        const isEditing =
          JSON.stringify(cursor.path) ===
          JSON.stringify([...path, "text"]);
        if (!isEditing) {
          return (
            <span
              className={`inline-block px-0.5 cursor-text hover:bg-muted rounded font-mono ${highlightClass}`}
              onClick={clickHandler}
            >
              {node.text}
            </span>
          );
        }

        const caret = Math.max(
          0,
          Math.min(cursor.index, node.text.length),
        );
        const before = node.text.slice(0, caret);
        const after = node.text.slice(caret);

        return (
          <span
            className={`inline-block px-0.5 cursor-text hover:bg-muted rounded font-mono ${highlightClass}`}
            onClick={clickHandler}
          >
            <span>{before}</span>
            <span className="inline-block w-0.5 h-6 bg-primary animate-pulse align-middle" />
            <span>{after}</span>
          </span>
        );
      }
      case "fraction":
        return (
          <div
            className={`inline-flex flex-col items-center px-1 mx-1 border border-transparent rounded ${highlightClass}`}
          >
            <div className="border-b border-foreground px-1">
              {renderContainer(node.numerator, [
                ...path,
                "numerator",
              ])}
            </div>
            <div className="px-1 mt-[4px] pt-[1px]">
              {renderContainer(node.denominator, [
                ...path,
                "denominator",
              ])}
            </div>
          </div>
        );
      case "superscript":
        return (
          <div
            className={`inline-flex items-start mx-0.5 ${highlightClass}`}
          >
            <span>
              {renderContainer(node.base, [...path, "base"])}
            </span>
            <span className="text-xs scale-75 origin-top-left -mt-1">
              {renderContainer(node.exponent, [
                ...path,
                "exponent",
              ])}
            </span>
          </div>
        );
      case "subscript":
        return (
          <div
            className={`inline-flex items-end mx-0.5 ${highlightClass}`}
          >
            <span>
              {renderContainer(node.base, [...path, "base"])}
            </span>
            <span className="text-xs scale-75 origin-bottom-left -mb-1">
              {renderContainer(node.index, [...path, "index"])}
            </span>
          </div>
        );
      case "sqrt":
        return (
          <div
            className={`inline-flex items-center mx-1 border-t-2 border-foreground pt-0.5 ${highlightClass}`}
          >
            <span className="text-xl mr-0.5 -ml-1">√</span>
            {renderContainer(node.content, [
              ...path,
              "content",
            ])}
          </div>
        );
      case "abs":
        return (
          <div
            className={`inline-flex items-center mx-1 px-1 border-x border-foreground ${highlightClass}`}
          >
            {renderContainer(node.content, [
              ...path,
              "content",
            ])}
          </div>
        );
      case "function":
        return (
          <div
            className={`inline-flex items-center ${highlightClass}`}
          >
            {node.name}(
            {renderContainer(node.argument, [
              ...path,
              "argument",
            ])}
            )
          </div>
        );
      case "sum":
      case "integral":
        const Symbol = node.type === "sum" ? "Σ" : "∫";
        return (
          <div
            className={`inline-flex items-center gap-1 mx-1 ${highlightClass}`}
          >
            <div className="flex flex-col items-center text-[10px]">
              <div>
                {renderContainer(node.upper, [
                  ...path,
                  "upper",
                ])}
              </div>
              <span className="text-2xl leading-none">
                {Symbol}
              </span>
              <div>
                {renderContainer(node.lower, [
                  ...path,
                  "lower",
                ])}
              </div>
            </div>
            {renderContainer(node.body, [...path, "body"])}
          </div>
        );
      default:
        return <span>?</span>;
    }
  };

  const keyboardApi: KeyboardApi = {
    insert: insertCharacter,
    replacePrevAtom,
    backspace: deleteAtCursor,
    moveLeft,
    moveRight,
    enterStructure: moveIn,
    exitStructure: moveOut,
    insertStructure,
  };

  return (
    <div className="min-h-screen h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      <textarea
        ref={hiddenInputRef}
        className="fixed opacity-0 pointer-events-none"
        inputMode={isCoarsePointer ? "none" : "text"}
        onBeforeInput={handleHiddenBeforeInput as any}
        onInput={handleHiddenInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() =>
          (isComposingRef.current = true)
        }
        onCompositionEnd={handleCompositionEnd}
        autoFocus={!isCoarsePointer}
      />

      <header className="h-14 flex items-center justify-between px-4 border-b shrink-0">
        <button onClick={onCancel} className="p-2">
          <ChevronLeft />
        </button>
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={historyIndex === 0}
            className="p-2 disabled:opacity-30"
          >
            <Undo />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            className="p-2 disabled:opacity-30"
          >
            <Redo />
          </button>
        </div>
        <button
          onClick={() => onNext(generateExpression(root), root)}
          className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg flex items-center gap-1"
        >
          完成 <ChevronRight size={16} />
        </button>
      </header>

      <main
        className="flex-1 overflow-auto p-8 flex justify-center items-start"
        onClick={() => focusHiddenInput()}
      >
        <div className="text-4xl">
          {renderContainer(root, [])}
        </div>
      </main>

      <footer
        ref={bottomPanelRef}
        className="w-full bg-card border-t safe-area-bottom shrink-0 z-50"
        style={{ marginBottom: keyboardInset }}
      >
        <FormulaKeyboard api={keyboardApi} />
      </footer>
    </div>
  );
}
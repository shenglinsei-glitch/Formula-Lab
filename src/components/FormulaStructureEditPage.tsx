import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Undo, Redo } from 'lucide-react';
import { dataStore } from '../store/dataStore';

interface FormulaStructureEditPageProps {
  formulaId: string | null;
  onNext: (expression: string, structureData?: any) => void;
  onCancel: () => void;
}

type Container = {
  children: FormulaNode[];
};

type FormulaNode =
  | { type: 'symbol'; value: string }
  | { type: 'fraction'; numerator: Container; denominator: Container }
  | { type: 'superscript'; base: Container; exponent: Container }
  | { type: 'subscript'; base: Container; index: Container }
  | { type: 'sqrt'; content: Container }
  | { type: 'sum'; lower: Container; upper: Container; body: Container }
  | { type: 'integral'; lower: Container; upper: Container; body: Container }
  | { type: 'function'; name: string; argument: Container }
  | { type: 'abs'; content: Container };

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
}: FormulaStructureEditPageProps) {
  const existingFormula = formulaId ? dataStore.getFormula(formulaId) : null;

  const initialRoot: FormulaRoot = existingFormula?.structureData
    ? existingFormula.structureData
    : {
        children: existingFormula?.expression
          ? [{ type: 'symbol', value: existingFormula.expression }]
          : [],
      };

  const [root, setRoot] = useState<FormulaRoot>(initialRoot);
  const [cursor, setCursor] = useState<Cursor>({ path: [], index: 0 });
  const [highlightedForDeletion, setHighlightedForDeletion] = useState<(number | string)[] | null>(null);
  const [history, setHistory] = useState<HistoryState[]>([{ root: initialRoot, cursor: { path: [], index: 0 } }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  const [keyboardInset, setKeyboardInset] = useState(0);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(0);
  const bottomPanelRef = useRef<HTMLDivElement>(null);

  const focusHiddenInput = () => {
    const el = hiddenInputRef.current;
    if (!el) return;
    el.focus();
  };

  const clearHiddenInput = () => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    const el = bottomPanelRef.current;
    if (!el) return;
    const update = () => setBottomPanelHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const saveHistory = (newRoot: FormulaRoot, newCursor: Cursor) => {
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

  const getContainerAtPath = (node: FormulaRoot | FormulaNode, path: (number | string)[]): Container | null => {
    if (path.length === 0) return 'children' in node ? (node as Container) : null;
    const [first, ...rest] = path;
    if ('children' in node) {
      const container = node as Container;
      if (typeof first === 'number' && container.children[first]) {
        return getContainerAtPath(container.children[first], rest);
      }
    }
    if (typeof first === 'string' && first in (node as any)) {
      const subContainer = (node as any)[first];
      if (subContainer && 'children' in subContainer) return getContainerAtPath(subContainer, rest);
    }
    return null;
  };

  const insertCharacter = (char: string) => {
    if (!char) return;
    const newRoot = JSON.parse(JSON.stringify(root));
    const container = getContainerAtPath(newRoot, cursor.path);
    if (!container) return;

    container.children.splice(cursor.index, 0, { type: 'symbol', value: char });
    const newCursor = { ...cursor, index: cursor.index + 1 };
    setRoot(newRoot);
    setCursor(newCursor);
    saveHistory(newRoot, newCursor);
    setHighlightedForDeletion(null);
  };

  const insertStructure = (structureType: string) => {
    let newNode: FormulaNode;
    switch (structureType) {
      case 'fraction': newNode = { type: 'fraction', numerator: { children: [] }, denominator: { children: [] } }; break;
      case 'superscript': newNode = { type: 'superscript', base: { children: [] }, exponent: { children: [] } }; break;
      case 'subscript': newNode = { type: 'subscript', base: { children: [] }, index: { children: [] } }; break;
      case 'sqrt': newNode = { type: 'sqrt', content: { children: [] } }; break;
      case 'sum': newNode = { type: 'sum', lower: { children: [] }, upper: { children: [] }, body: { children: [] } }; break;
      case 'integral': newNode = { type: 'integral', lower: { children: [] }, upper: { children: [] }, body: { children: [] } }; break;
      case 'abs': newNode = { type: 'abs', content: { children: [] } }; break;
      default: return;
    }
    const newRoot = JSON.parse(JSON.stringify(root));
    const container = getContainerAtPath(newRoot, cursor.path);
    if (container) {
      container.children.splice(cursor.index, 0, newNode);
      const firstSubPath = getFirstSubContainerPath(structureType);
      const newCursor = firstSubPath ? { path: [...cursor.path, cursor.index, firstSubPath], index: 0 } : { ...cursor, index: cursor.index + 1 };
      setRoot(newRoot);
      setCursor(newCursor);
      saveHistory(newRoot, newCursor);
      setHighlightedForDeletion(null);
    }
  };

  const insertFunction = (functionName: string) => {
    const newNode: FormulaNode = { type: 'function', name: functionName, argument: { children: [] } };
    const newRoot = JSON.parse(JSON.stringify(root));
    const container = getContainerAtPath(newRoot, cursor.path);
    if (container) {
      container.children.splice(cursor.index, 0, newNode);
      const newCursor = { path: [...cursor.path, cursor.index, 'argument'], index: 0 };
      setRoot(newRoot);
      setCursor(newCursor);
      saveHistory(newRoot, newCursor);
      setHighlightedForDeletion(null);
    }
  };

  const getFirstSubContainerPath = (structureType: string): string | null => {
    switch (structureType) {
      case 'fraction': return 'numerator';
      case 'superscript': case 'subscript': return 'base';
      case 'sqrt': case 'abs': return 'content';
      case 'function': return 'argument';
      case 'sum': case 'integral': return 'lower';
      default: return null;
    }
  };

  const deleteAtCursor = () => {
    if (cursor.index === 0 && cursor.path.length === 0) {
      setHighlightedForDeletion(null);
      return;
    }
    const newRoot = JSON.parse(JSON.stringify(root));
    const container = getContainerAtPath(newRoot, cursor.path);
    if (!container) return;

    if (cursor.index > 0) {
      const prevIndex = cursor.index - 1;
      const prevNodePath = [...cursor.path, prevIndex];
      const prevNode = container.children[prevIndex];
      const isHighlighted = highlightedForDeletion && JSON.stringify(highlightedForDeletion) === JSON.stringify(prevNodePath);

      if (prevNode.type === 'symbol') {
        container.children.splice(prevIndex, 1);
        const newCursor = { ...cursor, index: cursor.index - 1 };
        setRoot(newRoot);
        setCursor(newCursor);
        saveHistory(newRoot, newCursor);
        setHighlightedForDeletion(null);
      } else {
        if (isHighlighted) {
          container.children.splice(prevIndex, 1);
          const newCursor = { ...cursor, index: cursor.index - 1 };
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
      if (typeof lastKey === 'string') {
        const structPath = cursor.path.slice(0, -1);
        const structIndex = structPath[structPath.length - 1];
        if (typeof structIndex === 'number') {
          const parentContainerPath = structPath.slice(0, -1);
          const parentContainer = getContainerAtPath(newRoot, parentContainerPath);
          if (parentContainer) {
            const structNodePath = structPath;
            const isHighlighted = highlightedForDeletion && JSON.stringify(highlightedForDeletion) === JSON.stringify(structNodePath);
            if (isHighlighted) {
              parentContainer.children.splice(structIndex, 1);
              const newCursor = { path: parentContainerPath, index: structIndex };
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
    if (cursor.path.length === 0) return;
    const structPath = cursor.path.slice(0, -1);
    const structIndex = structPath[structPath.length - 1];
    if (typeof structIndex !== 'number') return;
    setCursor({ path: structPath.slice(0, -1), index: structIndex + 1 });
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

  const moveIn = () => {
    const container = getContainerAtPath(root, cursor.path);
    if (!container) return;
    const targetIdx = container.children[cursor.index] ? cursor.index : (cursor.index > 0 ? cursor.index - 1 : -1);
    if (targetIdx === -1) return;
    const targetNode = container.children[targetIdx];
    if (targetNode.type === 'symbol') return;
    const first = getFirstSubContainerPath(targetNode.type);
    if (!first) return;
    setCursor({ path: [...cursor.path, targetIdx, first], index: 0 });
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

  const moveLeft = () => {
    if (cursor.index > 0) {
      setCursor({ ...cursor, index: cursor.index - 1 });
    } else if (cursor.path.length > 0) {
      const structPath = cursor.path.slice(0, -1);
      const structIndex = structPath[structPath.length - 1];
      if (typeof structIndex === 'number') setCursor({ path: structPath.slice(0, -1), index: structIndex });
    }
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

  const moveRight = () => {
    const container = getContainerAtPath(root, cursor.path);
    if (container && cursor.index < container.children.length) {
      setCursor({ ...cursor, index: cursor.index + 1 });
    } else if (cursor.path.length > 0) {
      const structPath = cursor.path.slice(0, -1);
      const structIndex = structPath[structPath.length - 1];
      if (typeof structIndex === 'number') setCursor({ path: structPath.slice(0, -1), index: structIndex + 1 });
    }
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };


  // IME / beforeinput: 最終確定文字を確実に拾う（Chrome/Safari差異対策）
  const handleHiddenBeforeInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const ne = (e.nativeEvent as InputEvent);
    const t = ne.inputType || '';
    // 変換中の中間文字は無視（insertCompositionText など）
    if (t === 'insertCompositionText') return;

    const data = (ne as any).data as string | null | undefined;
    if (t === 'insertFromComposition' && data) {
      for (const ch of Array.from(data)) insertCharacter(ch);
      requestAnimationFrame(() => {
        clearHiddenInput();
      });
    }
  };

  const handleHiddenInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current) return;

    const val = e.target.value;
    if (!val) return;

    for (const char of Array.from(val)) {
      insertCharacter(char);
    }
    clearHiddenInput();
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;

    const data = (e as any).data as string | undefined;
    const v = (e.currentTarget as HTMLTextAreaElement).value;
    const finalText = (data && data.length > 0) ? data : v;

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
    if (e.key === 'Backspace') {
      e.preventDefault();
      deleteAtCursor();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveLeft();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveRight();
    }
  };

  const generateExpression = (node: FormulaRoot | FormulaNode): string => {
    if ('children' in node && !('type' in node)) return node.children.map((child) => generateExpression(child)).join('');
    const n = node as FormulaNode;
    switch (n.type) {
      case 'symbol': return n.value;
      case 'fraction': return `(${generateExpression(n.numerator)})/(${generateExpression(n.denominator)})`;
      case 'superscript': return `${generateExpression(n.base)}^{${generateExpression(n.exponent)}}`;
      case 'subscript': return `${generateExpression(n.base)}_{${generateExpression(n.index)}}`;
      case 'sqrt': return `√(${generateExpression(n.content)})`;
      case 'abs': return `|${generateExpression(n.content)}|`;
      case 'function': return `${n.name}(${generateExpression(n.argument)})`;
      case 'sum': return `Σ[${generateExpression(n.lower)}→${generateExpression(n.upper)}](${generateExpression(n.body)})`;
      case 'integral': return `∫[${generateExpression(n.lower)}→${generateExpression(n.upper)}](${generateExpression(n.body)})`;
      default: return '';
    }
  };

  const renderContainer = (container: Container, path: (number | string)[]): JSX.Element => {
    const isCursorHere = JSON.stringify(cursor.path) === JSON.stringify(path);
    return (
      <div className="inline-flex items-center gap-0.5 min-h-[1.5em]">
        {container.children.length === 0 ? (
          <span
            className={`inline-block w-4 h-6 border border-dashed ${isCursorHere ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'} rounded cursor-text`}
            onClick={(e) => { e.stopPropagation(); setCursor({ path, index: 0 }); focusHiddenInput(); }}
          />
        ) : (
          container.children.map((child, i) => (
            <React.Fragment key={i}>
              {isCursorHere && cursor.index === i && <span className="inline-block w-0.5 h-6 bg-primary animate-pulse" />}
              {renderNode(child, [...path, i])}
            </React.Fragment>
          ))
        )}
        {isCursorHere && cursor.index === container.children.length && <span className="inline-block w-0.5 h-6 bg-primary animate-pulse" />}
      </div>
    );
  };

  const renderNode = (node: FormulaNode, path: (number | string)[]): JSX.Element => {
    const isHighlighted = highlightedForDeletion && JSON.stringify(highlightedForDeletion) === JSON.stringify(path);
    const highlightClass = isHighlighted ? 'ring-2 ring-destructive bg-destructive/10' : '';
    const clickHandler = (e: React.MouseEvent) => {
      e.stopPropagation();
      const parentPath = path.slice(0, -1);
      const index = path[path.length - 1] as number;
      setCursor({ path: parentPath, index: index + 1 });
      setHighlightedForDeletion(null);
      focusHiddenInput();
    };

    switch (node.type) {
      case 'symbol':
        return <span className={`inline-block px-0.5 cursor-text hover:bg-muted rounded ${highlightClass}`} onClick={clickHandler}>{node.value}</span>;
      case 'fraction':
        return (
          <div className={`inline-flex flex-col items-center px-1 mx-1 border border-transparent rounded ${highlightClass}`}>
            <div className="border-b border-foreground px-1">{renderContainer(node.numerator, [...path, 'numerator'])}</div>
            <div className="px-1">{renderContainer(node.denominator, [...path, 'denominator'])}</div>
          </div>
        );
      case 'superscript':
        return (
          <div className={`inline-flex items-start mx-0.5 ${highlightClass}`}>
            <span>{renderContainer(node.base, [...path, 'base'])}</span>
            <span className="text-xs scale-75 origin-top-left -mt-1">{renderContainer(node.exponent, [...path, 'exponent'])}</span>
          </div>
        );
      case 'subscript':
        return (
          <div className={`inline-flex items-end mx-0.5 ${highlightClass}`}>
            <span>{renderContainer(node.base, [...path, 'base'])}</span>
            <span className="text-xs scale-75 origin-bottom-left -mb-1">{renderContainer(node.index, [...path, 'index'])}</span>
          </div>
        );
      case 'sqrt':
        return (
          <div className={`inline-flex items-center mx-1 border-t-2 border-foreground pt-0.5 ${highlightClass}`}>
            <span className="text-xl mr-0.5 -ml-1">√</span>
            {renderContainer(node.content, [...path, 'content'])}
          </div>
        );
      case 'abs':
        return <div className={`inline-flex items-center mx-1 px-1 border-x border-foreground ${highlightClass}`}>{renderContainer(node.content, [...path, 'content'])}</div>;
      case 'function':
        return <div className={`inline-flex items-center ${highlightClass}`}>{node.name}({renderContainer(node.argument, [...path, 'argument'])})</div>;
      case 'sum':
      case 'integral':
        const Symbol = node.type === 'sum' ? 'Σ' : '∫';
        return (
          <div className={`inline-flex items-center gap-1 mx-1 ${highlightClass}`}>
            <div className="flex flex-col items-center text-[10px]">
              <div>{renderContainer(node.upper, [...path, 'upper'])}</div>
              <span className="text-2xl leading-none">{Symbol}</span>
              <div>{renderContainer(node.lower, [...path, 'lower'])}</div>
            </div>
            {renderContainer(node.body, [...path, 'body'])}
          </div>
        );
      default: return <span>?</span>;
    }
  };

  const symbols = ['=', '+', '−', '×', '÷', '·', '(', ')', '[', ']', '≠', '≤', '≥', '±', '≈', '∝', '→', '∞', '°', 'π'];
  const structures = [
    { label: 'ᵃ⁄ᵦ', type: 'fraction' }, { label: 'x²', type: 'superscript' }, { label: 'xₐ', type: 'subscript' },
    { label: '√', type: 'sqrt' }, { label: 'Σ', type: 'sum' }, { label: '∫', type: 'integral' }, { label: '|x|', type: 'abs' }
  ];
  const funcs = ['sin', 'cos', 'tan', 'log', 'ln', 'exp'];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <textarea
        ref={hiddenInputRef}
        className="fixed opacity-0 pointer-events-none"
        onBeforeInput={handleHiddenBeforeInput as any}
        onInput={handleHiddenInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => (isComposingRef.current = true)}
        onCompositionEnd={handleCompositionEnd}
        autoFocus
      />

      <header className="h-14 flex items-center justify-between px-4 border-b shrink-0">
        <button onClick={onCancel} className="p-2"><ChevronLeft /></button>
        <div className="flex gap-2">
          <button onClick={undo} disabled={historyIndex === 0} className="p-2 disabled:opacity-30"><Undo /></button>
          <button onClick={redo} disabled={historyIndex === history.length - 1} className="p-2 disabled:opacity-30"><Redo /></button>
        </div>
        <button onClick={() => onNext(generateExpression(root), root)} className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg flex items-center gap-1">
          完成 <ChevronRight size={16} />
        </button>
      </header>

      <main className="flex-1 overflow-auto p-8 flex justify-center items-start" 
            onClick={() => focusHiddenInput()}
            style={{ paddingBottom: bottomPanelHeight + keyboardInset + 20 }}>
        <div className="text-4xl">{renderContainer(root, [])}</div>
      </main>

      <footer ref={bottomPanelRef} 
              className="fixed bottom-0 left-0 w-full bg-card border-t safe-area-bottom shrink-0 z-50"
              style={{ transform: `translateY(-${keyboardInset}px)` }}>
        <div className="overflow-x-auto flex gap-2 p-2 border-b">
          {structures.map(s => (
            <button key={s.type} onClick={() => insertStructure(s.type)} className="shrink-0 px-4 py-2 bg-muted rounded-md">{s.label}</button>
          ))}
          {funcs.map(f => (
            <button key={f} onClick={() => insertFunction(f)} className="shrink-0 px-4 py-2 bg-muted rounded-md">{f}</button>
          ))}
        </div>
        <div className="flex p-2 gap-2">
          <div className="grid grid-cols-2 gap-1 shrink-0">
            <button onClick={moveLeft} className="p-2 bg-muted rounded">←</button>
            <button onClick={moveRight} className="p-2 bg-muted rounded">→</button>
            <button onClick={moveIn} className="p-2 bg-muted rounded text-xs">中</button>
            <button onClick={moveOut} className="p-2 bg-muted rounded text-xs">外</button>
          </div>
          <div className="flex-1 overflow-x-auto flex gap-1 items-center">
            {symbols.map(s => (
              <button key={s} onClick={() => insertCharacter(s)} className="shrink-0 w-10 h-10 bg-muted rounded flex items-center justify-center">{s}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
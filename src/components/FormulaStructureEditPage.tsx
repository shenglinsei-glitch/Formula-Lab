import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Undo, Redo } from 'lucide-react';
import { dataStore } from '../store/dataStore';

interface FormulaStructureEditPageProps {
  formulaId: string | null;
  onNext: (expression: string, structureData?: any) => void;
  onCancel: () => void;
}

// 容器类型：所有可以包含子节点的结构
type Container = {
  children: FormulaNode[];
};

// 节点类型定义：所有结构内部都是 children 数组
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

// 公式根节点
type FormulaRoot = Container;

// 光标：指向某个容器的 children 数组中的位置
type Cursor = {
  path: (number | string)[]; // 到达容器的路径
  index: number; // 在 children 数组中的插入位置
};

// 编辑历史记录
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

  // 初始化公式树 - 优先使用structureData，否则从expression创建简单节点
  const initialRoot: FormulaRoot = existingFormula?.structureData
    ? existingFormula.structureData
    : {
        children: existingFormula?.expression
          ? [{ type: 'symbol', value: existingFormula.expression }]
          : [],
      };

  const [root, setRoot] = useState<FormulaRoot>(initialRoot);

  // 光标位置
  const [cursor, setCursor] = useState<Cursor>({
    path: [], // 根容器
    index: 0,
  });

  // 高亮的待删除结构路径
  const [highlightedForDeletion, setHighlightedForDeletion] = useState<
    (number | string)[] | null
  >(null);

  // Undo/Redo 历史
  const [history, setHistory] = useState<HistoryState[]>([
    { root: initialRoot, cursor: { path: [], index: 0 } },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);

  /**
   * iOS Safari/PWA 软键盘兼容：
   * 这个编辑器是“自绘光标 + 自定义节点树”，本身没有真实 input。
   * iOS 不会为 div 弹出系统键盘，因此我们用一个隐藏 textarea 来“召唤键盘”
   * 并把用户输入同步到 insertCharacter/deleteAtCursor 等逻辑。
   */
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  // iOS キーボード回避（VisualViewport でキーボードの被り量を取得）
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(0);
  const bottomPanelRef = useRef<HTMLDivElement>(null);

  const focusHiddenInput = () => {
    // 必须在用户手势（click/touch）回调内调用才会弹键盘
    // iOS 上偶尔需要先 blur 再 focus 才稳定
    const el = hiddenInputRef.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true } as any);
    } catch {
      try {
        el.focus();
      } catch {
        // ignore
      }
    }
  };

  const clearHiddenInput = () => {
    const el = hiddenInputRef.current;
    if (!el) return;
    el.value = '';
  };


  // キーボードの高さ（被り）を監視
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // innerHeight と visualViewport.height の差分が概ねキーボード高さ
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // 下部パネル高さを取得（エディタの padding に反映）
  useEffect(() => {
    const el = bottomPanelRef.current;
    if (!el) return;

    const update = () => setBottomPanelHeight(el.getBoundingClientRect().height);

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // 保存历史记录
  const saveHistory = (newRoot: FormulaRoot, newCursor: Cursor) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      root: JSON.parse(JSON.stringify(newRoot)),
      cursor: { ...newCursor },
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo
  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setRoot(JSON.parse(JSON.stringify(prevState.root)));
      setCursor({ ...prevState.cursor });
      setHistoryIndex(historyIndex - 1);
      setHighlightedForDeletion(null);
    }
  };

  // Redo
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setRoot(JSON.parse(JSON.stringify(nextState.root)));
      setCursor({ ...nextState.cursor });
      setHistoryIndex(historyIndex + 1);
      setHighlightedForDeletion(null);
    }
  };

  // 获取容器
  const getContainerAtPath = (
    node: FormulaRoot | FormulaNode,
    path: (number | string)[]
  ): Container | null => {
    if (path.length === 0) {
      if ('children' in node) {
        return node as Container;
      }
      return null;
    }

    const [first, ...rest] = path;

    if ('children' in node) {
      const container = node as Container;
      if (typeof first === 'number' && container.children[first]) {
        return getContainerAtPath(container.children[first], rest);
      }
    }

    if (typeof first === 'string' && first in (node as any)) {
      const subContainer = (node as any)[first];
      if (subContainer && 'children' in subContainer) {
        return getContainerAtPath(subContainer, rest);
      }
    }

    return null;
  };

  // 在光标位置插入节点
  const insertNodeAtCursor = (newNode: FormulaNode) => {
    const newRoot = JSON.parse(JSON.stringify(root));
    const container = getContainerAtPath(newRoot, cursor.path);

    if (container) {
      container.children.splice(cursor.index, 0, newNode);
      const newCursor = { ...cursor, index: cursor.index + 1 };
      setRoot(newRoot);
      setCursor(newCursor);
      saveHistory(newRoot, newCursor);
      setHighlightedForDeletion(null);
    }
  };

  // 在光标位置插入字符
  const insertCharacter = (char: string) => {
    const newRoot = JSON.parse(JSON.stringify(root));
    const container = getContainerAtPath(newRoot, cursor.path);

    if (!container) return;

    // 【修正】每个字符都创建独立的 symbol 节点，不再追加
    // 这样学习页才能按最小单元遮挡
    container.children.splice(cursor.index, 0, { type: 'symbol', value: char });
    const newCursor = { ...cursor, index: cursor.index + 1 };

    setRoot(newRoot);
    setCursor(newCursor);
    saveHistory(newRoot, newCursor);
    setHighlightedForDeletion(null);
  };

  // 插入结构
  const insertStructure = (structureType: string) => {
    let newNode: FormulaNode;

    switch (structureType) {
      case 'fraction':
        newNode = {
          type: 'fraction',
          numerator: { children: [] },
          denominator: { children: [] },
        };
        break;
      case 'superscript':
        newNode = {
          type: 'superscript',
          base: { children: [] },
          exponent: { children: [] },
        };
        break;
      case 'subscript':
        newNode = {
          type: 'subscript',
          base: { children: [] },
          index: { children: [] },
        };
        break;
      case 'sqrt':
        newNode = {
          type: 'sqrt',
          content: { children: [] },
        };
        break;
      case 'sum':
        newNode = {
          type: 'sum',
          lower: { children: [] },
          upper: { children: [] },
          body: { children: [] },
        };
        break;
      case 'integral':
        newNode = {
          type: 'integral',
          lower: { children: [] },
          upper: { children: [] },
          body: { children: [] },
        };
        break;
      case 'abs':
        newNode = {
          type: 'abs',
          content: { children: [] },
        };
        break;
      default:
        return;
    }

    const newRoot = JSON.parse(JSON.stringify(root));
    const container = getContainerAtPath(newRoot, cursor.path);

    if (container) {
      container.children.splice(cursor.index, 0, newNode);

      // 插入结构后，自动进入第一个子容器
      const firstSubPath = getFirstSubContainerPath(structureType);
      const newCursor = firstSubPath
        ? { path: [...cursor.path, cursor.index, firstSubPath], index: 0 }
        : { ...cursor, index: cursor.index + 1 };

      setRoot(newRoot);
      setCursor(newCursor);
      saveHistory(newRoot, newCursor);
      setHighlightedForDeletion(null);
    }
  };

  // 插入函数模板
  const insertFunction = (functionName: string) => {
    const newNode: FormulaNode = {
      type: 'function',
      name: functionName,
      argument: { children: [] },
    };

    const newRoot = JSON.parse(JSON.stringify(root));
    const container = getContainerAtPath(newRoot, cursor.path);

    if (container) {
      container.children.splice(cursor.index, 0, newNode);

      // 插入函数后，自动进入参数容器
      const newCursor = { path: [...cursor.path, cursor.index, 'argument'], index: 0 };

      setRoot(newRoot);
      setCursor(newCursor);
      saveHistory(newRoot, newCursor);
      setHighlightedForDeletion(null);
    }
  };

  // 获取结构的第一个子容器路径
  const getFirstSubContainerPath = (structureType: string): string | null => {
    switch (structureType) {
      case 'fraction':
        return 'numerator';
      case 'superscript':
      case 'subscript':
        return 'base';
      case 'sqrt':
      case 'abs':
        return 'content';
      case 'function':
        return 'argument';
      case 'sum':
      case 'integral':
        return 'lower';
      default:
        return null;
    }
  };

  // 删除光标前的节点（两段式删除）
  const deleteAtCursor = () => {
    if (cursor.index === 0 && cursor.path.length === 0) {
      // 在根容器开头，无法删除
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

      // 检查是否已经高亮了这个节点
      const isHighlighted =
        highlightedForDeletion &&
        JSON.stringify(highlightedForDeletion) === JSON.stringify(prevNodePath);

      if (prevNode.type === 'symbol') {
        // Symbol 节点：直接删除字符或整个节点
        if (prevNode.value.length > 1) {
          prevNode.value = prevNode.value.slice(0, -1);
          setRoot(newRoot);
          saveHistory(newRoot, cursor);
          setHighlightedForDeletion(null);
        } else {
          // 只有一个字符，删除整个节点
          container.children.splice(prevIndex, 1);
          const newCursor = { ...cursor, index: cursor.index - 1 };
          setRoot(newRoot);
          setCursor(newCursor);
          saveHistory(newRoot, newCursor);
          setHighlightedForDeletion(null);
        }
      } else {
        // 结构节点：两段式删除
        if (isHighlighted) {
          // 第二次 Backspace：真正删除
          container.children.splice(prevIndex, 1);
          const newCursor = { ...cursor, index: cursor.index - 1 };
          setRoot(newRoot);
          setCursor(newCursor);
          saveHistory(newRoot, newCursor);
          setHighlightedForDeletion(null);
        } else {
          // 第一次 Backspace：仅高亮
          setHighlightedForDeletion(prevNodePath);
        }
      }
    } else if (cursor.path.length > 0) {
      // 在子容器开头
      const container = getContainerAtPath(newRoot, cursor.path);

      if (container && container.children.length === 0) {
        // 当前容器为空，尝试删除包含它的结构节点
        const lastKey = cursor.path[cursor.path.length - 1];

        if (typeof lastKey === 'string') {
          // 这是一个结构属性
          const structPath = cursor.path.slice(0, -1);
          const structIndex = structPath[structPath.length - 1];

          if (typeof structIndex === 'number') {
            const parentContainerPath = structPath.slice(0, -1);
            const structNodePath = structPath;

            const parentContainer = getContainerAtPath(newRoot, parentContainerPath);
            if (parentContainer) {
              const structNode = parentContainer.children[structIndex];

              // 检查结构的所有子容器是否都为空
              if (isStructureEmpty(structNode)) {
                // 检查是否已经高亮了这个结构
                const isHighlighted =
                  highlightedForDeletion &&
                  JSON.stringify(highlightedForDeletion) === JSON.stringify(structNodePath);

                if (isHighlighted) {
                  // 第二次 Backspace：真正删除
                  parentContainer.children.splice(structIndex, 1);
                  const newCursor = { path: parentContainerPath, index: structIndex };
                  setRoot(newRoot);
                  setCursor(newCursor);
                  saveHistory(newRoot, newCursor);
                  setHighlightedForDeletion(null);
                } else {
                  // 第一次 Backspace：仅高亮
                  setHighlightedForDeletion(structNodePath);
                }
              }
            }
          }
        }
      }
    }
  };

  // 检查结构节点是否为空
  const isStructureEmpty = (node: FormulaNode): boolean => {
    if (node.type === 'symbol') return false;

    const containers = getSubContainers(node);
    return containers.every((c) => c.children.length === 0);
  };

  // 获取节点的所有子容器
  const getSubContainers = (node: FormulaNode): Container[] => {
    switch (node.type) {
      case 'fraction':
        return [node.numerator, node.denominator];
      case 'superscript':
        return [node.base, node.exponent];
      case 'subscript':
        return [node.base, node.index];
      case 'sqrt':
      case 'abs':
        return [node.content];
      case 'function':
        return [node.argument];
      case 'sum':
      case 'integral':
        return [node.lower, node.upper, node.body];
      default:
        return [];
    }
  };

  // 移动光标到下一个容器（退出子结构）
  const moveToNextContainer = () => {
    if (cursor.path.length === 0) {
      return;
    }

    const lastKey = cursor.path[cursor.path.length - 1];

    if (typeof lastKey === 'string') {
      const structPath = cursor.path.slice(0, -1);
      const structIndex = structPath[structPath.length - 1];

      if (typeof structIndex === 'number') {
        const parentContainer = getContainerAtPath(root, structPath.slice(0, -1));
        if (parentContainer) {
          const structNode = parentContainer.children[structIndex];
          const nextPath = getNextSubContainerPath(structNode, lastKey);

          if (nextPath) {
            setCursor({ path: [...structPath, nextPath], index: 0 });
          } else {
            setCursor({ path: structPath.slice(0, -1), index: structIndex + 1 });
          }
          setHighlightedForDeletion(null);
        }
      }
    }
  };

  // 获取下一个子容器路径
  const getNextSubContainerPath = (node: FormulaNode, currentPath: string): string | null => {
    const sequences: Record<string, string[]> = {
      fraction: ['numerator', 'denominator'],
      superscript: ['base', 'exponent'],
      subscript: ['base', 'index'],
      sqrt: ['content'],
      abs: ['content'],
      function: ['argument'],
      sum: ['lower', 'upper', 'body'],
      integral: ['lower', 'upper', 'body'],
    };

    const sequence = sequences[node.type];
    if (!sequence) return null;

    const currentIndex = sequence.indexOf(currentPath);
    if (currentIndex >= 0 && currentIndex < sequence.length - 1) {
      return sequence[currentIndex + 1];
    }

    return null;
  };

  
  // モバイル用：外へ（現在の子コンテナから外側へ出る）
  const moveOut = () => {
    if (cursor.path.length === 0) return;
    const lastKey = cursor.path[cursor.path.length - 1];
    if (typeof lastKey !== 'string') return;

    const structPath = cursor.path.slice(0, -1); // ... , structIndex
    const structIndex = structPath[structPath.length - 1];
    if (typeof structIndex !== 'number') return;

    const parentContainerPath = structPath.slice(0, -1);
    setCursor({ path: parentContainerPath, index: structIndex + 1 });
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

  // モバイル用：中へ（近くの構造へ入る：カーソル位置のノード、なければ直前ノード）
  const moveIn = () => {
    const container = getContainerAtPath(root, cursor.path);
    if (!container) return;

    const candidates: { node: FormulaNode; idx: number }[] = [];
    if (container.children[cursor.index] && container.children[cursor.index].type !== 'symbol') {
      candidates.push({ node: container.children[cursor.index], idx: cursor.index });
    }
    if (
      cursor.index > 0 &&
      container.children[cursor.index - 1] &&
      container.children[cursor.index - 1].type !== 'symbol'
    ) {
      candidates.push({ node: container.children[cursor.index - 1], idx: cursor.index - 1 });
    }

    const target = candidates[0];
    if (!target) return;

    const first = getFirstSubContainerPathForNode(target.node);
    if (!first) return;

    setCursor({ path: [...cursor.path, target.idx, first], index: 0 });
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

  const getFirstSubContainerPathForNode = (node: FormulaNode): string | null => {
    switch (node.type) {
      case 'fraction':
        return 'numerator';
      case 'superscript':
        return 'base';
      case 'subscript':
        return 'base';
      case 'sqrt':
      case 'abs':
        return 'content';
      case 'function':
        return 'argument';
      case 'sum':
      case 'integral':
        return 'lower';
      default:
        return null;
    }
  };

  const moveLeft = () => {
    const container = getContainerAtPath(root, cursor.path);
    if (!container) return;

    // 通常：同じコンテナ内で左へ
    if (cursor.index > 0) {
      setCursor({ ...cursor, index: cursor.index - 1 });
      setHighlightedForDeletion(null);
      focusHiddenInput();
      return;
    }

    // 先頭で左：外側（親コンテナ）へ戻って、構造ノードの「手前」に移動
    if (cursor.path.length === 0) return;

    const lastKey = cursor.path[cursor.path.length - 1];
    if (typeof lastKey !== 'string') return;

    const structPath = cursor.path.slice(0, -1); // ... , structIndex
    const structIndex = structPath[structPath.length - 1];
    if (typeof structIndex !== 'number') return;

    const parentContainerPath = structPath.slice(0, -1);
    setCursor({ path: parentContainerPath, index: structIndex });
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

  const moveRight = () => {
    const container = getContainerAtPath(root, cursor.path);
    if (!container) return;

    // 通常：同じコンテナ内で右へ
    if (cursor.index < container.children.length) {
      setCursor({ ...cursor, index: cursor.index + 1 });
      setHighlightedForDeletion(null);
      focusHiddenInput();
      return;
    }

    // 末尾で右：外側（親コンテナ）へ戻って、構造ノードの「後ろ」に移動（= 外へ と同等）
    if (cursor.path.length === 0) return;

    const lastKey = cursor.path[cursor.path.length - 1];
    if (typeof lastKey !== 'string') return;

    const structPath = cursor.path.slice(0, -1); // ... , structIndex
    const structIndex = structPath[structPath.length - 1];
    if (typeof structIndex !== 'number') return;

    const parentContainerPath = structPath.slice(0, -1);
    setCursor({ path: parentContainerPath, index: structIndex + 1 });
    setHighlightedForDeletion(null);
    focusHiddenInput();
  };

// 生成表达式字符串
  const generateExpression = (node: FormulaRoot | FormulaNode): string => {
    if ('children' in node && !('type' in node)) {
      return node.children.map((child) => generateExpressionNode(child)).join(' ');
    }
    return generateExpressionNode(node as FormulaNode);
  };

  const generateExpressionNode = (node: FormulaNode): string => {
    switch (node.type) {
      case 'symbol':
        return node.value;
      case 'fraction':
        return `(${node.numerator.children.map(generateExpressionNode).join(' ')})/(${node.denominator.children.map(generateExpressionNode).join(' ')})`;
      case 'superscript':
        return `${node.base.children.map(generateExpressionNode).join(' ')}^${node.exponent.children.map(generateExpressionNode).join(' ')}`;
      case 'subscript':
        return `${node.base.children.map(generateExpressionNode).join(' ')}_${node.index.children.map(generateExpressionNode).join(' ')}`;
      case 'sqrt':
        return `√(${node.content.children.map(generateExpressionNode).join(' ')})`;
      case 'abs':
        return `|${node.content.children.map(generateExpressionNode).join(' ')}|`;
      case 'function':
        return `${node.name}(${node.argument.children.map(generateExpressionNode).join(' ')})`;
      case 'sum':
        return `Σ[${node.lower.children.map(generateExpressionNode).join(' ')}→${node.upper.children.map(generateExpressionNode).join(' ')}](${node.body.children.map(generateExpressionNode).join(' ')})`;
      case 'integral':
        return `∫[${node.lower.children.map(generateExpressionNode).join(' ')}→${node.upper.children.map(generateExpressionNode).join(' ')}](${node.body.children.map(generateExpressionNode).join(' ')})`;
      default:
        return '';
    }
  };

  // 渲染容器
  const renderContainer = (container: Container, path: (number | string)[]): JSX.Element => {
    const isCursorHere = JSON.stringify(cursor.path) === JSON.stringify(path);

    return (
      <div className="inline-flex items-center gap-0.5">
        {container.children.length === 0 ? (
          <span
            className={`inline-block w-4 h-5 border border-dashed ${isCursorHere ? 'border-blue-400 bg-blue-50' : 'border-gray-300'} cursor-pointer`}
            onClick={(e) => {
              e.stopPropagation();
              setCursor({ path, index: 0 });
              setHighlightedForDeletion(null);
              focusHiddenInput();
            }}
          />
        ) : (
          container.children.map((child, i) => (
            <React.Fragment key={i}>
              {isCursorHere && cursor.index === i && (
                <span className="inline-block w-0.5 h-5 bg-blue-500 animate-pulse" />
              )}
              {renderNode(child, [...path, i])}
            </React.Fragment>
          ))
        )}
        {isCursorHere && cursor.index === container.children.length && (
          <span className="inline-block w-0.5 h-5 bg-blue-500 animate-pulse" />
        )}
      </div>
    );
  };

  // 渲染节点
  const renderNode = (node: FormulaNode, path: (number | string)[]): JSX.Element => {
    const isHighlighted =
      highlightedForDeletion && JSON.stringify(highlightedForDeletion) === JSON.stringify(path);
    const highlightClass = isHighlighted ? 'ring-2 ring-red-400 bg-red-50' : '';

    switch (node.type) {
      case 'symbol':
        return (
          <span
            className={`inline-block px-0.5 cursor-pointer hover:bg-gray-100 ${highlightClass}`}
            onClick={(e) => {
              e.stopPropagation();
              const parentPath = path.slice(0, -1);
              const index = path[path.length - 1];
              if (typeof index === 'number') {
                setCursor({ path: parentPath, index: index + 1 });
                setHighlightedForDeletion(null);
                focusHiddenInput();
              }
            }}
          >
            {node.value}
          </span>
        );

      case 'fraction':
        return (
          <div className={`inline-flex flex-col items-center px-2 mx-1 ${highlightClass} rounded`}>
            <div className="border-b-2 border-gray-800 pb-1 min-w-[30px] text-center">
              {renderContainer(node.numerator, [...path, 'numerator'])}
            </div>
            <div className="pt-1 min-w-[30px] text-center">
              {renderContainer(node.denominator, [...path, 'denominator'])}
            </div>
          </div>
        );

      case 'superscript':
        return (
          <div className={`inline-flex items-start mx-0.5 ${highlightClass} rounded`}>
            <div className="text-base">{renderContainer(node.base, [...path, 'base'])}</div>
            <div className="text-xs -mt-1 min-w-[20px]">
              {renderContainer(node.exponent, [...path, 'exponent'])}
            </div>
          </div>
        );

      case 'subscript':
        return (
          <div className={`inline-flex items-end mx-0.5 ${highlightClass} rounded`}>
            <div className="text-base">{renderContainer(node.base, [...path, 'base'])}</div>
            <div className="text-xs -mb-1 min-w-[20px]">
              {renderContainer(node.index, [...path, 'index'])}
            </div>
          </div>
        );

      case 'sqrt':
        return (
          <div className={`inline-flex items-center mx-1 ${highlightClass} rounded`}>
            <span className="text-2xl mr-0.5">√</span>
            <div className="border-t-2 border-gray-800 pt-1 px-1 min-w-[30px]">
              {renderContainer(node.content, [...path, 'content'])}
            </div>
          </div>
        );

      case 'abs':
        return (
          <div className={`inline-flex items-center mx-1 ${highlightClass} rounded`}>
            <span className="text-2xl mr-0.5">|</span>
            <div className="px-1 min-w-[30px]">{renderContainer(node.content, [...path, 'content'])}</div>
            <span className="text-2xl ml-0.5">|</span>
          </div>
        );

      case 'function':
        return (
          <div className={`inline-flex items-center mx-0.5 ${highlightClass} rounded`}>
            <span className="text-base">{node.name}</span>
            <span className="text-base">(</span>
            <div className="min-w-[30px]">{renderContainer(node.argument, [...path, 'argument'])}</div>
            <span className="text-base">)</span>
          </div>
        );

      case 'sum':
        return (
          <div className={`inline-flex items-center gap-1 mx-1 ${highlightClass} rounded`}>
            <div className="flex flex-col items-center">
              <div className="text-xs mb-0.5 min-w-[20px] text-center">
                {renderContainer(node.upper, [...path, 'upper'])}
              </div>
              <span className="text-3xl">Σ</span>
              <div className="text-xs mt-0.5 min-w-[20px] text-center">
                {renderContainer(node.lower, [...path, 'lower'])}
              </div>
            </div>
            <div>{renderContainer(node.body, [...path, 'body'])}</div>
          </div>
        );

      case 'integral':
        return (
          <div className={`inline-flex items-center gap-1 mx-1 ${highlightClass} rounded`}>
            <div className="flex flex-col items-center">
              <div className="text-xs mb-0.5 min-w-[20px] text-center">
                {renderContainer(node.upper, [...path, 'upper'])}
              </div>
              <span className="text-3xl">∫</span>
              <div className="text-xs mt-0.5 min-w-[20px] text-center">
                {renderContainer(node.lower, [...path, 'lower'])}
              </div>
            </div>
            <div>{renderContainer(node.body, [...path, 'body'])}</div>
          </div>
        );

      default:
        return <span>?</span>;
    }
  };

  // 键盘事件处理（PC / 物理键盘）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y: Redo
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // 字母和数字直接插入
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        insertCharacter(e.key);
      }

      // Backspace 删除
      if (e.key === 'Backspace') {
        e.preventDefault();
        deleteAtCursor();
      }

      // Tab 移动到下一个容器
      if (e.key === 'Tab') {
        e.preventDefault();
        moveToNextContainer();
      }

      // Escape 取消高亮
      if (e.key === 'Escape') {
        e.preventDefault();
        setHighlightedForDeletion(null);
      }

      // 左右箭头移动光标
      if (e.key === 'ArrowLeft' && cursor.index > 0) {
        e.preventDefault();
        setCursor({ ...cursor, index: cursor.index - 1 });
        setHighlightedForDeletion(null);
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const container = getContainerAtPath(root, cursor.path);
        if (container && cursor.index < container.children.length) {
          setCursor({ ...cursor, index: cursor.index + 1 });
          setHighlightedForDeletion(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cursor, root, highlightedForDeletion, history, historyIndex]);

  // 隐藏输入框：处理 iOS/Android 软键盘输入（IME 対応）
  // 重要：iOS の IME（中文/日文）では、確定前のローマ字が流れてくるため
  // 「確定した入力」だけを構造ツリーへ反映する。
  const lastInputTypeRef = useRef<string>('');

  const handleHiddenBeforeInput = (e: any) => {
    const ne = e.nativeEvent as InputEvent | undefined;
    const inputType = ne?.inputType || '';
    const data = (ne as any)?.data as string | null | undefined;

    lastInputTypeRef.current = inputType;

    // Backspace（软键盘删除）
    if (inputType === 'deleteContentBackward') {
      e.preventDefault?.();
      deleteAtCursor();
      clearHiddenInput();
      focusHiddenInput();
      return;
    }

    // Enter：当作空格（可按你喜好改成换行或忽略）
    if (inputType === 'insertLineBreak') {
      e.preventDefault?.();
      insertCharacter(' ');
      clearHiddenInput();
      focusHiddenInput();
      return;
    }

    // IME 确认：insertFromComposition（これだけ反映する）
    if (inputType === 'insertFromComposition') {
      if (data) {
        e.preventDefault?.();
        for (const ch of Array.from(data)) insertCharacter(ch);
        clearHiddenInput();
        focusHiddenInput();
      }
      return;
    }

    // 通常入力（英数/記号など）：insertText
    if (inputType === 'insertText') {
      if (data) {
        e.preventDefault?.();
        for (const ch of Array.from(data)) insertCharacter(ch);
        clearHiddenInput();
        focusHiddenInput();
      }
      return;
    }

    // 確定前の IME 文字列：insertCompositionText（ここでは何もしない）
    // ※ preventDefault すると IME が壊れる場合があるので触らない
  };

  const handleHiddenInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    // 安全弁：想定外で textarea に残った文字は、確定入力以外はツリーへ入れない。
    const el = e.currentTarget;
    const value = el.value;
    if (!value) return;

    const t = lastInputTypeRef.current;

    // composition 中のローマ字等が value に残ることがあるため、基本はクリアだけ
    // ただし、何らかの理由で beforeinput が効かない環境では value を拾う
    if (t === 'insertText' || t === 'insertFromComposition') {
      for (const ch of Array.from(value)) {
        if (ch === '\n') insertCharacter(' ');
        else insertCharacter(ch);
      }
    }

    clearHiddenInput();
    focusHiddenInput();
  };

  const handleNext = () => {
    const expression = generateExpression(root);
    if (expression.trim()) {
      onNext(expression, root);
    }
  };

  const structureSymbols = [
    { label: 'ᵃ⁄ᵦ', type: 'fraction' },
    { label: 'x²', type: 'superscript' },
    { label: 'xₐ', type: 'subscript' },
    { label: '√', type: 'sqrt' },
    { label: 'Σ', type: 'sum' },
    { label: '∫', type: 'integral' },
    { label: '|x|', type: 'abs' },
  ];

  const functionTemplates = [
    { label: 'sin', name: 'sin' },
    { label: 'cos', name: 'cos' },
    { label: 'tan', name: 'tan' },
    { label: 'arcsin', name: 'arcsin' },
    { label: 'arccos', name: 'arccos' },
    { label: 'arctan', name: 'arctan' },
    { label: 'log', name: 'log' },
    { label: 'ln', name: 'ln' },
    { label: 'exp', name: 'exp' },
  ];

  const quickSymbolsRow1 = [
    '=', '+', '−', '×', '÷', '·', '(', ')', '[', ']', ',', '.'
  ];

  const quickSymbolsRow2 = [
    '≠', '≤', '≥', '±', '≈', '∝', '→', '∞', '°', 'π'
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 隐藏输入框：用于召唤手机键盘 */}
      <textarea
        ref={hiddenInputRef}
        // 关键：不要设置 readOnly / inputMode="none"
        inputMode="text"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        // sr-only 在某些实现里会 display:none（会导致无法 focus），因此用 inline style 強制存在
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: 8,
          height: 8,
          opacity: 0,
          // 让它不挡点击，但仍可 focus
          pointerEvents: 'none',
        }}
        onBeforeInput={handleHiddenBeforeInput as any}
        onInput={handleHiddenInput}
      />

      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between border-b border-border">
        <button onClick={onCancel} className="p-2 hover:bg-primary/10 rounded-xl transition-colors">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="flex-1 text-center text-foreground">公式編集（構造）</h1>

        {/* Undo/Redo */}
        <div className="flex gap-1">
          <button
            onClick={undo}
            disabled={historyIndex === 0}
            className="p-2 disabled:opacity-30 text-primary hover:bg-primary/10 rounded-xl transition-colors"
            title="元に戻す (Ctrl+Z)"
          >
            <Undo className="w-5 h-5" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            className="p-2 disabled:opacity-30 text-primary hover:bg-primary/10 rounded-xl transition-colors"
            title="やり直す (Ctrl+Shift+Z)"
          >
            <Redo className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={handleNext}
          className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
        >
          <span>次へ</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* 编辑区 - 无限画布 */}
        <div
          ref={editorRef}
          className="flex-1 overflow-auto p-6" style={{ paddingBottom: bottomPanelHeight + keyboardInset + 24 }}
          onClick={() => {
            setCursor({ path: [], index: root.children.length });
            setHighlightedForDeletion(null);
            focusHiddenInput();
          }}
          onPointerDown={() => {
            // iOS 有时 click 触发较晚，pointerdown 更稳
            focusHiddenInput();
          }}
        >
          <div className="min-w-full min-h-full inline-block">
            <div className="text-3xl leading-relaxed">{renderContainer(root, [])}</div>
          </div>
        </div>

        {/* 公式键盘 - 横向滚動，無標題 */}
        <div ref={bottomPanelRef} className="border-t border-border bg-card/50 backdrop-blur-sm fixed left-0 right-0 z-50" style={{ bottom: keyboardInset, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {/* 第一行：构造符号 + 函数 */}
          <div className="px-3 py-3 overflow-x-auto">
            <div className="flex gap-2 pb-1">
              {structureSymbols.map((item) => (
                <button
                  key={item.type}
                  onClick={() => {
                    insertStructure(item.type);
                    focusHiddenInput();
                  }}
                  className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-background/80 text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-base"
                >
                  {item.label}
                </button>
              ))}
              <div className="w-px bg-border mx-1" />
              {functionTemplates.map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    insertFunction(item.name);
                    focusHiddenInput();
                  }}
                  className="flex-shrink-0 px-3 py-2.5 rounded-xl bg-background/80 text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-sm"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 第二行：ナビ（左固定） + 簡易記号（右：2行・横スクロール） */}
          <div className="px-3 pb-3 border-t border-border/50">
            <div className="flex gap-3 pt-3">
              {/* 左：ナビ（固定） */}
              <div className="flex-shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      moveOut();
                    }}
                    className="w-16 h-10 rounded-xl bg-background/80 text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-sm"
                  >
                    外へ
                  </button>
                  <button
                    onClick={() => {
                      moveIn();
                    }}
                    className="w-16 h-10 rounded-xl bg-background/80 text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-sm"
                  >
                    中へ
                  </button>
                  <button
                    onClick={() => {
                      moveLeft();
                    }}
                    className="w-16 h-10 rounded-xl bg-background/80 text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-base"
                    aria-label="左へ"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => {
                      moveRight();
                    }}
                    className="w-16 h-10 rounded-xl bg-background/80 text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-base"
                    aria-label="右へ"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* 右：記号（2行、どちらも横スクロール） */}
              <div className="min-w-0 flex-1">
                <div className="overflow-x-auto">
                  <div className="flex gap-2 pb-2">
                    {quickSymbolsRow1.map((symbol) => (
                      <button
                        key={symbol}
                        onClick={() => {
                          insertCharacter(symbol);
                          focusHiddenInput();
                        }}
                        className="flex-shrink-0 w-10 h-10 rounded-xl bg-background/80 text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center"
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="flex gap-2">
                    {quickSymbolsRow2.map((symbol) => (
                      <button
                        key={symbol}
                        onClick={() => {
                          insertCharacter(symbol);
                          focusHiddenInput();
                        }}
                        className="flex-shrink-0 w-10 h-10 rounded-xl bg-background/80 text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center"
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
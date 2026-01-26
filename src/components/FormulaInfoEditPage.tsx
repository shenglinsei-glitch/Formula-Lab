import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { dataStore, UNCATEGORIZED_SCENARIO_ID } from '../store/dataStore';
import type { Formula, Scenario } from '../data/scenarios';
import ScenarioStepSelector from './ScenarioStepSelector';
import FormulaRenderer from './FormulaRenderer';

interface FormulaInfoEditPageProps {
  formulaId: string | null;
  expression: string;
  structureData?: any; // 構造データ（2D表示用）
  onSave: (formulaData: {
    name: string;
    description: string;
    equivalentExpressions: string[];
    symbols: SymbolDefinition[];
    usedInContexts: ContextReference[];
    usedFormulas: string[];
    derivableFormulas: string[];
  }) => void;
  onBack: () => void; // 構造編集へ戻る
  onCancel: () => void; // 編集全体を破棄
}

interface SymbolCoeffTableColumn {
  id: string;
  label: string;
}

interface SymbolCoeffTableRow {
  cells: string[]; // index が columns に対応
}

interface SymbolCoeffTable {
  title: string;
  columns: SymbolCoeffTableColumn[];
  rows: SymbolCoeffTableRow[];
  note?: string;
}

interface SymbolDefinition {
  symbol: string;
  meaning: string;
  unit: string;
  coeffTable?: SymbolCoeffTable; // 任意：K1, K2 などの係数表
}

interface ContextReference {
  scenarioId: string;
  stepId: string;
}

export default function FormulaInfoEditPage({
  formulaId,
  expression,
  structureData,
  onSave,
  onBack,
  onCancel,
}: FormulaInfoEditPageProps) {
  const existingFormula = formulaId ? dataStore.getFormula(formulaId) : null;

  const [formulaName, setFormulaName] = useState(existingFormula?.name || '');
  const [description, setDescription] = useState(existingFormula?.description || '');
  const [equivalentExpressions, setEquivalentExpressions] = useState<string[]>(
    existingFormula?.equivalentExpressions || []
  );
  const [symbols, setSymbols] = useState<SymbolDefinition[]>(
    (existingFormula?.symbols as SymbolDefinition[] | undefined) || []
  );
  const [usedInContexts, setUsedInContexts] = useState<ContextReference[]>(
    existingFormula?.usedInContexts || []
  );
  const [usedFormulas, setUsedFormulas] = useState<string[]>(
    existingFormula?.usedFormulas || []
  );
  const [derivableFormulas, setDerivableFormulas] = useState<string[]>(
    existingFormula?.derivableFormulas || []
  );

  // 折りたたみ状態
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isEquivalentExpanded, setIsEquivalentExpanded] = useState(false);
  const [isContextsExpanded, setIsContextsExpanded] = useState(false);
  const [isSymbolsExpanded, setIsSymbolsExpanded] = useState(true);
  const [isUsedFormulasExpanded, setIsUsedFormulasExpanded] = useState(false);
  const [isDerivableExpanded, setIsDerivableExpanded] = useState(false);

  // セレクター表示状態
  const [showContextSelector, setShowContextSelector] = useState(false);
  const [showUsedFormulaSelector, setShowUsedFormulaSelector] = useState(false);
  const [showDerivableSelector, setShowDerivableSelector] = useState(false);

  // 記号ごとの数値表編集用
  const [editingSymbolIndex, setEditingSymbolIndex] = useState<number | null>(null);
  const [showCoeffTableEditor, setShowCoeffTableEditor] = useState(false);
  const [editingCoeffTable, setEditingCoeffTable] = useState<SymbolCoeffTable | null>(null);

  // 公式から自動で記号を抽出（初回のみ）
  useEffect(() => {
    if (!existingFormula && expression && symbols.length === 0) {
      const extractedSymbols = extractSymbolsFromExpression(expression);
      setSymbols(extractedSymbols);
      if (extractedSymbols.length > 0) {
        setIsSymbolsExpanded(true);
      }
    }
  }, [expression]);

  // 公式文字列から記号候補を抽出する
  const extractSymbolsFromExpression = (expr: string): SymbolDefinition[] => {
    const input = (expr || '').trim();
    if (!input) return [];

    const greekMap: Record<string, string> = {
      '\\alpha': 'α',
      '\\beta': 'β',
      '\\gamma': 'γ',
      '\\delta': 'δ',
      '\\epsilon': 'ε',
      '\\theta': 'θ',
      '\\lambda': 'λ',
      '\\mu': 'μ',
      '\\nu': 'ν',
      '\\omega': 'ω',
      '\\pi': 'π',
      '\\sigma': 'σ',
      '\\Sigma': 'Σ',
    };

    const nonSymbolCommands = new Set([
      'frac',
      'sqrt',
      'times',
      'cdot',
      'div',
      'pm',
      'le',
      'ge',
      'neq',
      'approx',
      'to',
      'infty',
      'left',
      'right',
      'mathrm',
      'text',
      'operatorname',
      'sum',
      'int',
    ]);

    const isAsciiLetter = (ch: string) => /[A-Za-z]/.test(ch);
    const isGreekLetter = (ch: string) =>
      /[α-ωΑ-Ω]/.test(ch) || ch === 'π' || ch === 'Σ' || ch === 'σ';
    const isSymbolBaseChar = (ch: string) => isAsciiLetter(ch) || isGreekLetter(ch);

    const readBraceGroup = (s: string, i: number) => {
      let depth = 0;
      let j = i;
      for (; j < s.length; j++) {
        const c = s[j];
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      return { value: s.slice(i + 1, j), next: Math.min(j + 1, s.length) };
    };

    const readScript = (s: string, i: number) => {
      if (i >= s.length) return { value: '', next: i };
      if (s[i] === '{') return readBraceGroup(s, i);
      return { value: s[i] ?? '', next: i + 1 };
    };

    const symbolsFound: string[] = [];
    const s = input;
    let i = 0;

    while (i < s.length) {
      const ch = s[i];

      if (ch === ' ' || ch === '\n' || ch === '\t') {
        i++;
        continue;
      }

      if (ch === '\\') {
        let j = i + 1;
        while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
        const cmd = s.slice(i, j);

        if (greekMap[cmd]) {
          let base = greekMap[cmd];
          let sub = '';
          let sup = '';
          let k = j;
          while (k < s.length && (s[k] === '_' || s[k] === '^')) {
            const kind = s[k];
            const out = readScript(s, k + 1);
            if (kind === '_') sub = out.value;
            else sup = out.value;
            k = out.next;
          }
          let token = base;
          if (sub) token += `_${sub}`;
          if (sup) token += `^${sup}`;
          symbolsFound.push(token);
          i = k;
          continue;
        }

        const cmdName = cmd.replace('\\', '');
        if (nonSymbolCommands.has(cmdName)) {
          i = j;
          continue;
        }

        i = j;
        continue;
      }

      if (isSymbolBaseChar(ch)) {
        let base = ch;
        let sub = '';
        let sup = '';
        let k = i + 1;
        while (k < s.length && (s[k] === '_' || s[k] === '^')) {
          const kind = s[k];
          const out = readScript(s, k + 1);
          if (kind === '_') sub = out.value;
          else sup = out.value;
          k = out.next;
        }
        let token = base;
        if (sub) token += `_${sub}`;
        if (sup) token += `^${sup}`;
        symbolsFound.push(token);
        i = k;
        continue;
      }

      i++;
    }

    const unique = Array.from(new Set(symbolsFound.filter(Boolean)));
    return unique.map((symbol) => ({ symbol, meaning: '', unit: '' }));
  };

  // 記号プレビュー（例：x_1^2）
  const renderSymbolPreview = (raw: string) => {
    const s = (raw || '').trim();
    if (!s) return <span className="text-muted-foreground">—</span>;

    const greekMap: Record<string, string> = {
      '\\sigma': 'σ',
      '\\Sigma': 'Σ',
      '\\pi': 'π',
      '\\alpha': 'α',
      '\\beta': 'β',
      '\\gamma': 'γ',
      '\\delta': 'δ',
      '\\epsilon': 'ε',
      '\\theta': 'θ',
      '\\lambda': 'λ',
      '\\mu': 'μ',
      '\\nu': 'ν',
      '\\omega': 'ω',
    };

    let t = s.replace(/\\[A-Za-z]+/g, (m) => greekMap[m] ?? m.replace('\\', ''));

    const readGroup = (str: string, i: number) => {
      if (str[i] === '{') {
        let depth = 0;
        let j = i;
        for (; j < str.length; j++) {
          const ch = str[j];
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) break;
          }
        }
        return { value: str.slice(i + 1, j), next: j + 1 };
      }
      return { value: str[i] ?? '', next: i + 1 };
    };

    let base = '';
    let sub = '';
    let sup = '';

    const baseMatch = t.match(/^([A-Za-zα-ωΑ-ΩπΣ]+|\d+|[一-龥]+)/);
    if (baseMatch) {
      base = baseMatch[0];
      t = t.slice(base.length);
    } else {
      base = t[0] ?? '';
      t = t.slice(1);
    }

    let i = 0;
    while (i < t.length) {
      const ch = t[i];
      if (ch === '_') {
        const g = readGroup(t, i + 1);
        sub = g.value;
        i = g.next;
        continue;
      }
      if (ch === '^') {
        const g = readGroup(t, i + 1);
        sup = g.value;
        i = g.next;
        continue;
      }
      i++;
    }

    return (
      <span className="inline-flex items-baseline leading-none">
        <span className="font-medium">{base}</span>
        {sub ? (
          <sub className="text-sm leading-none relative top-1 ml-0.5">{sub}</sub>
        ) : null}
        {sup ? (
          <sup className="text-sm leading-none relative -top-1 ml-0.5">{sup}</sup>
        ) : null}
      </span>
    );
  };

  // 等価表現
  const addEquivalentExpression = () => {
    setEquivalentExpressions([...equivalentExpressions, '']);
  };

  const updateEquivalentExpression = (index: number, value: string) => {
    const updated = [...equivalentExpressions];
    updated[index] = value;
    setEquivalentExpressions(updated);
  };

  const removeEquivalentExpression = (index: number) => {
    setEquivalentExpressions(equivalentExpressions.filter((_, i) => i !== index));
  };

  // 記号編集
  const updateSymbol = (index: number, field: keyof SymbolDefinition, value: string) => {
    const updated = [...symbols];
    updated[index] = { ...updated[index], [field]: value };
    setSymbols(updated);
  };

  const removeSymbol = (index: number) => {
    setSymbols(symbols.filter((_, i) => i !== index));
  };

  const addSymbol = () => {
    setSymbols([...symbols, { symbol: '', meaning: '', unit: '' }]);
  };

  // 場面（シナリオ）関連
  const addContext = (scenarioId: string, stepId: string) => {
    if (!usedInContexts.find((c) => c.scenarioId === scenarioId && c.stepId === stepId)) {
      setUsedInContexts([...usedInContexts, { scenarioId, stepId }]);
    }
    setShowContextSelector(false);
  };

  const removeContext = (index: number) => {
    setUsedInContexts(usedInContexts.filter((_, i) => i !== index));
  };

  const addUsedFormula = (id: string) => {
    if (!usedFormulas.includes(id)) {
      setUsedFormulas([...usedFormulas, id]);
    }
    setShowUsedFormulaSelector(false);
  };

  const removeUsedFormula = (id: string) => {
    setUsedFormulas(usedFormulas.filter((f) => f !== id));
  };

  const addDerivableFormula = (id: string) => {
    if (!derivableFormulas.includes(id)) {
      setDerivableFormulas([...derivableFormulas, id]);
    }
    setShowDerivableSelector(false);
  };

  const removeDerivableFormula = (id: string) => {
    setDerivableFormulas(derivableFormulas.filter((f) => f !== id));
  };

  const getContextName = (ctx: ContextReference): string => {
    const scenario = dataStore.getScenario(ctx.scenarioId);
    if (!scenario) return '不明なシナリオ';
    const step = scenario.steps.find((s: any) => s.id === ctx.stepId);
    return `${scenario.name} > ${step?.name ?? '不明なステップ'}`;
  };

  const handleSave = () => {
    onSave({
      name: formulaName,
      description,
      equivalentExpressions: equivalentExpressions.filter((e) => e.trim()),
      symbols: symbols.filter((s) => s.symbol.trim()),
      usedInContexts,
      usedFormulas,
      derivableFormulas,
    });
  };

  // ===== 数値表編集ロジック（任意列） =====

  const ensureTableHasAtLeastOneRowAndCol = (table: SymbolCoeffTable): SymbolCoeffTable => {
    let columns = table.columns;
    let rows = table.rows;

    if (!columns || columns.length === 0) {
      columns = [{ id: 'col1', label: '値' }];
    }
    if (!rows || rows.length === 0) {
      rows = [{ cells: new Array(columns.length).fill('') }];
    } else {
      // 各行の cells 長さを列数に合わせる
      rows = rows.map((r) => {
        const cells = [...r.cells];
        if (cells.length < columns.length) {
          while (cells.length < columns.length) cells.push('');
        } else if (cells.length > columns.length) {
          cells.length = columns.length;
        }
        return { cells };
      });
    }

    return { ...table, columns, rows };
  };

  const openCoeffTableEditor = (index: number) => {
    const sym = symbols[index];
    let table: SymbolCoeffTable;
    if (sym.coeffTable) {
      table = ensureTableHasAtLeastOneRowAndCol(sym.coeffTable);
    } else {
      table = {
        title: `${sym.symbol || '係数'}の数値表`,
        columns: [
          { id: 'col1', label: '条件' },
          { id: 'col2', label: '値' },
        ],
        rows: [{ cells: ['', ''] }],
        note: '',
      };
    }
    setEditingSymbolIndex(index);
    setEditingCoeffTable(table);
    setShowCoeffTableEditor(true);
  };

  const closeCoeffTableEditor = () => {
    setShowCoeffTableEditor(false);
    setEditingSymbolIndex(null);
    setEditingCoeffTable(null);
  };

  const handleCoeffMetaChange = (
    field: 'title' | 'note',
    value: string
  ) => {
    if (!editingCoeffTable) return;
    setEditingCoeffTable({ ...editingCoeffTable, [field]: value });
  };

  const handleCoeffColumnLabelChange = (colIndex: number, label: string) => {
    if (!editingCoeffTable) return;
    const columns = editingCoeffTable.columns.map((c, i) =>
      i === colIndex ? { ...c, label } : c
    );
    setEditingCoeffTable(ensureTableHasAtLeastOneRowAndCol({ ...editingCoeffTable, columns }));
  };

  const addCoeffColumn = () => {
    if (!editingCoeffTable) return;
    const nextIndex = editingCoeffTable.columns.length + 1;
    const newCol: SymbolCoeffTableColumn = {
      id: `col${nextIndex}`,
      label: '',
    };
    const columns = [...editingCoeffTable.columns, newCol];
    const rows = editingCoeffTable.rows.map((r) => ({
      cells: [...r.cells, ''],
    }));
    setEditingCoeffTable({ ...editingCoeffTable, columns, rows });
  };

  const removeCoeffColumn = (colIndex: number) => {
    if (!editingCoeffTable) return;
    let columns = editingCoeffTable.columns.filter((_, i) => i !== colIndex);
    let rows = editingCoeffTable.rows.map((r) => ({
      cells: r.cells.filter((_, i) => i !== colIndex),
    }));

    if (columns.length === 0) {
      columns = [{ id: 'col1', label: '値' }];
      rows = [{ cells: [''] }];
    }

    setEditingCoeffTable({ ...editingCoeffTable, columns, rows });
  };

  const handleCoeffCellChange = (rowIndex: number, colIndex: number, value: string) => {
    if (!editingCoeffTable) return;
    const rows = editingCoeffTable.rows.map((r, i) => {
      if (i !== rowIndex) return r;
      const cells = [...r.cells];
      cells[colIndex] = value;
      return { cells };
    });
    setEditingCoeffTable({ ...editingCoeffTable, rows });
  };

  const addCoeffRow = () => {
    if (!editingCoeffTable) return;
    const newRow: SymbolCoeffTableRow = {
      cells: new Array(editingCoeffTable.columns.length).fill(''),
    };
    setEditingCoeffTable({
      ...editingCoeffTable,
      rows: [...editingCoeffTable.rows, newRow],
    });
  };

  const removeCoeffRow = (rowIndex: number) => {
    if (!editingCoeffTable) return;
    let rows = editingCoeffTable.rows.filter((_, i) => i !== rowIndex);
    if (rows.length === 0) {
      rows = [{ cells: new Array(editingCoeffTable.columns.length).fill('') }];
    }
    setEditingCoeffTable({ ...editingCoeffTable, rows });
  };

  const saveCoeffTable = () => {
    if (editingSymbolIndex === null || !editingCoeffTable) return;

    // 空行を削除
    let rows = editingCoeffTable.rows.filter((r) =>
      r.cells.some((c) => c.trim() !== '')
    );
    if (rows.length === 0) {
      rows = [{ cells: new Array(editingCoeffTable.columns.length).fill('') }];
    }

    // 完全に空の列（ラベル＋全セル空）を削っておく
    let columns = editingCoeffTable.columns;
    const colToKeep: number[] = [];
    columns.forEach((col, i) => {
      const labelNotEmpty = col.label.trim() !== '';
      const someCellNotEmpty = rows.some((r) => (r.cells[i] ?? '').trim() !== '');
      if (labelNotEmpty || someCellNotEmpty) {
        colToKeep.push(i);
      }
    });

    if (colToKeep.length === 0) {
      columns = [{ id: 'col1', label: '値' }];
      rows = [{ cells: [''] }];
    } else if (colToKeep.length !== columns.length) {
      columns = colToKeep.map((i, idx) => ({
        id: `col${idx + 1}`,
        label: columns[i].label,
      }));
      rows = rows.map((r) => ({
        cells: colToKeep.map((i) => r.cells[i] ?? ''),
      }));
    }

    const tableToSave: SymbolCoeffTable = {
      ...editingCoeffTable,
      columns,
      rows,
    };

    const updatedSymbols = [...symbols];
    updatedSymbols[editingSymbolIndex] = {
      ...updatedSymbols[editingSymbolIndex],
      coeffTable: tableToSave,
    };
    setSymbols(updatedSymbols);
    closeCoeffTableEditor();
  };

  const currentEditingSymbol =
    editingSymbolIndex !== null ? symbols[editingSymbolIndex] : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between border-b border-border">
        <button
          onClick={onBack}
          className="p-2 hover:bg-primary/10 rounded-xl transition-colors"
          title="構造編集に戻る"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="flex-1 text-center text-foreground">公式編集（情報）</h1>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
          title="編集を破棄"
        >
          削除
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 p-4 pb-20 overflow-y-auto space-y-3">
        {/* 公式本体 */}
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs text-muted-foreground mb-3">公式</div>
          <div className="text-2xl text-foreground text-center overflow-x-auto">
            {(structureData ||
              existingFormula?.structureTree ||
              (existingFormula as any)?.structureData) ? (
              <FormulaRenderer
                root={(
                  structureData ||
                  existingFormula?.structureTree ||
                  (existingFormula as any)?.structureData
                ) as any}
                fallback={expression || '（公式が入力されていません）'}
                maskBlocks={[]}
              />
            ) : (
              <span className="font-mono">
                {expression || '（公式が入力されていません）'}
              </span>
            )}
          </div>
        </div>

        {/* 公式名 */}
        <div>
          <div className="text-xs text-muted-foreground mb-2 px-1">公式名（任意）</div>
          <input
            type="text"
            value={formulaName}
            onChange={(e) => setFormulaName(e.target.value)}
            placeholder="例：ガラスの許容耐力"
            className="w-full px-4 py-3 glass-card rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
          />
        </div>

        {/* 同値な表現 */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setIsEquivalentExpanded(!isEquivalentExpanded)}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-primary/5 transition-colors"
          >
            <div className="flex-1 text-left text-sm text-foreground">
              同値な表現
              {equivalentExpressions.length > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({equivalentExpressions.length})
                </span>
              )}
            </div>
            <div className="text-primary">
              {isEquivalentExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </div>
          </button>

          {isEquivalentExpanded && (
            <div className="border-t border-border p-4 space-y-2">
              {equivalentExpressions.map((expr, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={expr}
                    onChange={(e) =>
                      updateEquivalentExpression(index, e.target.value)
                    }
                    placeholder="等価な表現を入力"
                    className="flex-1 px-4 py-2.5 glass-card rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => removeEquivalentExpression(index)}
                    className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addEquivalentExpression}
                className="w-full glass-card rounded-xl px-4 py-3 text-sm text-muted-foreground hover:text-primary hover:shadow-md transition-all flex items-center justify-center gap-2 border border-dashed border-primary/30"
              >
                <Plus className="w-4 h-4" />
                <span>表現を追加</span>
              </button>
            </div>
          )}
        </div>

        {/* 公式の説明 */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-primary/5 transition-colors"
          >
            <div className="flex-1 text-left text-sm text-foreground">公式の説明</div>
            <div className="text-primary">
              {isDescriptionExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </div>
          </button>

          {isDescriptionExpanded && (
            <div className="border-t border-border p-4">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="公式の意味や使い方を入力..."
                rows={4}
                className="w-full px-4 py-3 glass-card rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground resize-none"
              />
            </div>
          )}
        </div>

        {/* この公式が使われる場面 */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setIsContextsExpanded(!isContextsExpanded)}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-primary/5 transition-colors"
          >
            <div className="flex-1 text-left text-sm text-foreground">
              この公式が使われる場面
              {usedInContexts.length > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({usedInContexts.length})
                </span>
              )}
            </div>
            <div className="text-primary">
              {isContextsExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </div>
          </button>

          {isContextsExpanded && (
            <div className="border-t border-border p-4">
              {usedInContexts.map((ctx, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded"
                >
                  <div className="flex-1 text-sm text-gray-700">
                    {getContextName(ctx)}
                  </div>
                  <button
                    onClick={() => removeContext(index)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <ScenarioStepSelector onAdd={addContext} />
            </div>
          )}
        </div>

        {/* 記号の意味 ＋ 数値表 */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setIsSymbolsExpanded(!isSymbolsExpanded)}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-primary/5 transition-colors"
          >
            <div className="flex-1 text-left text-sm text-foreground">
              記号の意味
              {symbols.length > 0 && (
                <span className="ml-2 text-muted-foreground">({symbols.length})</span>
              )}
            </div>
            <div className="text-primary">
              {isSymbolsExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </div>
          </button>

          {isSymbolsExpanded && (
            <div className="border-t border-border p-4">
              <div className="text-xs text-muted-foreground mb-2">
                記号 / 意味 / 単位 ＋ 数値表（任意）
              </div>
              {symbols.map((sym, index) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                  {/* preview + raw input */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-12 h-10 px-2 border border-gray-200 rounded bg-white flex items-center justify-center">
                      {renderSymbolPreview(sym.symbol)}
                    </div>
                    <input
                      type="text"
                      value={sym.symbol}
                      onChange={(e) =>
                        updateSymbol(index, 'symbol', e.target.value)
                      }
                      placeholder="記号"
                      className="w-16 sm:w-20 md:w-24 h-10 px-2 border border-gray-200 rounded text-sm text-center font-mono focus:outline-none focus:border-gray-400"
                    />
                  </div>

                  <input
                    type="text"
                    value={sym.meaning}
                    onChange={(e) =>
                      updateSymbol(index, 'meaning', e.target.value)
                    }
                    placeholder="意味"
                    className="flex-1 min-w-0 h-10 px-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-gray-400"
                  />

                  <input
                    type="text"
                    value={sym.unit}
                    onChange={(e) => updateSymbol(index, 'unit', e.target.value)}
                    placeholder="単位"
                    className="w-14 sm:w-20 md:w-24 h-10 px-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-gray-400"
                  />

                  {/* 数値表編集ボタン＋行数表示 */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openCoeffTableEditor(index)}
                      className="px-2 py-1 border border-gray-200 rounded text-[11px] text-gray-600 hover:bg-gray-50"
                    >
                      数値表
                    </button>
                    {sym.coeffTable && (
                      <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] leading-none">
                        {sym.coeffTable.rows.length} 行
                        {sym.coeffTable.columns.length > 0 &&
                          ` × ${sym.coeffTable.columns.length} 列`}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => removeSymbol(index)}
                    className="p-2 text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addSymbol}
                className="w-full px-3 py-2 border border-dashed border-gray-300 rounded text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>記号を追加</span>
              </button>
            </div>
          )}
        </div>

        {/* 使用する公式 */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setIsUsedFormulasExpanded(!isUsedFormulasExpanded)}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-primary/5 transition-colors"
          >
            <div className="flex-1 text-left text-sm text-foreground">
              使用する公式
              {usedFormulas.length > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({usedFormulas.length})
                </span>
              )}
            </div>
            <div className="text-primary">
              {isUsedFormulasExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </div>
          </button>

          {isUsedFormulasExpanded && (
            <div className="border-t border-border p-4">
              {usedFormulas.map((id) => {
                const formula = dataStore.getFormula(id);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">
                        {formula?.name || id}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {formula?.expression}
                      </div>
                    </div>
                    <button
                      onClick={() => removeUsedFormula(id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {showUsedFormulaSelector ? (
                <div className="border border-gray-300 rounded max-h-60 overflow-y-auto mb-2">
                  {Object.values(dataStore.getFormulas()).map((formula: any) => (
                    <button
                      key={formula.id}
                      onClick={() => addUsedFormula(formula.id)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100"
                      disabled={usedFormulas.includes(formula.id)}
                    >
                      <div className="text-sm text-gray-700">{formula.name}</div>
                      <div className="text-xs text-gray-400 font-mono">
                        {formula.expression}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setShowUsedFormulaSelector(true)}
                  className="w-full px-3 py-2 border border-dashed border-gray-300 rounded text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>公式を選択</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 導出できる公式 */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setIsDerivableExpanded(!isDerivableExpanded)}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-primary/5 transition-colors"
          >
            <div className="flex-1 text-left text-sm text-foreground">
              導出できる公式
              {derivableFormulas.length > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({derivableFormulas.length})
                </span>
              )}
            </div>
            <div className="text-primary">
              {isDerivableExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </div>
          </button>

          {isDerivableExpanded && (
            <div className="border-t border-border p-4">
              {derivableFormulas.map((id) => {
                const formula = dataStore.getFormula(id);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">
                        {formula?.name || id}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {formula?.expression}
                      </div>
                    </div>
                    <button
                      onClick={() => removeDerivableFormula(id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {showDerivableSelector ? (
                <div className="border border-gray-300 rounded max-h-60 overflow-y-auto mb-2">
                  {Object.values(dataStore.getFormulas()).map((formula: any) => (
                    <button
                      key={formula.id}
                      onClick={() => addDerivableFormula(formula.id)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100"
                      disabled={derivableFormulas.includes(formula.id)}
                    >
                      <div className="text-sm text-gray-700">{formula.name}</div>
                      <div className="text-xs text-gray-400 font-mono">
                        {formula.expression}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setShowDerivableSelector(true)}
                  className="w-full px-3 py-2 border border-dashed border-gray-300 rounded text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>公式を選択</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 数値表編集モーダル */}
      {showCoeffTableEditor && editingCoeffTable && currentEditingSymbol && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
          <div className="w-full max-h-[80vh] bg-background rounded-t-3xl shadow-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  {currentEditingSymbol.symbol || '記号'}
                </div>
                <div className="text-sm font-medium">数値表の編集</div>
              </div>
              <button
                onClick={closeCoeffTableEditor}
                className="p-2 rounded-full hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">タイトル</div>
                <input
                  type="text"
                  value={editingCoeffTable.title}
                  onChange={(e) => handleCoeffMetaChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground">列（カラム）</div>
                  <button
                    type="button"
                    onClick={addCoeffColumn}
                    className="flex items-center gap-1 text-xs px-2 py-1 border border-input rounded-lg hover:bg-muted"
                  >
                    <Plus className="w-3 h-3" />
                    列を追加
                  </button>
                </div>
                <div className="space-y-1">
                  {editingCoeffTable.columns.map((col, i) => (
                    <div key={col.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-10">
                        {i + 1}列目
                      </span>
                      <input
                        type="text"
                        value={col.label}
                        onChange={(e) =>
                          handleCoeffColumnLabelChange(i, e.target.value)
                        }
                        placeholder={`列${i + 1} の見出し`}
                        className="flex-1 px-3 py-1.5 border border-input rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={() => removeCoeffColumn(i)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                        disabled={editingCoeffTable.columns.length <= 1}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">数値表</div>
                <div className="border border-border rounded-2xl overflow-hidden">
                  <div
                    className="grid items-center bg-muted text-xs text-muted-foreground px-3 py-2"
                    style={{
                      gridTemplateColumns: `repeat(${editingCoeffTable.columns.length}, minmax(0, 1fr)) auto`,
                    }}
                  >
                    {editingCoeffTable.columns.map((col, i) => (
                      <div key={col.id}>{col.label || `列${i + 1}`}</div>
                    ))}
                    <div className="text-right">操作</div>
                  </div>

                  {editingCoeffTable.rows.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="grid items-center gap-2 px-3 py-2 border-t border-border text-sm"
                      style={{
                        gridTemplateColumns: `repeat(${editingCoeffTable.columns.length}, minmax(0, 1fr)) auto`,
                      }}
                    >
                      {editingCoeffTable.columns.map((col, colIndex) => (
                        <input
                          key={col.id}
                          type="text"
                          value={row.cells[colIndex] ?? ''}
                          onChange={(e) =>
                            handleCoeffCellChange(rowIndex, colIndex, e.target.value)
                          }
                          className="px-2 py-1 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      ))}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeCoeffRow(rowIndex)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addCoeffRow}
                    className="w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    行を追加
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">備考（任意）</div>
                <textarea
                  value={editingCoeffTable.note ?? ''}
                  onChange={(e) => handleCoeffMetaChange('note', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={saveCoeffTable}
                  className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-medium shadow-md hover:opacity-90 transition-opacity"
                >
                  数値表を保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <nav className="fixed bottom-0 left-0 right-0 glass-nav px-5 py-4">
        <button
          onClick={handleSave}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl shadow-lg hover:opacity-90 transition-opacity"
        >
          保存
        </button>
      </nav>
    </div>
  );
}

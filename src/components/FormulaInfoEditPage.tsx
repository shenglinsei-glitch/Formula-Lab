import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { dataStore, UNCATEGORIZED_SCENARIO_ID } from '../store/dataStore';
import type { Formula, Scenario } from '../data/scenarios';
import ScenarioStepSelector from './ScenarioStepSelector';

interface FormulaInfoEditPageProps {
  formulaId: string | null;
  expression: string;
  onSave: (formulaData: {
    name: string;
    description: string;
    equivalentExpressions: string[];
    symbols: SymbolDefinition[];
    usedInContexts: ContextReference[];
    usedFormulas: string[];
    derivableFormulas: string[];
  }) => void;
  onBack: () => void; // 返回到構造页
  onCancel: () => void; // 放弃整个编辑流程
}

interface SymbolDefinition {
  symbol: string;
  meaning: string;
  unit: string;
}

interface ContextReference {
  scenarioId: string;
  stepId: string;
}

export default function FormulaInfoEditPage({
  formulaId,
  expression,
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
    existingFormula?.symbols || []
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
  
  // 折叠状态
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isEquivalentExpanded, setIsEquivalentExpanded] = useState(false);
  const [isContextsExpanded, setIsContextsExpanded] = useState(false);
  const [isSymbolsExpanded, setIsSymbolsExpanded] = useState(true); // 默认展开
  const [isUsedFormulasExpanded, setIsUsedFormulasExpanded] = useState(false);
  const [isDerivableExpanded, setIsDerivableExpanded] = useState(false);

  // 选择器状态
  const [showContextSelector, setShowContextSelector] = useState(false);
  const [showUsedFormulaSelector, setShowUsedFormulaSelector] = useState(false);
  const [showDerivableSelector, setShowDerivableSelector] = useState(false);

  // 自动提取符号（仅在首次加载且没有现有符号时）
  useEffect(() => {
    if (!existingFormula && expression && symbols.length === 0) {
      const extractedSymbols = extractSymbolsFromExpression(expression);
      setSymbols(extractedSymbols);
      if (extractedSymbols.length > 0) {
        setIsSymbolsExpanded(true);
      }
    }
  }, [expression]);

  // 从表达式提取符号
  const extractSymbolsFromExpression = (expr: string): SymbolDefinition[] => {
    const symbolPattern = /[a-zA-Z]|[α-ωΑ-Ω]|π|Σ|∫/g;
    const matches = expr.match(symbolPattern) || [];
    const uniqueSymbols = Array.from(new Set(matches));
    
    return uniqueSymbols.map(symbol => ({
      symbol,
      meaning: '',
      unit: ''
    }));
  };

  // 等价表达式操作
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

  // 符号操作
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

  // 场景关联操作
  const addContext = (scenarioId: string, stepId: string) => {
    if (!usedInContexts.find(c => c.scenarioId === scenarioId && c.stepId === stepId)) {
      setUsedInContexts([...usedInContexts, { scenarioId, stepId }]);
    }
    setShowContextSelector(false);
  };

  const removeContext = (index: number) => {
    setUsedInContexts(usedInContexts.filter((_, i) => i !== index));
  };

  // 公式关联操作
  const addUsedFormula = (formulaId: string) => {
    if (!usedFormulas.includes(formulaId)) {
      setUsedFormulas([...usedFormulas, formulaId]);
    }
    setShowUsedFormulaSelector(false);
  };

  const removeUsedFormula = (formulaId: string) => {
    setUsedFormulas(usedFormulas.filter(id => id !== formulaId));
  };

  const addDerivableFormula = (formulaId: string) => {
    if (!derivableFormulas.includes(formulaId)) {
      setDerivableFormulas([...derivableFormulas, formulaId]);
    }
    setShowDerivableSelector(false);
  };

  const removeDerivableFormula = (formulaId: string) => {
    setDerivableFormulas(derivableFormulas.filter(id => id !== formulaId));
  };

  // 获取场景/步骤名称
  const getContextName = (ctx: ContextReference): string => {
    const scenario = dataStore.getScenario(ctx.scenarioId);
    if (!scenario) return '不明';
    const step = scenario.steps.find(st => st.id === ctx.stepId);
    return `${scenario.name} > ${step?.name || '不明'}`;
  };

  const handleSave = () => {
    // 无必填项，直接保存
    console.log('Saving formula info:', {
      formulaId,
      formulaName,
      expression,
      description,
      equivalentExpressions: equivalentExpressions.filter(e => e.trim()),
      symbols: symbols.filter(s => s.symbol.trim()),
      usedInContexts,
      usedFormulas,
      derivableFormulas
    });
    onSave({
      name: formulaName,
      description,
      equivalentExpressions: equivalentExpressions.filter(e => e.trim()),
      symbols: symbols.filter(s => s.symbol.trim()),
      usedInContexts,
      usedFormulas,
      derivableFormulas
    });
  };

  // 计算说明摘要
  const getDescriptionSummary = () => {
    if (!description) return '';
    const lines = description.split('\n');
    const firstLine = lines[0];
    return firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between border-b border-border">
        <button onClick={onBack} className="p-2 hover:bg-primary/10 rounded-xl transition-colors" title="構造編集に戻る">
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

      {/* Main Content */}
      <main className="flex-1 p-4 pb-20 overflow-y-auto space-y-3">
        {/* 公式本体 */}
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs text-muted-foreground mb-3">公式</div>
          <div className="text-2xl text-foreground font-mono text-center overflow-x-auto">
            {expression || '（公式が入力されていません）'}
          </div>
        </div>

        {/* 公式名 */}
        <div>
          <div className="text-xs text-muted-foreground mb-2 px-1">公式名（任意）</div>
          <input
            type="text"
            value={formulaName}
            onChange={(e) => setFormulaName(e.target.value)}
            placeholder="例：運動方程式"
            className="w-full px-4 py-3 glass-card rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
          />
        </div>

        {/* 等価表現 */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setIsEquivalentExpanded(!isEquivalentExpanded)}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-primary/5 transition-colors"
          >
            <div className="flex-1 text-left text-sm text-foreground">
              同値な表現
              {equivalentExpressions.length > 0 && (
                <span className="ml-2 text-muted-foreground">({equivalentExpressions.length})</span>
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
                    onChange={(e) => updateEquivalentExpression(index, e.target.value)}
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
                <span className="ml-2 text-muted-foreground">({usedInContexts.length})</span>
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

              {/* 新UI：拆分场景和步骤选择器 */}
              <ScenarioStepSelector onAdd={addContext} />
            </div>
          )}
        </div>

        {/* 記号の意味 */}
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
              <div className="text-xs text-muted-foreground mb-2">記号 / 意味 / 単位</div>
              {symbols.map((sym, index) => (
                <div key={index} className="grid grid-cols-[60px_1fr_80px_32px] gap-2 mb-2">
                  <input
                    type="text"
                    value={sym.symbol}
                    onChange={(e) => updateSymbol(index, 'symbol', e.target.value)}
                    placeholder="記号"
                    className="px-2 py-2 border border-gray-200 rounded text-sm text-center font-mono focus:outline-none focus:border-gray-400"
                  />
                  <input
                    type="text"
                    value={sym.meaning}
                    onChange={(e) => updateSymbol(index, 'meaning', e.target.value)}
                    placeholder="意味"
                    className="px-2 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-gray-400"
                  />
                  <input
                    type="text"
                    value={sym.unit}
                    onChange={(e) => updateSymbol(index, 'unit', e.target.value)}
                    placeholder="単位"
                    className="px-2 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-gray-400"
                  />
                  <button
                    onClick={() => removeSymbol(index)}
                    className="p-2 text-gray-400 hover:text-red-500"
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
                <span className="ml-2 text-muted-foreground">({usedFormulas.length})</span>
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
              {usedFormulas.map((fId) => {
                const formula = dataStore.getFormula(fId);
                return (
                  <div
                    key={fId}
                    className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">{formula?.name || fId}</div>
                      <div className="text-xs text-gray-400 font-mono">
                        {formula?.expression}
                      </div>
                    </div>
                    <button
                      onClick={() => removeUsedFormula(fId)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {showUsedFormulaSelector ? (
                <div className="border border-gray-300 rounded max-h-60 overflow-y-auto mb-2">
                  {Object.values(dataStore.getFormulas()).map((formula) => (
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
                <span className="ml-2 text-muted-foreground">({derivableFormulas.length})</span>
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
              {derivableFormulas.map((fId) => {
                const formula = dataStore.getFormula(fId);
                return (
                  <div
                    key={fId}
                    className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">{formula?.name || fId}</div>
                      <div className="text-xs text-gray-400 font-mono">
                        {formula?.expression}
                      </div>
                    </div>
                    <button
                      onClick={() => removeDerivableFormula(fId)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {showDerivableSelector ? (
                <div className="border border-gray-300 rounded max-h-60 overflow-y-auto mb-2">
                  {Object.values(dataStore.getFormulas()).map((formula) => (
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

      {/* Bottom Actions - 只有保存按钮 */}
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
import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import { dataStore } from '../store/dataStore';
import FormulaRenderer from './FormulaRenderer';
import BottomNav from './BottomNav';

interface FormulaDetailPageProps {
  formulaId: string;
  onBack: () => void;
  onEdit: () => void;
  onLearningClick: () => void;
  onFormulaClick: (formulaId: string) => void;
  onContextClick: (scenarioId: string, stepId: string) => void;
  /** optional: jump to symbol detail page */
  onSymbolClick?: (symbolId: string) => void;
}

export default function FormulaDetailPage({
  formulaId,
  onBack,
  onEdit,
  onLearningClick,
  onFormulaClick,
  onContextClick,
  onSymbolClick,
}: FormulaDetailPageProps) {
  const formula = dataStore.getFormula(formulaId);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isContextsExpanded, setIsContextsExpanded] = useState(false);
  const [isSymbolsExpanded, setIsSymbolsExpanded] = useState(false);

  const normalizeKey = (s: string) => (s || '').trim();

  const container = (...children: any[]) => ({ children });
  const symNode = (value: string) => ({ type: 'symbol', value });

  // Build a lightweight FormulaRoot for keys like: K_1, σ_{許容}, t^2, k_日本語
  const buildSymbolKeyRoot = (rawKey: string) => {
    const s = (rawKey || '').trim();
    if (!s) return container();

    let i = 0;
    const readGroup = (): string => {
      if (s[i] === '{') {
        i++; // skip '{'
        const start = i;
        let depth = 1;
        while (i < s.length) {
          const ch = s[i];
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) break;
          }
          i++;
        }
        const text = s.slice(start, i);
        if (s[i] === '}') i++; // skip '}'
        return text;
      }
      const start = i;
      while (i < s.length) {
        const ch = s[i];
        if (ch === '_' || ch === '^') break;
        i++;
      }
      return s.slice(start, i);
    };

    let baseText = '';
    while (i < s.length && s[i] !== '_' && s[i] !== '^') {
      baseText += s[i];
      i++;
    }
    baseText = baseText.trim();
    let current = container(symNode(baseText || s));

    while (i < s.length) {
      const op = s[i];
      if (op !== '_' && op !== '^') {
        i++;
        continue;
      }
      i++;
      const groupText = readGroup();
      const group = container(symNode(groupText.trim()));
      if (op === '_') {
        current = container({ type: 'subscript', base: current, index: group });
      } else {
        current = container({ type: 'superscript', base: current, exponent: group });
      }
    }

    return current;
  };

  const handleSymbolJump = (key: string, meaning?: string, unit?: string) => {
  if (!onSymbolClick) return;
  if (!formula) return;

  const k = normalizeKey(key);
  const symbols = Object.values(dataStore.getSymbols());
  const hit = symbols.find((x: any) => normalizeKey(x.key) === k);

  // 已存在 → 直接跳
  if (hit?.id) {
    onSymbolClick(hit.id);
    return;
  }

  // 不存在 → 自动创建后跳（保证“永远可跳转”）
  const now = new Date().toISOString();
  const newId = `sym-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const autoId = `auto-${String(formula.id)}`;

  dataStore.saveSymbol({
    id: newId,
    key,
    entries: [
      {
        id: autoId,
        title: String(formula.name || key),
        description: String(meaning || ''),
        unit: unit ? String(unit) : undefined,
        formulaIds: [String(formula.id)],
        tables: [],
      },
    ],
    createdAt: now,
    updatedAt: now,
  } as any);

  onSymbolClick(newId);
};


  if (!formula) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="px-5 py-4 flex items-center justify-between border-b border-border">
          <button onClick={onBack} className="p-2 hover:bg-primary/10 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="flex-1 text-center text-foreground">新しい公式</h1>
          <div className="w-9" />
        </header>
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="text-muted-foreground mb-6">公式が保存されました</div>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
            >
              戻る
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background pb-16">
      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between border-b border-border">
        <button onClick={onBack} className="p-2 hover:bg-primary/10 rounded-xl transition-colors">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="flex-1 text-center text-foreground">{formula.name}</h1>
        <button onClick={onEdit} className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors">
          <Edit2 className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-4 space-y-3 overflow-y-auto">
        {/* Formula Display */}
        <div className="glass-card rounded-2xl p-5">
          <div className="text-2xl text-foreground text-center">
            <FormulaRenderer
              root={(formula.structureTree || formula.structureData) as any}
              fallback={formula.expression}
              className=""
              maskBlocks={[]}
            />
          </div>
        </div>

        {/* この公式が使われる場面 */}
        {formula.usedInContexts && formula.usedInContexts.length > 0 && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <button
              onClick={() => setIsContextsExpanded(!isContextsExpanded)}
              className="w-full px-5 py-4 flex items-center gap-3 hover:bg-primary/5 transition-colors"
            >
              <div className="flex-1 text-left text-sm text-foreground">この公式が使われる場面</div>
              <div className="text-primary">
                {isContextsExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </div>
            </button>

            {isContextsExpanded && (
              <div className="border-t border-border">
                {formula.usedInContexts.map((context, index) => {
                  const scenarios = dataStore.getScenarios();
                  const scenario = scenarios.find((s) => s.id === context.scenarioId);
                  const step = scenario?.steps.find((st) => st.id === context.stepId);
                  return (
                    <button
                      key={index}
                      onClick={() => onContextClick(context.scenarioId, context.stepId)}
                      className="w-full px-5 py-3 text-left hover:bg-primary/5 transition-colors border-b border-border last:border-b-0"
                    >
                      <div className="text-foreground text-sm">{scenario?.name}</div>
                      <div className="text-muted-foreground text-xs mt-1">{step?.name}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 記号の意味 */}
        {formula.symbols && formula.symbols.length > 0 && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <button
              onClick={() => setIsSymbolsExpanded(!isSymbolsExpanded)}
              className="w-full px-5 py-4 flex items-center gap-3 hover:bg-primary/5 transition-colors"
            >
              <div className="flex-1 text-left text-sm text-foreground">記号の意味</div>
              <div className="text-primary">
                {isSymbolsExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </div>
            </button>

            {isSymbolsExpanded && (
              <div className="border-t border-border">
                {formula.symbols.map((sym, index) => (
                  <div key={index} className="px-5 py-3 flex items-center gap-4 text-sm border-b border-border last:border-b-0">
                    {(() => {
                      const symKey = ((sym as any).symbol ?? (sym as any).key ?? '').toString();
                      const root = symKey ? buildSymbolKeyRoot(symKey) : null;
                      const rootOrNull = root && Array.isArray((root as any).children) && (root as any).children.length > 0 ? root : null;
                      return (
                    <button
                      type="button"
                      onClick={() => handleSymbolJump(symKey, sym.meaning, sym.unit)}
                      disabled={!onSymbolClick}
                      className="flex-shrink-0 min-w-14 w-14 text-center text-foreground text-lg rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-100 disabled:hover:bg-transparent"
                      title={symKey}
                    >
                      <FormulaRenderer
                        root={rootOrNull as any}
                        fallback={symKey}
                        className=""
                        maskBlocks={[]}
                      />
                    </button>
                      );
                    })()}
                    <div className="flex-1 text-foreground">{sym.meaning}</div>
                    {sym.unit && <div className="text-muted-foreground text-xs">{sym.unit}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 同値な表現 */}
        {formula.equivalentExpressions && formula.equivalentExpressions.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2 px-1">同値な表現</div>
            <div className="glass-card rounded-2xl divide-y divide-border">
              {formula.equivalentExpressions.map((expr, index) => (
                <div key={index} className="px-5 py-3 text-sm font-mono text-foreground">
                  {expr}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 公式の説明 */}
        {formula.description && (
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
              <div className="px-5 py-4 pt-2 text-sm text-foreground leading-relaxed border-t border-border">
                {formula.description}
              </div>
            )}
          </div>
        )}

        {/* 使用する公式 */}
        {formula.usedFormulas.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2 px-1">使用する公式</div>
            <div className="glass-card rounded-2xl divide-y divide-border">
              {formula.usedFormulas.map((fId) => {
                const f = dataStore.getFormula(fId);
                if (!f) return null;
                return (
                  <button
                    key={fId}
                    onClick={() => onFormulaClick(fId)}
                    className="w-full px-5 py-3 text-left hover:bg-primary/5 transition-colors"
                  >
                    <div className="text-sm text-foreground mb-1">{f.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{f.expression}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 導出できる公式 */}
        {formula.derivableFormulas.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2 px-1">導出できる公式</div>
            <div className="glass-card rounded-2xl divide-y divide-border">
              {formula.derivableFormulas.map((fId) => {
                const f = dataStore.getFormula(fId);
                if (!f) return null;
                return (
                  <button
                    key={fId}
                    onClick={() => onFormulaClick(fId)}
                    className="w-full px-5 py-3 text-left hover:bg-primary/5 transition-colors"
                  >
                    <div className="text-sm text-foreground mb-1">{f.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{f.expression}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        currentPage="home"
        onNavigateHome={onBack}
        onNavigateLearning={onLearningClick}
      />
    </div>
  );
}
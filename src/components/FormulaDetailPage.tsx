import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import { dataStore } from '../store/dataStore';
import BottomNav from './BottomNav';
import FormulaRenderer from './FormulaRenderer';

interface FormulaDetailPageProps {
  formulaId: string;
  onBack: () => void;
  onEdit: () => void;
  onLearningClick: () => void;
  onFormulaClick: (formulaId: string) => void;
  onContextClick: (scenarioId: string, stepId: string) => void;
}

export default function FormulaDetailPage({
  formulaId,
  onBack,
  onEdit,
  onLearningClick,
  onFormulaClick,
  onContextClick,
}: FormulaDetailPageProps) {
  const formula = dataStore.getFormula(formulaId);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isContextsExpanded, setIsContextsExpanded] = useState(false);
  const [isSymbolsExpanded, setIsSymbolsExpanded] = useState(false);

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
                    <div className="font-mono text-foreground text-lg w-10 text-center">{sym.symbol}</div>
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
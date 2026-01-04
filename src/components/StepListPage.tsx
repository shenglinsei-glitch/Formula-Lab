import React, { useEffect, useMemo, useState, useRef } from "react";
import { ChevronDown, MoreVertical, Plus, ChevronLeft, Maximize2, Minimize2, X } from "lucide-react";
import { dataStore } from '../store/dataStore';
import { UNCATEGORIZED_SCENARIO_ID } from '../store/dataStore';
import BottomNav from './BottomNav';

interface StepListPageProps {
  scenarioId: string;
  targetStepId: string | null;
  onBack: () => void;
  onFormulaClick: (formulaId: string) => void;
  onLearningClick: () => void;
}

export default function StepListPage({
  scenarioId,
  targetStepId,
  onBack,
  onFormulaClick,
  onLearningClick,
}: StepListPageProps) {
  const [scenario, setScenario] = useState(() => dataStore.getScenario(scenarioId));
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showAddStepDialog, setShowAddStepDialog] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [showFormulaSelector, setShowFormulaSelector] = useState<string | null>(null);

  // Step action menu (via '...' button)
  const [stepMenu, setStepMenu] = useState<null | { stepId: string; anchorRect: DOMRect }>(null);

  const openStepMenu = (stepId: string, anchorRect: DOMRect) => {
    setStepMenu({ stepId, anchorRect });
  };

  const closeStepMenu = () => {
    setStepMenu(null);
  };

  useEffect(() => {
    if (!stepMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeStepMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepMenu]);

  // 订阅数据更新

  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setScenario(dataStore.getScenario(scenarioId));
    });
    return unsubscribe;
  }, [scenarioId]);

  if (!scenario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">シナリオが見つかりません</div>
      </div>
    );
  }

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const expandAll = () => {
    setExpandedSteps(new Set(scenario.steps.map((s) => s.id)));
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  useEffect(() => {
    if (targetStepId) {
      setExpandedSteps(new Set([targetStepId]));
    }
  }, [targetStepId]);

  const addStep = () => {
    if (newStepName.trim()) {
      dataStore.addStep(scenarioId, newStepName);
      setNewStepName('');
      setShowAddStepDialog(false);
    }
  };

  const deleteStep = (stepId: string) => {
    if (confirm('このステップを削除しますか？（公式は削除されません）')) {
      dataStore.deleteStep(scenarioId, stepId);
    }
  };

  const addFormulaToStep = (stepId: string, formulaId: string) => {
    dataStore.addFormulaToStep(scenarioId, stepId, formulaId);
    setShowFormulaSelector(null);
  };

  const removeFormulaFromStep = (stepId: string, formulaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dataStore.removeFormulaFromStep(scenarioId, stepId, formulaId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background pb-16">
      {/* Step context menu */}
      {stepMenu &&
        (() => {
          const MENU_W = 220;
          const MENU_H = 112; // approx height for 2 items
          const PAD = 10;

          const rect = stepMenu.anchorRect;
          const vw = window.innerWidth;
          const vh = window.innerHeight;

          // Default: align to the '...' button's right edge, show below
          let left = rect.right - MENU_W;
          let top = rect.bottom + 8;

          // Clamp horizontally
          if (left < PAD) left = PAD;
          if (left + MENU_W > vw - PAD) left = vw - PAD - MENU_W;

          // If bottom overflows, show above
          if (top + MENU_H > vh - PAD) {
            top = rect.top - 8 - MENU_H;
          }
          if (top < PAD) top = PAD;

          return (
            <div
              className="fixed inset-0 z-50"
              onPointerDown={() => closeStepMenu()}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div
                className="absolute bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md shadow-xl rounded-xl border border-border p-1 min-w-[200px]"
                style={{ left, top, width: MENU_W }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors"
                  onClick={() => {
                    setShowFormulaSelector(stepMenu.stepId);
                    closeStepMenu();
                  }}
                >
                  ＋ 公式を追加
                </button>
				<button
				  type="button"
				  className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-500/10 transition-colors text-orange-500 hover:text-orange-600"
                  onClick={() => {
                    deleteStep(stepMenu.stepId);
                    closeStepMenu();
                  }}
                >
                  ステップを削除
                </button>
              </div>
            </div>
          );
        })()}

      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between border-b border-border">
        <button onClick={onBack} className="p-2 hover:bg-primary/10 rounded-xl transition-colors">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="flex-1 text-center text-foreground">{scenario.name}</h1>
        
        {/* 展開/折叠控制 - 图标化 */}
        <div className="flex gap-1">
          <button
            onClick={expandAll}
            className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
            title="全展開"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={collapseAll}
            className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
            title="全折畳"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowAddStepDialog(true)}
            className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
            title="ステップ追加"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Steps List */}
      <main className="flex-1 p-4 pb-4 overflow-y-auto space-y-2">
        {scenario.steps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.id);
          return (
            <div key={step.id} className="glass-card rounded-2xl overflow-hidden">
              {/* Step Header */}
              <div
                className="px-4 py-3 flex items-center justify-between select-none"
              >
                <button
                  type="button"
                  onClick={() => toggleStep(step.id)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                  <span className="font-medium text-foreground">ステップ{index + 1}: {step.name}</span>
                </button>

                <button
                  type="button"
                  aria-label="ステップメニュー"
                  onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      openStepMenu(step.id, rect);
                    }}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {/* Formula List */}
              {isExpanded && (
                <div className="border-t border-border">
                  {(step.formulaIds || []).map((formulaId) => {
                    const formula = dataStore.getFormula(formulaId);
                    if (!formula) return null;
                    
                    return (
                      <div
                        key={formula.id}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-primary/5 transition-colors border-b border-border last:border-b-0"
                      >
                        <button
                          onClick={() => onFormulaClick(formula.id)}
                          className="flex-1 text-left"
                        >
                          <div className="text-sm text-foreground mb-1">{formula.name}</div>
                          <div className="text-sm text-muted-foreground font-mono">{formula.expression}</div>
                        </button>
	                        {scenarioId !== UNCATEGORIZED_SCENARIO_ID && (
	                          <button
	                            onClick={(e) => removeFormulaFromStep(step.id, formulaId, e)}
	                            className="p-2 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-colors"
	                            title="削除"
	                          >
	                            <X className="w-4 h-4" />
	                          </button>
	                        )}
                      </div>
                    );
                  })}
                  
                  {/* Add Formula Button */}
                  {scenarioId !== UNCATEGORIZED_SCENARIO_ID && showFormulaSelector === step.id && (
                    <div className="p-4">
                      <div className="glass-card rounded-xl max-h-60 overflow-y-auto">
                        {Object.values(dataStore.getFormulas()).map((formula) => {
                          const alreadyAdded = step.formulaIds.includes(formula.id);
                          return (
                            <button
                              key={formula.id}
                              onClick={() => addFormulaToStep(step.id, formula.id)}
                              disabled={alreadyAdded}
                              className="w-full px-4 py-3 text-left hover:bg-primary/5 border-b border-border last:border-b-0 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <div className="text-sm text-foreground">{formula.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{formula.expression}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        currentPage="home"
        onNavigateHome={onBack}
        onNavigateLearning={onLearningClick}
      />

      {/* Add Step Dialog */}
      {showAddStepDialog && (
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowAddStepDialog(false)}
          />
          
          {/* 对话框 */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <div className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h2 className="text-foreground mb-4">新しいステップを追加</h2>
              <input
                type="text"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addStep();
                  if (e.key === 'Escape') setShowAddStepDialog(false);
                }}
                className="w-full px-4 py-3 glass-card rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground mb-4"
                placeholder="ステップ名を入力"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddStepDialog(false)}
                  className="flex-1 px-4 py-2.5 glass-card rounded-xl text-sm text-muted-foreground hover:bg-muted/10 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={addStep}
                  disabled={!newStepName.trim()}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
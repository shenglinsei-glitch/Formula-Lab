import React, { useState, useEffect } from 'react';
import { Settings, Eye, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { dataStore } from '../store/dataStore';
import type { Formula } from '../data/scenarios';
import LearningSettings from './LearningSettings';
import BottomNav from './BottomNav';

// 容器类型
type Container = {
  children: FormulaNode[];
};

// 节点类型
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

// 学习模式
type LearningMode = 'left' | 'right' | 'whole';
type CoverRatio = 30 | 50 | 70 | 100;
type LearningContentType = 'formula' | 'symbols' | 'relations' | 'steps';
type StepCoverMode = 'random' | 'title' | 'formulas';

interface LearningPageProps {
  onBack: () => void;
  onNavigateHome: () => void;
}

interface MaskBlock {
  id: string;
  content: any;
}

// 学习题目类型
interface LearningItem {
  type: LearningContentType;
  // 公式题使用 formula；步骤题使用 step
  formula?: Formula;
  step?: { scenarioId: string; scenarioName: string; stepId: string; stepName: string; formulaIds: string[] };
  maskBlocks: MaskBlock[];
}

export default function LearningPage({ onBack, onNavigateHome }: LearningPageProps) {
  // 设置抽屉
  const [showSettings, setShowSettings] = useState(false);
  
  // 学习范围（仅场景多选）
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  
  // 学习内容类型（多选）
  const [contentTypes, setContentTypes] = useState<LearningContentType[]>(['formula']);
  
  // 学习设置（公式遮挡用）
  const [mode, setMode] = useState<LearningMode>('right');
  const [ratio, setRatio] = useState<CoverRatio>(50);
  const [isRandom, setIsRandom] = useState(true);
  // 計算ステップ遮挡対象
  const [stepCoverMode, setStepCoverMode] = useState<StepCoverMode>('random');
  
  // 学习状态
  const [isLearning, setIsLearning] = useState(false);
  const [revealedMaskIds, setRevealedMaskIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [learningItems, setLearningItems] = useState<LearningItem[]>([]);
  
  // 收集公式（从选中的场景）
  const collectFormulasToLearn = (): Formula[] => {
    const formulaIds = new Set<string>();
    
    selectedScenarioIds.forEach(scenarioId => {
      const scenario = dataStore.getScenario(scenarioId);
      if (scenario) {
        scenario.steps.forEach(step => {
          step.formulaIds.forEach(fid => formulaIds.add(fid));
        });
      }
    });
    
    const formulas: Formula[] = [];
    formulaIds.forEach(fid => {
      const formula = dataStore.getFormula(fid);
      if (formula) formulas.push(formula);
    });
    
    return formulas;
  };
  
  
  // 收集步骤（从选中的场景）
  const collectStepsToLearn = (): { scenarioId: string; scenarioName: string; stepId: string; stepName: string; formulaIds: string[] }[] => {
    const steps: { scenarioId: string; scenarioName: string; stepId: string; stepName: string; formulaIds: string[] }[] = [];
    selectedScenarioIds.forEach((scenarioId) => {
      const scenario = dataStore.getScenario(scenarioId);
      if (!scenario) return;
      scenario.steps.forEach((step) => {
        steps.push({
          scenarioId,
          scenarioName: scenario.name,
          stepId: step.id,
          stepName: step.name,
          formulaIds: step.formulaIds || [],
        });
      });
    });
    return steps;
  };

  // === 計算ステップ遮挡 ===
  // 题型：隐藏「ステップ名」或隐藏「ステップ内の公式（若干）」用于回想该步骤算什么/用什么公式
  const generateStepMaskBlocks = (step: { stepId: string; formulaIds: string[] }): MaskBlock[] => {
    // 遮挡目标：ステップ名のみ / 公式のみ / ランダム
    const hideTitle =
      stepCoverMode === 'title'
        ? true
        : stepCoverMode === 'formulas'
          ? false
          : Math.random() < 0.5;

    if (hideTitle) {
      return [{ id: `step-${step.stepId}-title`, content: { kind: 'title' } }];
    }

    const fids = step.formulaIds || [];
    if (fids.length === 0) {
      return [{ id: `step-${step.stepId}-title`, content: { kind: 'title' } }];
    }

    const count = Math.max(1, Math.ceil(fids.length * (ratio / 100)));
    let indices: number[];
    if (isRandom) {
      indices = [...Array(fids.length).keys()].sort(() => Math.random() - 0.5).slice(0, count);
    } else {
      indices = [...Array(fids.length).keys()].slice(0, count);
    }
    return indices.map((i) => ({
      id: `step-${step.stepId}-formula-${i}`,
      content: { kind: 'formula', index: i },
    }));
  };
// === 公式本体遮挡 ===
  const collectNodePaths = (root: FormulaRoot, basePath: (number | string)[] = []): (number | string)[][] => {
    const paths: (number | string)[][] = [];
    
    const traverse = (container: Container, currentPath: (number | string)[]) => {
      container.children.forEach((node, index) => {
        const nodePath = [...currentPath, index];
        paths.push(nodePath);
        
        if (node.type === 'fraction') {
          traverse(node.numerator, [...nodePath, 'numerator']);
          traverse(node.denominator, [...nodePath, 'denominator']);
        } else if (node.type === 'superscript') {
          traverse(node.base, [...nodePath, 'base']);
          traverse(node.exponent, [...nodePath, 'exponent']);
        } else if (node.type === 'subscript') {
          traverse(node.base, [...nodePath, 'base']);
          traverse(node.index, [...nodePath, 'index']);
        } else if (node.type === 'sqrt' || node.type === 'abs') {
          traverse(node.content, [...nodePath, 'content']);
        } else if (node.type === 'sum' || node.type === 'integral') {
          traverse(node.lower, [...nodePath, 'lower']);
          traverse(node.upper, [...nodePath, 'upper']);
          traverse(node.body, [...nodePath, 'body']);
        } else if (node.type === 'function') {
          traverse(node.argument, [...nodePath, 'argument']);
        }
      });
    };
    
    traverse(root, basePath);
    return paths;
  };
  
  const findEqualsIndex = (root: FormulaRoot): number => {
    for (let i = 0; i < root.children.length; i++) {
      const node = root.children[i];
      if (node.type === 'symbol' && node.value === '=') {
        return i;
      }
    }
    return -1;
  };
  
  const generateFormulaMaskBlocks = (root: FormulaRoot): MaskBlock[] => {
    const allPaths = collectNodePaths(root);
    const equalsIndex = findEqualsIndex(root);
    
    let targetPaths: (number | string)[][] = [];
    
    if (mode === 'left' && equalsIndex >= 0) {
      targetPaths = allPaths.filter(path => {
        const firstIndex = path[0];
        return typeof firstIndex === 'number' && firstIndex < equalsIndex;
      });
    } else if (mode === 'right' && equalsIndex >= 0) {
      targetPaths = allPaths.filter(path => {
        const firstIndex = path[0];
        return typeof firstIndex === 'number' && firstIndex > equalsIndex;
      });
    } else {
      targetPaths = allPaths;
    }
    
    const count = Math.ceil(targetPaths.length * (ratio / 100));
    let selectedPaths: (number | string)[][];
    
    if (isRandom) {
      const shuffled = [...targetPaths].sort(() => Math.random() - 0.5);
      selectedPaths = shuffled.slice(0, count);
    } else {
      selectedPaths = targetPaths.slice(0, count);
    }
    
    return selectedPaths.map(path => ({
      id: `formula-${path.join('-')}`,
      content: path
    }));
  };
  
  // === 记号的意味遮挡 ===
  const generateSymbolMaskBlocks = (symbols: any[]): MaskBlock[] => {
    const count = Math.ceil(symbols.length * (ratio / 100));
    let indices: number[];
    
    if (isRandom) {
      const shuffled = symbols.map((_, i) => i).sort(() => Math.random() - 0.5);
      indices = shuffled.slice(0, count);
    } else {
      indices = Array.from({ length: count }, (_, i) => i);
    }
    
    return indices.map(index => ({
      id: `symbol-${index}-${mode}`,
      content: { index, mode }
    }));
  };
  
  // === 关联公式遮挡 ===
  const generateRelationMaskBlocks = (relations: string[]): MaskBlock[] => {
    const count = Math.ceil(relations.length * (ratio / 100));
    let indices: number[];
    
    if (isRandom) {
      const shuffled = relations.map((_, i) => i).sort(() => Math.random() - 0.5);
      indices = shuffled.slice(0, count);
    } else {
      indices = Array.from({ length: count }, (_, i) => i);
    }
    
    return indices.map(index => ({
      id: `relation-${index}`,
      content: index
    }));
  };
  
  // 应用设置并开始学习
  const applySettingsAndStart = () => {
    const formulas = collectFormulasToLearn();
    const steps = collectStepsToLearn();

    const items: LearningItem[] = [];

    // 公式相关题型（公式本体 / 記号の意味 / 関連公式）
    formulas.forEach((formula) => {
      if (contentTypes.includes('formula') && (formula.structureTree || formula.structureData)) {
        const data = formula.structureTree || formula.structureData;
        const maskBlocks = generateFormulaMaskBlocks(data);
        items.push({ type: 'formula', formula, maskBlocks });
      }

      if (contentTypes.includes('symbols') && formula.symbols && formula.symbols.length > 0) {
        const maskBlocks = generateSymbolMaskBlocks(formula.symbols);
        items.push({ type: 'symbols', formula, maskBlocks });
      }

      if (contentTypes.includes('relations')) {
        const allRelations = [
          ...(formula.usedFormulas || []),
          ...(formula.derivableFormulas || []),
          ...(formula.equivalentExpressions || []),
        ];

        if (allRelations.length > 0) {
          const maskBlocks = generateRelationMaskBlocks(allRelations);
          items.push({ type: 'relations', formula, maskBlocks });
        }
      }
    });

    // 計算ステップ题型
    if (contentTypes.includes('steps')) {
      steps.forEach((step) => {
        const maskBlocks = generateStepMaskBlocks({ stepId: step.stepId, formulaIds: step.formulaIds });
        items.push({ type: 'steps', step, maskBlocks });
      });
    }

    if (items.length === 0) {
      alert('選択範囲に学習可能なデータがありません');
      return;
    }

    const finalItems = isRandom ? [...items].sort(() => Math.random() - 0.5) : items;

    setLearningItems(finalItems);
    setCurrentIndex(0);
    setIsLearning(true);
    setRevealedMaskIds(new Set());
    setShowSettings(false);
  };
  
  // 渲染公式节点
  const renderFormulaNode = (node: FormulaNode, path: (number | string)[], maskBlocks: MaskBlock[]): React.ReactNode => {
    const maskBlock = maskBlocks.find(b => b.id === `formula-${path.join('-')}`);
    const isRevealed = maskBlock && revealedMaskIds.has(maskBlock.id);
    
    if (maskBlock && !isRevealed) {
      return (
        <button
          key={path.join('-')}
          onClick={() => {
            const newRevealed = new Set(revealedMaskIds);
            newRevealed.add(maskBlock.id);
            setRevealedMaskIds(newRevealed);
          }}
          className="inline-block px-2 py-0.5 mx-0.5 bg-muted/50 text-muted rounded cursor-pointer hover:bg-muted transition-colors"
        >
          ?
        </button>
      );
    }
    
    if (node.type === 'symbol') {
      return <span key={path.join('-')} className="font-mono">{node.value}</span>;
    } else if (node.type === 'fraction') {
      return (
        <span key={path.join('-')} className="inline-flex flex-col items-center mx-1 text-sm">
          <span className="border-b border-foreground px-1">
            {renderContainer(node.numerator, [...path, 'numerator'], maskBlocks)}
          </span>
          <span className="px-1">
            {renderContainer(node.denominator, [...path, 'denominator'], maskBlocks)}
          </span>
        </span>
      );
    } else if (node.type === 'superscript') {
      return (
        <span key={path.join('-')} className="inline-flex items-start">
          {renderContainer(node.base, [...path, 'base'], maskBlocks)}
          <sup className="text-xs">{renderContainer(node.exponent, [...path, 'exponent'], maskBlocks)}</sup>
        </span>
      );
    } else if (node.type === 'subscript') {
      return (
        <span key={path.join('-')} className="inline-flex items-end">
          {renderContainer(node.base, [...path, 'base'], maskBlocks)}
          <sub className="text-xs">{renderContainer(node.index, [...path, 'index'], maskBlocks)}</sub>
        </span>
      );
    } else if (node.type === 'sqrt') {
      return (
        <span key={path.join('-')} className="inline-flex items-center">
          <span className="mr-0.5">√</span>
          <span className="border-t border-foreground px-1">
            {renderContainer(node.content, [...path, 'content'], maskBlocks)}
          </span>
        </span>
      );
    }
    
    return <span key={path.join('-')}>?</span>;
  };
  
  const renderContainer = (container: Container, basePath: (number | string)[], maskBlocks: MaskBlock[]): React.ReactNode => {
    return container.children.map((node, index) => 
      renderFormulaNode(node, [...basePath, index], maskBlocks)
    );
  };
  
  // 渲染当前题目
  const renderCurrentItem = () => {
    if (!isLearning || learningItems.length === 0) {
      return (
        <div className="text-center py-16">
          <div className="text-muted-foreground">
            設定から学習範囲と内容を選択し、<br />「適用 / 開始」を押してください
          </div>
        </div>
      );
    }

    const item = learningItems[currentIndex];

    // 計算ステップ題
    if (item.type === 'steps' && item.step) {
      const step = item.step;

      const reveal = (id: string) => {
        const next = new Set(revealedMaskIds);
        next.add(id);
        setRevealedMaskIds(next);
      };

      const titleBlockId = `step-${step.stepId}-title`;
      const titleMasked = item.maskBlocks.some((b) => b.id === titleBlockId) && !revealedMaskIds.has(titleBlockId);

      return (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="text-xs text-muted-foreground mb-2">{step.scenarioName}</div>

            {titleMasked ? (
              <button
                onClick={() => reveal(titleBlockId)}
                className="inline-block px-3 py-2 bg-muted/50 text-muted rounded cursor-pointer hover:bg-muted transition-colors"
              >
                ?
              </button>
            ) : (
              <div className="text-xl text-foreground font-medium">{step.stepName}</div>
            )}
          </div>

          <div className="glass-card rounded-2xl p-4">
            <div className="text-xs text-muted-foreground mb-3">このステップで使う公式</div>

            <div className="space-y-2">
              {(step.formulaIds || []).length === 0 && (
                <div className="text-sm text-muted-foreground">（公式が未登録です）</div>
              )}

              {(step.formulaIds || []).map((fid, idx) => {
                const f = dataStore.getFormula(fid);
                if (!f) return null;

                const blockId = `step-${step.stepId}-formula-${idx}`;
                const isMasked = item.maskBlocks.some((b) => b.id === blockId) && !revealedMaskIds.has(blockId);

                return isMasked ? (
                  <button
                    key={fid}
                    onClick={() => reveal(blockId)}
                    className="w-full px-3 py-2 bg-muted/50 text-muted rounded cursor-pointer hover:bg-muted transition-colors"
                  >
                    ?
                  </button>
                ) : (
                  <div key={fid} className="font-mono text-foreground">{f.expression}</div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            「このステップは何を計算する？」／「どの公式を使う？」を思い出してください
          </div>
        </div>
      );
    }

    // 公式题：题干始终显示公式本体
    const formula = item.formula!;
    const data = item.type === 'formula' ? (formula.structureTree || formula.structureData) : null;

    return (
      <div>
        {/* 题干：始终显示公式本体 */}
        <div className="text-center mb-8">
          <div className="text-sm text-muted-foreground mb-4">
            {formula.name || formula.expression}
          </div>
          {data && (
            <div className="text-3xl inline-block">
              {renderContainer(data, [], item.type === 'formula' ? item.maskBlocks : [])}
            </div>
          )}
        </div>

        {/* 学习内容区 */}
        {item.type === 'symbols' && (
          <div className="space-y-3">
            {formula.symbols!.map((sym: any, idx: number) => {
              const maskBlock = item.maskBlocks.find(b => b.content.index === idx);
              const isRevealed = maskBlock && revealedMaskIds.has(maskBlock.id);
              const mode = maskBlock?.content.mode;

              return (
                <div key={idx} className="glass-card rounded-2xl p-4 flex items-center gap-4">
                  {/* Symbol */}
                  {mode === 'left' && maskBlock && !isRevealed ? (
                    <button
                      onClick={() => {
                        const newRevealed = new Set(revealedMaskIds);
                        newRevealed.add(maskBlock.id);
                        setRevealedMaskIds(newRevealed);
                      }}
                      className="w-12 text-center px-2 py-0.5 bg-muted/50 text-muted rounded cursor-pointer hover:bg-muted transition-colors"
                    >
                      ?
                    </button>
                  ) : (
                    <div className="text-2xl font-mono w-12 text-center">{sym.symbol}</div>
                  )}

                  {/* Meaning + Unit */}
                  {(mode === 'right' || mode === 'whole') && maskBlock && !isRevealed ? (
                    <button
                      onClick={() => {
                        const newRevealed = new Set(revealedMaskIds);
                        newRevealed.add(maskBlock.id);
                        setRevealedMaskIds(newRevealed);
                      }}
                      className="flex-1 px-3 py-1 bg-muted/50 text-muted rounded cursor-pointer hover:bg-muted transition-colors"
                    >
                      ?
                    </button>
                  ) : (
                    <div className="flex-1">
                      <div className="text-foreground">{sym.meaning}</div>
                      {sym.unit && <div className="text-xs text-muted-foreground mt-1">単位: {sym.unit}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {item.type === 'relations' && (
          <div className="space-y-3">
            {/* 使用する公式 */}
            {formula.usedFormulas && formula.usedFormulas.length > 0 && (
              <div className="glass-card rounded-2xl p-4">
                <div className="text-xs text-muted-foreground mb-3">使用する公式</div>
                <div className="space-y-2">
                  {formula.usedFormulas.map((fid: string, idx: number) => {
                    const f = dataStore.getFormula(fid);
                    if (!f) return null;

                    const maskBlock = item.maskBlocks.find(b => b.content === idx);
                    const isRevealed = maskBlock && revealedMaskIds.has(maskBlock.id);

                    return maskBlock && !isRevealed ? (
                      <button
                        key={fid}
                        onClick={() => {
                          const newRevealed = new Set(revealedMaskIds);
                          newRevealed.add(maskBlock.id);
                          setRevealedMaskIds(newRevealed);
                        }}
                        className="w-full px-3 py-2 bg-muted/50 text-muted rounded cursor-pointer hover:bg-muted transition-colors"
                      >
                        ?
                      </button>
                    ) : (
                      <div key={fid} className="font-mono text-foreground">{f.expression}</div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 導出できる公式 */}
            {formula.derivableFormulas && formula.derivableFormulas.length > 0 && (
              <div className="glass-card rounded-2xl p-4">
                <div className="text-xs text-muted-foreground mb-3">導出できる公式</div>
                <div className="space-y-2">
                  {formula.derivableFormulas.map((fid: string, idx: number) => {
                    const f = dataStore.getFormula(fid);
                    if (!f) return null;

                    const offset = (formula.usedFormulas?.length || 0);
                    const maskBlock = item.maskBlocks.find(b => b.content === offset + idx);
                    const isRevealed = maskBlock && revealedMaskIds.has(maskBlock.id);

                    return maskBlock && !isRevealed ? (
                      <button
                        key={fid}
                        onClick={() => {
                          const newRevealed = new Set(revealedMaskIds);
                          newRevealed.add(maskBlock.id);
                          setRevealedMaskIds(newRevealed);
                        }}
                        className="w-full px-3 py-2 bg-muted/50 text-muted rounded cursor-pointer hover:bg-muted transition-colors"
                      >
                        ?
                      </button>
                    ) : (
                      <div key={fid} className="font-mono text-foreground">{f.expression}</div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setRevealedMaskIds(new Set());
    }
  };
  
  const handleNext = () => {
    if (currentIndex < learningItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setRevealedMaskIds(new Set());
    }
  };
  
  const handleRevealAll = () => {
    if (learningItems.length > 0) {
      const allIds = new Set(learningItems[currentIndex].maskBlocks.map(b => b.id));
      setRevealedMaskIds(allIds);
    }
  };
  
  const handleReset = () => {
    setRevealedMaskIds(new Set());
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-background pb-16">
      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between">
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
        >
          <Settings className="w-6 h-6" />
        </button>
        <div className="text-sm text-muted-foreground">
          {isLearning && `${currentIndex + 1} / ${learningItems.length}`}
        </div>
        <div className="w-10" />
      </header>

      {/* 公式显示区 - 居中留白 */}
      <main className="flex-1 flex items-center justify-center px-6 pb-24 overflow-y-auto">
        <div className="w-full max-w-2xl">
          {renderCurrentItem()}
        </div>
      </main>

      {/* 操作按钮区 - 固定底部 */}
      <div className="fixed bottom-20 left-0 right-0 px-6 pb-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
        {isLearning ? (
          <div className="space-y-3">
            {/* 主操作 */}
            <div className="flex gap-3">
              <button
                onClick={handleRevealAll}
                className="flex-1 py-3.5 bg-primary text-primary-foreground rounded-2xl shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Eye className="w-5 h-5" />
                <span>答えを表示</span>
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-3.5 glass-card rounded-2xl shadow-md hover:shadow-lg transition-all"
              >
                <RotateCcw className="w-5 h-5 text-primary" />
              </button>
            </div>
            
            {/* 上一题/下一题 */}
            {learningItems.length > 1 && (
              <div className="flex gap-3">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="flex-1 py-3 glass-card rounded-xl disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-foreground hover:shadow-md transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-sm">前の問題</span>
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex >= learningItems.length - 1}
                  className="flex-1 py-3 glass-card rounded-xl disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-foreground hover:shadow-md transition-all"
                >
                  <span className="text-sm">次の問題</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        currentPage="learning"
        onNavigateHome={onNavigateHome}
        onNavigateLearning={() => {}}
      />

      {/* Settings Drawer */}
      {showSettings && (
        <LearningSettings
          selectedScenarioIds={selectedScenarioIds}
          onToggleScenario={(id) => {
            if (selectedScenarioIds.includes(id)) {
              setSelectedScenarioIds(selectedScenarioIds.filter(i => i !== id));
            } else {
              setSelectedScenarioIds([...selectedScenarioIds, id]);
            }
          }}
          contentTypes={contentTypes}
          onToggleContentType={(type) => {
            if (contentTypes.includes(type)) {
              setContentTypes(contentTypes.filter(t => t !== type));
            } else {
              setContentTypes([...contentTypes, type]);
            }
          }}
          mode={mode}
          ratio={ratio}
          isRandom={isRandom}
          stepCoverMode={stepCoverMode}
          onStepCoverModeChange={setStepCoverMode}
          onModeChange={setMode}
          onRatioChange={setRatio}
          onToggleRandom={() => setIsRandom(!isRandom)}
          onApply={applySettingsAndStart}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
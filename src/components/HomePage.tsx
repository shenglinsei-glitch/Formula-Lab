import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { dataStore, UNCATEGORIZED_SCENARIO_ID } from '../store/dataStore';
import BottomNav from './BottomNav';

interface HomePageProps {
  onScenarioClick: (scenarioId: string, targetStepId?: string) => void;
  onFormulaClick: (formulaId: string) => void;
  onCreateFormula: () => void;
  onLearningClick: () => void;
}

type HomeMode = 'scenario' | 'formula';

interface SearchResult {
  type: 'formula' | 'scenario' | 'step';
  id: string;
  name: string;
  secondaryInfo?: string;
  scenarioId?: string;
  stepId?: string;
}

interface ContextMenuState {
  type: 'scenario' | 'formula';
  id: string;
  x: number;
  y: number;
}

export default function HomePage({ 
  onScenarioClick, 
  onFormulaClick,
  onCreateFormula,
  onLearningClick 
}: HomePageProps) {
  const [mode, setMode] = useState<HomeMode>('scenario');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set([UNCATEGORIZED_SCENARIO_ID]));
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingItem, setEditingItem] = useState<{ type: 'scenario' | 'formula'; id: string; name: string } | null>(null);
  const [newScenarioDialog, setNewScenarioDialog] = useState<{ parentId?: string } | null>(null);
  const [newScenarioName, setNewScenarioName] = useState('');
  
  // 長按检测
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  // 统一搜索：场景、步骤、公式
  const performSearch = (): SearchResult[] => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // 搜索公式
    const formulas = dataStore.getFormulas();
    Object.values(formulas).forEach(formula => {
      if (
        formula.name.toLowerCase().includes(query) ||
        formula.expression.toLowerCase().includes(query)
      ) {
        results.push({
          type: 'formula',
          id: formula.id,
          name: formula.name,
          secondaryInfo: formula.expression,
        });
      }
    });

    // 搜索场景和步骤
    if (mode === 'scenario') {
      const scenarios = dataStore.getScenarios();
      scenarios.forEach(scenario => {
        // 搜索场景名
        if (scenario.name.toLowerCase().includes(query)) {
          results.push({
            type: 'scenario',
            id: scenario.id,
            name: scenario.name,
          });
        }

        // 搜索步骤名
        scenario.steps.forEach(step => {
          if (step.name.toLowerCase().includes(query)) {
            results.push({
              type: 'step',
              id: step.id,
              name: step.name,
              secondaryInfo: scenario.name,
              scenarioId: scenario.id,
              stepId: step.id,
            });
          }
        });
      });
    }

    return results;
  };

  const searchResults = performSearch();
  const showSearchResults = searchQuery.trim().length > 0;

  // 处理搜索结果点击
  const handleSearchResultClick = (result: SearchResult) => {
    if (result.type === 'formula') {
      onFormulaClick(result.id);
    } else if (result.type === 'scenario') {
      onScenarioClick(result.id);
    } else if (result.type === 'step' && result.scenarioId && result.stepId) {
      onScenarioClick(result.scenarioId, result.stepId);
    }
    setSearchQuery(''); // 清空搜索
  };

  // 切换展开/折叠
  const toggleScenario = (scenarioId: string) => {
    const newExpanded = new Set(expandedScenarios);
    if (newExpanded.has(scenarioId)) {
      newExpanded.delete(scenarioId);
    } else {
      newExpanded.add(scenarioId);
    }
    setExpandedScenarios(newExpanded);
  };

  // 長按开始
  const handlePressStart = (e: React.TouchEvent | React.MouseEvent, type: 'scenario' | 'formula', id: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setContextMenu({
        type,
        id,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }, 500); // 500ms长按
  };

  // 長按结束 - 不再清除菜单，只清除定时器
  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // 不再设置longPressTriggered为false，保持菜单显示
  };

  // 長按取消
  const handlePressCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // 只有在取消时才重置（比如滑动离开）
    if (!contextMenu) {
      longPressTriggered.current = false;
    }
  };

  // 点击时检查是否是长按
  const handleClick = (e: React.MouseEvent, callback: () => void) => {
    e.stopPropagation();
    if (!longPressTriggered.current) {
      callback();
    }
    // 重置标志，准备下次点击
    setTimeout(() => {
      longPressTriggered.current = false;
    }, 100);
  };

  // 处理编辑
  const handleEdit = (type: 'scenario' | 'formula', id: string) => {
    const name = type === 'scenario' 
      ? dataStore.getScenario(id)?.name || ''
      : dataStore.getFormula(id)?.name || '';
    setEditingItem({ type, id, name });
    setContextMenu(null);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingItem) return;
    
    if (editingItem.type === 'scenario') {
      const scenario = dataStore.getScenario(editingItem.id);
      if (scenario) {
        dataStore.saveScenario({ ...scenario, name: editingItem.name });
      }
    } else {
      const formula = dataStore.getFormula(editingItem.id);
      if (formula) {
        dataStore.saveFormula({ ...formula, name: editingItem.name });
      }
    }
    setEditingItem(null);
  };

  // 处理删除
  const handleDelete = (type: 'scenario' | 'formula', id: string) => {
    const confirmMessage = type === 'scenario' ? '場面を削除しますか？' : '公式を削除しますか？';
    if (window.confirm(confirmMessage)) {
      if (type === 'scenario') {
        dataStore.deleteScenario(id);
      } else {
        dataStore.deleteFormula(id);
      }
    }
    setContextMenu(null);
  };

  // 打开新增场景对话框
  const handleAddScenario = (parentId?: string) => {
    setNewScenarioDialog({ parentId });
    setNewScenarioName('');
    setContextMenu(null);
  };

  // 保存新场景
  const handleSaveNewScenario = () => {
    if (!newScenarioName.trim()) return;
    
    const newScenario: import('../data/scenarios').Scenario = {
      id: `scenario-${Date.now()}`,
      name: newScenarioName.trim(),
      icon: '📁',
      parentId: newScenarioDialog?.parentId,
      steps: [{
        id: `step-${Date.now()}`,
        name: '計算ステップ',
        formulaIds: [] // 使用ID数组
      }]
    };
    
    dataStore.saveScenario(newScenario);
    setNewScenarioDialog(null);
    setNewScenarioName('');
  };

  // 渲染场景树（支持嵌套）
  const renderScenarioTree = (parentId?: string, level: number = 0) => {
    const scenarios = parentId 
      ? dataStore.getChildScenarios(parentId)
      : dataStore.getRootScenarios();

    return scenarios.map((scenario) => {
      const isExpanded = expandedScenarios.has(scenario.id);
      const hasChildren = dataStore.getChildScenarios(scenario.id).length > 0;
      const isUncategorized = scenario.id === UNCATEGORIZED_SCENARIO_ID;

      return (
        <div key={scenario.id}>
          <div className="relative group">
            <button
              onTouchStart={(e) => handlePressStart(e, 'scenario', scenario.id)}
              onTouchEnd={handlePressEnd}
              onTouchCancel={handlePressCancel}
              onMouseDown={(e) => handlePressStart(e, 'scenario', scenario.id)}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressCancel}
              onClick={(e) => handleClick(e, () => {
                if (hasChildren) {
                  toggleScenario(scenario.id);
                } else {
                  onScenarioClick(scenario.id);
                }
              })}
              className="w-full glass-card rounded-xl px-4 py-3 hover:shadow-md transition-all text-left flex items-center gap-3"
              style={{ marginLeft: `${level * 1.25}rem` }}
            >
              {hasChildren && (
                <div className="text-primary">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </div>
              )}
              <div className="flex-1 text-card-foreground">
                {scenario.name}
              </div>
            </button>
          </div>

          {/* 子场景 */}
          {isExpanded && hasChildren && (
            <div className="mt-2 space-y-2">
              {renderScenarioTree(scenario.id, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - 固定搜索栏 */}
      <header className="bg-background px-4 pt-3 pb-2 sticky top-0 z-10">
        {/* 搜索框 + 新建按钮 */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={mode === 'scenario' ? '検索...' : '公式を検索...'}
              className="w-full pl-10 pr-3 py-2.5 glass-card rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={onCreateFormula}
            className="px-3 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch - 分段控件 */}
        <div className="flex gap-1 p-1 glass-card rounded-xl">
          <button
            onClick={() => setMode('scenario')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm transition-all ${
              mode === 'scenario'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            場面
          </button>
          <button
            onClick={() => setMode('formula')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm transition-all ${
              mode === 'formula'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            公式
          </button>
        </div>

        {/* 搜索结果下拉 */}
        {showSearchResults && (
          <div className="absolute left-4 right-4 mt-2 glass-card rounded-xl shadow-lg max-h-80 overflow-y-auto z-50 border border-border">
            {searchResults.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground text-center">
                該当する結果がありません
              </div>
            ) : (
              searchResults.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}-${index}`}
                  onClick={() => handleSearchResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-primary/5 border-b border-border last:border-b-0 transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-md">
                      {result.type === 'formula' && '公式'}
                      {result.type === 'scenario' && '場面'}
                      {result.type === 'step' && 'ステップ'}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm text-foreground">{result.name}</div>
                      {result.secondaryInfo && (
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {result.secondaryInfo}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-20 overflow-y-auto space-y-2">
        {mode === 'scenario' ? (
          // 场景模式 - 多层级树形结构
          <>
            {renderScenarioTree()}
            {/* 添加顶层场景按钮 - 统一玻璃卡片样式 */}
            <button
              onClick={() => handleAddScenario()}
              className="w-full glass-card rounded-2xl px-4 py-3 text-sm text-muted-foreground hover:shadow-md hover:text-primary transition-all flex items-center justify-center gap-2 border border-dashed border-primary/30"
            >
              <Plus className="w-4 h-4" />
              <span>新しい場面を追加</span>
            </button>
          </>
        ) : (
          // 公式模式 - 支持长按
          Object.values(dataStore.getFormulas()).map((formula) => (
            <div key={formula.id} className="relative group">
              <button
                onTouchStart={(e) => handlePressStart(e, 'formula', formula.id)}
                onTouchEnd={handlePressEnd}
                onTouchCancel={handlePressCancel}
                onMouseDown={(e) => handlePressStart(e, 'formula', formula.id)}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressCancel}
                onClick={(e) => handleClick(e, () => onFormulaClick(formula.id))}
                className="w-full glass-card rounded-2xl px-4 py-3 hover:shadow-md transition-all text-left"
              >
                <div className="text-foreground mb-1">{formula.name}</div>
                <div className="text-sm text-muted-foreground font-mono">
                  {formula.expression}
                </div>
              </button>
            </div>
          ))
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        currentPage="home"
        onNavigateHome={() => {}}
        onNavigateLearning={onLearningClick}
      />

      {/* Context Menu */}
      {contextMenu && (
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setContextMenu(null)}
          />
          {/* 菜单 */}
          <div
            className="fixed glass-card rounded-2xl shadow-2xl py-2 z-50 min-w-[160px]"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <button
              onClick={() => handleEdit(contextMenu.type, contextMenu.id)}
              className="w-full px-5 py-3 text-left text-sm hover:bg-primary/5 text-foreground transition-colors"
            >
              編集
            </button>
            {contextMenu.type === 'scenario' && (
              <button
                onClick={() => handleAddScenario(contextMenu.id)}
                className="w-full px-5 py-3 text-left text-sm hover:bg-primary/5 text-foreground transition-colors"
              >
                子場面を追加
              </button>
            )}
            {contextMenu.id !== UNCATEGORIZED_SCENARIO_ID && (
              <button
                onClick={() => handleDelete(contextMenu.type, contextMenu.id)}
                className="w-full px-5 py-3 text-left text-sm text-destructive hover:bg-destructive/5 transition-colors"
              >
                削除
              </button>
            )}
          </div>
        </>
      )}

      {/* Edit Dialog */}
      {editingItem && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setEditingItem(null)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <div className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-foreground mb-4">
                {editingItem.type === 'scenario' ? '場面名を編集' : '公式名を編集'}
              </h3>
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setEditingItem(null);
                }}
                className="w-full px-4 py-3 glass-card rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-2.5 glass-card rounded-xl text-sm text-muted-foreground hover:bg-muted/10 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm hover:opacity-90 transition-opacity"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Scenario Dialog */}
      {newScenarioDialog && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setNewScenarioDialog(null)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <div className="glass-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-foreground mb-4">
                {newScenarioDialog.parentId ? '子場面を追加' : '新しい場面を追加'}
              </h3>
              <input
                type="text"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNewScenario();
                  if (e.key === 'Escape') setNewScenarioDialog(null);
                }}
                className="w-full px-4 py-3 glass-card rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground mb-4"
                placeholder="場面名を入力"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setNewScenarioDialog(null)}
                  className="flex-1 px-4 py-2.5 glass-card rounded-xl text-sm text-muted-foreground hover:bg-muted/10 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveNewScenario}
                  disabled={!newScenarioName.trim()}
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
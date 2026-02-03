import React, { useState, useEffect } from 'react';
import HomePage from './components/HomePage';
import StepListPage from './components/StepListPage';
import FormulaDetailPage from './components/FormulaDetailPage';
import LearningPage from './components/LearningPage';
import FormulaStructureEditPage from './components/FormulaStructureEditPage';
import FormulaInfoEditPage from './components/FormulaInfoEditPage';
import SymbolListPage from './components/SymbolListPage';
import SymbolDetailPage from './components/SymbolDetailPage';
import BottomNav from './components/BottomNav';
import { dataStore } from './store/dataStore';
import type { Formula } from './data/scenarios';

type Page =
  | 'scenes'
  | 'formulas'
  | 'symbols'
  | 'symbolDetail'
  | 'stepList'
  | 'formulaDetail'
  | 'learning'
  | 'formulaStructureEdit'
  | 'formulaInfoEdit';

interface NavigationState {
  currentPage: Page;
  selectedScenario: string | null;
  selectedFormula: string | null;
  selectedSymbol: string | null;
  targetStepId: string | null;
  previousPage: Page | null;
  tempFormula: Partial<Formula> | null; // 保存临时编辑的公式数据
  returnSource: 'home-scenario' | 'home-formula' | 'stepList' | null;
  // 编辑流程专用：保存进入编辑前的完整状态
  editEntryState: {
    returnPage: Page;
    returnSource: 'home-scenario' | 'home-formula' | 'stepList' | null;
    selectedScenario: string | null;
    selectedFormula: string | null;
    selectedSymbol: string | null;
  } | null;
}

export default function App() {
  const [dataVersion, setDataVersion] = useState(0); // 用于触发重新渲染
  
  const [navState, setNavState] = useState<NavigationState>({
    currentPage: 'scenes',
    selectedScenario: null,
    selectedFormula: null,
    selectedSymbol: null,
    targetStepId: null,
    previousPage: null,
    tempFormula: null,
    returnSource: null,
    editEntryState: null,
  });

  // 订阅数据变化
  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    return unsubscribe;
  }, []);

  // 从场面页进入步骤列表
  const navigateToStepList = (scenarioId: string, targetStepId?: string) => {
    setNavState({
      ...navState,
      currentPage: 'stepList',
      selectedScenario: scenarioId,
      targetStepId: targetStepId || null,
      previousPage: navState.currentPage,
      returnSource: 'home-scenario',
    });
  };

  // 从步骤列表进入公式详情
  const navigateToFormulaDetailFromStepList = (formulaId: string) => {
    setNavState({
      ...navState,
      currentPage: 'formulaDetail',
      selectedFormula: formulaId,
      previousPage: 'stepList',
      returnSource: 'stepList',
    });
  };

  // 从公式页进入公式详情
  const navigateToFormulaDetailFromHome = (formulaId: string) => {
    setNavState({
      ...navState,
      currentPage: 'formulaDetail',
      selectedFormula: formulaId,
      previousPage: navState.currentPage,
      returnSource: 'home-formula',
    });
  };

  const navigateToSymbolDetail = (symbolId: string) => {
    setNavState({
      ...navState,
      currentPage: 'symbolDetail',
      selectedSymbol: symbolId,
      previousPage: navState.currentPage,
    });
  };

  // 从公式详情跳转到场景步骤
  const navigateToStepListFromFormula = (scenarioId: string, stepId: string) => {
    setNavState({
      ...navState,
      currentPage: 'stepList',
      selectedScenario: scenarioId,
      targetStepId: stepId,
      previousPage: 'formulaDetail',
      returnSource: 'home-scenario',
    });
  };

  // 从公式详情跳转到另一个公式详情（保持返回源）
  const navigateToAnotherFormula = (formulaId: string) => {
    setNavState({
      ...navState,
      currentPage: 'formulaDetail',
      selectedFormula: formulaId,
      previousPage: 'formulaDetail',
    });
  };

  const navigateToLearning = () => {
    setNavState({
      ...navState,
      currentPage: 'learning',
      previousPage: navState.currentPage,
    });
  };

  // 新建公式：从首页进入编辑
  const navigateToCreateFormula = () => {
    setNavState({
      ...navState,
      currentPage: 'formulaStructureEdit',
      selectedFormula: null,
      previousPage: navState.currentPage,
      // 保存进入编辑前的状态
      editEntryState: {
        returnPage: navState.currentPage,
        returnSource: 'home-formula',
        selectedScenario: null,
        selectedFormula: null,
        selectedSymbol: null,
      },
    });
  };

  // 编辑已有公式：从公式详情进入编辑
  const navigateToEditFormula = () => {
    setNavState({
      ...navState,
      currentPage: 'formulaStructureEdit',
      previousPage: 'formulaDetail',
      // 保存进入编辑前的完整状态
      editEntryState: {
        returnPage: 'formulaDetail',
        returnSource: navState.returnSource,
        selectedScenario: navState.selectedScenario,
        selectedFormula: navState.selectedFormula,
        selectedSymbol: navState.selectedSymbol,
      },
    });
  };

  const navigateToFormulaInfoEdit = (expression: string, structureData?: any) => {
    setNavState({
      ...navState,
      currentPage: 'formulaInfoEdit',
      tempFormula: { ...navState.tempFormula, expression, structureData },
      previousPage: 'formulaStructureEdit',
      // 保持 editEntryState
    });
  };

  const backToFormulaStructureEdit = () => {
    setNavState({
      ...navState,
      currentPage: 'formulaStructureEdit',
      previousPage: 'formulaInfoEdit',
      // 保持 editEntryState
    });
  };

  // 编辑流程取消：弹出确认，返回进入前页面
  const cancelEdit = () => {
    if (confirm('編集内容を破棄しますか？')) {
      if (navState.editEntryState) {
        // 恢复进入编辑前的完整状态
        const entry = navState.editEntryState;
        setNavState({
          currentPage: entry.returnPage,
          selectedScenario: entry.selectedScenario,
          selectedFormula: entry.selectedFormula,
          selectedSymbol: entry.selectedSymbol,
          targetStepId: null,
          previousPage: null,
          tempFormula: null,
          returnSource: entry.returnSource,
          editEntryState: null,
        });
      } else {
        // 兜底：返回首页
        navigateToHome();
      }
    }
  };

  // 保存公式
  const saveFormula = (formulaData: {
    name: string;
    description: string;
    equivalentExpressions: string[];
    symbols: { symbol: string; meaning: string; unit: string }[];
    usedInContexts: { scenarioId: string; stepId: string }[];
    usedFormulas: string[];
    derivableFormulas: string[];
  }) => {
    // 构建完整的公式对象
    const formulaId = navState.selectedFormula || 'f' + Date.now();
    const expression = navState.tempFormula?.expression || '';
    const structureData = navState.tempFormula?.structureData;
    
    const formula: Formula = {
      id: formulaId,
      name: formulaData.name || `公式 ${formulaId}`,
      expression,
      description: formulaData.description,
      equivalentExpressions: formulaData.equivalentExpressions,
      symbols: formulaData.symbols.map(s => ({
        symbol: s.symbol,
        meaning: s.meaning,
        unit: s.unit || undefined
      })),
      usedInContexts: formulaData.usedInContexts,
      usedFormulas: formulaData.usedFormulas,
      derivableFormulas: formulaData.derivableFormulas,
      structureData, // 保存结构数据（用于编辑）
      structureTree: structureData, // 同时保存为structureTree（用于学习）
    };

    // 保存到dataStore
    dataStore.saveFormula(formula);

    // 如果是编辑流程，获取进入编辑前的状态
    if (navState.editEntryState) {
      const entry = navState.editEntryState;
      
      // 更新selectedFormula为新建的ID（如果是新建）
      const returnFormulaId = navState.selectedFormula || formulaId;
      
      setNavState({
        currentPage: entry.returnPage,
        selectedFormula: returnFormulaId,
        selectedScenario: entry.selectedScenario,
        selectedSymbol: entry.selectedSymbol,
        targetStepId: null,
        previousPage: null,
        tempFormula: null,
        returnSource: entry.returnSource,
        editEntryState: null,
      });
    } else {
      // 兜底：返回首页
      navigateToHome();
    }
  };

  // 通用返回逻辑
  const navigateBack = () => {
    if (navState.currentPage === 'formulaDetail') {
      // 公式详情页返回：根据来源决定
      if (navState.returnSource === 'stepList') {
        setNavState({
          ...navState,
          currentPage: 'stepList',
          selectedFormula: null,
          previousPage: null,
        });
      } else {
        // 返回首页公式模式
        setNavState({
          currentPage: 'formulas',
          selectedScenario: null,
          selectedFormula: null,
          selectedSymbol: null,
          targetStepId: null,
          previousPage: null,
          tempFormula: null,
          returnSource: null,
          editEntryState: null,
        });
      }
    } else if (navState.currentPage === 'symbolDetail') {
      setNavState({
        ...navState,
        currentPage: 'symbols',
        selectedSymbol: null,
        previousPage: null,
      });
    } else if (navState.currentPage === 'stepList') {
      // 步骤列表返回首页场景模式
      setNavState({
        currentPage: 'scenes',
        selectedScenario: null,
        selectedFormula: null,
        selectedSymbol: null,
        targetStepId: null,
        previousPage: null,
        tempFormula: null,
        returnSource: null,
        editEntryState: null,
      });
    } else if (navState.previousPage) {
      // 其他页面：返回前一页
      setNavState({
        ...navState,
        currentPage: navState.previousPage,
        previousPage: null,
      });
    }
  };

  const navigateToHome = () => {
    setNavState({
      currentPage: 'scenes',
      selectedScenario: null,
      selectedFormula: null,
      selectedSymbol: null,
      targetStepId: null,
      previousPage: null,
      tempFormula: null,
      returnSource: null,
      editEntryState: null,
    });
  };

  const navigateToScenes = () => {
    setNavState({
      ...navState,
      currentPage: 'scenes',
      selectedScenario: null,
      selectedFormula: null,
      selectedSymbol: null,
      targetStepId: null,
      previousPage: null,
      returnSource: null,
      editEntryState: null,
      tempFormula: null,
    });
  };

  const navigateToFormulas = () => {
    setNavState({
      ...navState,
      currentPage: 'formulas',
      selectedScenario: null,
      selectedFormula: null,
      selectedSymbol: null,
      targetStepId: null,
      previousPage: null,
      returnSource: null,
      editEntryState: null,
      tempFormula: null,
    });
  };

  const navigateToSymbols = () => {
    setNavState({
      ...navState,
      currentPage: 'symbols',
      selectedScenario: null,
      selectedFormula: null,
      selectedSymbol: null,
      targetStepId: null,
      previousPage: null,
      returnSource: null,
      editEntryState: null,
      tempFormula: null,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {navState.currentPage === 'scenes' && (
        <HomePage
          fixedMode="scenario"
          onScenarioClick={navigateToStepList}
          onFormulaClick={navigateToFormulaDetailFromHome}
          onCreateFormula={navigateToCreateFormula}
        />
      )}

      {navState.currentPage === 'formulas' && (
        <HomePage
          fixedMode="formula"
          onScenarioClick={navigateToStepList}
          onFormulaClick={navigateToFormulaDetailFromHome}
          onCreateFormula={navigateToCreateFormula}
        />
      )}

      {navState.currentPage === 'symbols' && (
        <SymbolListPage
          onSymbolClick={navigateToSymbolDetail}
          onCreateSymbol={(id) => {
            if (id) navigateToSymbolDetail(id);
          }}
        />
      )}

      {navState.currentPage === 'symbolDetail' && navState.selectedSymbol && (
        <SymbolDetailPage
          symbolId={navState.selectedSymbol}
          onBack={navigateBack}
          onFormulaClick={navigateToAnotherFormula}
        />
      )}
      
      {navState.currentPage === 'stepList' && navState.selectedScenario && (
        <StepListPage
          scenarioId={navState.selectedScenario}
          targetStepId={navState.targetStepId}
          onBack={navigateBack}
          onFormulaClick={navigateToFormulaDetailFromStepList}
          onLearningClick={navigateToLearning}
        />
      )}
      
      {navState.currentPage === 'formulaDetail' && navState.selectedFormula && (
        <FormulaDetailPage
          formulaId={navState.selectedFormula}
          onBack={navigateBack}
          onEdit={navigateToEditFormula}
          onLearningClick={navigateToLearning}
          onFormulaClick={navigateToAnotherFormula}
          onContextClick={navigateToStepListFromFormula}
          onSymbolClick={navigateToSymbolDetail}
        />
      )}
      
      {navState.currentPage === 'learning' && (
        <LearningPage
          onBack={navigateBack}
          onNavigateHome={navigateToHome}
        />
      )}
      
      {navState.currentPage === 'formulaStructureEdit' && (
        <FormulaStructureEditPage
          formulaId={navState.selectedFormula}
          draftExpression={navState.tempFormula?.expression || undefined}
          draftStructureData={navState.tempFormula?.structureData || navState.tempFormula?.structureTree || undefined}
          onNext={navigateToFormulaInfoEdit}
          onCancel={cancelEdit}
        />
      )}
      
      {navState.currentPage === 'formulaInfoEdit' && (
        <FormulaInfoEditPage
          formulaId={navState.selectedFormula}
          expression={navState.tempFormula?.expression || ''}
          structureData={navState.tempFormula?.structureTree || navState.tempFormula?.structureData}
          onSave={saveFormula}
          onBack={backToFormulaStructureEdit}
          onCancel={cancelEdit}
        />
      )}

      {(() => {
        // BottomNav should remain usable on detail pages too.
        // Normalize currentPage to one of: scenes / formulas / symbols / learning.
        if (navState.currentPage === 'formulaStructureEdit' || navState.currentPage === 'formulaInfoEdit') return null;
        const normalized: any =
          navState.currentPage === 'formulaDetail'
            ? 'formulas'
            : navState.currentPage === 'stepList'
              ? 'scenes'
              : navState.currentPage === 'symbolDetail'
                ? 'symbols'
                : navState.currentPage;
        if (!(['scenes', 'formulas', 'symbols', 'learning'] as string[]).includes(normalized)) return null;
        return (
          <BottomNav
            currentPage={normalized}
            onNavigateScenes={navigateToScenes}
            onNavigateFormulas={navigateToFormulas}
            onNavigateSymbols={navigateToSymbols}
            onNavigateLearning={navigateToLearning}
          />
        );
      })()}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import HomePage from './components/HomePage';
import StepListPage from './components/StepListPage';
import FormulaDetailPage from './components/FormulaDetailPage';
import LearningPage from './components/LearningPage';
import FormulaStructureEditPage from './components/FormulaStructureEditPage';
import FormulaInfoEditPage from './components/FormulaInfoEditPage';
import { dataStore } from './store/dataStore';
import type { Formula } from './data/scenarios';

type Page = 'home' | 'stepList' | 'formulaDetail' | 'learning' | 'formulaStructureEdit' | 'formulaInfoEdit';

interface NavigationState {
  currentPage: Page;
  selectedScenario: string | null;
  selectedFormula: string | null;
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
  } | null;
}

export default function App() {
  const [dataVersion, setDataVersion] = useState(0); // 用于触发重新渲染
  
  const [navState, setNavState] = useState<NavigationState>({
    currentPage: 'home',
    selectedScenario: null,
    selectedFormula: null,
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

  // 从首页场景模式进入步骤列表
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

  // 从首页公式模式进入公式详情
  const navigateToFormulaDetailFromHome = (formulaId: string) => {
    setNavState({
      ...navState,
      currentPage: 'formulaDetail',
      selectedFormula: formulaId,
      previousPage: 'home',
      returnSource: 'home-formula',
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
      previousPage: 'home',
      // 保存进入编辑前的状态
      editEntryState: {
        returnPage: 'home',
        returnSource: 'home-formula',
        selectedScenario: null,
        selectedFormula: null,
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
          currentPage: 'home',
          selectedScenario: null,
          selectedFormula: null,
          targetStepId: null,
          previousPage: null,
          tempFormula: null,
          returnSource: null,
          editEntryState: null,
        });
      }
    } else if (navState.currentPage === 'stepList') {
      // 步骤列表返回首页场景模式
      setNavState({
        currentPage: 'home',
        selectedScenario: null,
        selectedFormula: null,
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
      currentPage: 'home',
      selectedScenario: null,
      selectedFormula: null,
      targetStepId: null,
      previousPage: null,
      tempFormula: null,
      returnSource: null,
      editEntryState: null,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {navState.currentPage === 'home' && (
        <HomePage
          onScenarioClick={navigateToStepList}
          onFormulaClick={navigateToFormulaDetailFromHome}
          onCreateFormula={navigateToCreateFormula}
          onLearningClick={navigateToLearning}
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
    </div>
  );
}
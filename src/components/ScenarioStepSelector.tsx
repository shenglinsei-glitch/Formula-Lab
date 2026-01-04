import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { dataStore, UNCATEGORIZED_SCENARIO_ID } from '../store/dataStore';
import type { Scenario } from '../data/scenarios';

interface ScenarioStepSelectorProps {
  onAdd: (scenarioId: string, stepId: string) => void;
}

export default function ScenarioStepSelector({ onAdd }: ScenarioStepSelectorProps) {
  // A栏：场景选择
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [newScenarioInput, setNewScenarioInput] = useState('');
  
  // B栏：步骤选择
  const [selectedStepId, setSelectedStepId] = useState<string>('');
  const [newStepInput, setNewStepInput] = useState('');

  // 获取当前选择场景的步骤列表
  const getStepsForSelectedScenario = () => {
    if (!selectedScenarioId) return [];
    const scenario = dataStore.getScenario(selectedScenarioId);
    return scenario?.steps || [];
  };

  // A栏：新增场景
  const handleAddScenario = () => {
    if (!newScenarioInput.trim()) return;

    if (selectedScenarioId) {
      // 已选场景 → 创建子场景
      const newScenario: Scenario = {
        id: `scenario-${Date.now()}`,
        name: newScenarioInput.trim(),
        icon: '📁',
        parentId: selectedScenarioId,
        steps: []
      };
      dataStore.saveScenario(newScenario);
      // 不自动选中子场景，保持父场景选中状态
      setNewScenarioInput('');
    } else {
      // 未选场景 → 创建顶层场景
      const newScenario: Scenario = {
        id: `scenario-${Date.now()}`,
        name: newScenarioInput.trim(),
        icon: '📁',
        steps: []
      };
      dataStore.saveScenario(newScenario);
      // 自动选中新场景
      setSelectedScenarioId(newScenario.id);
      setNewScenarioInput('');
    }
  };

  // B栏：新增步骤
  const handleAddStep = () => {
    if (!newStepInput.trim()) return;

    let targetScenarioId = selectedScenarioId;

    // 若未选场景，默认归入"未整理"
    if (!targetScenarioId) {
      targetScenarioId = UNCATEGORIZED_SCENARIO_ID;
      setSelectedScenarioId(UNCATEGORIZED_SCENARIO_ID);
    }

    // 创建步骤
    dataStore.addStep(targetScenarioId, newStepInput.trim());
    
    // 获取新创建的步骤（最后一个）
    const scenario = dataStore.getScenario(targetScenarioId);
    if (scenario && scenario.steps.length > 0) {
      const newStep = scenario.steps[scenario.steps.length - 1];
      setSelectedStepId(newStep.id);
      setNewStepInput('');
    }
  };

  // 添加到公式
  const handleAddToFormula = () => {
    if (selectedScenarioId && selectedStepId) {
      onAdd(selectedScenarioId, selectedStepId);
      // 重置选择
      setSelectedScenarioId('');
      setSelectedStepId('');
    }
  };

  // 场景列表（树形展示）
  const renderScenarioOptions = () => {
    const rootScenarios = dataStore.getRootScenarios();
    const renderScenarioTree = (scenario: Scenario, level = 0): JSX.Element[] => {
      const children = dataStore.getChildScenarios(scenario.id);
      return [
        <option key={scenario.id} value={scenario.id}>
          {'\u00A0'.repeat(level * 2)}{scenario.name}
        </option>,
        ...children.flatMap(child => renderScenarioTree(child, level + 1))
      ];
    };
    return rootScenarios.flatMap(s => renderScenarioTree(s));
  };

  return (
    <div className="space-y-3">
      {/* A栏：场景 */}
      <div className="border border-gray-200 rounded p-3">
        <div className="text-xs text-gray-600 mb-2">場面（シナリオ）</div>
        
        {/* 选择现有场景 */}
        <select
          value={selectedScenarioId}
          onChange={(e) => {
            setSelectedScenarioId(e.target.value);
            setSelectedStepId(''); // 清空步骤选择
          }}
          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-gray-400 mb-2"
        >
          <option value="">（選択してください）</option>
          {renderScenarioOptions()}
        </select>

        {/* 新增场景输入 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newScenarioInput}
            onChange={(e) => setNewScenarioInput(e.target.value)}
            placeholder={selectedScenarioId ? "子場面名を入力" : "新しい場面名を入力"}
            className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-gray-400"
          />
          <button
            onClick={handleAddScenario}
            disabled={!newScenarioInput.trim()}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* B栏：步骤 */}
      <div className="border border-gray-200 rounded p-3">
        <div className="text-xs text-gray-600 mb-2">計算ステップ</div>
        
        {/* 选择现有步骤 */}
        <select
          value={selectedStepId}
          onChange={(e) => setSelectedStepId(e.target.value)}
          disabled={!selectedScenarioId}
          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-gray-400 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {selectedScenarioId ? "（選択してください）" : "（先に場面を選択してください）"}
          </option>
          {getStepsForSelectedScenario().map(step => (
            <option key={step.id} value={step.id}>
              {step.name}
            </option>
          ))}
        </select>

        {/* 新增步骤输入 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newStepInput}
            onChange={(e) => setNewStepInput(e.target.value)}
            placeholder={selectedScenarioId ? "新しいステップ名を入力" : "場面未選択時は「未整理」に追加"}
            className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-gray-400"
          />
          <button
            onClick={handleAddStep}
            disabled={!newStepInput.trim()}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* 添加按钮 */}
      <button
        onClick={handleAddToFormula}
        disabled={!selectedScenarioId || !selectedStepId}
        className="w-full px-3 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        この場面を追加
      </button>
    </div>
  );
}

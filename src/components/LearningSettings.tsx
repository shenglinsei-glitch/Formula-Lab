import React from 'react';
import { X, Check } from 'lucide-react';
import { dataStore } from '../store/dataStore';

type LearningMode = 'left' | 'right' | 'whole';
type CoverRatio = 30 | 50 | 70 | 100;
type LearningContentType = 'formula' | 'symbols' | 'relations' | 'steps';
type StepCoverMode = 'random' | 'title' | 'formulas';

interface LearningSettingsProps {
  selectedScenarioIds: string[];
  onToggleScenario: (id: string) => void;
  contentTypes: LearningContentType[];
  onToggleContentType: (type: LearningContentType) => void;
  mode: LearningMode;
  stepCoverMode: StepCoverMode;
  onStepCoverModeChange: (mode: StepCoverMode) => void;
  ratio: CoverRatio;
  isRandom: boolean;
  onModeChange: (mode: LearningMode) => void;
  onRatioChange: (ratio: CoverRatio) => void;
  onToggleRandom: () => void;
  onApply: () => void;
  onClose: () => void;
}

export default function LearningSettings({
  selectedScenarioIds,
  onToggleScenario,
  contentTypes,
  onToggleContentType,
  stepCoverMode,
  onStepCoverModeChange,
  mode,
  ratio,
  isRandom,
  onModeChange,
  onRatioChange,
  onToggleRandom,
  onApply,
  onClose,
}: LearningSettingsProps) {
  // 收集所有场景（包括子场景）
  const allScenarios = dataStore.getScenarios();
  
  // 检查是否可以开始学习
  const canStart = selectedScenarioIds.length > 0 && contentTypes.length > 0;

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      
      {/* 设置抽屉 */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-background shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="text-foreground">学習設定</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 pb-32">
          {/* 学习范围 */}
          <div>
            <h3 className="text-sm text-foreground mb-3">学習範囲（場面を選択）</h3>
            <div className="space-y-2">
              {allScenarios.map(scenario => (
                <button
                  key={scenario.id}
                  onClick={() => onToggleScenario(scenario.id)}
                  className={`w-full glass-card rounded-xl px-4 py-3 text-left flex items-center gap-3 transition-all ${
                    selectedScenarioIds.includes(scenario.id)
                      ? 'ring-2 ring-primary bg-primary/5'
                      : 'hover:shadow-md'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedScenarioIds.includes(scenario.id)
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}>
                    {selectedScenarioIds.includes(scenario.id) && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="flex-1 text-foreground">{scenario.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 学习内容 */}
          <div>
            <h3 className="text-sm text-foreground mb-3">学習内容（複数選択可）</h3>
            <div className="space-y-2">
              <button
                onClick={() => onToggleContentType('formula')}
                className={`w-full glass-card rounded-xl px-4 py-3 text-left flex items-center gap-3 transition-all ${
                  contentTypes.includes('formula')
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:shadow-md'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  contentTypes.includes('formula')
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                }`}>
                  {contentTypes.includes('formula') && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
                <span className="flex-1 text-foreground">公式本体（構造）</span>
              </button>
              
              <button
                onClick={() => onToggleContentType('symbols')}
                className={`w-full glass-card rounded-xl px-4 py-3 text-left flex items-center gap-3 transition-all ${
                  contentTypes.includes('symbols')
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:shadow-md'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  contentTypes.includes('symbols')
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                }`}>
                  {contentTypes.includes('symbols') && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
                <span className="flex-1 text-foreground">記号の意味</span>
              </button>
              
              <button
                onClick={() => onToggleContentType('relations')}
                className={`w-full glass-card rounded-xl px-4 py-3 text-left flex items-center gap-3 transition-all ${
                  contentTypes.includes('relations')
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:shadow-md'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  contentTypes.includes('relations')
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                }`}>
                  {contentTypes.includes('relations') && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
                <span className="flex-1 text-foreground">関連公式</span>
              </button>

              <button
                onClick={() => onToggleContentType('steps')}
                className={`w-full glass-card rounded-xl px-4 py-3 text-left flex items-center gap-3 transition-all ${
                  contentTypes.includes('steps')
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:shadow-md'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  contentTypes.includes('steps')
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                }`}>
                  {contentTypes.includes('steps') && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
                <span className="flex-1 text-foreground">計算ステップ</span>
              </button>
            </div>
          </div>

          {/* 遮挡设置 */}
          {contentTypes.length > 0 && (
            <>
              {/* 遮挡位置（公式本体 / 記号の意味 用） */}
              {(contentTypes.includes('formula') || contentTypes.includes('symbols')) && (
                <div>
                  <h3 className="text-sm text-foreground mb-3">遮挡位置</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onModeChange('left')}
                      className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
                        mode === 'left'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'glass-card text-foreground hover:shadow-md'
                      }`}
                    >
                      左側
                    </button>
                    <button
                      onClick={() => onModeChange('right')}
                      className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
                        mode === 'right'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'glass-card text-foreground hover:shadow-md'
                      }`}
                    >
                      右側
                    </button>
                    <button
                      onClick={() => onModeChange('whole')}
                      className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
                        mode === 'whole'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'glass-card text-foreground hover:shadow-md'
                      }`}
                    >
                      全体
                    </button>
                  </div>
                </div>
              )}

              {/* 計算ステップ：遮挡対象 */}
              {contentTypes.includes('steps') && (
                <div>
                  <h3 className="text-sm text-foreground mb-3">計算ステップの遮挡対��</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onStepCoverModeChange('title')}
                      className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
                        stepCoverMode === 'title'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'glass-card text-foreground hover:shadow-md'
                      }`}
                    >
                      ステップ名のみ
                    </button>
                    <button
                      onClick={() => onStepCoverModeChange('formulas')}
                      className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
                        stepCoverMode === 'formulas'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'glass-card text-foreground hover:shadow-md'
                      }`}
                    >
                      公式のみ
                    </button>
                    <button
                      onClick={() => onStepCoverModeChange('random')}
                      className={`flex-1 py-2.5 rounded-xl text-sm transition-all ${
                        stepCoverMode === 'random'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'glass-card text-foreground hover:shadow-md'
                      }`}
                    >
                      ランダム
                    </button>
                  </div>
                </div>
              )}

              {/* 遮挡比例（全题型共通） */}
              <div>
                <h3 className="text-sm text-foreground mb-3">隠す割合</h3>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 50, 70, 100].map((r) => (
                    <button
                      key={r}
                      onClick={() => onRatioChange(r as CoverRatio)}
                      className={`py-2.5 rounded-xl text-sm transition-all ${
                        ratio === r
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'glass-card text-foreground hover:shadow-md'
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              {/* ランダム配置（全题型共通） */}
              <div>
                <button
                  onClick={onToggleRandom}
                  className={`w-full glass-card rounded-xl px-4 py-3 text-left flex items-center gap-3 transition-all ${
                    isRandom ? 'ring-2 ring-primary bg-primary/5' : 'hover:shadow-md'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isRandom ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}
                  >
                    {isRandom && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className="flex-1 text-foreground">ランダム配置</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md ml-auto glass-nav px-5 py-4">
          <button
            onClick={onApply}
            disabled={!canStart}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {canStart ? '適用 / 開始' : '範囲と内容を選択してください'}
          </button>
        </div>
      </div>
    </>
  );
}
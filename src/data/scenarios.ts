export interface Formula {
  id: string;
  name: string;
  expression: string;
  description: string;
  usedFormulas: string[];
  derivableFormulas: string[];
  symbols?: { symbol: string; meaning: string }[];
}

export interface Step {
  id: string;
  name: string;
  formulaIds: string[];
}

export interface Scenario {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  parentId?: string; // 新增：父场景ID，支持嵌套
  steps: Step[];
}

/**
 * 预置公式（已清空）
 * - “未整理”默认文件夹通常是 UI 层兜底生成，不在这里定义
 */
export const formulas: Record<string, Formula> = {};

/**
 * 预置场面（已清空）
 */
export const scenarios: Scenario[] = [];

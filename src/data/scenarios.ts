export interface Formula {
  id: string;
  name: string;
  expression: string;
  description: string;
  usedFormulas: string[];
  derivableFormulas: string[];
  symbols?: { symbol: string; meaning: string; unit?: string }[];
  equivalentExpressions?: string[];
  usedInContexts?: { scenarioId: string; stepId: string }[];
  structureData?: any; // 新增：保存公式结构树，用于再次编辑
  structureTree?: any; // 新增：保存解析后的AST树，用于学习模式
}

export interface Step {
  id: string;
  name: string;
  formulaIds: string[]; // 改为只保存ID引用，不保存公式对象
}

export interface Scenario {
  id: string;
  name: string;
  icon: string;
  parentId?: string; // 新增：父场景ID，支持嵌套
  steps: Step[];
}

export const formulas: Record<string, Formula> = {
  'f1': {
    id: 'f1',
    name: '運動方程式',
    expression: 'F = ma',
    description: '物体に働く力は質量と加速度の積に等しい。ニュートンの第二法則として知られる基本的な力学法則。',
    usedFormulas: [],
    derivableFormulas: ['f2', 'f3'],
    symbols: [
      { symbol: 'F', meaning: '力', unit: 'N' },
      { symbol: 'm', meaning: '質量', unit: 'kg' },
      { symbol: 'a', meaning: '加速度', unit: 'm/s²' },
    ],
    equivalentExpressions: ['ma = F', 'ΣF = ma'],
    usedInContexts: [
      { scenarioId: 's1', stepId: 'step1' },
      { scenarioId: 's2', stepId: 'step1' },
      { scenarioId: 's3', stepId: 'step1' },
      { scenarioId: 's4', stepId: 'step1' },
      { scenarioId: 's5', stepId: 'step1' },
    ],
  },
  'f2': {
    id: 'f2',
    name: '加速度',
    expression: 'a = F/m',
    description: '加速度は力を質量で割ったものに等しい。運動方程式を変形したもの。',
    usedFormulas: ['f1'],
    derivableFormulas: [],
    symbols: [
      { symbol: 'a', meaning: '加速度', unit: 'm/s²' },
      { symbol: 'F', meaning: '力', unit: 'N' },
      { symbol: 'm', meaning: '質量', unit: 'kg' },
    ],
    usedInContexts: [
      { scenarioId: 's2', stepId: 'step2' },
    ],
  },
  'f3': {
    id: 'f3',
    name: '質量',
    expression: 'm = F/a',
    description: '質量は力を加速度で割ったものに等しい。運動方程式を変形したもの。',
    usedFormulas: ['f1'],
    derivableFormulas: [],
    symbols: [
      { symbol: 'm', meaning: '質量', unit: 'kg' },
      { symbol: 'F', meaning: '力', unit: 'N' },
      { symbol: 'a', meaning: '加速度', unit: 'm/s²' },
    ],
  },
  'f4': {
    id: 'f4',
    name: '速度',
    expression: 'v = v₀ + at',
    description: '等加速度運動において、速度は初速度に加速度と時間の積を加えたもの。',
    usedFormulas: [],
    derivableFormulas: ['f5', 'f6'],
    symbols: [
      { symbol: 'v', meaning: '速度', unit: 'm/s' },
      { symbol: 'v₀', meaning: '初速度', unit: 'm/s' },
      { symbol: 'a', meaning: '加速度', unit: 'm/s²' },
      { symbol: 't', meaning: '時間', unit: 's' },
    ],
    equivalentExpressions: ['v - v₀ = at', 'at = v - v₀'],
    usedInContexts: [
      { scenarioId: 's1', stepId: 'step2' },
      { scenarioId: 's2', stepId: 'step3' },
      { scenarioId: 's3', stepId: 'step2' },
      { scenarioId: 's6', stepId: 'step1' },
    ],
  },
  'f5': {
    id: 'f5',
    name: '変位',
    expression: 's = v₀t + ½at²',
    description: '等加速度運動における変位の公式。初速度と時間、加速度の関係を示す。',
    usedFormulas: ['f4'],
    derivableFormulas: [],
    symbols: [
      { symbol: 's', meaning: '変位', unit: 'm' },
      { symbol: 'v₀', meaning: '初速度', unit: 'm/s' },
      { symbol: 't', meaning: '時間', unit: 's' },
      { symbol: 'a', meaning: '加速度', unit: 'm/s²' },
    ],
    usedInContexts: [
      { scenarioId: 's1', stepId: 'step2' },
      { scenarioId: 's2', stepId: 'step3' },
      { scenarioId: 's6', stepId: 'step1' },
    ],
  },
  'f6': {
    id: 'f6',
    name: '速度と変位の関係',
    expression: 'v² = v₀² + 2as',
    description: '時間を含まない等加速度運動の公式。速度、初速度、加速度、変位の関係。',
    usedFormulas: ['f4', 'f5'],
    derivableFormulas: [],
    symbols: [
      { symbol: 'v', meaning: '速度', unit: 'm/s' },
      { symbol: 'v₀', meaning: '初速度', unit: 'm/s' },
      { symbol: 'a', meaning: '加速度', unit: 'm/s²' },
      { symbol: 's', meaning: '変位', unit: 'm' },
    ],
    equivalentExpressions: ['v² - v₀² = 2as'],
    usedInContexts: [
      { scenarioId: 's2', stepId: 'step3' },
      { scenarioId: 's6', stepId: 'step2' },
    ],
  },
  'f7': {
    id: 'f7',
    name: '運動エネルギー',
    expression: 'K = ½mv²',
    description: '運動する物体が持つエネルギー。質量と速度の二乗に比例する。',
    usedFormulas: [],
    derivableFormulas: ['f8'],
    symbols: [
      { symbol: 'K', meaning: '運動エネルギー', unit: 'J' },
      { symbol: 'm', meaning: '質量', unit: 'kg' },
      { symbol: 'v', meaning: '速度', unit: 'm/s' },
    ],
    usedInContexts: [
      { scenarioId: 's1', stepId: 'step3' },
      { scenarioId: 's4', stepId: 'step2' },
      { scenarioId: 's5', stepId: 'step2' },
    ],
  },
  'f8': {
    id: 'f8',
    name: '仕事とエネルギーの関係',
    expression: 'W = ΔK',
    description: '物体に加えられた仕事は運動エネルギーの変化量に等しい。',
    usedFormulas: ['f7'],
    derivableFormulas: [],
    symbols: [
      { symbol: 'W', meaning: '仕事', unit: 'J' },
      { symbol: 'ΔK', meaning: '運動エネルギーの変化', unit: 'J' },
    ],
    equivalentExpressions: ['W = K₂ - K₁', 'ΔK = W'],
    usedInContexts: [
      { scenarioId: 's4', stepId: 'step2' },
    ],
  },
  'f9': {
    id: 'f9',
    name: '位置エネルギー',
    expression: 'U = mgh',
    description: '高さhにある物体が持つ重力による位置エネルギー。',
    usedFormulas: [],
    derivableFormulas: [],
    symbols: [
      { symbol: 'U', meaning: '位置エネルギー', unit: 'J' },
      { symbol: 'm', meaning: '質量', unit: 'kg' },
      { symbol: 'g', meaning: '重力加速度', unit: 'm/s²' },
      { symbol: 'h', meaning: '高さ', unit: 'm' },
    ],
    usedInContexts: [
      { scenarioId: 's1', stepId: 'step3' },
    ],
  },
  'f10': {
    id: 'f10',
    name: '力学的エネルギー保存則',
    expression: 'K + U = 一定',
    description: '保存力のみが働く系では、運動エネルギーと位置エネルギーの和が一定に保たれる。',
    usedFormulas: ['f7', 'f9'],
    derivableFormulas: [],
    symbols: [
      { symbol: 'K', meaning: '運動エネルギー', unit: 'J' },
      { symbol: 'U', meaning: '位置エネルギー', unit: 'J' },
    ],
    equivalentExpressions: ['E = K + U = 一定', 'K₁ + U₁ = K₂ + U₂'],
    usedInContexts: [
      { scenarioId: 's1', stepId: 'step3' },
      { scenarioId: 's5', stepId: 'step2' },
    ],
  },
};

export const scenarios: Scenario[] = [
  {
    id: 's1',
    name: '自由落下運動',
    icon: '↓',
    steps: [
      {
        id: 'step1',
        name: 'ステップ1：力の分析',
        formulaIds: ['f1'],
      },
      {
        id: 'step2',
        name: 'ステップ2：運動の記述',
        formulaIds: ['f4', 'f5'],
      },
      {
        id: 'step3',
        name: 'ステップ3：エネルギー保存',
        formulaIds: ['f7', 'f9', 'f10'],
      },
    ],
  },
  {
    id: 's2',
    name: '斜面運動',
    icon: '⟋',
    steps: [
      {
        id: 'step1',
        name: 'ステップ1：力の分解',
        formulaIds: ['f1'],
      },
      {
        id: 'step2',
        name: 'ステップ2：加速度の計算',
        formulaIds: ['f2'],
      },
      {
        id: 'step3',
        name: 'ステップ3：運動の予測',
        formulaIds: ['f4', 'f5', 'f6'],
      },
    ],
  },
  {
    id: 's3',
    name: '円運動',
    icon: '○',
    steps: [
      {
        id: 'step1',
        name: 'ステップ1：向心力の導出',
        formulaIds: ['f1'],
      },
      {
        id: 'step2',
        name: 'ステップ2：速度と周期',
        formulaIds: ['f4'],
      },
    ],
  },
  {
    id: 's4',
    name: '衝突問題',
    icon: '⇄',
    steps: [
      {
        id: 'step1',
        name: 'ステップ1：運動量保存',
        formulaIds: ['f1'],
      },
      {
        id: 'step2',
        name: 'ステップ2：エネルギー分析',
        formulaIds: ['f7', 'f8'],
      },
    ],
  },
  {
    id: 's5',
    name: '単振動',
    icon: '~',
    steps: [
      {
        id: 'step1',
        name: 'ステップ1：復元力',
        formulaIds: ['f1'],
      },
      {
        id: 'step2',
        name: 'ステップ2：エネルギー保存',
        formulaIds: ['f7', 'f10'],
      },
    ],
  },
  {
    id: 's6',
    name: '放物運動',
    icon: '⌒',
    steps: [
      {
        id: 'step1',
        name: 'ステップ1：水平・鉛直分解',
        formulaIds: ['f4', 'f5'],
      },
      {
        id: 'step2',
        name: 'ステップ2：軌道の決定',
        formulaIds: ['f6'],
      },
    ],
  },
];
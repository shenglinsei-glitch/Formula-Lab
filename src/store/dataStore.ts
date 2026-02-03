import { formulas as initialFormulas, scenarios as initialScenarios } from '../data/scenarios';
import type { Formula, Scenario } from '../data/scenarios';
import type { SymbolItem } from '../data/symbols';

// 使用localStorage持久化数据
const STORAGE_KEY_FORMULAS = 'mechanics_formulas';
const STORAGE_KEY_SCENARIOS = 'mechanics_scenarios';
const STORAGE_KEY_SYMBOLS = 'mechanics_symbols';

// 系统默认"未整理"场景ID
export const UNCATEGORIZED_SCENARIO_ID = 'uncategorized';

class DataStore {
  private formulas: Record<string, Formula>;
  private scenarios: Scenario[];
  private symbols: Record<string, SymbolItem>;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // 从localStorage加载，如果没有则使用初始数据
    const savedFormulas = localStorage.getItem(STORAGE_KEY_FORMULAS);
    const savedScenarios = localStorage.getItem(STORAGE_KEY_SCENARIOS);
    const savedSymbols = localStorage.getItem(STORAGE_KEY_SYMBOLS);

    this.formulas = savedFormulas ? JSON.parse(savedFormulas) : { ...initialFormulas };
    this.scenarios = savedScenarios ? JSON.parse(savedScenarios) : [...initialScenarios];
    this.symbols = savedSymbols ? JSON.parse(savedSymbols) : {};

    // 数据迁移：将旧格式(formulas数组)转换为新格式(formulaIds数组)
    this.migrateOldDataFormat();

    // 确保"未整理"场景存在
    this.ensureUncategorizedScenario();
  }

  // ===== Symbols =====
  getSymbols(): Record<string, SymbolItem> {
    return this.symbols;
  }

  getSymbol(id: string): SymbolItem | undefined {
    return this.symbols[id];
  }

  saveSymbol(symbol: SymbolItem): void {
    this.symbols[symbol.id] = symbol;
    this.persist();
    this.notifyListeners();
  }

  deleteSymbol(id: string): void {
    delete this.symbols[id];
    this.persist();
    this.notifyListeners();
  }

  /**
   * 同期：公式に入力済みの「記号の意味 / 単位」を符号ライブラリへ自動同期する。
   * - 未登録の記号は自動作成
   * - 各公式ごとに auto-<formulaId> の説明エントリを作成/更新
   * - 手動エントリ（auto- 以外）は上書きしない
   */
  syncSymbolsFromFormulas(): { createdSymbols: number; updatedAutoEntries: number } {
    const formulas = Object.values(this.formulas);
    let createdSymbols = 0;
    let updatedAutoEntries = 0;

    // key -> symbolId lookup (fast)
    const keyToId = new Map<string, string>();
    Object.values(this.symbols).forEach((s) => {
      if (s?.key) keyToId.set(String(s.key), s.id);
    });

    const now = new Date().toISOString();
    const ensureSymbol = (key: string) => {
      const existingId = keyToId.get(key);
      if (existingId && this.symbols[existingId]) return this.symbols[existingId];

      // create
      const id = `sym-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const created: any = {
        id,
        key,
        entries: [],
        createdAt: now,
        updatedAt: now,
      };
      this.symbols[id] = created;
      keyToId.set(key, id);
      createdSymbols += 1;
      return created as any;
    };

    formulas.forEach((f: any) => {
      const formulaId = String(f.id);
      const formulaName = String(f.name || '');
      (f.symbols || []).forEach((s: any) => {
        const key = String(s.symbol || '').trim();
        if (!key) return;

        const meaning = String(s.meaning || '').trim();
        const unit = String(s.unit || '').trim();
        // 公式側に何も入力がない場合は同期対象外（空エントリ乱立防止）
        if (!meaning && !unit) return;

        const sym = ensureSymbol(key) as any;
        const entries: any[] = Array.isArray(sym.entries) ? [...sym.entries] : [];
        const autoId = `auto-${formulaId}`;
        const next = {
          id: autoId,
          title: formulaName || key,
          description: meaning,
          unit: unit || undefined,
          formulaIds: [formulaId],
        };

        const idx = entries.findIndex((e) => e?.id === autoId);
        if (idx >= 0) {
          // only update auto- entry
          entries[idx] = { ...entries[idx], ...next };
          updatedAutoEntries += 1;
        } else {
          entries.unshift({ ...next, tables: [] });
          updatedAutoEntries += 1;
        }

        this.symbols[sym.id] = { ...sym, entries, updatedAt: now };
      });
    });

    if (createdSymbols > 0 || updatedAutoEntries > 0) {
      this.persist();
      this.notifyListeners();
    }

    return { createdSymbols, updatedAutoEntries };
  }

  // 数据迁移：将旧的Step.formulas转换为Step.formulaIds
  private migrateOldDataFormat(): void {
    let needsMigration = false;
    
    this.scenarios.forEach(scenario => {
      scenario.steps.forEach((step: any) => {
        // 检查是否是旧格式（有formulas但没有formulaIds）
        if (step.formulas && !step.formulaIds) {
          needsMigration = true;
          // 将formulas数组转换为formulaIds数组
          step.formulaIds = step.formulas.map((f: any) => f.id || f);
          // 删除旧的formulas字段
          delete step.formulas;
        } else if (!step.formulaIds) {
          // 如果两个都没有，初始化为空数组
          step.formulaIds = [];
        }
      });
    });

    // 如果进行了迁移，保存新格式
    if (needsMigration) {
      this.persist();
    }
  }

  // 确保"未整理"场景存在
  private ensureUncategorizedScenario(): void {
    const hasUncategorized = this.scenarios.some(s => s.id === UNCATEGORIZED_SCENARIO_ID);
    if (!hasUncategorized) {
      this.scenarios.unshift({
        id: UNCATEGORIZED_SCENARIO_ID,
        name: '未整理',
        icon: '📋',
        steps: [{
          id: 'uncategorized-step',
          name: 'その他の公式',
          formulaIds: [] // 改为ID数组
        }]
      });
    }
  }

  // 获取所有公式
  getFormulas(): Record<string, Formula> {
    return this.formulas;
  }

  // 获取单个公式
  getFormula(id: string): Formula | undefined {
    return this.formulas[id];
  }

  // 保存或更新公式（核心方法：确保双向关联正确）
  saveFormula(formula: Formula): void {
    // 1. 保存公式实体到唯一数据源
    this.formulas[formula.id] = formula;
    
    // 2. 清理所有步骤中的旧关联（防止重复/残留）
    this.scenarios.forEach(scenario => {
      scenario.steps.forEach(step => {
        step.formulaIds = step.formulaIds.filter(fId => fId !== formula.id);
      });
    });

    // 3. 建立新的双向关联
    if (formula.usedInContexts && formula.usedInContexts.length > 0) {
      // 用户选择了场景/步骤，建立关联
      formula.usedInContexts.forEach(context => {
        const scenario = this.scenarios.find(s => s.id === context.scenarioId);
        if (scenario) {
          const step = scenario.steps.find(st => st.id === context.stepId);
          if (step) {
            // 建立反向关联：step.formulaIds
            step.formulaIds.push(formula.id);
          }
        }
      });
    } else {
      // 未选择场景/步骤，自动归入"未整理"
      const uncategorizedScenario = this.scenarios.find(s => s.id === UNCATEGORIZED_SCENARIO_ID);
      if (uncategorizedScenario && uncategorizedScenario.steps[0]) {
        uncategorizedScenario.steps[0].formulaIds.push(formula.id);
      }
    }
    
    this.persist();
    this.notifyListeners();
  }

  // 删除公式
  deleteFormula(id: string): void {
    delete this.formulas[id];
    // 同时从所有场景中移除
    this.scenarios.forEach(scenario => {
      scenario.steps.forEach(step => {
        step.formulaIds = step.formulaIds.filter(f => f !== id);
      });
    });
    this.persist();
    this.notifyListeners();
  }

  // 获取所有场景
  getScenarios(): Scenario[] {
    return this.scenarios;
  }

  // 获取顶级场景（没有父场景的）
  getRootScenarios(): Scenario[] {
    return this.scenarios.filter(s => !s.parentId);
  }

  // 获取某个场景的子场景
  getChildScenarios(parentId: string): Scenario[] {
    return this.scenarios.filter(s => s.parentId === parentId);
  }

  // 获取单个场景
  getScenario(id: string): Scenario | undefined {
    return this.scenarios.find(s => s.id === id);
  }

  // 保存或更新场景
  saveScenario(scenario: Scenario): void {
    const index = this.scenarios.findIndex(s => s.id === scenario.id);
    if (index >= 0) {
      this.scenarios[index] = scenario;
    } else {
      this.scenarios.push(scenario);
    }
    this.persist();
    this.notifyListeners();
  }

  // 新增步骤到场景（合并更新，不覆盖现有数据）
  addStep(scenarioId: string, stepName: string): void {
    const scenario = this.scenarios.find(s => s.id === scenarioId);
    if (scenario) {
      const newStep = {
        id: `step-${Date.now()}`,
        name: stepName,
        formulaIds: []
      };
      scenario.steps.push(newStep);
      this.persist();
      this.notifyListeners();
    }
  }

  // 删除步骤（只删步骤，不删公式）
  deleteStep(scenarioId: string, stepId: string): void {
    const scenario = this.scenarios.find(s => s.id === scenarioId);
    if (scenario) {
      // 获取要删除的步骤中的所有公式
      const step = scenario.steps.find(s => s.id === stepId);
      if (step) {
        // 从所有公式的 usedInContexts 中移除这个步骤
        step.formulaIds.forEach(formulaId => {
          const formula = this.formulas[formulaId];
          if (formula && formula.usedInContexts) {
            formula.usedInContexts = formula.usedInContexts.filter(
              ctx => !(ctx.scenarioId === scenarioId && ctx.stepId === stepId)
            );
            
            // 如果公式不再属于任何场景/步骤，归入"未整理"
            if (formula.usedInContexts.length === 0) {
              const uncategorizedScenario = this.scenarios.find(s => s.id === UNCATEGORIZED_SCENARIO_ID);
              if (uncategorizedScenario && uncategorizedScenario.steps[0]) {
                uncategorizedScenario.steps[0].formulaIds.push(formulaId);
              }
            }
          }
        });
      }
      
      // 删除步骤
      scenario.steps = scenario.steps.filter(s => s.id !== stepId);
      this.persist();
      this.notifyListeners();
    }
  }

  // 往步骤中添加公式（建立双向关联）
  addFormulaToStep(scenarioId: string, stepId: string, formulaId: string): void {
    const scenario = this.scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    
    const step = scenario.steps.find(s => s.id === stepId);
    if (!step) return;
    
    const formula = this.formulas[formulaId];
    if (!formula) return;
    
    // 1. 添加到 step.formulaIds（避免重复）
    if (!step.formulaIds.includes(formulaId)) {
      step.formulaIds.push(formulaId);
    }
    
    // 2. 添加到 formula.usedInContexts（避免重复）
    if (!formula.usedInContexts) {
      formula.usedInContexts = [];
    }
    const contextExists = formula.usedInContexts.some(
      ctx => ctx.scenarioId === scenarioId && ctx.stepId === stepId
    );
    if (!contextExists) {
      formula.usedInContexts.push({ scenarioId, stepId });
    }
    
    // 3. 从"未整理"中移除（如果存在）
    const uncategorizedScenario = this.scenarios.find(s => s.id === UNCATEGORIZED_SCENARIO_ID);
    if (uncategorizedScenario && uncategorizedScenario.steps[0]) {
      uncategorizedScenario.steps[0].formulaIds = 
        uncategorizedScenario.steps[0].formulaIds.filter(id => id !== formulaId);
    }
    
    this.persist();
    this.notifyListeners();
  }

  // 从步骤中移除公式（解除双向关联）
  removeFormulaFromStep(scenarioId: string, stepId: string, formulaId: string): void {
    const scenario = this.scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    
    const step = scenario.steps.find(s => s.id === stepId);
    if (!step) return;
    
    const formula = this.formulas[formulaId];
    if (!formula) return;
    
    // 1. 从 step.formulaIds 中移除
    step.formulaIds = step.formulaIds.filter(id => id !== formulaId);
    
    // 2. 从 formula.usedInContexts 中移除
    if (formula.usedInContexts) {
      formula.usedInContexts = formula.usedInContexts.filter(
        ctx => !(ctx.scenarioId === scenarioId && ctx.stepId === stepId)
      );
      
      // 3. 如果公式不再属于任何场景/步骤，归入"未整理"
      if (formula.usedInContexts.length === 0) {
        const uncategorizedScenario = this.scenarios.find(s => s.id === UNCATEGORIZED_SCENARIO_ID);
        if (uncategorizedScenario && uncategorizedScenario.steps[0]) {
          if (!uncategorizedScenario.steps[0].formulaIds.includes(formulaId)) {
            uncategorizedScenario.steps[0].formulaIds.push(formulaId);
          }
        }
      }
    }
    
    this.persist();
    this.notifyListeners();
  }

  // 删除场景
  deleteScenario(id: string): void {
    // 不允许删除"未整理"场景
    if (id === UNCATEGORIZED_SCENARIO_ID) {
      return;
    }
    
    // 递归删除子场景
    const childScenarios = this.getChildScenarios(id);
    childScenarios.forEach(child => this.deleteScenario(child.id));
    
    // 删除场景本身
    this.scenarios = this.scenarios.filter(s => s.id !== id);
    this.persist();
    this.notifyListeners();
  }

  // 添加监听器
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // 通知所有监听器
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  // 持久化到localStorage
  private persist(): void {
    localStorage.setItem(STORAGE_KEY_FORMULAS, JSON.stringify(this.formulas));
    localStorage.setItem(STORAGE_KEY_SCENARIOS, JSON.stringify(this.scenarios));
    localStorage.setItem(STORAGE_KEY_SYMBOLS, JSON.stringify(this.symbols));
  }

// 导出：返回可直接保存的 JSON 字符串（完全覆盖用）
exportData(): string {
  const payload = {
    version: 1,
    formulas: this.formulas,
    scenarios: this.scenarios,
    symbols: this.symbols,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

// 导入：从 JSON 字符串恢复数据（完全覆盖）
importData(rawJson: string): void {
  const parsed = JSON.parse(rawJson);

  // 允许两种格式：
  // A) { version, formulas, scenarios, ... }
  // B) { formulas, scenarios }
  const formulas = parsed?.formulas;
  const scenarios = parsed?.scenarios;
  const symbols = parsed?.symbols;

  if (!formulas || typeof formulas !== 'object') {
    throw new Error('Invalid formulas');
  }
  if (!Array.isArray(scenarios)) {
    throw new Error('Invalid scenarios');
  }

  this.formulas = formulas as Record<string, Formula>;
  this.scenarios = scenarios as Scenario[];
  this.symbols = (symbols && typeof symbols === 'object') ? (symbols as Record<string, SymbolItem>) : {};

  // 兼容旧数据结构，并保证"未整理"存在
  this.migrateOldDataFormat();
  this.ensureUncategorizedScenario();

  this.persist();
  this.notifyListeners();
}

  // 重置为初始数据
  reset(): void {
    this.formulas = { ...initialFormulas };
    this.scenarios = [...initialScenarios];
    this.symbols = {};
    this.persist();
    this.notifyListeners();
  }
}

// 单例
export const dataStore = new DataStore();
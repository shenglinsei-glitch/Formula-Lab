import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, List, Layers, RefreshCw } from 'lucide-react';
import { dataStore } from '../store/dataStore';
import type { SymbolItem } from '../data/symbols';
import FormulaRenderer from './FormulaRenderer';
import type { FormulaRoot, Container, FormulaNode } from './FormulaRenderer';

/**
 * Render symbol keys like K_1, \u03c3_R as real subscripts/superscripts (list-friendly).
 * Supports: _x, _{x}, ^x, ^{x}, and chained combinations (e.g. K_1^2).
 */
function symbolKeyToFormulaRoot(key: string): FormulaRoot | null {
  const s = (key || '').trim();
  if (!s) return null;

  // If no markers, keep it simple.
  if (!s.includes('_') && !s.includes('^')) {
    return { children: [{ type: 'symbol', value: s } satisfies FormulaNode] };
  }

  const toContainer = (text: string): Container => ({
    children: text
      .split('')
      .filter(Boolean)
      .map((ch) => {
        if (/^[0-9]$/.test(ch)) return { type: 'number', text: ch } as FormulaNode;
        return { type: 'symbol', value: ch } as FormulaNode;
      }),
  });

  const readGroup = (src: string, start: number): { text: string; next: number } => {
    // { ... } group (allows multi-char, including Japanese/Chinese, symbols, etc.)
    if (src[start] === '{') {
      let depth = 0;
      let i = start;
      i++; // skip '{'
      depth++;
      const buf: string[] = [];
      for (; i < src.length; i++) {
        const c = src[i];
        if (c === '{') {
          depth++;
          buf.push(c);
          continue;
        }
        if (c === '}') {
          depth--;
          if (depth === 0) {
            i++; // consume closing
            break;
          }
          buf.push(c);
          continue;
        }
        buf.push(c);
      }
      return { text: buf.join(''), next: i };
    }
    // Non-braced group: consume until next marker so `_日本語` works without braces.
    let i = start;
    const buf: string[] = [];
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '_' || c === '^') break;
      buf.push(c);
    }
    // Fallback: at least one char if we didn't collect anything.
    if (buf.length === 0) return { text: src[start] ?? '', next: start + 1 };
    return { text: buf.join(''), next: i };
  };

  // base before first _ or ^
  let i = 0;
  let baseText = '';
  while (i < s.length && s[i] !== '_' && s[i] !== '^') {
    baseText += s[i];
    i++;
  }
  let current: Container = toContainer(baseText || s[0]);

  while (i < s.length) {
    const op = s[i];
    if (op !== '_' && op !== '^') {
      // treat unexpected char as part of base (fallback)
      current = toContainer((baseText + s.slice(i)).trim());
      break;
    }
    const { text, next } = readGroup(s, i + 1);
    const content = toContainer(text);
    if (op === '_') {
      current = {
        children: [
          {
            type: 'subscript',
            base: current,
            index: content,
          } as FormulaNode,
        ],
      };
    } else {
      current = {
        children: [
          {
            type: 'superscript',
            base: current,
            exponent: content,
          } as FormulaNode,
        ],
      };
    }
    i = next;
  }

  // unwrap one level if we wrapped in Container each time
  const node = (current.children.length === 1 ? current.children[0] : { type: 'symbol', value: s }) as FormulaNode;
  return { children: [node] };
}

function SymbolKey({ value, className }: { value: string; className?: string }) {
  const root = useMemo(() => symbolKeyToFormulaRoot(value), [value]);
  return <FormulaRenderer root={root} fallback={value} className={className} />;
}

interface SymbolListPageProps {
  onSymbolClick: (symbolId: string) => void;
  onCreateSymbol: (symbolId?: string) => void;
}

type DerivedSymbol = {
  key: string;
  byFormula: Array<{ formulaId: string; formulaName: string; meaning?: string; unit?: string }>;
};

function deriveSymbolsFromFormulas(): DerivedSymbol[] {
  const formulas = dataStore.getFormulas();
  const map = new Map<string, DerivedSymbol>();

  Object.values(formulas).forEach((f) => {
    (f.symbols || []).forEach((s: any) => {
      const k = (s.symbol || '').trim();
      if (!k) return;
      if (!map.has(k)) map.set(k, { key: k, byFormula: [] });
      const item = map.get(k)!;

      const meaning = (s.meaning || '').trim() || undefined;
      const unit = (s.unit || '').trim() || undefined;
      const exists = item.byFormula.some(
        (x) => x.formulaId === f.id && (x.meaning || '') === (meaning || '') && (x.unit || '') === (unit || '')
      );
      if (!exists) {
        item.byFormula.push({
          formulaId: f.id,
          formulaName: f.name,
          meaning,
          unit,
        });
      }
    });
  });

  // sort by key; within a key, sort by formula name
  return [...map.values()]
    .map((d) => ({ ...d, byFormula: [...d.byFormula].sort((a, b) => a.formulaName.localeCompare(b.formulaName)) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function buildPrefilledEntries(derived?: DerivedSymbol): any[] {
  if (!derived) return [];
  // One entry per (formula, meaning/unit) to keep "公式別" classification clear.
  return derived.byFormula.map((x, idx) => ({
    id: `entry-${x.formulaId}-${idx}`,
    title: x.formulaName,
    description: x.meaning || '',
    unit: x.unit,
    formulaIds: [x.formulaId],
    tables: [],
  }));
}

export default function SymbolListPage({ onSymbolClick, onCreateSymbol }: SymbolListPageProps) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'symbol' | 'formula'>('symbol');
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // re-render when datastore changes (sync / create / edit)
  const [, setStoreVersion] = useState(0);
  useEffect(() => dataStore.subscribe(() => setStoreVersion((v) => v + 1)), []);

  const storedSymbols = dataStore.getSymbols();
  const derived = useMemo(() => deriveSymbolsFromFormulas(), []);
  const derivedByKey = useMemo(() => {
    const m = new Map<string, DerivedSymbol>();
    derived.forEach((d) => m.set(d.key, d));
    return m;
  }, [derived]);

  const mergedList: SymbolItem[] = useMemo(() => {
    // Merge stored symbols + derived keys (as virtual items if missing)
    const list: SymbolItem[] = Object.values(storedSymbols).map((s) => s);
    const existingKeys = new Set(list.map((s) => s.key));
    derived.forEach((d) => {
      if (!existingKeys.has(d.key)) {
        // virtual items are prefilled from formulas (meaning/unit) so "0件" doesn't happen
        list.push({ id: `virtual-${d.key}`, key: d.key, entries: buildPrefilledEntries(d) as any });
      }
    });
    return list.sort((a, b) => a.key.localeCompare(b.key));
  }, [storedSymbols, derived]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return mergedList;
    return mergedList.filter(s => {
      if (s.key.toLowerCase().includes(query)) return true;
      if (s.aliases?.some(a => a.toLowerCase().includes(query))) return true;
      if (s.entries?.some(e => (e.title + ' ' + e.description).toLowerCase().includes(query))) return true;
      return false;
    });
  }, [mergedList, q]);

  const handleOpenCreate = () => {
    setNewKey('');
    setShowCreate(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleCreate = () => {
    const key = newKey.trim();
    if (!key) return;

    // If exists, navigate
    const existing = Object.values(dataStore.getSymbols()).find(s => s.key === key);
    if (existing) {
      setShowCreate(false);
      onSymbolClick(existing.id);
      return;
    }

    const id = `sym-${Date.now()}`;
    dataStore.saveSymbol({
      id,
      key,
      entries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowCreate(false);
    onCreateSymbol(id);
  };

  const formulasForMode = useMemo(() => {
    const formulas = Object.values(dataStore.getFormulas());
    const query = q.trim().toLowerCase();
    const filteredFormulas = !query
      ? formulas
      : formulas.filter((f) => {
          if ((f.name || '').toLowerCase().includes(query)) return true;
          if ((f.expression || '').toLowerCase().includes(query)) return true;
          return (f.symbols || []).some((s: any) => (s.symbol || '').toLowerCase().includes(query) || (s.meaning || '').toLowerCase().includes(query));
        });
    return filteredFormulas
      .map((f) => ({
        id: f.id,
        name: f.name,
        symbols: (f.symbols || [])
          .map((s: any) => ({
            key: (s.symbol || '').trim(),
            meaning: (s.meaning || '').trim(),
            unit: (s.unit || '').trim(),
          }))
          .filter((x) => x.key),
      }))
      .filter((x) => x.symbols.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="検索..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl glass-card border border-border focus:outline-none"
            />
          </div>

          {/* 同期：公式の意味/単位を符号ライブラリへ反映 */}
          <button
            onClick={() => {
              const res = dataStore.syncSymbolsFromFormulas();
              // lightweight feedback (no toast dependency)
              alert(`同期完了：新規 ${res.createdSymbols} 件 / 更新 ${res.updatedAutoEntries} 件`);
            }}
            className="shrink-0 px-4 py-3 rounded-2xl glass-card border border-border text-sm flex items-center gap-2 hover:bg-primary/5 transition-colors"
            title="公式から同期"
          >
            <RefreshCw className="w-4 h-4" /> 同期
          </button>
        </div>

        {/* Mode switch: 符号一覧 / 公式別 */}
        <div className="mt-4 glass-card rounded-2xl border border-border p-1 flex">
          <button
            onClick={() => setMode('symbol')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${
              mode === 'symbol' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-primary/5'
            }`}
          >
            <List className="w-4 h-4" /> 符号
          </button>
          <button
            onClick={() => setMode('formula')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${
              mode === 'formula' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-primary/5'
            }`}
          >
            <Layers className="w-4 h-4" /> 公式別
          </button>
        </div>

        {mode === 'symbol' ? (
          <div className="mt-4 space-y-3">
            {filtered.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">該当する符号がありません</div>
            ) : (
              filtered.map((s) => {
                const isVirtual = s.id.startsWith('virtual-');
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (isVirtual) {
                        // Create real symbol prefilled from formula symbol meanings/units
                        const id = `sym-${Date.now()}`;
                        const d = derivedByKey.get(s.key);
                        dataStore.saveSymbol({
                          id,
                          key: s.key,
                          entries: buildPrefilledEntries(d) as any,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        });
                        onSymbolClick(id);
                      } else {
                        onSymbolClick(s.id);
                      }
                    }}
                    className="w-full text-left glass-card rounded-2xl p-4 border border-border hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <SymbolKey value={s.key} className="font-semibold text-foreground" />
                      <div className="text-xs text-muted-foreground">{(s.entries?.length || 0)} 件</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {s.entries?.[0]?.description || (isVirtual ? '（公式から検出：未登録）' : '（未登録）')}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {formulasForMode.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">該当する公式がありません</div>
            ) : (
              formulasForMode.map((f) => (
                <div key={f.id} className="glass-card rounded-2xl border border-border overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="font-semibold text-foreground">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{f.symbols.length} 件</div>
                  </div>
                  <div className="border-t border-border divide-y divide-border">
                    {f.symbols.map((s, idx) => {
                      const stored = Object.values(storedSymbols).find((x) => x.key === s.key);
                      const isVirtual = !stored;
                      const entryHint = s.meaning ? `${s.meaning}${s.unit ? `（${s.unit}）` : ''}` : '（未登録）';
                      return (
                        <button
                          key={`${s.key}-${idx}`}
                          onClick={() => {
                            if (stored) {
                              onSymbolClick(stored.id);
                              return;
                            }
                            const id = `sym-${Date.now()}`;
                            // create only one entry for this formula to keep "公式別" tidy
                            dataStore.saveSymbol({
                              id,
                              key: s.key,
                              entries: [
                                {
                                  id: `entry-${f.id}-${Date.now()}`,
                                  title: f.name,
                                  description: s.meaning || '',
                                  unit: s.unit || undefined,
                                  formulaIds: [f.id],
                                  tables: [],
                                },
                              ] as any,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            });
                            onSymbolClick(id);
                          }}
                          className="w-full text-left px-5 py-3 hover:bg-primary/5 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <SymbolKey value={s.key} className="text-foreground text-base" />
                            <div className="text-xs text-muted-foreground">{isVirtual ? '未登録' : `${stored?.entries?.length || 0}件`}</div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-1">{entryHint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Floating + */}
      <button
        onClick={handleOpenCreate}
        style={{
          width: 64,
          height: 64,
          borderRadius: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid rgb(83, 190, 232)',
          background: 'rgb(83, 190, 232)',
          color: 'white',
          boxShadow: 'rgba(83, 190, 232, 0.5) 0px 8px 24px -6px',
          outline: 'none',
          padding: 0,
          opacity: 1,
          position: 'fixed',
          right: 16,
          bottom: 'calc(16px + env(safe-area-inset-bottom) + 56px)',
          zIndex: 110,
          transform: 'scale(1)',
        }}
      >
        <Plus width={24} height={24} />
      </button>

      {/* Create Dialog */}
      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowCreate(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-md glass-card rounded-3xl border border-border p-5 shadow-2xl">
            <div className="font-semibold">新しい符号</div>
            <div className="mt-3">
              <input
                ref={inputRef}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="例：k1, E, σ"
                className="w-full px-4 py-3 rounded-2xl border border-border bg-background/60 focus:outline-none"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-3 rounded-2xl border border-border text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-3 rounded-2xl bg-primary text-primary-foreground text-sm"
              >
                作成
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

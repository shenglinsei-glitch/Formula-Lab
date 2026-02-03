import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react';
import { dataStore } from '../store/dataStore';
import type { SymbolEntry, SymbolItem, SymbolTable } from '../data/symbols';
import SymbolTableEditor from './SymbolTableEditor';
import FormulaRenderer from './FormulaRenderer';
import type { FormulaRoot, Container, FormulaNode } from './FormulaRenderer';

// Same inline key renderer as SymbolListPage (duplicated to avoid adding a new shared util file).
function symbolKeyToFormulaRoot(key: string): FormulaRoot | null {
  const s = (key || '').trim();
  if (!s) return null;
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
      i++;
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
            i++;
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

  const node = (current.children.length === 1 ? current.children[0] : { type: 'symbol', value: s }) as FormulaNode;
  return { children: [node] };
}

function SymbolKey({ value, className }: { value: string; className?: string }) {
  const root = useMemo(() => symbolKeyToFormulaRoot(value), [value]);
  return <FormulaRenderer root={root} fallback={value} className={className} />;
}

interface SymbolDetailPageProps {
  symbolId: string;
  onBack: () => void;
  onFormulaClick: (formulaId: string) => void;
}

export default function SymbolDetailPage({ symbolId, onBack, onFormulaClick }: SymbolDetailPageProps) {
  const symbol = dataStore.getSymbol(symbolId);
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState(symbol?.key ?? '');

  // re-render when datastore changes (sync / edit on other screen)
  const [, setStoreVersion] = useState(0);
  useEffect(() => dataStore.subscribe(() => setStoreVersion((v) => v + 1)), []);

  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryDraft, setEntryDraft] = useState<Partial<SymbolEntry>>({ title: '', description: '', tables: [] });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement | null>(null);

  const relatedFormulas = useMemo(() => {
    if (!symbol) return [] as { id: string; name: string; expression: string }[];
    const formulas = dataStore.getFormulas();
    return Object.values(formulas)
      .filter(f => (f.symbols || []).some(s => (s.symbol || '').trim() === symbol.key))
      .map(f => ({ id: f.id, name: f.name, expression: f.expression }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [symbolId]);

  if (!symbol) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-6">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> 戻る
          </button>
          <div className="mt-4 glass-card rounded-2xl p-6 border border-border">符号が見つかりません</div>
        </div>
      </div>
    );
  }

  const persist = (next: SymbolItem) => {
    dataStore.saveSymbol({ ...next, updatedAt: new Date().toISOString() });
  };

  const openAddEntry = () => {
    setEditingEntryId(null);
    setEntryDraft({ title: '', description: '', unit: '', source: '', tables: [] });
    setShowAddEntry(true);
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const openEditEntry = (entry: SymbolEntry) => {
    setEditingEntryId(entry.id);
    setEntryDraft(JSON.parse(JSON.stringify(entry)));
    setShowAddEntry(true);
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const saveEntry = () => {
    const title = (entryDraft.title || '').trim();
    const description = (entryDraft.description || '').trim();
    if (!title && !description) return;

    const nextEntry: SymbolEntry = {
      id: editingEntryId || `entry-${Date.now()}`,
      title: title || symbol.key,
      description,
      unit: (entryDraft.unit || '').trim() || undefined,
      source: (entryDraft.source || '').trim() || undefined,
      sceneId: entryDraft.sceneId,
      formulaIds: entryDraft.formulaIds || undefined,
      tables: (entryDraft.tables || []) as SymbolTable[],
    };

    const entries = [...(symbol.entries || [])];
    const idx = entries.findIndex(e => e.id === nextEntry.id);
    if (idx >= 0) entries[idx] = nextEntry;
    else entries.unshift(nextEntry);

    persist({ ...symbol, entries });
    setShowAddEntry(false);
  };

  const deleteEntry = (entryId: string) => {
    if (!confirm('この説明を削除しますか？')) return;
    persist({ ...symbol, entries: (symbol.entries || []).filter(e => e.id !== entryId) });
  };

  const deleteSymbol = () => {
    if (!confirm('符号を削除しますか？')) return;
    dataStore.deleteSymbol(symbol.id);
    onBack();
  };

  // tables are edited by <SymbolTableEditor />

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> 戻る
          </button>
          <button onClick={deleteSymbol} className="text-sm text-destructive flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> 削除
          </button>
        </div>

        <div className="mt-4 glass-card rounded-3xl border border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {!editingKey ? (
                <SymbolKey value={symbol.key} className="text-2xl font-bold text-foreground" />
              ) : (
                <input
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-border bg-background/60 focus:outline-none text-lg"
                />
              )}
              <div className="mt-1 text-xs text-muted-foreground">説明：{symbol.entries?.length || 0} 件</div>
            </div>
            {!editingKey ? (
              <button
                onClick={() => {
                  setKeyDraft(symbol.key);
                  setEditingKey(true);
                }}
                className="px-3 py-2 rounded-2xl border border-border text-sm flex items-center gap-1"
              >
                <Pencil className="w-4 h-4" /> 編集
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingKey(false)}
                  className="px-3 py-2 rounded-2xl border border-border text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    const nextKey = keyDraft.trim();
                    if (!nextKey) return;
                    persist({ ...symbol, key: nextKey });
                    setEditingKey(false);
                  }}
                  className="px-3 py-2 rounded-2xl bg-primary text-primary-foreground text-sm"
                >
                  保存
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={openAddEntry}
              className="flex-1 px-4 py-3 rounded-2xl bg-primary text-primary-foreground text-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> 説明を追加
            </button>
          </div>
        </div>

        {/* Entries */}
        <div className="mt-4 space-y-3">
          {(symbol.entries || []).length === 0 ? (
            <div className="glass-card rounded-2xl p-6 border border-border text-sm text-muted-foreground">
              まだ説明がありません。右上の「説明を追加」から登録できます。
            </div>
          ) : (
            (symbol.entries || []).map((e) => (
              <div key={e.id} className="glass-card rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{e.title}</div>
                    {e.unit ? <div className="text-xs text-muted-foreground mt-1">単位：{e.unit}</div> : null}
                    {e.source ? <div className="text-xs text-muted-foreground">出典：{e.source}</div> : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditEntry(e)}
                      className="px-3 py-2 rounded-2xl border border-border text-sm flex items-center gap-1"
                    >
                      <Pencil className="w-4 h-4" /> 編集
                    </button>
                    <button
                      onClick={() => deleteEntry(e.id)}
                      className="px-3 py-2 rounded-2xl border border-border text-sm text-destructive flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {e.description ? (
                  <div className="mt-3 text-sm text-foreground whitespace-pre-wrap">{e.description}</div>
                ) : null}

                {(e.tables || []).length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {(e.tables || []).map((t) => (
                      <div key={t.id} className="border border-border rounded-2xl overflow-hidden">
                        <div className="px-4 py-2 bg-primary/5 text-sm font-semibold">{t.name}</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/30">
                                {t.columns.map((c, i) => (
                                  <th key={i} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                                    {c}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {t.rows.map((r, ri) => (
                                <tr key={ri} className="border-t border-border">
                                  {t.columns.map((_, ci) => (
                                    <td key={ci} className="px-3 py-2 whitespace-nowrap">
                                      {r[ci] ?? ''}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {t.notes ? <div className="px-4 py-2 text-xs text-muted-foreground">{t.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* Related formulas */}
        <div className="mt-4 glass-card rounded-2xl border border-border p-4">
          <div className="font-semibold text-foreground">関連する公式</div>
          {relatedFormulas.length === 0 ? (
            <div className="mt-2 text-sm text-muted-foreground">この符号を含む公式が見つかりません</div>
          ) : (
            <div className="mt-2 space-y-2">
              {relatedFormulas.map(f => (
                <button
                  key={f.id}
                  onClick={() => onFormulaClick(f.id)}
                  className="w-full text-left px-3 py-3 rounded-2xl border border-border hover:bg-primary/5 transition-colors"
                >
                  <div className="font-semibold text-foreground">{f.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{f.expression}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

            {/* Entry dialog */}
{showAddEntry && (
  <>
    <div
      className="fixed inset-0 bg-black/20 z-40"
      onClick={() => setShowAddEntry(false)}
    />

    <div
      className={[
        // mobile: pin to viewport edges, but leave space for bottom nav
        'fixed z-50 left-3 right-3 top-3',
        'bottom-[calc(12px+env(safe-area-inset-bottom)+80px)]',
        // desktop: centered modal
        'sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[94vw] sm:max-w-xl',
        'glass-card rounded-3xl border border-border shadow-2xl flex flex-col',
      ].join(' ')}
      style={{
        padding: 16,
        // dvh: better on mobile browser address bar changes
        maxHeight:
          'calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 80px)',
      }}
    >
      <div className="font-semibold shrink-0">
        {editingEntryId ? '説明を編集' : '説明を追加'}
      </div>

      {/* Scrollable body */}
      <div className="mt-3 flex-1 overflow-y-auto pr-2 overscroll-contain">
        <div className="grid gap-2">
          <input
            ref={titleRef}
            value={entryDraft.title || ''}
            onChange={(e) => setEntryDraft({ ...entryDraft, title: e.target.value })}
            placeholder="タイトル（例：ガラス：係数k1）"
            className="w-full px-4 py-3 rounded-2xl border border-border bg-background/60 focus:outline-none"
          />
          <input
            value={entryDraft.unit || ''}
            onChange={(e) => setEntryDraft({ ...entryDraft, unit: e.target.value })}
            placeholder="単位（任意）"
            className="w-full px-4 py-3 rounded-2xl border border-border bg-background/60 focus:outline-none"
          />
          <input
            value={entryDraft.source || ''}
            onChange={(e) => setEntryDraft({ ...entryDraft, source: e.target.value })}
            placeholder="出典（任意：規準/資料など）"
            className="w-full px-4 py-3 rounded-2xl border border-border bg-background/60 focus:outline-none"
          />
          <textarea
            value={entryDraft.description || ''}
            onChange={(e) =>
              setEntryDraft({ ...entryDraft, description: e.target.value })
            }
            placeholder="説明"
            rows={5}
            className="w-full px-4 py-3 rounded-2xl border border-border bg-background/60 focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <div className="font-semibold text-sm mb-2">データ表</div>

          {/* Limit table editor height so dialog never becomes too tall */}
          <div className="mt-2 max-h-[38dvh] overflow-y-auto rounded-2xl border border-border/60 bg-background/30 p-2">
            <SymbolTableEditor
              tables={((entryDraft.tables || []) as SymbolTable[]) || []}
              onChange={(tables) => setEntryDraft({ ...entryDraft, tables })}
            />
          </div>
        </div>
      </div>

      {/* Footer (outside scroll) */}
      <div className="mt-4 flex gap-2 shrink-0 pt-3 border-t border-border/60">
        <button
          onClick={() => setShowAddEntry(false)}
          className="flex-1 px-4 py-3 rounded-2xl border border-border text-sm"
        >
          キャンセル
        </button>
        <button
          onClick={saveEntry}
          className="flex-1 px-4 py-3 rounded-2xl bg-primary text-primary-foreground text-sm"
        >
          保存
        </button>
      </div>
    </div>
  </>
)}
    </div>
  );
}

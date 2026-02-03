import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Table as TableIcon, ClipboardPaste } from 'lucide-react';
import type { SymbolTable } from '../data/symbols';

type Props = {
  tables: SymbolTable[];
  onChange: (tables: SymbolTable[]) => void;
};

function clampRowsToColumns(rows: string[][], colCount: number): string[][] {
  return rows.map((r) => {
    const next = [...r];
    while (next.length < colCount) next.push('');
    return next.slice(0, colCount);
  });
}

function parseClipboard(raw: string): string[][] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, ''))
    .filter((l) => l.trim().length > 0);
  const rows = lines.map((l) => {
    // Prefer tab, else comma, else split by multiple spaces.
    if (l.includes('\t')) return l.split('\t').map((x) => x.trim());
    if (l.includes(',')) return l.split(',').map((x) => x.trim());
    return l.trim().split(/\s{2,}/).map((x) => x.trim());
  });
  return rows;
}

function makeDefaultTable(): SymbolTable {
  return {
    id: `table-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: 'データ表',
    columns: ['項目', '値'],
    rows: [['', '']],
  } as any;
}

export default function SymbolTableEditor({ tables, onChange }: Props) {
  const safeTables = useMemo(() => (Array.isArray(tables) ? tables : []), [tables]);

  const addBlock = () => {
    onChange([makeDefaultTable(), ...safeTables]);
  };

  const removeBlock = (tableId: string) => {
    onChange(safeTables.filter((t) => t.id !== tableId));
  };

  const updateBlock = (tableId: string, patch: Partial<SymbolTable>) => {
    onChange(
      safeTables.map((t) => {
        if (t.id !== tableId) return t;
        const next = { ...t, ...patch } as any;
        // normalize
        next.columns = Array.isArray(next.columns) ? next.columns : [];
        next.rows = Array.isArray(next.rows) ? next.rows : [];
        next.rows = clampRowsToColumns(next.rows, next.columns.length);
        return next;
      })
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">複数の表ブロックを追加できます（CSV/TSV貼り付け対応）</div>
        <button
          type="button"
          onClick={addBlock}
          className="px-3 py-2 rounded-2xl bg-primary text-primary-foreground text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> 表ブロック追加
        </button>
      </div>

      {safeTables.length === 0 ? (
        <div className="glass-card rounded-2xl border border-border p-4 text-sm text-muted-foreground">（なし）</div>
      ) : (
        safeTables.map((t) => (
          <TableBlock
            key={t.id}
            table={t}
            onUpdate={(patch) => updateBlock(t.id, patch)}
            onRemove={() => removeBlock(t.id)}
          />
        ))
      )}
    </div>
  );
}

function TableBlock({
  table,
  onUpdate,
  onRemove,
}: {
  table: SymbolTable;
  onUpdate: (patch: Partial<SymbolTable>) => void;
  onRemove: () => void;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [firstRowHeader, setFirstRowHeader] = useState(true);

  const columns = Array.isArray((table as any).columns) ? (table as any).columns : [];
  const rows = Array.isArray((table as any).rows) ? (table as any).rows : [];

  const addCol = () => {
    const nextCols = [...columns, `列${columns.length + 1}`];
    const nextRows = clampRowsToColumns(rows, nextCols.length);
    onUpdate({ columns: nextCols, rows: nextRows });
  };

  const removeCol = (colIdx: number) => {
    const nextCols = columns.filter((_: any, i: number) => i !== colIdx);
    const nextRows = rows.map((r: string[]) => r.filter((_: any, i: number) => i !== colIdx));
    onUpdate({ columns: nextCols, rows: clampRowsToColumns(nextRows, nextCols.length) });
  };

  const addRow = () => {
    const next = [...rows, Array.from({ length: columns.length }).map(() => '')];
    onUpdate({ rows: clampRowsToColumns(next, columns.length) });
  };

  const removeRow = (rowIdx: number) => {
    onUpdate({ rows: rows.filter((_: any, i: number) => i !== rowIdx) });
  };

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const next = rows.map((r: string[], i: number) => {
      if (i !== rowIdx) return r;
      const rr = clampRowsToColumns([r], columns.length)[0];
      rr[colIdx] = value;
      return rr;
    });
    onUpdate({ rows: next });
  };

  const updateColName = (colIdx: number, value: string) => {
    const next = [...columns];
    next[colIdx] = value;
    onUpdate({ columns: next });
  };

  const applyPaste = () => {
    const parsed = parseClipboard(pasteText);
    if (parsed.length === 0) return;

    let nextCols: string[] = [];
    let nextRows: string[][] = [];

    if (firstRowHeader) {
      nextCols = parsed[0].map((c) => c.trim()).filter((c) => c.length > 0);
      nextRows = parsed.slice(1);
    } else {
      const maxLen = Math.max(...parsed.map((r) => r.length));
      nextCols = Array.from({ length: maxLen }).map((_, i) => `列${i + 1}`);
      nextRows = parsed;
    }

    if (nextCols.length === 0) {
      // fallback: at least 1 column
      nextCols = ['列1'];
    }

    nextRows = clampRowsToColumns(nextRows, nextCols.length);
    onUpdate({ columns: nextCols, rows: nextRows });
    setPasteOpen(false);
    setPasteText('');
  };

  return (
    <div className="glass-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <TableIcon className="w-4 h-4 text-muted-foreground" />
          <input
            value={(table as any).name || ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="表ブロック名（任意）"
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background/60 text-sm focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="px-3 py-2 rounded-xl border border-border text-sm text-destructive flex items-center gap-2"
          title="表ブロック削除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          className="px-3 py-2 rounded-xl border border-border text-sm hover:bg-primary/5"
        >
          + 行
        </button>
        <button
          type="button"
          onClick={addCol}
          className="px-3 py-2 rounded-xl border border-border text-sm hover:bg-primary/5"
        >
          + 列
        </button>
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          className="px-3 py-2 rounded-xl border border-border text-sm flex items-center gap-2 hover:bg-primary/5"
        >
          <ClipboardPaste className="w-4 h-4" /> 貼り付け
        </button>
      </div>

      {pasteOpen ? (
        <div className="px-4 pb-4">
          <div className="text-xs text-muted-foreground mb-2">
            CSV / TSV を貼り付けて「生成」を押すと、表を一括生成します。
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder={'例：\n項目\t値\nA\t1\nB\t2'}
            className="w-full px-3 py-2 rounded-2xl border border-border bg-background/60 text-sm focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={firstRowHeader}
                onChange={(e) => setFirstRowHeader(e.target.checked)}
              />
              1行目を列名にする
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasteOpen(false);
                  setPasteText('');
                }}
                className="px-3 py-2 rounded-xl border border-border text-sm"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={applyPaste}
                className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm"
              >
                生成
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto border-t border-border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted/30">
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap w-10">#</th>
              {columns.map((c: string, ci: number) => (
                <th key={ci} className="px-2 py-2 text-left font-semibold whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <input
                      value={c}
                      onChange={(e) => updateColName(ci, e.target.value)}
                      className="w-40 max-w-[40vw] px-2 py-1 rounded-lg border border-border bg-background/60 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeCol(ci)}
                      className="text-xs text-destructive hover:underline"
                      title="列削除"
                    >
                      削除
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-4 text-sm text-muted-foreground">
                  （行がありません）「+ 行」で追加できます。
                </td>
              </tr>
            ) : (
              rows.map((r: string[], ri: number) => (
                <tr key={ri} className="border-t border-border">
                  <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {ri + 1}
                      <button
                        type="button"
                        onClick={() => removeRow(ri)}
                        className="text-xs text-destructive hover:underline"
                        title="行削除"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                  {columns.map((_: any, ci: number) => (
                    <td key={ci} className="px-2 py-2 whitespace-nowrap">
                      <input
                        value={(r?.[ci] ?? '') as any}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        className="w-40 max-w-[40vw] px-2 py-1 rounded-lg border border-border bg-background/60 focus:outline-none"
                      />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-border">
        <textarea
          value={(table as any).notes || ''}
          onChange={(e) => onUpdate({ notes: e.target.value as any })}
          placeholder="注記（任意）"
          rows={2}
          className="w-full px-3 py-2 rounded-2xl border border-border bg-background/60 text-sm focus:outline-none"
        />
      </div>
    </div>
  );
}

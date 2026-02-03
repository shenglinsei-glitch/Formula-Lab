export interface SymbolTable {
  id: string;
  name: string;
  columns: string[];
  rows: string[][];
  notes?: string;
}

export interface SymbolEntry {
  id: string;
  title: string;
  description: string;
  unit?: string;
  sceneId?: string;
  formulaIds?: string[];
  source?: string;
  tables: SymbolTable[];
  order?: number;
}

export interface SymbolItem {
  id: string;
  key: string;
  aliases?: string[];
  tags?: string[];
  entries: SymbolEntry[];
  createdAt?: string;
  updatedAt?: string;
}

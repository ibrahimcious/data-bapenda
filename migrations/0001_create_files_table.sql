-- Migration number: 0001 	 2026-07-28T01:54:18.669Z

CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  storage_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Uncategorized'
    CHECK (category IN ('Regulasi/Perundangan', 'Data Kendaraan', 'Laporan Potensi Pajak', 'Lainnya', 'Uncategorized')),
  description TEXT,
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT
);

CREATE INDEX idx_files_category ON files(category);

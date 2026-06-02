const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../prediction.db');
const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS congestion_predictions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    corridor     TEXT NOT NULL,
    level        TEXT NOT NULL,
    probability  REAL NOT NULL,
    reason       TEXT,
    predicted_at TEXT NOT NULL DEFAULT (datetime('now')),
    valid_until  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_cp_corridor ON congestion_predictions(corridor, predicted_at);

  CREATE TABLE IF NOT EXISTS rerouting_events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id     TEXT NOT NULL,
    route_id       TEXT NOT NULL,
    original_route TEXT,
    new_route      TEXT,
    reason         TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;

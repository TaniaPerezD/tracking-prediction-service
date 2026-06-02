const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../tracking.db');
const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS vehicle_locations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id   TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'bus',
    lat          REAL NOT NULL,
    lng          REAL NOT NULL,
    speed        REAL DEFAULT 0,
    heading      REAL DEFAULT 0,
    timestamp    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_vl_vehicle_ts ON vehicle_locations(vehicle_id, timestamp);

  CREATE TABLE IF NOT EXISTS vehicle_status (
    vehicle_id    TEXT PRIMARY KEY,
    vehicle_type  TEXT NOT NULL DEFAULT 'bus',
    route_id      TEXT,
    status        TEXT NOT NULL DEFAULT 'on_time',
    delay_minutes REAL DEFAULT 0,
    current_stop  TEXT,
    next_stop     TEXT,
    lat           REAL,
    lng           REAL,
    speed         REAL DEFAULT 0,
    heading       REAL DEFAULT 0,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS arrival_predictions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id        TEXT NOT NULL,
    stop_id           TEXT NOT NULL,
    scheduled_arrival TEXT,
    predicted_arrival TEXT,
    delay_minutes     REAL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;

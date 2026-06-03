-- ============================================================
-- UrbanFlow Technologies — Esquema de Base de Datos
-- Motor: SQLite con WAL mode (equivalente a TimescaleDB)
-- Arquitectura: Polyglot Persistence — una DB por microservicio
-- ============================================================


-- ------------------------------------------------------------
-- tracking-service  (tracking.db)
-- ------------------------------------------------------------

PRAGMA journal_mode = WAL;

-- Serie de tiempo de pings GPS
-- Append-only (solo INSERT, nunca UPDATE) — patrón TimescaleDB hypertable
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

-- Estado actual de cada vehículo (upsert por vehicle_id)
CREATE TABLE IF NOT EXISTS vehicle_status (
  vehicle_id    TEXT PRIMARY KEY,
  vehicle_type  TEXT NOT NULL DEFAULT 'bus',
  route_id      TEXT,
  status        TEXT NOT NULL DEFAULT 'on_time',   -- on_time | delayed
  delay_minutes REAL DEFAULT 0,
  current_stop  TEXT,
  next_stop     TEXT,
  lat           REAL,
  lng           REAL,
  speed         REAL DEFAULT 0,
  heading       REAL DEFAULT 0,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Predicciones de llegada por parada
CREATE TABLE IF NOT EXISTS arrival_predictions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id        TEXT NOT NULL,
  stop_id           TEXT NOT NULL,
  scheduled_arrival TEXT,
  predicted_arrival TEXT,
  delay_minutes     REAL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);


-- ------------------------------------------------------------
-- prediction-service  (prediction.db)
-- ------------------------------------------------------------

PRAGMA journal_mode = WAL;

-- Historial de predicciones de congestión (horizonte: 30 minutos)
CREATE TABLE IF NOT EXISTS congestion_predictions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  corridor     TEXT NOT NULL,
  level        TEXT NOT NULL,       -- low | medium | high | critical
  probability  REAL NOT NULL,       -- score 0.0 – 1.0
  reason       TEXT,
  predicted_at TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until  TEXT
);

CREATE INDEX IF NOT EXISTS idx_cp_corridor ON congestion_predictions(corridor, predicted_at);

-- Trazabilidad de reenrutamientos automáticos (MVP 4 — auditoría regulatoria)
CREATE TABLE IF NOT EXISTS rerouting_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id     TEXT NOT NULL,
  route_id       TEXT NOT NULL,
  original_route TEXT,
  new_route      TEXT,
  reason         TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

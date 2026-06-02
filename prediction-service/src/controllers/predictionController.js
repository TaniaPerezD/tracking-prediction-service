const db = require('../db');

// In-memory state — simulates what a Kafka consumer would maintain
let delayedBuses = [];

const CORRIDORS = [
  'Corredor Central',
  'Av. Principal Norte',
  'Corredor Sur',
  'Av. Costanera',
  'Corredor Oriente',
];

const REROUTE_MAP = {
  'Corredor Central':    'Av. Costanera - Ruta Alterna A',
  'Av. Principal Norte': 'Calle 45 - Ruta Alterna B',
  'Corredor Sur':        'Vía Expresa Sur - Ruta Alterna C',
  'Av. Costanera':       'Corredor Central - Ruta Alterna D',
  'Corredor Oriente':    'Av. Libertad - Ruta Alterna E',
};

// Called by tracking-service when bus.delayed event fires
const receiveEvent = (req, res) => {
  const { type, vehicleId, delayMinutes, routeId } = req.body;

  if (type === 'bus.delayed') {
    const idx = delayedBuses.findIndex(b => b.vehicleId === vehicleId);
    const entry = { vehicleId, delayMinutes, routeId, updatedAt: Date.now() };
    if (idx >= 0) delayedBuses[idx] = entry;
    else delayedBuses.push(entry);
  }

  res.json({ received: true, type });
};

const evaluateLevel = (isPeakHour, delayedCount) => {
  if (isPeakHour && delayedCount > 5) return { level: 'critical', probability: 0.95 };
  if (isPeakHour && delayedCount > 2) return { level: 'high',     probability: 0.80 };
  if (isPeakHour)                     return { level: 'medium',   probability: 0.60 };
  if (delayedCount > 3)               return { level: 'high',     probability: 0.70 };
  if (delayedCount > 0)               return { level: 'medium',   probability: 0.40 };
  return                                     { level: 'low',      probability: 0.10 };
};

const getCongestion = (req, res) => {
  const now = new Date();
  const hour = now.getHours();
  const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);

  // Evict stale entries older than 15 min
  const cutoff = Date.now() - 15 * 60 * 1000;
  delayedBuses = delayedBuses.filter(b => b.updatedAt > cutoff);

  const predictions = CORRIDORS.map((corridor, i) => {
    // Distribute delayed buses across corridors (round-robin simulation)
    const corridorBuses = delayedBuses.filter((_, j) => j % CORRIDORS.length === i);
    const { level, probability } = evaluateLevel(isPeakHour, corridorBuses.length);

    const reason = isPeakHour
      ? `Hora pico (${hour}:00 hs) con ${corridorBuses.length} bus(es) retrasado(s)`
      : `${corridorBuses.length} bus(es) retrasado(s) fuera de hora pico`;

    const validUntil = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO congestion_predictions (corridor, level, probability, reason, valid_until)
      VALUES (?, ?, ?, ?, ?)
    `).run(corridor, level, probability, reason, validUntil);

    return { corridor, level, probability, delayedBusesCount: corridorBuses.length, reason, validUntil };
  });

  const alerts = predictions.filter(p => p.level === 'high' || p.level === 'critical');

  res.json({
    timestamp: now.toISOString(),
    hour,
    isPeakHour,
    totalDelayedBuses: delayedBuses.length,
    predictions,
    alerts,
    summary: alerts.length
      ? `ALERTA: ${alerts.length} corredor(es) con congestión alta o crítica`
      : 'Tráfico normal — sin alertas activas',
  });
};

const reroute = (req, res) => {
  const { vehicleId, routeId, reason } = req.body;

  if (!vehicleId || !routeId) {
    return res.status(400).json({ error: 'vehicleId y routeId son requeridos' });
  }

  const newRoute = REROUTE_MAP[routeId] || 'Ruta Alternativa Disponible';
  const rerouteReason = reason || `Congestión detectada en ${routeId}`;

  db.prepare(`
    INSERT INTO rerouting_events (vehicle_id, route_id, original_route, new_route, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(vehicleId, routeId, routeId, newRoute, rerouteReason);

  // Optimistically remove from delayed list
  delayedBuses = delayedBuses.filter(b => b.vehicleId !== vehicleId);

  res.json({
    success: true,
    vehicleId,
    rerouting: {
      originalRoute: routeId,
      newRoute,
      reason: rerouteReason,
      estimatedDelaySaving: '4–8 minutos',
      appliedAt: new Date().toISOString(),
    },
    message: `Bus ${vehicleId} reenrutado: "${routeId}" → "${newRoute}"`,
  });
};

const getHistory = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const { corridor } = req.query;

  let predQuery = 'SELECT * FROM congestion_predictions';
  const predParams = [];
  if (corridor) { predQuery += ' WHERE corridor = ?'; predParams.push(corridor); }
  predQuery += ' ORDER BY predicted_at DESC LIMIT ?';
  predParams.push(limit);

  const predictions = db.prepare(predQuery).all(...predParams);
  const reroutings  = db.prepare('SELECT * FROM rerouting_events ORDER BY created_at DESC LIMIT ?').all(limit);

  res.json({ predictions, reroutings, count: { predictions: predictions.length, reroutings: reroutings.length } });
};

module.exports = { receiveEvent, getCongestion, reroute, getHistory };

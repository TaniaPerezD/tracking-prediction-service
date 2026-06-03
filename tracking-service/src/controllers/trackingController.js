const db = require('../db');
const kafka = require('../kafka');

const DELAY_THRESHOLD = 5; // minutes

const updateLocation = (req, res) => {
  const {
    vehicleId, vehicleType = 'bus',
    lat, lng, speed = 0, heading = 0,
    routeId, currentStop, nextStop, scheduledArrival
  } = req.body;

  if (!vehicleId || lat == null || lng == null) {
    return res.status(400).json({ error: 'vehicleId, lat and lng are required' });
  }

  db.prepare(`
    INSERT INTO vehicle_locations (vehicle_id, vehicle_type, lat, lng, speed, heading)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(vehicleId, vehicleType, lat, lng, speed, heading);

  let delayMinutes = 0;
  let status = 'on_time';

  if (scheduledArrival) {
    const diff = (Date.now() - new Date(scheduledArrival).getTime()) / 60000;
    delayMinutes = Math.max(0, Math.round(diff * 10) / 10);
    status = delayMinutes > DELAY_THRESHOLD ? 'delayed' : 'on_time';
  }

  db.prepare(`
    INSERT INTO vehicle_status
      (vehicle_id, vehicle_type, route_id, status, delay_minutes, current_stop, next_stop, lat, lng, speed, heading, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(vehicle_id) DO UPDATE SET
      vehicle_type  = excluded.vehicle_type,
      route_id      = excluded.route_id,
      status        = excluded.status,
      delay_minutes = excluded.delay_minutes,
      current_stop  = excluded.current_stop,
      next_stop     = excluded.next_stop,
      lat           = excluded.lat,
      lng           = excluded.lng,
      speed         = excluded.speed,
      heading       = excluded.heading,
      updated_at    = datetime('now')
  `).run(vehicleId, vehicleType, routeId ?? null, status, delayMinutes, currentStop ?? null, nextStop ?? null, lat, lng, speed, heading);

  // Always publish position update (consumed by route-planning-service)
  kafka.publish('vehicle.position.updated', {
    vehicleId, vehicleType, lat, lng, speed, heading, routeId, status, delayMinutes,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  if (status === 'delayed') {
    kafka.publish('bus.delayed', { vehicleId, delayMinutes, routeId }).catch(() => {});
  }

  res.json({ success: true, vehicleId, status, delayMinutes });
};

const getVehicle = (req, res) => {
  const { vehicleId } = req.params;

  const status = db.prepare('SELECT * FROM vehicle_status WHERE vehicle_id = ?').get(vehicleId);
  if (!status) return res.status(404).json({ error: 'Vehicle not found' });

  const history = db.prepare(`
    SELECT lat, lng, speed, heading, timestamp
    FROM vehicle_locations WHERE vehicle_id = ?
    ORDER BY timestamp DESC LIMIT 20
  `).all(vehicleId);

  res.json({ vehicleId, status, history });
};

const getArrivals = (req, res) => {
  const { stopId } = req.params;

  const arrivals = db.prepare(`
    SELECT vehicle_id, vehicle_type, route_id, status, delay_minutes,
           current_stop, lat, lng, updated_at
    FROM vehicle_status
    WHERE next_stop = ?
    ORDER BY delay_minutes ASC
  `).all(stopId);

  res.json({ stopId, arrivals, count: arrivals.length });
};

const getMap = (req, res) => {
  const vehicles = db.prepare(`
    SELECT vehicle_id, vehicle_type, route_id, status, delay_minutes,
           current_stop, next_stop, lat, lng, speed, heading, updated_at
    FROM vehicle_status
    ORDER BY status DESC, delay_minutes DESC
  `).all();

  const summary = {
    total: vehicles.length,
    onTime: vehicles.filter(v => v.status === 'on_time').length,
    delayed: vehicles.filter(v => v.status === 'delayed').length,
    stopped: vehicles.filter(v => v.status === 'stopped').length,
  };

  res.json({ vehicles, summary, timestamp: new Date().toISOString() });
};

// GET /tracking/analytics — KPIs for the city analytics panel (Req. VIII)
const getAnalytics = (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicle_status').all();
  const total = vehicles.length;
  const onTime = vehicles.filter(v => v.status === 'on_time').length;
  const delayed = vehicles.filter(v => v.status === 'delayed').length;

  const punctualityIndex = total > 0 ? Math.round((onTime / total) * 100) : 100;

  // Average delay across delayed buses only
  const avgDelay = delayed > 0
    ? vehicles.filter(v => v.status === 'delayed')
        .reduce((sum, v) => sum + v.delay_minutes, 0) / delayed
    : 0;

  // Emissions avoided: each on-time bus vs. car baseline (simulated: 0.8 kg CO₂/km saved)
  const emissionsAvoidedKg = Math.round(onTime * 12 * 0.8);

  // Flow per corridor: group vehicles by route
  const flowByCorridor = vehicles.reduce((acc, v) => {
    const corridor = v.route_id || 'Sin ruta';
    if (!acc[corridor]) acc[corridor] = { total: 0, onTime: 0, delayed: 0 };
    acc[corridor].total++;
    if (v.status === 'on_time') acc[corridor].onTime++;
    else acc[corridor].delayed++;
    return acc;
  }, {});

  // Average occupancy: simulated (50,000 daily trips / active buses)
  const avgOccupancy = total > 0 ? Math.round(50000 / (total * 20)) : 0;

  // Recent rerouting count from location history
  const recentPings = db.prepare(`
    SELECT COUNT(*) as count FROM vehicle_locations
    WHERE timestamp >= datetime('now', '-1 hour')
  `).get();

  res.json({
    timestamp: new Date().toISOString(),
    kpis: {
      totalActiveVehicles: total,
      punctualityIndex: `${punctualityIndex}%`,
      onTimeVehicles: onTime,
      delayedVehicles: delayed,
      avgDelayMinutes: Math.round(avgDelay * 10) / 10,
      emissionsAvoidedKg,
      avgOccupancyPercent: Math.min(avgOccupancy, 100),
    },
    flowByCorridor,
    telemetry: {
      gpsEventsLastHour: recentPings.count,
    },
  });
};

module.exports = { updateLocation, getVehicle, getArrivals, getMap, getAnalytics };

const db = require('../db');
const axios = require('axios');

const PREDICTION_URL = process.env.PREDICTION_SERVICE_URL || 'http://localhost:3002';
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
  `).run(vehicleId, vehicleType, routeId, status, delayMinutes, currentStop, nextStop, lat, lng, speed, heading);

  if (status === 'delayed') {
    axios.post(`${PREDICTION_URL}/prediction/events`, {
      type: 'bus.delayed', vehicleId, delayMinutes, routeId
    }).catch(() => {});
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

module.exports = { updateLocation, getVehicle, getArrivals, getMap };

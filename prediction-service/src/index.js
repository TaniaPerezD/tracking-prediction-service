require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3002;
const TRACKING_URL = process.env.TRACKING_SERVICE_URL || 'http://localhost:3001';

app.use(cors());
app.use(express.json());

app.use('/prediction', require('./routes/prediction'));

app.get('/health', (req, res) => res.json({ service: 'prediction-service', status: 'ok', timestamp: new Date().toISOString() }));

// Every 2 minutes: pull delayed vehicles from tracking service and refresh internal state
cron.schedule('*/2 * * * *', async () => {
  try {
    const { data } = await axios.get(`${TRACKING_URL}/tracking/map`, { timeout: 3000 });
    const delayed = (data.vehicles || []).filter(v => v.status === 'delayed');
    for (const v of delayed) {
      await axios.post(`http://localhost:${PORT}/prediction/events`, {
        type: 'bus.delayed',
        vehicleId: v.vehicle_id,
        delayMinutes: v.delay_minutes,
        routeId: v.route_id,
      }).catch(() => {});
    }
    if (delayed.length > 0) {
      console.log(`[cron] Synced ${delayed.length} delayed vehicle(s) from tracking service`);
    }
  } catch {
    // tracking service might not be available yet
  }
});

app.listen(PORT, () => {
  console.log(`[prediction-service] Running on port ${PORT}`);
});

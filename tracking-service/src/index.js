require('dotenv').config();
const express = require('express');
const cors = require('cors');
const kafka = require('./kafka');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/tracking', require('./routes/tracking'));

app.get('/health', (req, res) => res.json({
  service: 'tracking-service',
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

// HTTP server starts immediately — Kafka connects in background
app.listen(PORT, () => {
  console.log(`[tracking-service] Running on port ${PORT}`);
});

kafka.connect()
  .then(() => console.log('[kafka] Producer ready'))
  .catch(err => console.warn(`[kafka] Running without Kafka: ${err.message}`));

process.on('SIGTERM', async () => {
  await kafka.disconnect();
  process.exit(0);
});

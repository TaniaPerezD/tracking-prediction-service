require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use('/prediction', require('./routes/prediction'));

app.get('/health', (req, res) => res.json({
  service: 'prediction-service',
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

// HTTP server starts immediately — Kafka connects in background
app.listen(PORT, () => {
  console.log(`[prediction-service] Running on port ${PORT}`);
});

const kafka = require('./kafka');
const { setKafkaPublish } = require('./controllers/predictionController');

kafka.start()
  .then(() => {
    setKafkaPublish(kafka.publish);
    console.log('[kafka] Consumer + producer ready');
  })
  .catch(err => console.warn(`[kafka] Running without Kafka: ${err.message}`));

process.on('SIGTERM', async () => {
  await kafka.disconnect();
  process.exit(0);
});

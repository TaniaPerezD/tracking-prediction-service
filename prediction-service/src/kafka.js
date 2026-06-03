const { Kafka, logLevel } = require('kafkajs');
const { processDelayedBus, processPositionUpdate } = require('./controllers/predictionController');

const kafka = new Kafka({
  clientId: 'prediction-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  logLevel: logLevel.WARN,
  retry: { retries: 5, initialRetryTime: 300 },
});

const consumer = kafka.consumer({ groupId: 'prediction-group' });
const producer = kafka.producer();
let producerConnected = false;

const publish = async (topic, payload) => {
  if (!producerConnected) return;
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(payload) }],
  });
};

const start = async () => {
  await producer.connect();
  producerConnected = true;
  console.log('[kafka] Producer connected');

  await consumer.connect();
  await consumer.subscribe({ topics: ['bus.delayed', 'vehicle.position.updated'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const data = JSON.parse(message.value.toString());

        if (topic === 'bus.delayed') {
          processDelayedBus(data);
          console.log(`[kafka] bus.delayed received: ${data.vehicleId} (+${data.delayMinutes} min)`);
        } else if (topic === 'vehicle.position.updated') {
          processPositionUpdate(data);
        }
      } catch (err) {
        console.error('[kafka] Failed to process message:', err.message);
      }
    },
  });

  console.log('[kafka] Consumer subscribed to: bus.delayed, vehicle.position.updated');
};

const disconnect = async () => {
  await consumer.disconnect();
  await producer.disconnect();
};

module.exports = { start, publish, disconnect };

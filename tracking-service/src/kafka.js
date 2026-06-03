const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'tracking-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  logLevel: logLevel.WARN,
  retry: { retries: 5, initialRetryTime: 300 },
});

const producer = kafka.producer();
let connected = false;

const connect = async () => {
  await producer.connect();
  connected = true;
  console.log('[kafka] Producer connected');
};

const publish = async (topic, payload) => {
  if (!connected) return;
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(payload) }],
  });
};

const disconnect = () => producer.disconnect();

module.exports = { connect, publish, disconnect };

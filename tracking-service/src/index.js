require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/tracking', require('./routes/tracking'));

app.get('/health', (req, res) => res.json({ service: 'tracking-service', status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`[tracking-service] Running on port ${PORT}`);
});

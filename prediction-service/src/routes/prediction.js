const router = require('express').Router();
const ctrl = require('../controllers/predictionController');

router.post('/events', ctrl.receiveEvent);       // internal: called by tracking-service
router.get('/congestion', ctrl.getCongestion);
router.post('/reroute', ctrl.reroute);
router.get('/history', ctrl.getHistory);

module.exports = router;

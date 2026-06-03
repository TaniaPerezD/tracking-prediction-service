const router = require('express').Router();
const ctrl = require('../controllers/trackingController');

router.post('/location', ctrl.updateLocation);
router.get('/vehicle/:vehicleId', ctrl.getVehicle);
router.get('/arrivals/:stopId', ctrl.getArrivals);
router.get('/map', ctrl.getMap);
router.get('/analytics', ctrl.getAnalytics);

module.exports = router;

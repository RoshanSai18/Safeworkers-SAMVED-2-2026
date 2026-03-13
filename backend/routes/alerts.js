const express = require('express');
const router  = express.Router();

// In-memory alerts store — prepended by engine.js on every auto_alert event
const alerts = [
  { id: 'a1', type: 'SOS',   workerId: 1, msg: 'SOS triggered by Ravi Kumar at MH-2041',  severity: 'critical', time: '2m ago' },
  { id: 'a2', type: 'DELAY', workerId: 3, msg: 'Meena Devi overdue by 12 min at MH-0933', severity: 'warning',  time: '5m ago' },
];

// GET /api/alerts
router.get('/', (_req, res) => {
  res.json(alerts);
});

// Called by engine.js to record each auto-generated gas alert
function prependAlert(alert) {
  alerts.unshift(alert);
  if (alerts.length > 100) alerts.pop(); // cap to avoid unbounded growth
}

module.exports        = router;
module.exports.prependAlert = prependAlert;
module.exports.alerts       = alerts;

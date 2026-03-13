const express = require('express');
const router  = express.Router();
const { workers } = require('../data/seed');
const { THRESHOLDS, INITIAL_SAFE, classify } = require('../sensors/thresholds');

const GAS_CHECK_LIST = ['H2S', 'CO', 'O2', 'CH4', 'WATER'];

// GET /api/workers/gas-check  — one-shot pre-entry reading (must be before /:id)
router.get('/gas-check', (_req, res) => {
  const readings = {};
  for (const gas of GAS_CHECK_LIST) {
    const cfg  = THRESHOLDS[gas];
    const base = INITIAL_SAFE[gas];
    let val = base + (Math.random() * 2 - 1) * cfg.stepSize * 5;
    val = parseFloat(Math.min(cfg.physMax, Math.max(cfg.physMin, val)).toFixed(2));
    readings[gas] = val;
  }
  const statuses = {};
  for (const gas of GAS_CHECK_LIST) {
    statuses[gas] = classify(gas, readings[gas]);
  }
  res.json({ readings, statuses });
});

// GET /api/workers
router.get('/', (_req, res) => {
  res.json(workers);
});

// GET /api/workers/:id
router.get('/:id', (req, res) => {
  const worker = workers.find(w => w.id === parseInt(req.params.id, 10));
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  res.json(worker);
});

module.exports = router;

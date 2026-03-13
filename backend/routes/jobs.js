const express = require('express');
const router  = express.Router();
const { jobs } = require('../data/seed');

// GET /api/jobs
router.get('/', (_req, res) => {
  res.json(jobs);
});

// GET /api/jobs/:id
router.get('/:id', (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

module.exports = router;

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const workersRouter = require('./routes/workers');
const jobsRouter    = require('./routes/jobs');
const alertsRouter  = require('./routes/alerts');
const engine        = require('./sensors/engine');
const { workers, jobs } = require('./data/seed');
const simulator     = require('./sensors/simulator');
const { evaluateRisk, buildWeatherAdvisory } = require('./advisory/evaluateRisk');
const { buildSafetyProfile }                 = require('./controllers/safetyProfile');
const { buildIncidentPostmortem }            = require('./controllers/incidentPostmortem');
const { evaluateTodaysPlan }                 = require('./utils/evaluatePlan');
const { getRecommendations }                 = require('./controllers/recommend');
const { buildCounterfactualSimulation }      = require('./controllers/counterfactual');
const { getWardIntelligence }                = require('./controllers/wardIntelligence');
const { getPlanCopilot }                     = require('./controllers/planCopilot');

const PORT             = 3001;
const FRONTEND_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

const app = express();
app.use(cors({ origin: FRONTEND_ORIGINS }));
app.use(express.json());

app.use('/api/workers', workersRouter);
app.use('/api/jobs',    jobsRouter);
app.use('/api/alerts',  alertsRouter);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: FRONTEND_ORIGINS, methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected:    ${socket.id}`);

  function emitIncidentPostmortem(eventContext, lang = 'hi') {
    buildIncidentPostmortem(eventContext, lang)
      .then((postmortem) => {
        io.emit('auto_incident_postmortem', {
          id: `pm-${Date.now()}`,
          ...eventContext,
          ...postmortem,
          generatedAt: new Date().toISOString(),
        });
      })
      .catch((err) => {
        console.error('[Postmortem] Error:', err.message);
      });
  }

  // Worker → Server → Supervisor: manual SOS button press
  socket.on('sos_manual', (data) => {
    console.log(`[Socket] Manual SOS from worker ${data.workerId}`);
    const worker = workers.find(w => w.id === data.workerId);
    const activeJob = worker?.job && worker.job !== '—' ? jobs.find(j => j.id === worker.job) : null;
    const alertId = `sos-manual-${Date.now()}`;

    if (worker) {
      worker.status = 'SOS';
      io.emit('worker_status_change', { workerId: data.workerId, status: 'SOS', name: worker.name });
    }

    io.emit('auto_alert', {
      id:         alertId,
      type:       'SOS_MANUAL',
      workerId:   data.workerId,
      workerName: data.workerName,
      msg:        `Manual SOS triggered by ${data.workerName || `Worker ${data.workerId}`}`,
      severity:   'critical',
      time:       'just now',
    });

    emitIncidentPostmortem({
      incidentId: alertId,
      eventType: 'SOS_MANUAL',
      severity: 'critical',
      workerId: data.workerId,
      workerName: data.workerName || worker?.name || `Worker ${data.workerId}`,
      badge: worker?.badge || 'N/A',
      zone: activeJob?.zone || 'Zone N/A',
      location: activeJob?.address || worker?.address || 'Field location',
      eventTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      hazard: '',
      alertMessage: `Manual SOS triggered by ${data.workerName || worker?.name || `Worker ${data.workerId}`}`,
    });
  });

  // Supervisor → Server → Worker: supervisor hits "Evacuate" in popup
  socket.on('evac_command', (data) => {
    console.log(`[Socket] Evacuation command for worker ${data.workerId}`);
    io.emit('evac_command', { workerId: data.workerId });
  });

  // Worker dashboard → Server: worker entered manhole, start sensor simulation
  socket.on('worker_enter_manhole', (data) => {
    const worker = workers.find(w => w.id === data.workerId);
    if (worker) {
      worker.status = 'IN_MANHOLE';
      io.emit('worker_status_change', { workerId: data.workerId, status: 'IN_MANHOLE', name: worker.name });
      console.log(`[Socket] Worker ${data.workerId} entered manhole — sensor simulation started`);
    }
  });

  // Worker dashboard → Server: worker exited manhole, stop sensor simulation
  socket.on('worker_exit_manhole', (data) => {
    const worker = workers.find(w => w.id === data.workerId);
    if (worker) {
      worker.status = 'IDLE';
      simulator.reset(data.workerId);
      io.emit('worker_status_change', { workerId: data.workerId, status: 'IDLE', name: worker.name });
      console.log(`[Socket] Worker ${data.workerId} exited manhole — sensor simulation stopped`);
    }
  });

  // Worker → Server → Supervisor: hazard spotted inside manhole
  socket.on('hazard_report', (data) => {
    console.log(`[Socket] Hazard report from worker ${data.workerId}: ${data.hazard}`);
    const worker = workers.find(w => w.id === data.workerId);
    const activeJob = worker?.job && worker.job !== '—' ? jobs.find(j => j.id === worker.job) : null;
    const alertId = `haz-${Date.now()}`;

    io.emit('auto_alert', {
      id:         alertId,
      type:       'HAZARD',
      workerId:   data.workerId,
      workerName: data.workerName || (worker && worker.name),
      msg:        `${data.hazard} reported by ${data.workerName || (worker && worker.name) || `Worker ${data.workerId}`}`,
      severity:   'warning',
      time:       'just now',
    });

    emitIncidentPostmortem({
      incidentId: alertId,
      eventType: 'HAZARD',
      severity: 'medium',
      workerId: data.workerId,
      workerName: data.workerName || worker?.name || `Worker ${data.workerId}`,
      badge: worker?.badge || 'N/A',
      zone: activeJob?.zone || 'Zone N/A',
      location: activeJob?.address || worker?.address || 'Field location',
      eventTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      hazard: data.hazard || '',
      alertMessage: `${data.hazard} reported by ${data.workerName || worker?.name || `Worker ${data.workerId}`}`,
    });
  });

  // Worker → Server → Worker: request a Safety Co-Pilot advisory for the current job.
  // Payload: { workerId, jobParams: { depth, recentIncidents, weather } }
  // Only safety parameters — no location tracking.
  socket.on('request_advisory', (data) => {
    const advisory = evaluateRisk(data.jobParams ?? {});
    socket.emit('live_safety_advisory', {
      ...advisory,
      workerId: data.workerId ?? null,
      source:   'auto',
    });
    console.log(`[Advisory] Emitted advisory (priority=${advisory.priority}) to socket ${socket.id}`);
  });

  // Worker → Server → Worker: fetch Safety Diary profile
  // Payload: { workerId: number }
  socket.on('get_safety_profile', (data) => {
    const profile = buildSafetyProfile(data.workerId);
    socket.emit('safety_profile', profile);
    console.log(`[Diary] Safety profile emitted for worker ${data.workerId} (score=${profile.displayScore})`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// GET /api/safety-profile/:workerId
// Returns the full Safety Diary profile for a worker.
// Useful for supervisor / admin views and for REST fallback.
app.get('/api/safety-profile/:workerId', (req, res) => {
  const workerId = parseInt(req.params.workerId, 10);
  if (isNaN(workerId)) return res.status(400).json({ error: 'Invalid workerId' });
  const profile = buildSafetyProfile(workerId);
  res.json(profile);
});

// POST /api/advisory/weather-alert
// Body: { weather: 'heavy_rain'|'thunderstorm'|'flood_warning'|'heatwave', workerId?: number }
// Supervisor / automated weather service pushes a live advisory to all workers
// (or a specific worker when workerId is provided).
// Broadcasts only safety information — no tracking payloads.
app.post('/api/advisory/weather-alert', (req, res) => {
  const { weather, workerId } = req.body ?? {};
  const advisory = buildWeatherAdvisory(weather);
  if (!advisory) {
    return res.status(400).json({ error: `Unknown weather type: "${weather}". Valid: heavy_rain, thunderstorm, flood_warning, heatwave` });
  }
  const payload = { ...advisory, workerId: workerId ?? null };
  io.emit('live_safety_advisory', payload);
  console.log(`[Advisory] Weather alert (${weather}) broadcast — workerId=${workerId ?? 'all'}`);
  res.json({ ok: true, advisory });
});

// POST /api/plan/evaluate
// Body: { assignments: Array<{ workerId, workerName, jobId, risk, zone, lat, lng }> }
// Admin submits today's job assignments; server returns a list of safety issues
// (high-risk overload, route fatigue, total workload) before deployment is confirmed.
app.post('/api/plan/evaluate', (req, res) => {
  const { assignments } = req.body ?? {};
  if (!Array.isArray(assignments)) {
    return res.status(400).json({ error: 'assignments array required' });
  }
  const issues = evaluateTodaysPlan(assignments);
  console.log(`[Plan] Evaluated ${assignments.length} assignments — ${issues.length} issue(s) found`);
  res.json({ issues });
});

// POST /api/plan/copilot
// Body: { assignments: [...], issues?: [...], lang?: 'en'|'hi' }
// Generates AI-assisted optimization guidance for today's deployment plan.
app.post('/api/plan/copilot', async (req, res) => {
  try {
    const result = await getPlanCopilot(req.body ?? {});
    res.json(result);
  } catch (err) {
    console.error('[Plan Copilot] Error:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to generate plan copilot analysis',
    });
  }
});

// POST /api/recommendations
// AI-generated worker-to-job assignment recommendations
// based on proximity, worker status, job risk, and safety rules.
app.post('/api/recommendations', async (req, res) => {
  try {
    const { lang } = req.body ?? {};
    const result = await getRecommendations(lang || 'en');
    res.json(result);
  } catch (err) {
    console.error('[Recommendations] Error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
    });
  }
});

// POST /api/recommendations/simulate
// Body: { workerId, jobId, lang?, workers?, jobs? }
// Simulates "what-if" assignment risk for supervisor decision support.
app.post('/api/recommendations/simulate', async (req, res) => {
  try {
    const result = await buildCounterfactualSimulation(req.body ?? {});
    res.json(result);
  } catch (err) {
    console.error('[Counterfactual] Error:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to simulate assignment',
    });
  }
});

// POST /api/ai/ward-intelligence
// Body: { ward, lang?, wardSnapshot? }
// Generates evidence-based ward action analysis for admin dashboard.
app.post('/api/ai/ward-intelligence', async (req, res) => {
  try {
    const result = await getWardIntelligence(req.body ?? {});
    res.json(result);
  } catch (err) {
    console.error('[Ward Intelligence] Error:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to generate ward analysis',
    });
  }
});

// Start sensor tick loop (no-op stub until Phase 1 fills it in)
engine.start(io);

httpServer.listen(PORT, () => {
  console.log(`[SAMVED] Socket.IO server listening on :${PORT}`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const workersRouter = require('./routes/workers');
const jobsRouter    = require('./routes/jobs');
const alertsRouter  = require('./routes/alerts');
const engine        = require('./sensors/engine');
const { workers } = require('./data/seed');
const simulator     = require('./sensors/simulator');
const { evaluateRisk, buildWeatherAdvisory } = require('./advisory/evaluateRisk');
const { buildSafetyProfile }                 = require('./controllers/safetyProfile');
const { evaluateTodaysPlan }                 = require('./utils/evaluatePlan');

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

  // Worker → Server → Supervisor: manual SOS button press
  socket.on('sos_manual', (data) => {
    console.log(`[Socket] Manual SOS from worker ${data.workerId}`);
    const worker = workers.find(w => w.id === data.workerId);
    if (worker) {
      worker.status = 'SOS';
      io.emit('worker_status_change', { workerId: data.workerId, status: 'SOS', name: worker.name });
    }
    io.emit('auto_alert', {
      id:         `sos-manual-${Date.now()}`,
      type:       'SOS_MANUAL',
      workerId:   data.workerId,
      workerName: data.workerName,
      msg:        `Manual SOS triggered by ${data.workerName || `Worker ${data.workerId}`}`,
      severity:   'critical',
      time:       'just now',
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
    io.emit('auto_alert', {
      id:         `haz-${Date.now()}`,
      type:       'HAZARD',
      workerId:   data.workerId,
      workerName: data.workerName || (worker && worker.name),
      msg:        `${data.hazard} reported by ${data.workerName || (worker && worker.name) || `Worker ${data.workerId}`}`,
      severity:   'warning',
      time:       'just now',
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

// Start sensor tick loop (no-op stub until Phase 1 fills it in)
engine.start(io);

httpServer.listen(PORT, () => {
  console.log(`[SAMVED] Socket.IO server listening on :${PORT}`);
});

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const workersRouter = require('./routes/workers');
const jobsRouter    = require('./routes/jobs');
const alertsRouter  = require('./routes/alerts');
const whatsappRouter = require('./routes/whatsapp');
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
const { buildRcaAssistant }                  = require('./controllers/rcaAssistant');
const { buildEvacuationDrill }               = require('./controllers/evacuationDrill');
const { sendSosToSupervisors }               = require('./controllers/whatsapp');
const { generateAiAuditChart }               = require('./controllers/chartGenerator');

const PORT             = 3001;
const FRONTEND_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

const app = express();
app.use(cors({ origin: FRONTEND_ORIGINS }));
app.use(express.json());

app.use('/api/workers', workersRouter);
app.use('/api/jobs',    jobsRouter);
app.use('/api/alerts',  alertsRouter);
app.use('/api/whatsapp', whatsappRouter);

const INCIDENT_HISTORY_LIMIT = 250;
const incidentHistory = [
  {
    incidentId: 'seed-rca-1',
    eventType: 'HAZARD',
    severity: 'medium',
    workerId: 2,
    workerName: 'Suresh Babu',
    badge: 'SW-018',
    zone: 'Zone C',
    location: 'Gandhi Road, Block C',
    eventTime: '08:42',
    hazard: 'Gas Cloud',
    alertMessage: 'Gas Cloud reported near MH-1874',
    recordedAt: new Date(Date.now() - (3 * 86_400_000)).toISOString(),
  },
  {
    incidentId: 'seed-rca-2',
    eventType: 'SOS_MANUAL',
    severity: 'critical',
    workerId: 1,
    workerName: 'Ravi Kumar',
    badge: 'SW-041',
    zone: 'Zone B',
    location: 'Rajiv Nagar, Lane 4',
    eventTime: '09:10',
    hazard: '',
    alertMessage: 'Manual SOS triggered by Ravi Kumar',
    recordedAt: new Date(Date.now() - (2 * 86_400_000)).toISOString(),
  },
  {
    incidentId: 'seed-rca-3',
    eventType: 'HAZARD',
    severity: 'medium',
    workerId: 3,
    workerName: 'Meena Devi',
    badge: 'SW-029',
    zone: 'Zone A',
    location: 'Nehru St, Sector 2',
    eventTime: '11:25',
    hazard: 'Water Flood',
    alertMessage: 'Water Flood reported near MH-0933',
    recordedAt: new Date(Date.now() - (1 * 86_400_000)).toISOString(),
  },
];

function normalizeIncidentSnapshot(context = {}) {
  return {
    incidentId: context.incidentId || `inc-${Date.now()}`,
    eventType: String(context.eventType || context.type || 'INCIDENT').toUpperCase(),
    severity: String(context.severity || 'medium').toLowerCase(),
    workerId: context.workerId ?? null,
    workerName: context.workerName || 'Worker',
    badge: context.badge || 'N/A',
    zone: context.zone || 'Zone N/A',
    location: context.location || context.address || 'Field location',
    eventTime: context.eventTime || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    hazard: context.hazard || '',
    alertMessage: context.alertMessage || context.msg || '',
    recordedAt: context.recordedAt || new Date().toISOString(),
  };
}

function words(text = '') {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function incidentSimilarityScore(target, candidate) {
  let score = 0;
  if (target.eventType && target.eventType === candidate.eventType) score += 4;
  if (target.zone && target.zone === candidate.zone) score += 2;
  if (target.severity && target.severity === candidate.severity) score += 1;

  const targetHazard = new Set(words(target.hazard));
  const candidateHazard = new Set(words(candidate.hazard));
  const hazardOverlap = [...targetHazard].some((w) => candidateHazard.has(w));
  if (hazardOverlap) score += 3;

  const targetAlert = new Set(words(target.alertMessage));
  const candidateAlert = new Set(words(candidate.alertMessage));
  const alertOverlap = [...targetAlert].some((w) => candidateAlert.has(w));
  if (alertOverlap) score += 1;

  return score;
}

function findSimilarIncidents(targetIncident, limit = 5) {
  return incidentHistory
    .filter((item) => item.incidentId !== targetIncident.incidentId)
    .map((item) => ({ ...item, _score: incidentSimilarityScore(targetIncident, item) }))
    .filter((item) => item._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...item }) => item);
}

function rememberIncident(context = {}) {
  const snapshot = normalizeIncidentSnapshot(context);
  incidentHistory.unshift(snapshot);
  if (incidentHistory.length > INCIDENT_HISTORY_LIMIT) {
    incidentHistory.splice(INCIDENT_HISTORY_LIMIT);
  }
}

const DRILL_HISTORY_LIMIT = 100;
const DRILL_PASS_RESPONSE_SEC = 45;
const DRILL_HISTORY_FILE = path.join(__dirname, 'data', 'evacuationDrillHistory.json');
const evacuationDrillHistory = [];

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function asPositiveInt(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function deriveDrillBadge(drillLog = {}) {
  const targetSec = asPositiveInt(drillLog.targetSec, 90);
  const evacuationSec = asPositiveInt(drillLog.totalEvacuationSec, null);
  const supervisorResponseSec = asPositiveInt(drillLog.supervisorResponseSec, null);

  const meetsEvacuationTarget = !isPositiveNumber(evacuationSec) || evacuationSec <= targetSec;
  const meetsSupervisorTarget = !isPositiveNumber(supervisorResponseSec) || supervisorResponseSec <= DRILL_PASS_RESPONSE_SEC;
  const passed = meetsEvacuationTarget && meetsSupervisorTarget;

  let reason = 'Evacuation and supervisor response met the target windows.';
  if (!meetsEvacuationTarget) {
    reason = `Evacuation ${evacuationSec}s exceeded ${targetSec}s target.`;
  } else if (!meetsSupervisorTarget) {
    reason = `Supervisor response ${supervisorResponseSec}s exceeded ${DRILL_PASS_RESPONSE_SEC}s target.`;
  } else if (!isPositiveNumber(supervisorResponseSec)) {
    reason = `Evacuation met ${targetSec}s target. Supervisor response timing pending.`;
  }

  return {
    status: passed ? 'PASS' : 'FAIL',
    passed,
    reason,
    targetSec,
    supervisorTargetSec: DRILL_PASS_RESPONSE_SEC,
    evacuationSec: isPositiveNumber(evacuationSec) ? evacuationSec : null,
    supervisorResponseSec: isPositiveNumber(supervisorResponseSec) ? supervisorResponseSec : null,
  };
}

function normalizeDrillLogEntry(drill = {}) {
  const targetWorkers = Array.isArray(drill.targetWorkers) ? drill.targetWorkers : [];
  const totalEvacuationSec = asPositiveInt(drill.totalEvacuationSec, 0);

  const normalized = {
    id: drill.id || `drill-${Date.now()}`,
    drillType: drill.drillType || 'EMERGENCY_EVACUATION',
    startedAt: typeof drill.startedAt === 'string' ? drill.startedAt : new Date().toISOString(),
    completedAt: typeof drill.completedAt === 'string' ? drill.completedAt : null,
    simulatedZone: drill.simulatedZone || 'Zone N/A',
    targetWorkers,
    targetCount: asPositiveInt(drill.targetCount, targetWorkers.length),
    totalEvacuationSec,
    targetSec: asPositiveInt(drill.targetSec, 90),
    supervisorResponseSec: asPositiveInt(drill.supervisorResponseSec, null),
    responseChain: Array.isArray(drill.responseChain) ? drill.responseChain : [],
    zoneBreakdown: Array.isArray(drill.zoneBreakdown) ? drill.zoneBreakdown : [],
    feedback: Array.isArray(drill.feedback) ? drill.feedback.map((item) => String(item)).slice(0, 4) : [],
    logLine: drill.logLine || `Evacuated ${targetWorkers.length} workers in ${totalEvacuationSec} seconds`,
  };

  normalized.resultBadge = deriveDrillBadge(normalized);
  return normalized;
}

function persistDrillHistoryToDisk() {
  try {
    fs.mkdirSync(path.dirname(DRILL_HISTORY_FILE), { recursive: true });
    fs.writeFileSync(
      DRILL_HISTORY_FILE,
      JSON.stringify(evacuationDrillHistory.slice(0, DRILL_HISTORY_LIMIT), null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('[Drill] Failed to persist drill history:', err.message);
  }
}

function loadDrillHistoryFromDisk() {
  try {
    if (!fs.existsSync(DRILL_HISTORY_FILE)) return;

    const raw = fs.readFileSync(DRILL_HISTORY_FILE, 'utf8');
    if (!raw.trim()) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const normalizedLogs = parsed
      .map((item) => normalizeDrillLogEntry(item))
      .slice(0, DRILL_HISTORY_LIMIT);

    evacuationDrillHistory.splice(0, evacuationDrillHistory.length, ...normalizedLogs);
    console.log(`[Drill] Loaded ${normalizedLogs.length} persisted drill logs`);
  } catch (err) {
    console.error('[Drill] Failed to load persisted drill history:', err.message);
  }
}

function rememberDrillRun(drill) {
  const summary = normalizeDrillLogEntry({
    ...drill,
    completedAt: null,
    supervisorResponseSec: null,
    targetCount: Array.isArray(drill.targetWorkers) ? drill.targetWorkers.length : 0,
  });

  evacuationDrillHistory.unshift(summary);
  if (evacuationDrillHistory.length > DRILL_HISTORY_LIMIT) {
    evacuationDrillHistory.splice(DRILL_HISTORY_LIMIT);
  }

  persistDrillHistoryToDisk();
  return summary;
}

function appendDrillFeedback(drillLog, supervisorResponseSec) {
  const feedback = [...(drillLog.feedback || [])];
  if (Number.isFinite(supervisorResponseSec) && supervisorResponseSec > 45) {
    feedback.unshift(`Supervisor response took ${supervisorResponseSec}s - rehearse escalation handoff.`);
  } else if (Number.isFinite(supervisorResponseSec)) {
    feedback.unshift(`Supervisor response was ${supervisorResponseSec}s - within expected range.`);
  }
  drillLog.feedback = feedback.slice(0, 4);
  drillLog.resultBadge = deriveDrillBadge(drillLog);
}

function averageRounded(values = []) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildDrillTrends(logs = evacuationDrillHistory) {
  const orderedLogs = Array.isArray(logs) ? logs.filter(Boolean) : [];
  const completedLogs = orderedLogs.filter((log) => Boolean(log.completedAt));
  const passBasis = completedLogs.length > 0 ? completedLogs : orderedLogs;

  const evacuationValues = orderedLogs
    .map((log) => asPositiveInt(log.totalEvacuationSec, null))
    .filter(isPositiveNumber);

  const responseValues = completedLogs
    .map((log) => asPositiveInt(log.supervisorResponseSec, null))
    .filter(isPositiveNumber);

  const passCount = passBasis.filter((log) => deriveDrillBadge(log).passed).length;
  const recentWindow = orderedLogs
    .slice(0, 5)
    .map((log) => asPositiveInt(log.totalEvacuationSec, null))
    .filter(isPositiveNumber);
  const previousWindow = orderedLogs
    .slice(5, 10)
    .map((log) => asPositiveInt(log.totalEvacuationSec, null))
    .filter(isPositiveNumber);

  const recentAvgEvacuationSec = averageRounded(recentWindow);
  const previousAvgEvacuationSec = averageRounded(previousWindow);

  let trendDirection = 'steady';
  let trendDeltaSec = null;
  if (isPositiveNumber(recentAvgEvacuationSec) && isPositiveNumber(previousAvgEvacuationSec)) {
    trendDeltaSec = recentAvgEvacuationSec - previousAvgEvacuationSec;
    if (trendDeltaSec <= -3) trendDirection = 'improving';
    if (trendDeltaSec >= 3) trendDirection = 'slowing';
  }

  const zoneAccumulator = new Map();
  orderedLogs.forEach((log) => {
    const zone = log.simulatedZone || 'Zone N/A';
    const evacSec = asPositiveInt(log.totalEvacuationSec, null);
    const badge = deriveDrillBadge(log);

    if (!zoneAccumulator.has(zone)) {
      zoneAccumulator.set(zone, {
        zone,
        runs: 0,
        passCount: 0,
        evacuationTotalSec: 0,
        evacuationCount: 0,
        latestEvacuationSec: null,
      });
    }

    const entry = zoneAccumulator.get(zone);
    entry.runs += 1;
    if (badge.passed) entry.passCount += 1;
    if (isPositiveNumber(evacSec)) {
      entry.evacuationTotalSec += evacSec;
      entry.evacuationCount += 1;
      entry.latestEvacuationSec = evacSec;
    }
  });

  const zoneTrends = [...zoneAccumulator.values()]
    .map((entry) => ({
      zone: entry.zone,
      runs: entry.runs,
      passRatePct: entry.runs > 0 ? Math.round((entry.passCount / entry.runs) * 100) : 0,
      avgEvacuationSec: entry.evacuationCount > 0
        ? Math.round(entry.evacuationTotalSec / entry.evacuationCount)
        : null,
      latestEvacuationSec: entry.latestEvacuationSec,
    }))
    .sort((a, b) => (b.avgEvacuationSec || 0) - (a.avgEvacuationSec || 0))
    .slice(0, 4);

  return {
    totalRuns: orderedLogs.length,
    completedRuns: completedLogs.length,
    passRatePct: passBasis.length > 0 ? Math.round((passCount / passBasis.length) * 100) : 0,
    avgEvacuationSec: averageRounded(evacuationValues),
    avgSupervisorResponseSec: averageRounded(responseValues),
    bestEvacuationSec: evacuationValues.length > 0 ? Math.min(...evacuationValues) : null,
    worstEvacuationSec: evacuationValues.length > 0 ? Math.max(...evacuationValues) : null,
    trendDirection,
    trendDeltaSec,
    recentAvgEvacuationSec,
    previousAvgEvacuationSec,
    zoneTrends,
  };
}

loadDrillHistoryFromDisk();

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

    const incidentContext = {
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
    };

    sendSosToSupervisors({
      workerName: incidentContext.workerName,
      workerId: incidentContext.workerId,
      jobId: worker?.job || null,
      zone: incidentContext.zone,
      location: incidentContext.location,
      reason: data?.reason || 'manual',
      triggeredAt: incidentContext.eventTime,
    })
      .then((result) => {
        if (result.success) {
          console.log(`[WhatsApp] SOS alert sent to ${result.successCount}/${result.recipients.length} supervisor number(s)`);
        } else {
          console.warn(`[WhatsApp] SOS alert not sent: ${result.error || 'No successful deliveries'}`);
        }
      })
      .catch((err) => {
        console.error('[WhatsApp] SOS send failed:', err.message);
      });

    rememberIncident(incidentContext);
    emitIncidentPostmortem(incidentContext);
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

    const incidentContext = {
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
    };

    rememberIncident(incidentContext);
    emitIncidentPostmortem(incidentContext);
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

  // Worker → Server → Supervisor: offline incident/hazard reports synced after reconnection.
  // Payload: { workerId, workerName, syncedCount, summary?: { sos, hazard }, syncedAt }
  socket.on('worker_offline_reports_synced', (data) => {
    const syncedCount = Number(data?.syncedCount || 0);
    if (!syncedCount) return;

    const sosCount = Number(data?.summary?.sos || 0);
    const hazardCount = Number(data?.summary?.hazard || 0);
    const workerName = data?.workerName || `Worker ${data?.workerId ?? 'N/A'}`;
    const breakdown = [
      sosCount > 0 ? `${sosCount} SOS` : null,
      hazardCount > 0 ? `${hazardCount} hazard` : null,
    ].filter(Boolean).join(', ');

    io.emit('auto_alert', {
      id: `offline-sync-${Date.now()}`,
      type: 'OFFLINE_SYNC',
      workerId: data?.workerId ?? null,
      workerName,
      msg: breakdown
        ? `${workerName} synced ${syncedCount} offline report(s): ${breakdown}`
        : `${workerName} synced ${syncedCount} offline report(s) after reconnecting`,
      severity: 'info',
      time: 'just now',
      syncedCount,
      summary: { sos: sosCount, hazard: hazardCount },
      syncedAt: data?.syncedAt || new Date().toISOString(),
    });

    console.log(`[Offline Sync] ${workerName} synced ${syncedCount} report(s)`);
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

// GET /api/drills/evacuation-history
// Returns latest evacuation drill logs with response summary and zone feedback.
app.get('/api/drills/evacuation-history', (_req, res) => {
  res.json({ success: true, logs: evacuationDrillHistory, trends: buildDrillTrends() });
});

// GET /api/drills/evacuation-trends
// Returns aggregated drill performance trends for pass rate and response speed.
app.get('/api/drills/evacuation-trends', (_req, res) => {
  res.json({ success: true, trends: buildDrillTrends() });
});

// POST /api/drills/evacuation-run
// Body: { workerCount?: number, zonePreference?: string, workersSnapshot?: Worker[], jobsSnapshot?: Job[] }
// Runs a simulated evacuation drill and emits a DRILL_SOS alert.
app.post('/api/drills/evacuation-run', (req, res) => {
  try {
    const {
      workerCount,
      zonePreference,
      workersSnapshot,
      jobsSnapshot,
    } = req.body ?? {};

    const drill = buildEvacuationDrill({
      workerCount,
      zonePreference,
      workers: Array.isArray(workersSnapshot) && workersSnapshot.length > 0 ? workersSnapshot : workers,
      jobs: Array.isArray(jobsSnapshot) && jobsSnapshot.length > 0 ? jobsSnapshot : jobs,
    });

    const storedDrill = rememberDrillRun(drill);

    io.emit('auto_alert', {
      id: `drill-sos-${Date.now()}`,
      type: 'DRILL_SOS',
      severity: 'critical',
      time: 'just now',
      drillId: storedDrill.id,
      zone: storedDrill.simulatedZone,
      msg: `DRILL: Simulated SOS in ${storedDrill.simulatedZone}. Test evacuation response chain now.`,
      workerId: storedDrill.targetWorkers[0]?.workerId ?? null,
      workerName: storedDrill.targetWorkers[0]?.workerName || 'Drill Team',
    });

    console.log(`[Drill] Started ${storedDrill.id} | ${storedDrill.logLine}`);
    res.json({ success: true, drill: storedDrill, trends: buildDrillTrends() });
  } catch (err) {
    console.error('[Drill] Run error:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to run evacuation drill',
    });
  }
});

// POST /api/drills/evacuation-complete
// Body: { drillId: string, supervisorResponseSec?: number }
// Finalizes a drill log and emits DRILL_COMPLETE informational alert.
app.post('/api/drills/evacuation-complete', (req, res) => {
  const { drillId, supervisorResponseSec } = req.body ?? {};
  if (!drillId) {
    return res.status(400).json({ success: false, error: 'drillId is required' });
  }

  const drillLog = evacuationDrillHistory.find((d) => d.id === drillId);
  if (!drillLog) {
    return res.status(404).json({ success: false, error: 'Drill run not found' });
  }

  const parsedResponseSec = Number.parseInt(supervisorResponseSec, 10);
  if (Number.isFinite(parsedResponseSec) && parsedResponseSec > 0) {
    drillLog.supervisorResponseSec = parsedResponseSec;
  }
  drillLog.completedAt = new Date().toISOString();
  appendDrillFeedback(drillLog, drillLog.supervisorResponseSec);
  persistDrillHistoryToDisk();

  const responseSuffix = Number.isFinite(drillLog.supervisorResponseSec)
    ? ` | Supervisor response ${drillLog.supervisorResponseSec}s`
    : '';

  io.emit('auto_alert', {
    id: `drill-complete-${Date.now()}`,
    type: 'DRILL_COMPLETE',
    severity: 'info',
    time: 'just now',
    drillId: drillLog.id,
    zone: drillLog.simulatedZone,
    msg: `Drill complete: ${drillLog.logLine}${responseSuffix}`,
    workerId: drillLog.targetWorkers[0]?.workerId ?? null,
    workerName: drillLog.targetWorkers[0]?.workerName || 'Drill Team',
  });

  console.log(`[Drill] Completed ${drillLog.id} | response=${drillLog.supervisorResponseSec ?? 'n/a'}s`);
  res.json({ success: true, drill: drillLog, trends: buildDrillTrends() });
});

// POST /api/incident/rca-assistant
// Body: { incident: {...}, interviewAnswers?: Record<string,string>, lang?: 'hi'|'en' }
// Runs structured RCA assistant using incident context + similar historical incidents.
app.post('/api/incident/rca-assistant', async (req, res) => {
  const { incident, interviewAnswers, lang } = req.body ?? {};
  if (!incident || typeof incident !== 'object') {
    return res.status(400).json({ success: false, error: 'incident object is required' });
  }

  try {
    const normalizedIncident = normalizeIncidentSnapshot(incident);
    const similarIncidents = findSimilarIncidents(normalizedIncident, 5);
    const assistant = await buildRcaAssistant({
      incident: normalizedIncident,
      interviewAnswers: interviewAnswers || {},
      similarIncidents,
      lang: lang || 'hi',
    });

    res.json({ success: true, assistant });
  } catch (err) {
    console.error('[RCA Assistant] Error:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to generate RCA assistant report',
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

// POST /api/ai/chart-generate
// Body: { question: string, auditRows: AuditRow[], lang?: 'hi'|'en' }
// Generates Recharts-ready chart config from audit logs using AI (with safe fallback).
app.post('/api/ai/chart-generate', async (req, res) => {
  try {
    const result = await generateAiAuditChart(req.body ?? {});
    res.json(result);
  } catch (err) {
    console.error('[AI Chart] Error:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to generate AI chart',
    });
  }
});

// Start sensor tick loop (no-op stub until Phase 1 fills it in)
engine.start(io);

httpServer.listen(PORT, () => {
  console.log(`[SAMVED] Socket.IO server listening on :${PORT}`);
});

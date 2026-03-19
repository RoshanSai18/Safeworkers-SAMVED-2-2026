function toPositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function zoneFromAddress(address = '') {
  const match = String(address).match(/zone\s+([a-z])/i);
  return match ? `Zone ${match[1].toUpperCase()}` : null;
}

function normalizeWorkers(workers = []) {
  if (!Array.isArray(workers)) return [];
  return workers
    .filter((w) => w && typeof w === 'object')
    .map((w) => ({
      id: w.id,
      name: w.name || `Worker ${w.id ?? 'N/A'}`,
      badge: w.badge || 'N/A',
      status: String(w.status || 'IDLE').toUpperCase(),
      job: w.job || '—',
      address: w.address || 'Field location',
      battery: Number.isFinite(Number(w.battery)) ? Number(w.battery) : 70,
      signal: Number.isFinite(Number(w.signal)) ? Number(w.signal) : 3,
      entries: Number.isFinite(Number(w.entries)) ? Number(w.entries) : 0,
    }));
}

function normalizeJobs(jobs = []) {
  if (!Array.isArray(jobs)) return [];
  return jobs
    .filter((j) => j && typeof j === 'object')
    .map((j) => ({
      id: j.id,
      zone: j.zone || zoneFromAddress(j.address) || 'Zone N/A',
      risk: String(j.risk || 'MEDIUM').toUpperCase(),
    }));
}

function buildJobZoneMap(jobs = []) {
  const map = new Map();
  jobs.forEach((job) => {
    if (job.id) map.set(job.id, job.zone || 'Zone N/A');
  });
  return map;
}

function deriveWorkerZone(worker, jobZoneMap, knownZones = []) {
  if (!worker) return 'Zone N/A';
  if (worker.job && worker.job !== '—' && jobZoneMap.has(worker.job)) {
    return jobZoneMap.get(worker.job);
  }
  const fromAddress = zoneFromAddress(worker.address);
  if (fromAddress) return fromAddress;
  if (knownZones.length > 0) {
    const idx = Math.abs(Number(worker.id || 1) - 1) % knownZones.length;
    return knownZones[idx];
  }
  return 'Zone N/A';
}

function stableJitter(seed) {
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}

function evacuationBaseByStatus(status) {
  const normalized = String(status || 'IDLE').toUpperCase();
  if (normalized === 'SOS') return 78;
  if (normalized === 'IN_MANHOLE') return 86;
  if (normalized === 'DELAYED') return 80;
  if (normalized === 'TRANSIT') return 64;
  if (normalized === 'SIGNAL_LOST') return 98;
  return 58;
}

function computeEvacuationSec(worker, order, drillSeed) {
  const base = evacuationBaseByStatus(worker.status);
  const fatiguePenalty = Math.min(12, Math.max(0, Number(worker.entries || 0) * 2));
  const batteryPenalty = worker.battery < 30 ? 8 : worker.battery < 45 ? 4 : 0;
  const signalPenalty = worker.signal <= 1 ? 7 : worker.signal === 2 ? 3 : 0;
  const jitter = Math.round(stableJitter((worker.id || 1) * 17 + order * 11 + drillSeed) * 18);
  return base + fatiguePenalty + batteryPenalty + signalPenalty + jitter;
}

function summarizeZoneBreakdown(targetWorkers = []) {
  const grouped = new Map();
  targetWorkers.forEach((w) => {
    const zone = w.zone || 'Zone N/A';
    if (!grouped.has(zone)) grouped.set(zone, []);
    grouped.get(zone).push(w);
  });

  return [...grouped.entries()].map(([zone, members]) => {
    const total = members.length;
    const maxEvacuationSec = Math.max(...members.map((m) => m.evacuationSec));
    const avgEvacuationSec = Math.round(members.reduce((acc, m) => acc + m.evacuationSec, 0) / total);
    return {
      zone,
      workers: total,
      avgEvacuationSec,
      maxEvacuationSec,
    };
  });
}

function buildFeedback({ zoneBreakdown, targetWorkers, totalEvacuationSec, targetSec }) {
  const feedback = [];

  if (zoneBreakdown.length > 0) {
    const slowestZone = [...zoneBreakdown].sort((a, b) => b.avgEvacuationSec - a.avgEvacuationSec)[0];
    feedback.push(`${slowestZone.zone} took longer - may need route review.`);
  }

  const weakCommsCount = targetWorkers.filter((w) => w.signal <= 1 || w.battery < 30).length;
  if (weakCommsCount > 0) {
    feedback.push('Low battery or weak signal delayed confirmations. Add pre-drill communication checks.');
  }

  if (totalEvacuationSec > targetSec) {
    feedback.push(`Evacuation exceeded ${targetSec} seconds. Pre-stage rescue gear near high-risk entries.`);
  } else {
    feedback.push(`Evacuation stayed within ${targetSec} seconds. Keep current dispatch playbook.`);
  }

  return feedback.slice(0, 3);
}

function buildEvacuationDrill({ workers = [], jobs = [], workerCount = 4, zonePreference = '' } = {}) {
  const normalizedWorkers = normalizeWorkers(workers);
  const normalizedJobs = normalizeJobs(jobs);
  const drillSeed = Date.now() % 997;

  if (normalizedWorkers.length === 0) {
    throw new Error('workers data is required for evacuation drill');
  }

  const targetSize = Math.min(toPositiveInt(workerCount, 4), normalizedWorkers.length);
  const jobZoneMap = buildJobZoneMap(normalizedJobs);
  const knownZones = [...new Set(normalizedJobs.map((j) => j.zone).filter(Boolean))];
  const preferredZone = String(zonePreference || '').trim();
  const statusRank = { SOS: 0, IN_MANHOLE: 1, DELAYED: 2, TRANSIT: 3, IDLE: 4, SIGNAL_LOST: 5 };

  const zoneAnnotated = normalizedWorkers.map((worker) => ({
    ...worker,
    zone: deriveWorkerZone(worker, jobZoneMap, knownZones),
  }));

  zoneAnnotated.sort((a, b) => {
    const rankDelta = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
    if (rankDelta !== 0) return rankDelta;
    return (a.signal ?? 3) - (b.signal ?? 3);
  });

  const primary = preferredZone
    ? zoneAnnotated.filter((w) => w.zone.toLowerCase() === preferredZone.toLowerCase())
    : zoneAnnotated;
  const secondary = preferredZone
    ? zoneAnnotated.filter((w) => w.zone.toLowerCase() !== preferredZone.toLowerCase())
    : [];

  const selected = [...primary, ...secondary].slice(0, targetSize);
  const targetWorkers = selected.map((worker, idx) => ({
    workerId: worker.id,
    workerName: worker.name,
    badge: worker.badge,
    status: worker.status,
    zone: worker.zone,
    evacuationSec: computeEvacuationSec(worker, idx + 1, drillSeed),
  }));

  const sortedByEvac = [...targetWorkers].sort((a, b) => a.evacuationSec - b.evacuationSec);
  const totalEvacuationSec = Math.max(...targetWorkers.map((w) => w.evacuationSec));
  const targetSec = 90;
  const plannedSupervisorResponseSec = Math.max(10, Math.min(30, Math.round(totalEvacuationSec * 0.22)));
  const dispatchSec = Math.max(plannedSupervisorResponseSec + 10, Math.round(totalEvacuationSec * 0.45));
  const zoneBreakdown = summarizeZoneBreakdown(targetWorkers);
  const simulatedZone = zoneBreakdown.length
    ? [...zoneBreakdown].sort((a, b) => b.workers - a.workers)[0].zone
    : 'Zone N/A';

  const responseChain = [
    { step: `Simulated SOS triggered in ${simulatedZone}`, atSec: 0 },
    { step: 'Supervisor acknowledges emergency protocol', atSec: plannedSupervisorResponseSec },
    { step: 'Dispatch relay confirms evacuation command', atSec: dispatchSec },
    ...sortedByEvac.map((item) => ({
      step: `${item.workerName} evacuated from ${item.zone}`,
      atSec: item.evacuationSec,
    })),
    { step: `All ${targetWorkers.length} workers evacuated`, atSec: totalEvacuationSec },
  ];

  const feedback = buildFeedback({
    zoneBreakdown,
    targetWorkers,
    totalEvacuationSec,
    targetSec,
  });

  const now = Date.now();
  return {
    id: `drill-${now}`,
    drillType: 'EMERGENCY_EVACUATION',
    startedAt: new Date(now).toISOString(),
    simulatedZone,
    targetWorkers,
    plannedSupervisorResponseSec,
    totalEvacuationSec,
    targetSec,
    responseChain,
    zoneBreakdown,
    logLine: `Evacuated ${targetWorkers.length} workers in ${totalEvacuationSec} seconds`,
    feedback,
    recommendedActions: [
      'Rehearse emergency role-call with 90-second target.',
      'Keep ventilation and route-clearing kits pre-staged in high-risk zones.',
      'Run communication check before every live entry and drill.',
    ],
  };
}

module.exports = {
  buildEvacuationDrill,
};

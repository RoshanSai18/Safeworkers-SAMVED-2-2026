// Sensor tick engine — runs a 1 s loop for every IN_MANHOLE worker,
// emits sensor_update to all clients, and fires auto_alert when a
// gas reading crosses a threshold.

const simulator  = require('./simulator');
const { classify } = require('./thresholds');
const { workers }  = require('../data/seed');
const { prependAlert } = require('../routes/alerts');

const TICK_MS = 1000;

// Per-(workerId, gas) last-alerted severity + timestamp — throttle logic:
// re-emit only when severity changes OR > 30 s since last alert for that gas.
const alertState = new Map(); // key: `${workerId}:${gas}` → { severity, ts }

const GAS_LIST = ['H2S', 'CO', 'O2', 'CH4', 'WATER'];

const GAS_UNITS  = { H2S: 'ppm', CO: 'ppm', O2: '%', CH4: '% LEL', WATER: 'cm' };

const GAS_LABELS = { H2S: 'H₂S', CO: 'CO', O2: 'O₂', CH4: 'CH₄', WATER: 'Water' };

function shouldAlert(workerId, gas, severity) {
  if (severity === 'safe') return false; // never spam "safe" alerts

  const key  = `${workerId}:${gas}`;
  const prev = alertState.get(key);
  const now  = Date.now();

  if (!prev) {
    alertState.set(key, { severity, ts: now });
    return true;
  }

  const severityChanged = prev.severity !== severity;
  const throttleExpired = (now - prev.ts) > 30_000;

  if (severityChanged || throttleExpired) {
    alertState.set(key, { severity, ts: now });
    return true;
  }

  return false;
}

function start(io) {
  setInterval(() => {
    // Only simulate workers who are currently IN_MANHOLE
    const activeWorkers = workers.filter(w => w.status === 'IN_MANHOLE');

    for (const worker of activeWorkers) {
      const readings  = simulator.tick(worker.id);
      const statuses  = {};

      for (const gas of GAS_LIST) {
        statuses[gas] = classify(gas, readings[gas]);
      }

      // Broadcast live readings to every connected client
      io.emit('sensor_update', {
        workerId:  worker.id,
        name:      worker.name,
        readings,
        statuses,
        timestamp: Date.now(),
      });

      // Check each gas for threshold crossing and emit auto_alert
      for (const gas of GAS_LIST) {
        const severity = statuses[gas]; // 'safe' | 'warning' | 'danger'

        if (!shouldAlert(worker.id, gas, severity)) continue;

        const alertSeverity = severity === 'danger' ? 'critical' : 'warning';
        const value = readings[gas];
        const unit  = GAS_UNITS[gas];
        const label = GAS_LABELS[gas];

        const alert = {
          id:       `gas-${worker.id}-${gas}-${Date.now()}`,
          type:     'AUTO_GAS',
          workerId: worker.id,
          workerName: worker.name,
          gas,
          value,
          unit,
          severity: alertSeverity,
          msg:      `${label} ${alertSeverity === 'critical' ? 'DANGER' : 'WARNING'}: ${value} ${unit} detected for ${worker.name} at ${worker.job}`,
          time:     'just now',
        };

        prependAlert(alert);
        io.emit('auto_alert', alert);

        console.log(`[Engine] AUTO_ALERT ${alertSeverity.toUpperCase()} — Worker ${worker.id} (${worker.name}): ${label} = ${value} ${unit}`);
      }
    }
  }, TICK_MS);

  console.log('[Engine] Sensor tick loop started (1 s interval)');
}

module.exports = { start };


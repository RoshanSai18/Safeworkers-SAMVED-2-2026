// Random-walk gas sensor simulator.
// Each IN_MANHOLE worker gets an independent state object that drifts
// slightly every tick (~1 s) so readings look organic.

const { THRESHOLDS, INITIAL_SAFE } = require('./thresholds');

// workerId → { H2S, CO, O2, CH4 }
const state = new Map();

/**
 * Return (creating if needed) the current gas state for a worker.
 */
function getOrCreate(workerId) {
  if (!state.has(workerId)) {
    state.set(workerId, { ...INITIAL_SAFE });
  }
  return state.get(workerId);
}

/**
 * Advance the simulation by one tick for the given worker.
 * Applies a ±stepSize random walk to each gas, clamped to physical limits.
 * Returns the new readings object.
 */
function tick(workerId) {
  const readings = getOrCreate(workerId);

  for (const gas of ['H2S', 'CO', 'O2', 'CH4', 'WATER']) {
    const cfg   = THRESHOLDS[gas];
    const delta = (Math.random() * 2 - 1) * cfg.stepSize; // uniform ±stepSize
    readings[gas] = clamp(readings[gas] + delta, cfg.physMin, cfg.physMax);
    readings[gas] = parseFloat(readings[gas].toFixed(2));
  }

  return { ...readings };
}

/**
 * Remove simulator state for a worker (e.g. when they exit the manhole).
 */
function reset(workerId) {
  state.delete(workerId);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

module.exports = { getOrCreate, tick, reset };

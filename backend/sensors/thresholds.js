// Real-world OSHA/NIOSH gas thresholds used for classification and simulation.
const THRESHOLDS = {
  H2S: {
    unit:       'ppm',
    safeMax:    1,      // < 1 ppm  → safe
    warningMax: 10,     // 1–10 ppm → warning
    // > 10 ppm → danger (IDLH = 50 ppm)
    physMin:    0,
    physMax:    100,
    // Random-walk step size = 5% of the safe range width
    stepSize:   0.05,   // 5% of 1 ppm safe ceiling
  },
  CO: {
    unit:       'ppm',
    safeMax:    25,     // < 25 ppm   → safe
    warningMax: 200,    // 25–200 ppm → warning
    // > 200 ppm → danger (IDLH = 1200 ppm)
    physMin:    0,
    physMax:    1200,
    stepSize:   1.25,   // 5% of 25 ppm safe ceiling
  },
  O2: {
    unit:       '%',
    safeMin:    19.5,   // 19.5–23.5% → safe
    safeMax:    23.5,
    warningMin: 16,     // 16–19.5%   → warning (low O2)
    // < 16% → danger
    physMin:    0,
    physMax:    25,
    stepSize:   0.2,    // 5% of the 4% safe window
  },
  CH4: {
    unit:       '% LEL',
    safeMax:    10,     // < 10% LEL  → safe
    warningMax: 25,     // 10–25% LEL → warning
    // > 25% LEL → danger
    physMin:    0,
    physMax:    100,
    stepSize:   0.5,    // 5% of 10% LEL safe ceiling
  },
  WATER: {
    unit:       'cm',
    safeMax:    10,     // < 10 cm  → safe (residual moisture)
    warningMax: 30,     // 10–30 cm → warning (rising water)
    // > 30 cm → danger (flooding risk)
    physMin:    0,
    physMax:    100,
    stepSize:   0.6,    // cm per tick
  },
};

// Starting values near the centre of each gas's safe range
const INITIAL_SAFE = {
  H2S:   0.3,   // ppm
  CO:    10,    // ppm
  O2:    21.0,  // %
  CH4:   3,     // % LEL
  WATER: 2,     // cm
};

/**
 * Classify a single gas reading into 'safe' | 'warning' | 'danger'.
 */
function classify(gas, value) {
  switch (gas) {
    case 'H2S':
      if (value < THRESHOLDS.H2S.safeMax)    return 'safe';
      if (value < THRESHOLDS.H2S.warningMax) return 'warning';
      return 'danger';

    case 'CO':
      if (value < THRESHOLDS.CO.safeMax)    return 'safe';
      if (value < THRESHOLDS.CO.warningMax) return 'warning';
      return 'danger';

    case 'O2':
      // O2 is unique: danger is LOW oxygen, safe is a band
      if (value >= THRESHOLDS.O2.safeMin && value <= THRESHOLDS.O2.safeMax) return 'safe';
      if (value >= THRESHOLDS.O2.warningMin) return 'warning';
      return 'danger';

    case 'CH4':
      if (value < THRESHOLDS.CH4.safeMax)    return 'safe';
      if (value < THRESHOLDS.CH4.warningMax) return 'warning';
      return 'danger';

    case 'WATER':
      if (value < THRESHOLDS.WATER.safeMax)    return 'safe';
      if (value < THRESHOLDS.WATER.warningMax) return 'warning';
      return 'danger';

    default:
      return 'safe';
  }
}

module.exports = { THRESHOLDS, INITIAL_SAFE, classify };

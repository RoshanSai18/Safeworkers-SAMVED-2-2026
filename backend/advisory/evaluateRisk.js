// Safety Co-Pilot — server-side risk evaluation engine.
// Accepts job/environment parameters and returns a structured advisory
// payload containing Hindi/Marathi safety guidance.
//
// Design principle: "Support, not Surveillance"
// · All inputs are purely safety parameters (hazards, depth, weather, gas).
// · No location tracking data is stored or emitted.

const WEATHER_MSGS = {
  heavy_rain:    'तेज़ बारिश के कारण पानी भरने का खतरा है',
  thunderstorm:  'तूफान के कारण मैनहोल के अंदर काम करना खतरनाक है',
  flood_warning: 'बाढ़ की चेतावनी — काम तुरंत बंद करें',
  heatwave:      'अत्यधिक गर्मी के कारण मैनहोल के अंदर ऑक्सीजन कम हो सकती है',
};

const STANDARD_TIPS = [
  'PPE को सही तरीके से पहनें और फोटो अपलोड करें',
  'पहले ऊपर से गैस टेस्ट और पानी का बहाव चेक करें',
  'किसी भी वक्त घबराहट हो तो SOS दबाएँ — कोई निगरानी नहीं, सिर्फ़ बचाव के लिए',
];

const WEATHER_SIGNAL_LABELS = {
  heavy_rain: 'तेज़ बारिश',
  thunderstorm: 'तूफानी मौसम',
  flood_warning: 'बाढ़ का खतरा',
  heatwave: 'अत्यधिक गर्मी',
};

function pushRiskSignal(reasons, signals, reasonText, signalKey, signalLabel, severity = 'warning') {
  reasons.push(reasonText);
  signals.push({ key: signalKey, label: signalLabel, severity });
}

function buildConfidence(priority, signals) {
  const dangerCount = signals.filter(s => s.severity === 'danger').length;
  const warningCount = signals.filter(s => s.severity === 'warning').length;
  const infoCount = signals.filter(s => s.severity === 'info').length;

  const base = priority === 'high' ? 72 : priority === 'medium' ? 62 : 84;
  const raw = base + (dangerCount * 6) + (warningCount * 4) + (infoCount * 2);
  const score = Math.max(55, Math.min(97, Math.round(raw)));

  const bandHi = score >= 90 ? 'उच्च' : score >= 75 ? 'मध्यम-उच्च' : 'मध्यम';
  return { score, labelHi: `${score}% (${bandHi})` };
}

function buildImmediateSteps(priority, signalKeys) {
  const steps = [];
  const hasGas = signalKeys.some((k) => ['h2s', 'co', 'o2_low', 'ch4'].includes(k));
  const hasWaterOrWeather = signalKeys.some((k) => ['water', 'heavy_rain', 'thunderstorm', 'flood_warning'].includes(k));
  const hasDepthOrHistory = signalKeys.some((k) => ['depth', 'incidents'].includes(k));

  if (priority === 'high') {
    steps.push('तुरंत निकासी करें और एरिया को कॉर्डन करें');
  } else if (priority === 'medium') {
    steps.push('एंट्री रोकें और दोबारा गैस टेस्ट करें');
  } else {
    steps.push('काम शुरू रखने से पहले PPE और गैस मीटर दोबारा जांचें');
  }

  if (hasGas) {
    steps.push('ब्लोअर/वेंटिलेशन चालू करें और 2 मिनट बाद रीडिंग रीचेक करें');
  }

  if (hasWaterOrWeather) {
    steps.push('पानी का बहाव और ड्रेनेज क्लियरेंस तुरंत सुनिश्चित करें');
  }

  if (hasDepthOrHistory) {
    steps.push('रेस्क्यू लाइन और स्टैंडबाय टीम तैयार रखें');
  }

  steps.push('सुपरवाइजर को तुरंत अपडेट करें और अनुमति लेकर ही आगे बढ़ें');
  return [...new Set(steps)].slice(0, 3);
}

function buildHindiSignalNarrative(topSignals = [], actionClause = '') {
  if (topSignals.length === 0) {
    return `सभी संकेत सुरक्षित हैं। ${actionClause}`;
  }
  if (topSignals.length === 1) {
    return `${topSignals[0]} के कारण ${actionClause}`;
  }
  if (topSignals.length === 2) {
    return `${topSignals[0]} और ${topSignals[1]} के कारण ${actionClause}`;
  }
  return `${topSignals[0]}, ${topSignals[1]} और ${topSignals[2]} के कारण ${actionClause}`;
}

function buildExplainability(priority, signals) {
  const signalLabels = signals.map((s) => s.label);
  const topSignals = signalLabels.slice(0, 3);

  const actionClause = priority === 'high'
    ? 'तुरंत बाहर निकलें और आपात प्रोटोकॉल लागू करें'
    : priority === 'medium'
      ? 'कार्य रोककर सुरक्षा जांच दोबारा करें'
      : 'सामान्य सावधानी के साथ कार्य जारी रखें';

  const summaryHi = buildHindiSignalNarrative(topSignals, actionClause);

  const confidence = buildConfidence(priority, signals);
  const immediateSteps = buildImmediateSteps(priority, signals.map((s) => s.key));

  return {
    summaryHi,
    confidence: confidence.labelHi,
    confidenceScore: confidence.score,
    immediateSteps,
    triggerSignals: signalLabels,
  };
}

/**
 * Evaluate risk for a given set of job-safety parameters.
 *
 * @param {object} params
 * @param {number}  params.depth            - Manhole depth in meters
 * @param {number}  params.recentIncidents  - Incidents logged at this site
 * @param {string}  params.weather          - 'clear' | 'heavy_rain' | 'thunderstorm' | 'flood_warning' | 'heatwave'
 * @param {object}  [params.gasReadings]    - Live readings { H2S, CO, O2, CH4, WATER }
 * @returns {{ priority, title, reasons, tips, speak }}
 */
function evaluateRisk({ depth = 0, recentIncidents = 0, weather = 'clear', gasReadings = null } = {}) {
  const reasons = [];
  const signals = [];

  // Structural / site factors
  if (depth > 3) {
    pushRiskSignal(
      reasons,
      signals,
      `मैनहोल बहुत गहरा है (${depth} मीटर — 3 मीटर से अधिक)`,
      'depth',
      `अधिक गहराई (${depth}m)`,
      'warning'
    );
  }
  if (recentIncidents > 0) {
    pushRiskSignal(
      reasons,
      signals,
      `इस जगह हाल ही में ${recentIncidents} घटना दर्ज हुई है`,
      'incidents',
      `${recentIncidents} हालिया घटना`,
      'warning'
    );
  }

  // Weather factors
  const weatherMsg = WEATHER_MSGS[weather];
  if (weatherMsg) {
    pushRiskSignal(
      reasons,
      signals,
      weatherMsg,
      weather,
      WEATHER_SIGNAL_LABELS[weather] || 'मौसम जोखिम',
      weather === 'flood_warning' || weather === 'thunderstorm' ? 'danger' : 'warning'
    );
  }

  // Live gas sensor factors
  if (gasReadings) {
    if (gasReadings.H2S >= 10) {
      pushRiskSignal(
        reasons,
        signals,
        `H₂S गैस खतरनाक स्तर पर है — ${gasReadings.H2S} ppm`,
        'h2s',
        `H2S बढ़ रहा है (${gasReadings.H2S} ppm)`,
        'danger'
      );
    }
    if (gasReadings.CO >= 200) {
      pushRiskSignal(
        reasons,
        signals,
        `CO गैस खतरनाक स्तर पर है — ${gasReadings.CO} ppm`,
        'co',
        `CO बढ़ रहा है (${gasReadings.CO} ppm)`,
        'danger'
      );
    }
    if (gasReadings.O2 < 19.5) {
      pushRiskSignal(
        reasons,
        signals,
        `ऑक्सीजन का स्तर कम है — ${gasReadings.O2}%`,
        'o2_low',
        `ऑक्सीजन कम है (${gasReadings.O2}%)`,
        'danger'
      );
    }
    if (gasReadings.CH4 >= 25) {
      pushRiskSignal(
        reasons,
        signals,
        `मीथेन गैस खतरे के स्तर पर है — ${gasReadings.CH4}% LEL`,
        'ch4',
        `मीथेन बढ़ रही है (${gasReadings.CH4}% LEL)`,
        'danger'
      );
    }
    if (gasReadings.WATER >= 30) {
      pushRiskSignal(
        reasons,
        signals,
        `मैनहोल में पानी भर रहा है — ${gasReadings.WATER} सेंटीमीटर`,
        'water',
        `पानी का स्तर बढ़ रहा है (${gasReadings.WATER} cm)`,
        'warning'
      );
    }
  }

  const priority = reasons.length >= 2 ? 'high'
                 : reasons.length === 1 ? 'medium'
                 : 'low';

  const isHighRisk = priority !== 'low';
  const explainability = buildExplainability(priority, signals);

  // The spoken Hindi sentence — concise enough for a short TTS clip
  const speakText = isHighRisk && explainability.summaryHi
    ? `सावधान! ${explainability.summaryHi}. ${explainability.immediateSteps[0] || STANDARD_TIPS[2]}`
    : 'सब ठीक है। PPE पहनें और सावधान रहें।';

  return {
    priority,
    title:   isHighRisk ? '⚠️ उच्च जोखिम का काम' : 'ℹ️ सामान्य जोखिम',
    reasons,
    tips:    [...STANDARD_TIPS],
    speak:   speakText,
    explainability,
  };
}

/**
 * Build a pushed weather-alert advisory — used when a supervisor or
 * automated weather service triggers a live alert.
 *
 * @param {string} weather  - One of the WEATHER_MSGS keys
 * @returns {object|null}
 */
function buildWeatherAdvisory(weather) {
  const msg = WEATHER_MSGS[weather];
  if (!msg) return null;

  const weatherSignals = [
    {
      key: weather,
      label: WEATHER_SIGNAL_LABELS[weather] || 'मौसम जोखिम',
      severity: weather === 'flood_warning' || weather === 'thunderstorm' ? 'danger' : 'warning',
    },
  ];
  const explainability = buildExplainability('high', weatherSignals);

  return {
    priority: 'high',
    title:    '🌧️ मौसम सतर्कता',
    reasons:  [msg],
    tips: [
      'मौसम की वजह से मैनहोल के अंदर खतरा बढ़ सकता है',
      'काम रोकें और सुरक्षित जगह पर आ जाएँ',
      'SOS बटन दबाएँ यदि आप फँसे हुए हैं',
    ],
    speak:  `मौसम चेतावनी। ${msg}. तुरंत काम रोकें और बाहर आ जाएँ।`,
    explainability,
    source: 'weather',
  };
}

module.exports = { evaluateRisk, buildWeatherAdvisory };

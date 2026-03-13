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

  // Structural / site factors
  if (depth > 3)           reasons.push(`मैनहोल बहुत गहरा है (${depth} मीटर — 3 मीटर से अधिक)`);
  if (recentIncidents > 0) reasons.push(`इस जगह हाल ही में ${recentIncidents} घटना दर्ज हुई है`);

  // Weather factors
  const weatherMsg = WEATHER_MSGS[weather];
  if (weatherMsg) reasons.push(weatherMsg);

  // Live gas sensor factors
  if (gasReadings) {
    if (gasReadings.H2S  >= 10)  reasons.push(`H₂S गैस खतरनाक स्तर पर है — ${gasReadings.H2S} ppm`);
    if (gasReadings.CO   >= 200) reasons.push(`CO गैस खतरनाक स्तर पर है — ${gasReadings.CO} ppm`);
    if (gasReadings.O2   < 19.5) reasons.push(`ऑक्सीजन का स्तर कम है — ${gasReadings.O2}%`);
    if (gasReadings.CH4  >= 25)  reasons.push(`मीथेन गैस खतरे के स्तर पर है — ${gasReadings.CH4}% LEL`);
    if (gasReadings.WATER >= 30) reasons.push(`मैनहोल में पानी भर रहा है — ${gasReadings.WATER} सेंटीमीटर`);
  }

  const priority = reasons.length >= 2 ? 'high'
                 : reasons.length === 1 ? 'medium'
                 : 'low';

  const isHighRisk = priority !== 'low';

  // The spoken Hindi sentence — concise enough for a short TTS clip
  const speakText = isHighRisk
    ? `सावधान! ${reasons[0]}. ${STANDARD_TIPS[2]}`
    : 'सब ठीक है। PPE पहनें और सावधान रहें।';

  return {
    priority,
    title:   isHighRisk ? '⚠️ उच्च जोखिम का काम' : 'ℹ️ सामान्य जोखिम',
    reasons,
    tips:    [...STANDARD_TIPS],
    speak:   speakText,
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
    source: 'weather',
  };
}

module.exports = { evaluateRisk, buildWeatherAdvisory };

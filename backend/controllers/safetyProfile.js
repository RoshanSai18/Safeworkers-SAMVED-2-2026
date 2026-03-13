// Safety Profile Controller
// Builds a worker's full "Safety Diary" profile from mock data.
// Calculates Safety Strength score, awards badges, and generates
// dignity-first Hindi reinforcement messages.

const { getWorkerDiaryData } = require('../data/safetyDiary');

// ── Badge definitions ───────────────────────────────────────────────────────
// condition(profile) receives the intermediate profile object and returns bool.
const BADGE_DEFS = [
  {
    id:        'first_step',
    emoji:     '🦶',
    label:     'पहला कदम',
    desc:      'पहली बार सुरक्षित काम पूरा किया',
    condition: (p) => p.totalJobs >= 1,
  },
  {
    id:        'brave_heart',
    emoji:     '🛡️',
    label:     'निडर योद्धा',
    desc:      'उच्च जोखिम वाला काम सफलतापूर्वक पूरा किया',
    condition: (p) => p.highRiskCompleted >= 1,
  },
  {
    id:        'eagle_eye',
    emoji:     '👁️',
    label:     'सुरक्षा प्रहरी',
    desc:      '3 या अधिक बार खतरे की सूचना दी',
    condition: (p) => p.proactiveReports >= 3,
  },
  {
    id:        'checklist_champ',
    emoji:     '✅',
    label:     'चेकलिस्ट चैम्पियन',
    desc:      '5 या अधिक बार पूरी जाँच करके मैनहोल में उतरे',
    condition: (p) => p.checklistCount >= 5,
  },
  {
    id:        'streak_30',
    emoji:     '🔥',
    label:     '30 दिन सुरक्षित',
    desc:      '30 दिनों में कोई गंभीर घटना नहीं',
    condition: (p) => p.incidentFreeDays >= 30,
  },
  {
    id:        'safety_star',
    emoji:     '⭐',
    label:     'सुरक्षा सितारा',
    desc:      'सुरक्षा स्कोर 50 अंक पार',
    condition: (p) => p.displayScore >= 50,
  },
  {
    id:        'elite_worker',
    emoji:     '🏆',
    label:     'श्रेष्ठ कर्मचारी',
    desc:      'सुरक्षा स्कोर 80 अंक पार — शीर्ष स्तर',
    condition: (p) => p.displayScore >= 80,
  },
];

// ── Main builder ────────────────────────────────────────────────────────────
/**
 * Builds a fully-populated safety profile for a given workerId.
 * This is the function that replaces the localStorage-based buildSafetyProfile().
 *
 * @param {number} workerId
 * @returns {object} Safety profile payload
 */
function buildSafetyProfile(workerId) {
  const data = getWorkerDiaryData(workerId);

  // ── Core metrics (mirrors reference formula) ──────────────────
  const highRiskCompleted = data.completedJobs.filter(j => j.risk === 'HIGH').length;
  const proactiveReports  = data.hazardReports.length;
  const checklistCount    = data.completedChecklists;
  const totalJobs         = data.completedJobs.length;

  // Raw score (reference: highRisk*3 + hazard*2 + checklists*1)
  const rawScore = highRiskCompleted * 3 + proactiveReports * 2 + checklistCount;

  // Normalized 0–100 display score (soft cap via multiplier)
  const displayScore = Math.min(100, Math.round(rawScore * 2.5));

  // ── Days incident-free ─────────────────────────────────────────
  const today = new Date();
  const sinceDate = data.lastIncidentDate
    ? new Date(data.lastIncidentDate)
    : new Date(data.joinDate);
  const incidentFreeDays = Math.max(0, Math.floor((today - sinceDate) / 86_400_000));

  // ── Partial profile used by badge conditions ───────────────────
  const partial = {
    totalJobs,
    highRiskCompleted,
    proactiveReports,
    checklistCount,
    incidentFreeDays,
    rawScore,
    displayScore,
  };

  // ── Award earned badges  ───────────────────────────────────────
  const earnedBadges  = BADGE_DEFS
    .filter(b => b.condition(partial))
    .map(({ condition: _c, ...b }) => ({ ...b, earned: true }));

  const lockedBadges  = BADGE_DEFS
    .filter(b => !b.condition(partial))
    .map(({ condition: _c, ...b }) => ({ ...b, earned: false }));

  // ── Hindi reinforcement messages ───────────────────────────────
  const messages = [];
  if (incidentFreeDays >= 30) {
    messages.push(`पिछले ${incidentFreeDays} दिनों से कोई गंभीर घटना नहीं – बहुत अच्छा काम!`);
  } else if (incidentFreeDays >= 7) {
    messages.push(`पिछले ${incidentFreeDays} दिन से आप लगातार सुरक्षित काम कर रहे हैं – शाबाश!`);
  }
  if (highRiskCompleted >= 3) {
    messages.push('उच्च जोखिम वाले काम में भी आप सुरक्षित रहे – यही असली हिम्मत है!');
  }
  if (proactiveReports >= 2) {
    messages.push('आपने समय पर खतरे की सूचना देकर साथियों को बचाया – बहुत जिम्मेदाराना काम!');
  }
  if (checklistCount >= 5) {
    messages.push('हर बार पूरी जाँच करके उतरना – आपकी यह आदत सबके लिए मिसाल है!');
  }
  if (displayScore >= 80) {
    messages.push('आप हमारे सबसे सुरक्षित कर्मचारियों में से एक हैं – बहुत बढ़िया!');
  } else if (displayScore >= 50) {
    messages.push('आपका सुरक्षा स्कोर बढ़ रहा है – इसी तरह काम करते रहें!');
  }
  if (messages.length === 0) {
    messages.push('अपनी सुरक्षा डायरी बनाना शुरू करें – हर सुरक्षित दिन मायने रखता है!');
  }

  // ── Return full profile ────────────────────────────────────────
  return {
    workerId,
    displayScore,
    rawScore,
    highRiskCompleted,
    proactiveReports,
    checklistCount,
    totalJobs,
    incidentFreeDays,
    badges:     [...earnedBadges, ...lockedBadges],
    messages,
    recentJobs: data.completedJobs.slice(0, 5),
    joinDate:   data.joinDate,
  };
}

module.exports = { buildSafetyProfile };

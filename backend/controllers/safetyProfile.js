// Safety Profile Controller
// Builds a worker's full "Safety Diary" profile from mock data.
// Calculates Safety Strength score, awards badges, and generates
// dignity-first Hindi reinforcement messages + weekly coaching cards.

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

const ROLE_DEFAULT_HABITS = {
  starter: [
    {
      id: 'starter_checklist',
      titleHi: 'हर काम से पहले 45-सेकंड डबल-चेक',
      actionHi: 'PPE और गैस मीटर चेकलिस्ट को जोर से पढ़कर टिक करें।',
      reasonHi: 'शुरुआती चरण में यही आदत सबसे तेज़ सुरक्षा सुधार देती है।',
      projectedGain: 5,
      priority: 80,
    },
    {
      id: 'starter_report',
      titleHi: 'हर शिफ्ट में 1 सुरक्षा अवलोकन रिपोर्ट करें',
      actionHi: 'गैस, पानी या दीवार की असामान्यता दिखे तो तुरंत रिपोर्ट करें।',
      reasonHi: 'समय पर रिपोर्ट से घटना बनने से पहले खतरा रुकता है।',
      projectedGain: 4,
      priority: 78,
    },
  ],
  steady_operator: [
    {
      id: 'steady_prebrief',
      titleHi: 'एंट्री से पहले 2-मिनट बडी ब्रीफिंग',
      actionHi: 'गैस रीडिंग, निकासी मार्ग और SOS भूमिका पहले तय करें।',
      reasonHi: 'ब्रीफिंग से टीम समन्वय बेहतर होता है और प्रतिक्रिया समय घटता है।',
      projectedGain: 4,
      priority: 77,
    },
    {
      id: 'steady_hazard_eye',
      titleHi: 'सप्ताह में 2 बार खतरा-स्कैन रूटीन',
      actionHi: 'काम शुरू होने से पहले 30-सेकंड में पानी, दीवार और गैस पर फोकस करें।',
      reasonHi: 'माइक्रो-स्कैन से छूटने वाले जोखिम जल्दी पकड़े जाते हैं।',
      projectedGain: 3,
      priority: 76,
    },
  ],
  high_risk_operator: [
    {
      id: 'highrisk_buddy_callout',
      titleHi: 'हर HIGH जॉब में डबल-कॉलआउट अपनाएं',
      actionHi: 'रीडिंग बोलकर सुनाएं और साथी से दोबारा पुष्टि करवाएं।',
      reasonHi: 'उच्च जोखिम में दो-स्तरीय पुष्टि मानव त्रुटि कम करती है।',
      projectedGain: 5,
      priority: 82,
    },
    {
      id: 'highrisk_recheck',
      titleHi: 'वेंटिलेशन के बाद अनिवार्य री-चेक',
      actionHi: 'ब्लोअर चलाने के 2 मिनट बाद गैस माप दोबारा लें।',
      reasonHi: 'री-चेक से फंसी हुई गैस का जोखिम कम होता है।',
      projectedGain: 4,
      priority: 81,
    },
  ],
  safety_anchor: [
    {
      id: 'anchor_peer_review',
      titleHi: 'हर सप्ताह 1 पीयर-सेफ्टी रिव्यू करें',
      actionHi: 'एक साथी की एंट्री चेकलिस्ट और गैस-पुष्टि प्रक्रिया cross-check करें।',
      reasonHi: 'लीड स्तर पर peer review पूरी टीम की सुरक्षा बढ़ाता है।',
      projectedGain: 3,
      priority: 74,
    },
    {
      id: 'anchor_pattern_note',
      titleHi: '2 near-miss patterns डायरी में दर्ज करें',
      actionHi: 'सप्ताह के अंत में दो दोहराने वाले जोखिम कारण लिखें।',
      reasonHi: 'पैटर्न पहचान से भविष्य के जोखिम पहले ही रोके जा सकते हैं।',
      projectedGain: 3,
      priority: 73,
    },
  ],
  high_risk_lead: [
    {
      id: 'lead_hotzone_huddle',
      titleHi: 'उच्च जोखिम कार्य से पहले 90-सेकंड हडल',
      actionHi: 'टीम को एक लाइन में exit-plan, gas-plan और SOS plan दोहराएं।',
      reasonHi: 'नेतृत्व-स्तर हडल से आपातकालीन निर्णयों में देरी घटती है।',
      projectedGain: 4,
      priority: 83,
    },
    {
      id: 'lead_signal_log',
      titleHi: 'हर HIGH जॉब का सिग्नल-लॉग बनाए रखें',
      actionHi: 'H2S/CO/O2 ट्रेंड को 3 checkpoints पर नोट करें।',
      reasonHi: 'डेटा अनुशासन से अगली टीम की जोखिम तैयारी बेहतर होती है।',
      projectedGain: 3,
      priority: 79,
    },
  ],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getWeekRange() {
  const today = new Date();
  const day = today.getDay() || 7; // Sunday -> 7
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day + 1); // Monday
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

function formatHiDayMonth(date) {
  return date.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' });
}

function pickRoleProfile(profile, rates) {
  if (profile.displayScore >= 80 && rates.highRiskRate >= 0.4) {
    return {
      key: 'high_risk_lead',
      labelHi: 'उच्च जोखिम लीड',
      labelEn: 'High-Risk Lead',
      toneHi: 'आप मजबूत स्तर पर हैं, अब टीम-स्तर सुरक्षा आदतों को स्थिर रखना फोकस है।',
    };
  }
  if (profile.displayScore >= 80) {
    return {
      key: 'safety_anchor',
      labelHi: 'सुरक्षा एंकर',
      labelEn: 'Safety Anchor',
      toneHi: 'आपका स्कोर अच्छा है, अब consistency और peer support से बढ़त बनाए रखें।',
    };
  }
  if (profile.displayScore >= 50 && rates.highRiskRate >= 0.35) {
    return {
      key: 'high_risk_operator',
      labelHi: 'उच्च जोखिम ऑपरेटर',
      labelEn: 'High-Risk Operator',
      toneHi: 'उच्च जोखिम कार्य में आपकी भागीदारी अधिक है, इसलिए disciplined re-check सबसे जरूरी है।',
    };
  }
  if (profile.displayScore >= 50) {
    return {
      key: 'steady_operator',
      labelHi: 'स्थिर ऑपरेटर',
      labelEn: 'Steady Operator',
      toneHi: 'आपकी प्रगति अच्छी है, दो माइक्रो-आदतें इसे अगले स्तर तक ले जाएंगी।',
    };
  }
  return {
    key: 'starter',
    labelHi: 'सुरक्षा स्टार्ट',
    labelEn: 'Safety Starter',
    toneHi: 'बेसिक अनुशासन पर फोकस करके इस हफ्ते तेज़ सुधार हासिल किया जा सकता है।',
  };
}

function buildHabitCandidates(profile, rates) {
  const candidates = [];
  const checklistGap = clamp(1 - rates.checklistRate, 0, 1);
  const reportGap = clamp(0.35 - rates.reportRate, 0, 0.35) / 0.35;

  if (checklistGap > 0.05 || profile.checklistCount < 5) {
    candidates.push({
      id: 'checklist_rhythm',
      titleHi: 'हर एंट्री से पहले 45-सेकंड डबल-चेक',
      actionHi: 'PPE, गैस मीटर और निकासी मार्ग को क्रम से verify करें।',
      reasonHi: 'डबल-चेक अनुशासन छोटी गलती को बड़ी घटना बनने से रोकता है।',
      projectedGain: 3 + Math.round(checklistGap * 3),
      priority: 95 + checklistGap * 15,
    });
  }

  if (reportGap > 0 || profile.proactiveReports < 2) {
    candidates.push({
      id: 'proactive_report',
      titleHi: 'हर शिफ्ट में कम से कम 1 सुरक्षा रिपोर्ट',
      actionHi: 'गैस, पानी या संरचना में हल्का बदलाव भी तुरंत लॉग करें।',
      reasonHi: 'प्रोएक्टिव रिपोर्टिंग से टीम को early-warning मिलता है।',
      projectedGain: 3 + Math.round(reportGap * 2),
      priority: 92 + reportGap * 14,
    });
  }

  if (rates.highRiskRate >= 0.35) {
    candidates.push({
      id: 'high_risk_brief',
      titleHi: 'हर HIGH जॉब से पहले 2-मिनट बडी ब्रीफ',
      actionHi: 'गैस सीमा, exit signal और SOS जिम्मेदारी पहले तय करें।',
      reasonHi: 'उच्च जोखिम कार्य में pre-brief टीम की प्रतिक्रिया क्षमता बढ़ाता है।',
      projectedGain: 4,
      priority: 90 + rates.highRiskRate * 10,
    });
  }

  if (profile.incidentFreeDays < 30) {
    const streakGap = clamp((30 - profile.incidentFreeDays) / 30, 0, 1);
    candidates.push({
      id: 'streak_reset',
      titleHi: 'अगले 7 दिन नो-शॉर्टकट सेफ्टी रूटीन',
      actionHi: 'हर कार्य-चरण पर checklist pause लें और जल्दबाज़ी से बचें।',
      reasonHi: 'घटना-मुक्त streak वापस बनाने का सबसे तेज़ तरीका consistency है।',
      projectedGain: 4 + Math.round(streakGap),
      priority: 91 + streakGap * 12,
    });
  }

  if (profile.displayScore >= 80) {
    candidates.push({
      id: 'mentor_touchpoint',
      titleHi: 'सप्ताह में 1 peer safety touchpoint',
      actionHi: 'एक साथी के साथ pre-entry routine cross-check करें।',
      reasonHi: 'उच्च स्कोर बनाए रखने में peer accountability मदद करती है।',
      projectedGain: 3,
      priority: 84,
    });
  }

  return candidates;
}

function buildWeeklyCoach(profile) {
  const jobsBase = Math.max(profile.totalJobs, 1);
  const rates = {
    checklistRate: clamp(profile.checklistCount / jobsBase, 0, 1.2),
    reportRate: clamp(profile.proactiveReports / jobsBase, 0, 1),
    highRiskRate: clamp(profile.highRiskCompleted / jobsBase, 0, 1),
  };

  const role = pickRoleProfile(profile, rates);
  const dynamicCandidates = buildHabitCandidates(profile, rates);
  const defaults = ROLE_DEFAULT_HABITS[role.key] || ROLE_DEFAULT_HABITS.steady_operator;

  const uniqueCandidates = [...dynamicCandidates, ...defaults]
    .filter((item, index, all) => all.findIndex((v) => v.id === item.id) === index)
    .sort((a, b) => (b.priority - a.priority) || (b.projectedGain - a.projectedGain));

  const habits = uniqueCandidates.slice(0, 2).map(({ priority: _priority, ...habit }, index) => ({
    ...habit,
    order: index + 1,
  }));

  const projectedScoreDelta = clamp(
    habits.reduce((sum, habit) => sum + (habit.projectedGain || 0), 0),
    2,
    16
  );
  const projectedTargetScore = clamp(profile.displayScore + projectedScoreDelta, 0, 100);
  const week = getWeekRange();

  return {
    weekKey: week.start.toISOString().split('T')[0],
    weekLabelHi: `${formatHiDayMonth(week.start)} - ${formatHiDayMonth(week.end)}`,
    roleKey: role.key,
    roleLabelHi: role.labelHi,
    roleLabelEn: role.labelEn,
    coachToneHi: role.toneHi,
    projectedScoreDelta,
    projectedTargetScore,
    headlineHi: `इस हफ्ते ये 2 आदतें अपनाएं, सुरक्षा स्कोर लगभग +${projectedScoreDelta} बढ़ सकता है।`,
    headlineEn: `Do these 2 habits to increase your safety score by +${projectedScoreDelta}.`,
    habits,
  };
}

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

  const weeklyCoach = buildWeeklyCoach(partial);

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
    weeklyCoach,
    recentJobs: data.completedJobs.slice(0, 5),
    joinDate:   data.joinDate,
  };
}

module.exports = { buildSafetyProfile };

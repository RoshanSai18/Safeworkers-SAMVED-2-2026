const { GoogleGenerativeAI } = require('@google/generative-ai');

function normalizeLang(lang = 'en') {
  return String(lang || 'en').toLowerCase().startsWith('hi') ? 'hi' : 'en';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function extractSnapshotMetrics(snapshot = {}) {
  const jobs = Array.isArray(snapshot.jobs) ? snapshot.jobs : [];

  const totalJobs = Number.isFinite(snapshot.totalJobs)
    ? Number(snapshot.totalJobs)
    : jobs.length;

  const highRiskJobs = Number.isFinite(snapshot.highRiskJobs)
    ? Number(snapshot.highRiskJobs)
    : jobs.filter(j => String(j.risk || '').toLowerCase().includes('high')).length;

  const mediumRiskJobs = Number.isFinite(snapshot.mediumRiskJobs)
    ? Number(snapshot.mediumRiskJobs)
    : jobs.filter(j => String(j.risk || '').toLowerCase().includes('medium')).length;

  const lowRiskJobs = Math.max(0, totalJobs - highRiskJobs - mediumRiskJobs);

  const highRiskRatio = totalJobs > 0
    ? highRiskJobs / totalJobs
    : Number(snapshot.highRiskRatio || 0);

  const incidentCount = Number.isFinite(snapshot.incidentCount)
    ? Number(snapshot.incidentCount)
    : 0;

  const hazardousWastePct = Number.isFinite(snapshot.hazardousWastePct)
    ? Number(snapshot.hazardousWastePct)
    : 0;

  const ppeCompliance = Number.isFinite(snapshot.ppeCompliance)
    ? Number(snapshot.ppeCompliance)
    : clamp(Math.round(98 - incidentCount * 2 - hazardousWastePct * 20), 70, 99);

  const incidentTrend = Array.isArray(snapshot.incidentTrend) ? snapshot.incidentTrend : [];
  const trendDelta = incidentTrend.length >= 2
    ? Number(incidentTrend[incidentTrend.length - 1]) - Number(incidentTrend[0])
    : 0;

  return {
    totalJobs,
    highRiskJobs,
    mediumRiskJobs,
    lowRiskJobs,
    highRiskRatio,
    incidentCount,
    hazardousWastePct,
    ppeCompliance,
    incidentTrend,
    trendDelta,
  };
}

function computeRiskIndex(metrics) {
  const highRiskScore = clamp(metrics.highRiskRatio, 0, 1) * 45;
  const wasteScore = clamp(metrics.hazardousWastePct, 0, 1) * 30;
  const incidentScore = clamp(metrics.incidentCount, 0, 10) / 10 * 15;
  const complianceScore = (100 - clamp(metrics.ppeCompliance, 0, 100)) / 100 * 10;

  const riskIndex = clamp(
    Math.round(highRiskScore + wasteScore + incidentScore + complianceScore),
    0,
    100
  );

  if (riskIndex >= 70) {
    return { riskIndex, level: 'critical', actionPriority: 'immediate' };
  }
  if (riskIndex >= 45) {
    return { riskIndex, level: 'elevated', actionPriority: 'this_week' };
  }
  return { riskIndex, level: 'stable', actionPriority: 'monitor' };
}

function buildEvidence(ward, snapshot = {}) {
  const metrics = extractSnapshotMetrics(snapshot);
  const risk = computeRiskIndex(metrics);
  return {
    ward,
    ...metrics,
    highRiskRatioPct: round2(metrics.highRiskRatio * 100),
    hazardousWastePctValue: round2(metrics.hazardousWastePct * 100),
    ...risk,
  };
}

function buildPrompt(evidence, lang = 'en') {
  const languageInstruction = lang === 'hi'
    ? 'Respond in Hindi (Devanagari). Keep all numbers unchanged.'
    : 'Respond in English.';

  return `You are SafeWorker AI, generating ward-level decision support for a city sanitation admin.

${languageInstruction}

Evidence for ward ${evidence.ward}:
- Total jobs: ${evidence.totalJobs}
- High-risk jobs: ${evidence.highRiskJobs}
- Medium-risk jobs: ${evidence.mediumRiskJobs}
- Low-risk jobs: ${evidence.lowRiskJobs}
- High-risk ratio: ${evidence.highRiskRatioPct}%
- Incident count (30d): ${evidence.incidentCount}
- Hazardous waste ratio: ${evidence.hazardousWastePctValue}%
- PPE compliance: ${evidence.ppeCompliance}%
- Trend delta (latest minus earliest): ${evidence.trendDelta}
- Risk index: ${evidence.riskIndex}/100
- Risk level: ${evidence.level}
- Action priority: ${evidence.actionPriority}

Task:
1) Give a short evidence snapshot (3 bullets max).
2) Explain the main risk drivers (3 bullets max).
3) Provide exactly 3 operational actions with clear verbs.
4) End with a one-line priority recommendation.

Formatting:
- Use markdown headings and bullets.
- Keep it concise (<= 170 words).
- Do not invent values beyond the evidence above.`;
}

function fallbackAnalysis(evidence, lang = 'en') {
  if (lang === 'hi') {
    return `### Evidence Snapshot
- वार्ड ${evidence.ward}: कुल ${evidence.totalJobs} जॉब्स में से ${evidence.highRiskJobs} हाई-रिस्क हैं (${evidence.highRiskRatioPct}%).
- पिछले 30 दिनों में ${evidence.incidentCount} घटनाएं दर्ज हुईं; PPE compliance ${evidence.ppeCompliance}% है.
- Hazardous waste ratio ${evidence.hazardousWastePctValue}% है और risk index ${evidence.riskIndex}/100 है.

### Risk Drivers
- हाई-रिस्क जॉब अनुपात और incident count risk को ऊपर ले जा रहे हैं.
- Hazardous waste ratio operational exposure को बढ़ा रहा है.
- Compliance gap (100-${evidence.ppeCompliance}%) residual risk बनाए रखता है.

### Recommended Actions
- गैस टेस्ट और pre-entry checklist को ward-wide mandatory करें.
- High-risk jobs के लिए rotation cap लागू करें.
- PPE audit और supervisor escalation dashboard daily चलाएं.

**Priority:** ${evidence.actionPriority} action for ward ${evidence.ward}.`;
  }

  return `### Evidence Snapshot
- Ward ${evidence.ward} has ${evidence.highRiskJobs}/${evidence.totalJobs} high-risk jobs (${evidence.highRiskRatioPct}%).
- 30-day incidents are ${evidence.incidentCount}; PPE compliance is ${evidence.ppeCompliance}%.
- Hazardous waste ratio is ${evidence.hazardousWastePctValue}%, with risk index ${evidence.riskIndex}/100.

### Risk Drivers
- High-risk workload concentration is increasing exposure.
- Incident volume and hazardous waste share elevate operational risk.
- Compliance gap is sustaining residual risk.

### Recommended Actions
- Enforce gas-test and pre-entry checklist for all deployments.
- Cap high-risk assignments per worker through rotation.
- Run daily PPE audit and supervisor escalation tracking.

**Priority:** ${evidence.actionPriority} action for ward ${evidence.ward}.`;
}

function hasDevanagari(text = '') {
  return /[\u0900-\u097F]/.test(text);
}

async function ensureHindi(model, text) {
  const source = String(text || '').trim();
  if (!source) return source;
  if (hasDevanagari(source)) return source;

  const translationPrompt = `Translate the text below into Hindi (Devanagari).\n\nRules:\n1. Keep numbers and metric values unchanged.\n2. Keep markdown headings and bullets.\n3. Return only translated content.\n\nText:\n${source}`;

  try {
    const translated = await model.generateContent(translationPrompt);
    return translated.response.text()?.trim() || source;
  } catch {
    return source;
  }
}

async function generateAnalysis(evidence, lang) {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackAnalysis(evidence, lang);
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  try {
    const response = await model.generateContent(buildPrompt(evidence, lang));
    let text = response.response.text()?.trim();
    if (!text) text = fallbackAnalysis(evidence, lang);

    if (lang === 'hi') {
      text = await ensureHindi(model, text);
    }

    return text;
  } catch {
    return fallbackAnalysis(evidence, lang);
  }
}

async function getWardIntelligence(input = {}) {
  const ward = String(input.ward || '').trim();
  if (!ward) throw new Error('ward is required');

  const lang = normalizeLang(input.lang);
  const evidence = buildEvidence(ward, input.wardSnapshot || {});
  const analysis = await generateAnalysis(evidence, lang);

  return {
    success: true,
    ward,
    lang,
    evidence,
    analysis,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getWardIntelligence };

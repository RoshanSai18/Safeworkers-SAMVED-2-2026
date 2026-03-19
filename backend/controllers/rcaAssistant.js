const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildIncidentPostmortem } = require('./incidentPostmortem');

function normalizeLang(lang = 'hi') {
  return String(lang || 'hi').toLowerCase().startsWith('en') ? 'en' : 'hi';
}

function normalizeIncidentContext(incident = {}) {
  return {
    incidentId: incident.incidentId || `inc-${Date.now()}`,
    eventType: String(incident.eventType || incident.type || 'INCIDENT').toUpperCase(),
    severity: String(incident.severity || 'medium').toLowerCase(),
    workerId: incident.workerId ?? null,
    workerName: incident.workerName || 'Worker',
    badge: incident.badge || 'N/A',
    zone: incident.zone || 'Zone N/A',
    location: incident.location || incident.address || 'Field location',
    eventTime: incident.eventTime || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    hazard: incident.hazard || '',
    alertMessage: incident.alertMessage || incident.msg || '',
  };
}

function buildInterviewGuide(incident = {}) {
  const isGas = /gas|h2s|co|o2|ch4/i.test(String(incident.hazard || '')) || incident.eventType === 'AUTO_GAS';
  const isSos = incident.eventType === 'SOS' || incident.eventType === 'SOS_MANUAL';

  const guide = [
    {
      id: 'pre_event_signals',
      questionHi: 'घटना से 2-3 मिनट पहले कौन से चेतावनी संकेत दिखे?',
      questionEn: 'What warning signs were observed 2-3 minutes before the incident?',
      hintHi: 'जैसे गैस मीटर रीडिंग, गंध, चक्कर, पानी भरना, या दृश्य संकेत।',
      hintEn: 'Examples: gas meter values, odor, dizziness, rising water, or visible cues.',
    },
    {
      id: 'sop_status',
      questionHi: 'क्या pre-entry checklist, PPE और गैस टेस्ट SOP के अनुसार पूरे हुए थे?',
      questionEn: 'Were pre-entry checklist, PPE, and gas-test SOP steps completed correctly?',
      hintHi: 'यदि कोई स्टेप छूटा तो स्पष्ट लिखें।',
      hintEn: 'If any step was skipped, mention it explicitly.',
    },
    {
      id: 'equipment_and_environment',
      questionHi: 'उपकरण और साइट की स्थिति में क्या समस्या थी?',
      questionEn: 'What issue was observed in equipment condition or site environment?',
      hintHi: 'Ventilation, calibration, drainage, access, signal, lighting आदि।',
      hintEn: 'Ventilation, calibration, drainage, access, signal, lighting, etc.',
    },
    {
      id: 'response_actions',
      questionHi: 'घटना के तुरंत बाद टीम ने कौन-कौन से कदम उठाए?',
      questionEn: 'What immediate response actions were taken by the team?',
      hintHi: 'Alert, evacuation, medical check, supervisor call, area cordon।',
      hintEn: 'Alerting, evacuation, medical check, supervisor call, area cordon.',
    },
    {
      id: 'prevention_commitments',
      questionHi: 'इसी तरह की घटना रोकने के लिए अगले 24 घंटे में कौन से 2-3 उपाय करेंगे?',
      questionEn: 'What 2-3 measures will be implemented in the next 24 hours to prevent recurrence?',
      hintHi: 'स्पष्ट owner और due window सोचकर लिखें।',
      hintEn: 'Write concrete actions with clear owners and due windows.',
    },
  ];

  if (isGas) {
    guide.push({
      id: 'gas_control_validation',
      questionHi: 'Ventilation और gas re-check cycle कितने अंतराल पर चलाया गया?',
      questionEn: 'At what interval was the ventilation and gas re-check cycle executed?',
      hintHi: 'उदाहरण: हर 2 मिनट, entry से पहले/बाद, alarm threshold पर।',
      hintEn: 'Example: every 2 minutes, before/after entry, on alarm threshold.',
    });
  }

  if (isSos) {
    guide.push({
      id: 'sos_trigger_reason',
      questionHi: 'SOS ट्रिगर करने का मुख्य कारण क्या था?',
      questionEn: 'What was the main reason for triggering SOS?',
      hintHi: 'मानव कारक, उपकरण समस्या, या पर्यावरणीय जोखिम में से बताएं।',
      hintEn: 'Specify whether it was human factor, equipment issue, or environmental risk.',
    });
  }

  return guide;
}

function buildAnswerDigest(interviewGuide = [], interviewAnswers = {}) {
  return interviewGuide
    .map((q) => {
      const answer = String(interviewAnswers[q.id] || '').trim();
      if (!answer) return null;
      return {
        id: q.id,
        questionHi: q.questionHi,
        questionEn: q.questionEn,
        answer,
      };
    })
    .filter(Boolean);
}

function derivePreventiveMeasures(incident = {}, similarIncidents = [], answerDigest = []) {
  const hi = [];
  const en = [];

  const push = (h, e) => {
    if (!hi.includes(h)) hi.push(h);
    if (!en.includes(e)) en.push(e);
  };

  const hazardText = [incident.hazard, ...similarIncidents.map(i => i.hazard || '')].join(' ').toLowerCase();
  const sosCount = similarIncidents.filter(i => String(i.eventType || '').toUpperCase().includes('SOS')).length;
  const gasLike = /gas|h2s|co|o2|ch4/.test(hazardText) || String(incident.eventType || '').toUpperCase() === 'AUTO_GAS';
  const waterLike = /water|flood|drain/.test(hazardText);

  if (gasLike) {
    push(
      'हर HIGH जॉब में ventilation + 2-minute gas re-check loop अनिवार्य करें।',
      'Enforce ventilation plus a 2-minute gas re-check loop for every HIGH-risk job.'
    );
    push(
      'शिफ्ट शुरू होने से पहले गैस मीटर calibration log अनिवार्य रूप से verify करें।',
      'Mandate gas meter calibration log verification before each shift.'
    );
  }

  if (waterLike) {
    push(
      'Entry से पहले drainage clearance और dewatering readiness checklist जोड़ें।',
      'Add drainage clearance and dewatering readiness checks before entry.'
    );
  }

  if (sosCount >= 1 || String(incident.eventType || '').toUpperCase().includes('SOS')) {
    push(
      'हर टीम के लिए 90-second emergency role-call और exit drill weekly चलाएं।',
      'Run a weekly 90-second emergency role-call and exit drill for each team.'
    );
  }

  const answerText = answerDigest.map(a => a.answer.toLowerCase()).join(' ');
  if (/ventilation|ब्लोअर|blower/.test(answerText)) {
    push(
      'ब्लोअर availability और backup power readiness को pre-entry gate में शामिल करें।',
      'Include blower availability and backup power readiness in the pre-entry gate.'
    );
  }
  if (/ppe|helmet|glove|vest|चेकलिस्ट/.test(answerText)) {
    push(
      'PPE non-compliance पर zero-tolerance और photo-verified checklist लागू करें।',
      'Apply zero-tolerance PPE compliance with photo-verified checklists.'
    );
  }

  push(
    'घटना के 24 घंटे भीतर team briefing करके corrective actions की ownership assign करें।',
    'Conduct a team briefing within 24 hours and assign owners for corrective actions.'
  );

  return {
    hi: hi.slice(0, 4),
    en: en.slice(0, 4),
  };
}

function toRcaMarkdown(report = {}, lang = 'hi') {
  const timeline = lang === 'en' ? report.timelineEn : report.timelineHi;
  const rootCause = lang === 'en' ? report.rootCauseEn : report.rootCauseHi;
  const actions = lang === 'en' ? report.correctiveActionsEn : report.correctiveActionsHi;
  const preventive = lang === 'en' ? report.preventiveMeasuresEn : report.preventiveMeasuresHi;
  const confidence = lang === 'en' ? report.confidenceEn : report.confidenceHi;

  const timelineBlock = (timeline || []).map((t) => `- ${t}`).join('\n');
  const actionsBlock = (actions || [])
    .map((a) => `- **${a.action}** (Owner: ${a.owner}, Due: ${a.due})`)
    .join('\n');
  const preventiveBlock = (preventive || []).map((p) => `- ${p}`).join('\n');

  return `### ${lang === 'en' ? 'Incident Timeline' : 'घटना टाइमलाइन'}\n${timelineBlock}\n\n### ${lang === 'en' ? 'Probable Root Cause' : 'संभावित मूल कारण'}\n- ${rootCause}\n\n### ${lang === 'en' ? 'Corrective Actions' : 'सुधारात्मक कदम'}\n${actionsBlock}\n\n### ${lang === 'en' ? 'Preventive Measures (from similar incidents)' : 'रोकथाम उपाय (समान घटनाओं से)'}\n${preventiveBlock}\n\n**${lang === 'en' ? 'Confidence' : 'विश्वास'}:** ${confidence}`;
}

async function buildFallbackRcaReport(incident = {}, similarIncidents = [], answerDigest = []) {
  const [pmHi, pmEn] = await Promise.all([
    buildIncidentPostmortem(incident, 'hi'),
    buildIncidentPostmortem(incident, 'en'),
  ]);

  const preventive = derivePreventiveMeasures(incident, similarIncidents, answerDigest);

  return {
    rootCauseHi: pmHi.probableRootCause,
    rootCauseEn: pmEn.probableRootCause,
    timelineHi: pmHi.timeline,
    timelineEn: pmEn.timeline,
    correctiveActionsHi: pmHi.correctiveActions,
    correctiveActionsEn: pmEn.correctiveActions,
    preventiveMeasuresHi: preventive.hi,
    preventiveMeasuresEn: preventive.en,
    confidenceHi: String(pmHi.confidence || 'मध्यम'),
    confidenceEn: String(pmEn.confidence || 'Medium'),
  };
}

async function generateRcaWithModel({ incident, interviewGuide, answerDigest, similarIncidents }) {
  if (!process.env.GEMINI_API_KEY) return null;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const interviewSummary = answerDigest.length > 0
    ? answerDigest.map((item, idx) => `${idx + 1}. ${item.questionEn}\nAnswer: ${item.answer}`).join('\n\n')
    : 'No interview answers provided yet. Use available evidence and clearly note assumptions.';

  const similarSummary = similarIncidents.length > 0
    ? similarIncidents.map((s, idx) => `${idx + 1}. ${s.eventType} | ${s.severity} | ${s.zone} | ${s.hazard || 'N/A'} | ${s.alertMessage || 'N/A'}`).join('\n')
    : 'No similar incidents available.';

  const prompt = `You are SafeWorkers RCA Assistant.
Generate a bilingual root-cause analysis report (Hindi + English) from verified field evidence.

Current Incident:
- incidentId: ${incident.incidentId}
- eventType: ${incident.eventType}
- severity: ${incident.severity}
- workerName: ${incident.workerName}
- badge: ${incident.badge}
- zone: ${incident.zone}
- location: ${incident.location}
- eventTime: ${incident.eventTime}
- hazard: ${incident.hazard || 'N/A'}
- alertMessage: ${incident.alertMessage || 'N/A'}

Interview Answers:
${interviewSummary}

Similar Past Incidents:
${similarSummary}

Return strict JSON with this exact schema:
{
  "rootCauseHi": "...",
  "rootCauseEn": "...",
  "timelineHi": ["...", "...", "..."],
  "timelineEn": ["...", "...", "..."],
  "correctiveActionsHi": [
    {"action":"...","owner":"...","due":"..."},
    {"action":"...","owner":"...","due":"..."},
    {"action":"...","owner":"...","due":"..."}
  ],
  "correctiveActionsEn": [
    {"action":"...","owner":"...","due":"..."},
    {"action":"...","owner":"...","due":"..."},
    {"action":"...","owner":"...","due":"..."}
  ],
  "preventiveMeasuresHi": ["...", "...", "..."],
  "preventiveMeasuresEn": ["...", "...", "..."],
  "confidenceHi": "...",
  "confidenceEn": "..."
}

Rules:
- Keep all outputs practical and operations-focused.
- Use evidence and interview answers; if uncertain, stay conservative.
- Exactly 3 timeline points and 3 corrective actions in both languages.
- Exactly 3 preventive measures in both languages.
- No markdown and no text outside JSON.`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text()?.trim() || '';
    const clean = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(clean);

    const hasShape =
      Array.isArray(parsed.timelineHi) && parsed.timelineHi.length >= 3 &&
      Array.isArray(parsed.timelineEn) && parsed.timelineEn.length >= 3 &&
      Array.isArray(parsed.correctiveActionsHi) && parsed.correctiveActionsHi.length >= 3 &&
      Array.isArray(parsed.correctiveActionsEn) && parsed.correctiveActionsEn.length >= 3 &&
      Array.isArray(parsed.preventiveMeasuresHi) && parsed.preventiveMeasuresHi.length >= 3 &&
      Array.isArray(parsed.preventiveMeasuresEn) && parsed.preventiveMeasuresEn.length >= 3;

    if (!hasShape) return null;

    return {
      rootCauseHi: String(parsed.rootCauseHi || ''),
      rootCauseEn: String(parsed.rootCauseEn || ''),
      timelineHi: parsed.timelineHi.slice(0, 3).map(String),
      timelineEn: parsed.timelineEn.slice(0, 3).map(String),
      correctiveActionsHi: parsed.correctiveActionsHi.slice(0, 3).map((a) => ({
        action: String(a.action || ''),
        owner: String(a.owner || ''),
        due: String(a.due || ''),
      })),
      correctiveActionsEn: parsed.correctiveActionsEn.slice(0, 3).map((a) => ({
        action: String(a.action || ''),
        owner: String(a.owner || ''),
        due: String(a.due || ''),
      })),
      preventiveMeasuresHi: parsed.preventiveMeasuresHi.slice(0, 3).map(String),
      preventiveMeasuresEn: parsed.preventiveMeasuresEn.slice(0, 3).map(String),
      confidenceHi: String(parsed.confidenceHi || 'मध्यम'),
      confidenceEn: String(parsed.confidenceEn || 'Medium'),
    };
  } catch {
    return null;
  }
}

async function buildRcaAssistant({ incident = {}, interviewAnswers = {}, similarIncidents = [], lang = 'hi' } = {}) {
  const preferredLang = normalizeLang(lang);
  const normalizedIncident = normalizeIncidentContext(incident);
  const interviewGuide = buildInterviewGuide(normalizedIncident);
  const answerDigest = buildAnswerDigest(interviewGuide, interviewAnswers || {});

  const llmReport = await generateRcaWithModel({
    incident: normalizedIncident,
    interviewGuide,
    answerDigest,
    similarIncidents,
  });

  const fallback = await buildFallbackRcaReport(normalizedIncident, similarIncidents, answerDigest);
  const report = llmReport || fallback;

  return {
    preferredLang,
    incident: normalizedIncident,
    interviewGuide,
    answerDigest,
    similarIncidents: similarIncidents.slice(0, 5),
    report: {
      ...report,
      markdownHi: toRcaMarkdown(report, 'hi'),
      markdownEn: toRcaMarkdown(report, 'en'),
    },
  };
}

module.exports = {
  buildRcaAssistant,
  normalizeIncidentContext,
};

const { GoogleGenerativeAI } = require('@google/generative-ai');

function normalizeLang(lang = 'hi') {
  return String(lang || 'hi').toLowerCase().startsWith('en') ? 'en' : 'hi';
}

function formatTime(date = new Date()) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function inferCause(context = {}) {
  const eventType = String(context.eventType || '').toUpperCase();
  const hazard = String(context.hazard || '').toLowerCase();

  if (eventType === 'SOS_MANUAL') {
    return {
      hi: 'वर्कर ने उच्च जोखिम स्थिति महसूस कर SOS ट्रिगर किया; संभवतः confined-space में unsafe condition बनी।',
      en: 'Worker triggered SOS under perceived high-risk conditions, likely indicating unsafe confined-space status.',
    };
  }

  if (hazard.includes('gas')) {
    return {
      hi: 'गैस-संबंधित खतरे की रिपोर्ट से संकेत मिलता है कि toxic exposure या ventilation failure हुआ।',
      en: 'Gas-related hazard suggests toxic exposure risk or ventilation failure.',
    };
  }

  if (hazard.includes('flood') || hazard.includes('water')) {
    return {
      hi: 'पानी/बाढ़ रिपोर्ट से drainage surge या blocked flow का संकेत मिलता है।',
      en: 'Water/flood hazard suggests drainage surge or blocked flow conditions.',
    };
  }

  return {
    hi: 'ऑपरेशन के दौरान असुरक्षित field condition या SOP deviation की संभावना है।',
    en: 'Likely unsafe field condition or SOP deviation during operations.',
  };
}

function buildTimeline(context = {}, lang = 'hi') {
  const t = context.eventTime || formatTime(new Date());
  const workerLabel = `${context.workerName || 'Worker'} (${context.badge || context.workerId || 'N/A'})`;
  const zone = context.zone || 'Zone N/A';
  const location = context.location || 'Field location';

  if (lang === 'en') {
    return [
      `${t} - Alert captured from ${workerLabel} in ${zone} (${location}).`,
      `${t} - Supervisor alert fan-out completed via socket broadcast.`,
      `${t} - Immediate control protocol initiated (acknowledge, verify, and evacuate readiness).`,
    ];
  }

  return [
    `${t} - ${workerLabel} से ${zone} (${location}) में alert प्राप्त हुआ।`,
    `${t} - Supervisor टीम को socket broadcast के माध्यम से alert भेजा गया।`,
    `${t} - तत्काल नियंत्रण प्रोटोकॉल शुरू: acknowledge, verify, और evacuation readiness।`,
  ];
}

function buildActions(context = {}, lang = 'hi') {
  const severity = String(context.severity || 'medium').toLowerCase();
  const urgentHours = severity === 'critical' ? 2 : 6;

  if (lang === 'en') {
    return [
      {
        action: 'Run site verification checklist and confirm worker physiological status.',
        owner: 'Supervisor On Duty',
        due: `Within ${urgentHours} hours`,
      },
      {
        action: 'Inspect ventilation, gas-scan logs, and confined entry SOP compliance.',
        owner: 'Safety Officer',
        due: 'By end of shift',
      },
      {
        action: 'Document findings and schedule corrective briefing for the team.',
        owner: 'Ward Admin',
        due: 'Within 24 hours',
      },
    ];
  }

  return [
    {
      action: 'साइट verification checklist चलाकर worker की स्थिति तुरंत confirm करें।',
      owner: 'ड्यूटी सुपरवाइज़र',
      due: `${urgentHours} घंटे के भीतर`,
    },
    {
      action: 'Ventilation, gas-scan logs, और confined-entry SOP compliance की जांच करें।',
      owner: 'सेफ्टी ऑफिसर',
      due: 'शिफ्ट समाप्ति तक',
    },
    {
      action: 'फाइंडिंग्स दर्ज करें और corrective briefing शेड्यूल करें।',
      owner: 'वार्ड एडमिन',
      due: '24 घंटे के भीतर',
    },
  ];
}

function fallbackPostmortem(context = {}, lang = 'hi') {
  const cause = inferCause(context);
  const timeline = buildTimeline(context, lang);
  const actions = buildActions(context, lang);

  return {
    timeline,
    probableRootCause: lang === 'en' ? cause.en : cause.hi,
    correctiveActions: actions,
    confidence: lang === 'en' ? 'Medium' : 'मध्यम',
    summaryMarkdown: lang === 'en'
      ? `### Incident Timeline\n- ${timeline.join('\n- ')}\n\n### Probable Root Cause\n- ${cause.en}\n\n### Corrective Actions\n- **${actions[0].action}** (Owner: ${actions[0].owner}, Due: ${actions[0].due})\n- **${actions[1].action}** (Owner: ${actions[1].owner}, Due: ${actions[1].due})\n- **${actions[2].action}** (Owner: ${actions[2].owner}, Due: ${actions[2].due})\n\n**Confidence:** Medium`
      : `### Incident Timeline\n- ${timeline.join('\n- ')}\n\n### Probable Root Cause\n- ${cause.hi}\n\n### Corrective Actions\n- **${actions[0].action}** (Owner: ${actions[0].owner}, Due: ${actions[0].due})\n- **${actions[1].action}** (Owner: ${actions[1].owner}, Due: ${actions[1].due})\n- **${actions[2].action}** (Owner: ${actions[2].owner}, Due: ${actions[2].due})\n\n**Confidence:** मध्यम`,
  };
}

async function generateWithModel(context = {}, lang = 'hi') {
  if (!process.env.GEMINI_API_KEY) return null;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const prompt = `You are SafeWorkers Incident Postmortem AI.

Generate a concise postmortem using ONLY the evidence below.
Language: ${lang === 'en' ? 'English' : 'Hindi (Devanagari)'}.

Evidence:
- eventType: ${context.eventType}
- severity: ${context.severity}
- workerName: ${context.workerName}
- badge: ${context.badge}
- workerId: ${context.workerId}
- zone: ${context.zone}
- location: ${context.location}
- eventTime: ${context.eventTime}
- hazard: ${context.hazard || 'N/A'}
- alertMessage: ${context.alertMessage || 'N/A'}

Return strict JSON with keys:
{
  "timeline": ["...", "...", "..."],
  "probableRootCause": "...",
  "correctiveActions": [
    { "action": "...", "owner": "...", "due": "..." },
    { "action": "...", "owner": "...", "due": "..." },
    { "action": "...", "owner": "...", "due": "..." }
  ],
  "confidence": "..."
}

Rules:
- Exactly 3 timeline points and exactly 3 corrective actions.
- Keep output actionable and specific.
- Do not include markdown or extra text outside JSON.`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text()?.trim() || '';
    const clean = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(clean);

    if (!Array.isArray(parsed.timeline) || parsed.timeline.length < 3) return null;
    if (!Array.isArray(parsed.correctiveActions) || parsed.correctiveActions.length < 3) return null;

    return {
      timeline: parsed.timeline.slice(0, 3),
      probableRootCause: String(parsed.probableRootCause || ''),
      correctiveActions: parsed.correctiveActions.slice(0, 3).map((a) => ({
        action: String(a.action || ''),
        owner: String(a.owner || ''),
        due: String(a.due || ''),
      })),
      confidence: String(parsed.confidence || (lang === 'en' ? 'Medium' : 'मध्यम')),
    };
  } catch {
    return null;
  }
}

function toSummaryMarkdown(postmortem = {}, lang = 'hi') {
  const timeline = Array.isArray(postmortem.timeline) ? postmortem.timeline : [];
  const actions = Array.isArray(postmortem.correctiveActions) ? postmortem.correctiveActions : [];

  const actionsMd = actions
    .slice(0, 3)
    .map(a => `- **${a.action}** (Owner: ${a.owner}, Due: ${a.due})`)
    .join('\n');

  if (lang === 'en') {
    return `### Incident Timeline\n- ${timeline.join('\n- ')}\n\n### Probable Root Cause\n- ${postmortem.probableRootCause}\n\n### Corrective Actions\n${actionsMd}\n\n**Confidence:** ${postmortem.confidence || 'Medium'}`;
  }

  return `### Incident Timeline\n- ${timeline.join('\n- ')}\n\n### Probable Root Cause\n- ${postmortem.probableRootCause}\n\n### Corrective Actions\n${actionsMd}\n\n**Confidence:** ${postmortem.confidence || 'मध्यम'}`;
}

async function buildIncidentPostmortem(context = {}, langInput = 'hi') {
  const lang = normalizeLang(langInput);

  const llm = await generateWithModel(context, lang);
  const fallback = fallbackPostmortem(context, lang);
  const final = llm || {
    timeline: fallback.timeline,
    probableRootCause: fallback.probableRootCause,
    correctiveActions: fallback.correctiveActions,
    confidence: fallback.confidence,
  };

  return {
    ...final,
    summaryMarkdown: toSummaryMarkdown(final, lang),
  };
}

module.exports = { buildIncidentPostmortem };

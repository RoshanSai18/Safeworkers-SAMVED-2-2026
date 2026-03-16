const { GoogleGenerativeAI } = require('@google/generative-ai');
const { evaluateTodaysPlan, routeKm } = require('../utils/evaluatePlan');

function normalizeLang(lang = 'en') {
  return String(lang || 'en').toLowerCase().startsWith('hi') ? 'hi' : 'en';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildWorkerLoad(assignments = []) {
  const byWorker = assignments.reduce((acc, job) => {
    if (!acc[job.workerId]) {
      acc[job.workerId] = {
        workerId: job.workerId,
        workerName: job.workerName,
        jobs: [],
      };
    }
    acc[job.workerId].jobs.push(job);
    return acc;
  }, {});

  Object.values(byWorker).forEach((worker) => {
    worker.totalJobs = worker.jobs.length;
    worker.highRiskJobs = worker.jobs.filter(j => j.risk === 'High-risk').length;
    worker.mediumRiskJobs = worker.jobs.filter(j => j.risk === 'Medium').length;
    worker.lowRiskJobs = worker.jobs.filter(j => j.risk === 'Low').length;
    worker.routeKm = round2(routeKm(worker.jobs));
    worker.zoneSpread = new Set(worker.jobs.map(j => j.zone)).size;
    worker.jobIds = worker.jobs.map(j => j.jobId);
  });

  return byWorker;
}

function buildEvidence(assignments = [], issues = []) {
  const byWorker = buildWorkerLoad(assignments);
  const workerSummaries = Object.values(byWorker)
    .sort((a, b) => {
      if (b.highRiskJobs !== a.highRiskJobs) return b.highRiskJobs - a.highRiskJobs;
      if (b.routeKm !== a.routeKm) return b.routeKm - a.routeKm;
      return b.totalJobs - a.totalJobs;
    })
    .map(w => ({
      workerId: w.workerId,
      workerName: w.workerName,
      totalJobs: w.totalJobs,
      highRiskJobs: w.highRiskJobs,
      routeKm: w.routeKm,
      zoneSpread: w.zoneSpread,
      jobIds: w.jobIds,
    }));

  const issuesTotal = issues.length;
  const highSeverityIssues = issues.filter(i => i.severity === 'high').length;
  const mediumSeverityIssues = issues.filter(i => i.severity === 'medium').length;
  const overloadedWorkers = new Set(issues.filter(i => i.type === 'overload').map(i => i.workerId)).size;
  const fatigueWorkers = new Set(issues.filter(i => i.type === 'fatigue').map(i => i.workerId)).size;
  const workloadWorkers = new Set(issues.filter(i => i.type === 'workload').map(i => i.workerId)).size;

  const totalHighRiskJobs = assignments.filter(a => a.risk === 'High-risk').length;
  const riskScore = clamp(
    Math.round(
      (totalHighRiskJobs * 6)
      + (highSeverityIssues * 25)
      + (mediumSeverityIssues * 12)
      + (fatigueWorkers * 8)
    ),
    0,
    100
  );

  return {
    totalAssignments: assignments.length,
    totalWorkers: workerSummaries.length,
    totalHighRiskJobs,
    issuesTotal,
    highSeverityIssues,
    mediumSeverityIssues,
    overloadedWorkers,
    fatigueWorkers,
    workloadWorkers,
    riskScore,
    workerSummaries,
  };
}

function buildOverloadAction(issue, loadMap, lang = 'en') {
  const overloaded = loadMap[issue.workerId];
  if (!overloaded) return null;

  const extraHighRiskJob = overloaded.jobs.filter(j => j.risk === 'High-risk').at(-1);
  if (!extraHighRiskJob) return null;

  const target = Object.values(loadMap)
    .filter(w => w.workerId !== issue.workerId)
    .sort((a, b) => {
      if (a.highRiskJobs !== b.highRiskJobs) return a.highRiskJobs - b.highRiskJobs;
      if (a.totalJobs !== b.totalJobs) return a.totalJobs - b.totalJobs;
      return a.routeKm - b.routeKm;
    })
    .find(w => w.totalJobs < 4);

  if (!target) return null;

  if (lang === 'hi') {
    return {
      id: `swap-${issue.workerId}`,
      type: 'swap',
      message: `${issue.workerName} से ${extraHighRiskJob.jobId} को ${target.workerName} को शिफ्ट करें ताकि हाई-रिस्क लोड 2 के भीतर रहे।`,
      expectedImpact: 'ओवरलोड जोखिम तुरंत कम होगा',
    };
  }

  return {
    id: `swap-${issue.workerId}`,
    type: 'swap',
    message: `Move ${extraHighRiskJob.jobId} from ${issue.workerName} to ${target.workerName} to keep high-risk load within limit.`,
    expectedImpact: 'Immediately reduces overload risk',
  };
}

function buildFatigueAction(issue, loadMap, lang = 'en') {
  const worker = loadMap[issue.workerId];
  if (!worker) return null;

  if (lang === 'hi') {
    return {
      id: `fatigue-${issue.workerId}`,
      type: 'route',
      message: `${worker.workerName} के जॉब्स को zone-cluster में रीऑर्डर करें; ${worker.routeKm} km रूट को 3.5 km से नीचे लाएं।`,
      expectedImpact: 'थकान और response delay दोनों घटेंगे',
    };
  }

  return {
    id: `fatigue-${issue.workerId}`,
    type: 'route',
    message: `Reorder ${worker.workerName}'s jobs into a zone cluster and reduce route from ${worker.routeKm} km to below 3.5 km.`,
    expectedImpact: 'Lowers fatigue and response delay',
  };
}

function buildWorkloadAction(issue, loadMap, lang = 'en') {
  const worker = loadMap[issue.workerId];
  if (!worker) return null;

  const target = Object.values(loadMap)
    .filter(w => w.workerId !== issue.workerId)
    .sort((a, b) => a.totalJobs - b.totalJobs)
    .find(w => w.totalJobs <= 2);

  if (!target) return null;

  if (lang === 'hi') {
    return {
      id: `workload-${issue.workerId}`,
      type: 'rebalance',
      message: `${worker.workerName} के एक लो/मीडियम जॉब को ${target.workerName} को देकर जॉब-काउंट संतुलित करें।`,
      expectedImpact: 'शिफ्ट बोझ संतुलित होगा और त्रुटि-जोखिम घटेगा',
    };
  }

  return {
    id: `workload-${issue.workerId}`,
    type: 'rebalance',
    message: `Rebalance one low/medium job from ${worker.workerName} to ${target.workerName} to normalize shift workload.`,
    expectedImpact: 'Balances shift load and lowers execution errors',
  };
}

function buildActions(assignments = [], issues = [], lang = 'en') {
  const loadMap = buildWorkerLoad(assignments);
  const actions = [];
  const dedupe = new Set();

  issues.forEach((issue) => {
    let action = null;

    if (issue.type === 'overload') {
      action = buildOverloadAction(issue, loadMap, lang);
    } else if (issue.type === 'fatigue') {
      action = buildFatigueAction(issue, loadMap, lang);
    } else if (issue.type === 'workload') {
      action = buildWorkloadAction(issue, loadMap, lang);
    }

    if (action && !dedupe.has(action.id)) {
      dedupe.add(action.id);
      actions.push(action);
    }
  });

  if (actions.length === 0) {
    actions.push(lang === 'hi'
      ? {
          id: 'monitor-plan',
          type: 'monitor',
          message: 'वर्तमान तैनाती मानक के भीतर है; प्री-एंट्री चेकलिस्ट और गैस मॉनिटरिंग अनुशासन जारी रखें।',
          expectedImpact: 'स्थिर और सुरक्षित संचालन',
        }
      : {
          id: 'monitor-plan',
          type: 'monitor',
          message: 'Current deployment is within limits; continue strict pre-entry checklist and gas monitoring discipline.',
          expectedImpact: 'Stable and safe operations',
        });
  }

  return actions.slice(0, 4);
}

function buildPrompt(evidence, actions, lang = 'en') {
  const languageInstruction = lang === 'hi'
    ? 'Respond in Hindi (Devanagari). Keep all numbers unchanged.'
    : 'Respond in English.';

  const topWorkers = evidence.workerSummaries
    .slice(0, 4)
    .map(w => `${w.workerName}: jobs=${w.totalJobs}, highRisk=${w.highRiskJobs}, routeKm=${w.routeKm}`)
    .join(' | ');

  const actionsText = actions
    .map((a, idx) => `${idx + 1}. ${a.message} (Impact: ${a.expectedImpact})`)
    .join('\n');

  return `You are SafeWorker AI Plan Co-Pilot for sanitation deployment optimization.

${languageInstruction}

Evidence:
- Total assignments: ${evidence.totalAssignments}
- Total workers: ${evidence.totalWorkers}
- High-risk jobs: ${evidence.totalHighRiskJobs}
- Issues: ${evidence.issuesTotal} (high=${evidence.highSeverityIssues}, medium=${evidence.mediumSeverityIssues})
- Overload workers: ${evidence.overloadedWorkers}
- Fatigue workers: ${evidence.fatigueWorkers}
- Workload workers: ${evidence.workloadWorkers}
- Risk score: ${evidence.riskScore}/100
- Top worker load: ${topWorkers || 'none'}

Candidate actions:
${actionsText}

Task:
1) Write a short evidence snapshot (max 3 bullets).
2) Convert candidate actions into a prioritized action plan.
3) Add expected impact in one concise block.
4) End with one-line priority call.

Formatting:
- Use markdown headings and bullets.
- Keep under 170 words.
- Do not invent values beyond the evidence.`;
}

function fallbackAnalysis(evidence, actions, lang = 'en') {
  const actionLines = actions
    .slice(0, 3)
    .map((a, idx) => `${idx + 1}. ${a.message}`)
    .join('\n');

  if (lang === 'hi') {
    return `### Evidence Snapshot
- कुल ${evidence.totalAssignments} असाइनमेंट में ${evidence.totalHighRiskJobs} हाई-रिस्क जॉब हैं.
- ${evidence.issuesTotal} मुद्दे मिले (High: ${evidence.highSeverityIssues}, Medium: ${evidence.mediumSeverityIssues}).
- वर्तमान deployment risk score ${evidence.riskScore}/100 है.

### Optimization Actions
${actionLines}

### Expected Impact
- ओवरलोड, थकान और शिफ्ट असंतुलन घटेगा, जिससे incident संभावना कम होगी.

**Priority:** पहले high severity मुद्दों पर immediate reallocation लागू करें.`;
  }

  return `### Evidence Snapshot
- ${evidence.totalAssignments} assignments include ${evidence.totalHighRiskJobs} high-risk jobs.
- ${evidence.issuesTotal} issues found (High: ${evidence.highSeverityIssues}, Medium: ${evidence.mediumSeverityIssues}).
- Current deployment risk score is ${evidence.riskScore}/100.

### Optimization Actions
${actionLines}

### Expected Impact
- Reduces overload, fatigue, and shift imbalance, lowering incident probability.

**Priority:** Apply immediate reallocation for high-severity issues first.`;
}

function hasDevanagari(text = '') {
  return /[\u0900-\u097F]/.test(text);
}

async function ensureHindi(model, text) {
  const source = String(text || '').trim();
  if (!source) return source;
  if (hasDevanagari(source)) return source;

  const translationPrompt = `Translate the text below into Hindi (Devanagari).\n\nRules:\n1. Keep numbers unchanged.\n2. Preserve markdown headings and bullets.\n3. Return only translated content.\n\nText:\n${source}`;

  try {
    const translated = await model.generateContent(translationPrompt);
    return translated.response.text()?.trim() || source;
  } catch {
    return source;
  }
}

async function generateAnalysis(evidence, actions, lang) {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackAnalysis(evidence, actions, lang);
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  try {
    const response = await model.generateContent(buildPrompt(evidence, actions, lang));
    let text = response.response.text()?.trim();
    if (!text) text = fallbackAnalysis(evidence, actions, lang);

    if (lang === 'hi') {
      text = await ensureHindi(model, text);
    }

    return text;
  } catch {
    return fallbackAnalysis(evidence, actions, lang);
  }
}

async function getPlanCopilot(input = {}) {
  const assignments = Array.isArray(input.assignments) ? input.assignments : [];
  if (assignments.length === 0) {
    throw new Error('assignments array is required');
  }

  const lang = normalizeLang(input.lang);
  const issues = Array.isArray(input.issues) ? input.issues : evaluateTodaysPlan(assignments);
  const evidence = buildEvidence(assignments, issues);
  const actions = buildActions(assignments, issues, lang);
  const analysis = await generateAnalysis(evidence, actions, lang);

  return {
    success: true,
    lang,
    evidence,
    actions,
    analysis,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getPlanCopilot };

const { GoogleGenerativeAI } = require('@google/generative-ai');

function normalizeLang(lang = 'en') {
  return String(lang || 'en').toLowerCase().startsWith('hi') ? 'hi' : 'en';
}

function parseDurationMinutes(duration) {
  const m = String(duration || '').match(/(\d+)/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

function normalizeAuditRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows
    .slice(0, 500)
    .map((r, idx) => ({
      id: String(r.id || `row-${idx}`),
      worker: String(r.worker || 'Unknown'),
      zone: String(r.zone || 'Zone N/A'),
      date: String(r.date || '').slice(0, 10),
      ppe: String(r.ppe || '✗'),
      gas: String(r.gas || '✗'),
      durationMin: parseDurationMinutes(r.duration),
    }));
}

function aggregateByZone(rows = []) {
  const zoneMap = new Map();
  rows.forEach((r) => {
    if (!zoneMap.has(r.zone)) {
      zoneMap.set(r.zone, { zone: r.zone, entries: 0, ppePass: 0, gasPass: 0, avgDuration: 0, _dur: 0 });
    }
    const zone = zoneMap.get(r.zone);
    zone.entries += 1;
    if (r.ppe === '✓') zone.ppePass += 1;
    if (r.gas === '✓') zone.gasPass += 1;
    zone._dur += r.durationMin;
  });

  return [...zoneMap.values()]
    .map((z) => ({
      zone: z.zone,
      entries: z.entries,
      ppePass: z.ppePass,
      gasPass: z.gasPass,
      ppeRate: z.entries ? Math.round((z.ppePass / z.entries) * 100) : 0,
      gasRate: z.entries ? Math.round((z.gasPass / z.entries) * 100) : 0,
      avgDuration: z.entries ? Math.round(z._dur / z.entries) : 0,
    }))
    .sort((a, b) => b.entries - a.entries);
}

function aggregateByDate(rows = []) {
  const dateMap = new Map();
  rows.forEach((r) => {
    if (!r.date) return;
    if (!dateMap.has(r.date)) {
      dateMap.set(r.date, { date: r.date, entries: 0, ppePass: 0, gasPass: 0 });
    }
    const d = dateMap.get(r.date);
    d.entries += 1;
    if (r.ppe === '✓') d.ppePass += 1;
    if (r.gas === '✓') d.gasPass += 1;
  });

  return [...dateMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      entries: d.entries,
      ppeRate: d.entries ? Math.round((d.ppePass / d.entries) * 100) : 0,
      gasRate: d.entries ? Math.round((d.gasPass / d.entries) * 100) : 0,
    }));
}

function aggregateByWorker(rows = []) {
  const workerMap = new Map();
  rows.forEach((r) => {
    if (!workerMap.has(r.worker)) {
      workerMap.set(r.worker, { worker: r.worker, entries: 0, ppePass: 0, gasPass: 0, _dur: 0 });
    }
    const w = workerMap.get(r.worker);
    w.entries += 1;
    if (r.ppe === '✓') w.ppePass += 1;
    if (r.gas === '✓') w.gasPass += 1;
    w._dur += r.durationMin;
  });

  return [...workerMap.values()]
    .map((w) => ({
      worker: w.worker,
      entries: w.entries,
      ppeRate: w.entries ? Math.round((w.ppePass / w.entries) * 100) : 0,
      gasRate: w.entries ? Math.round((w.gasPass / w.entries) * 100) : 0,
      avgDuration: w.entries ? Math.round(w._dur / w.entries) : 0,
    }))
    .sort((a, b) => b.entries - a.entries)
    .slice(0, 10);
}

function fallbackChart(question = '', datasets = {}, lang = 'en') {
  const q = String(question || '').toLowerCase();

  if (q.includes('trend') || q.includes('daily') || q.includes('date')) {
    return {
      chartType: 'LineChart',
      title: lang === 'hi' ? 'दैनिक एंट्री और अनुपालन ट्रेंड' : 'Daily Entries and Compliance Trend',
      data: datasets.byDate,
      xKey: 'date',
      series: [
        { key: 'entries', label: lang === 'hi' ? 'एंट्री' : 'Entries', color: '#111827' },
        { key: 'ppeRate', label: lang === 'hi' ? 'PPE %' : 'PPE %', color: '#16a34a' },
        { key: 'gasRate', label: lang === 'hi' ? 'Gas %' : 'Gas %', color: '#2563eb' },
      ],
      insight: lang === 'hi'
        ? 'यह ट्रेंड दैनिक एंट्री और अनुपालन प्रतिशत दिखाता है।'
        : 'This trend shows daily entries and compliance percentages.',
    };
  }

  if (q.includes('worker') || q.includes('duration')) {
    return {
      chartType: 'BarChart',
      title: lang === 'hi' ? 'वर्कर-वार औसत अवधि' : 'Average Duration by Worker',
      data: datasets.byWorker,
      xKey: 'worker',
      series: [
        { key: 'avgDuration', label: lang === 'hi' ? 'औसत मिनट' : 'Avg Minutes', color: '#9333ea' },
        { key: 'entries', label: lang === 'hi' ? 'एंट्री' : 'Entries', color: '#111827' },
      ],
      insight: lang === 'hi'
        ? 'यह चार्ट किन वर्करों की औसत साइट अवधि अधिक है, यह बताता है।'
        : 'This chart highlights workers with higher average site duration.',
    };
  }

  return {
    chartType: 'BarChart',
    title: lang === 'hi' ? 'ज़ोन-वार PPE और गैस अनुपालन' : 'Zone-wise PPE and Gas Compliance',
    data: datasets.byZone,
    xKey: 'zone',
    series: [
      { key: 'ppeRate', label: lang === 'hi' ? 'PPE %' : 'PPE %', color: '#16a34a' },
      { key: 'gasRate', label: lang === 'hi' ? 'Gas %' : 'Gas %', color: '#2563eb' },
      { key: 'entries', label: lang === 'hi' ? 'एंट्री' : 'Entries', color: '#111827' },
    ],
    insight: lang === 'hi'
      ? 'ज़ोन के अनुसार अनुपालन दर और एंट्री वॉल्यूम दिख रहा है।'
      : 'Compliance rates and entry volume are shown by zone.',
  };
}

function safeParseAiChart(text = '') {
  let body = String(text || '').trim();
  if (!body) throw new Error('Empty AI response');

  if (body.startsWith('```json')) body = body.slice(7);
  if (body.startsWith('```')) body = body.slice(3);
  if (body.endsWith('```')) body = body.slice(0, -3);

  return JSON.parse(body.trim());
}

function sanitizeChartConfig(config = {}, fallback = {}) {
  const chartType = config.chartType === 'LineChart' ? 'LineChart' : 'BarChart';
  const title = String(config.title || fallback.title || 'AI Chart');
  const xKey = String(config.xKey || fallback.xKey || 'label');

  const data = Array.isArray(config.data) ? config.data.slice(0, 16) : (Array.isArray(fallback.data) ? fallback.data : []);
  const seriesRaw = Array.isArray(config.series) ? config.series : (Array.isArray(fallback.series) ? fallback.series : []);
  const series = seriesRaw
    .map((s) => ({
      key: String(s.key || ''),
      label: String(s.label || s.key || ''),
      color: String(s.color || '#111827'),
    }))
    .filter((s) => s.key.length > 0)
    .slice(0, 4);

  return {
    chartType,
    title,
    data,
    xKey,
    series,
    insight: String(config.insight || fallback.insight || ''),
  };
}

function buildAiPrompt(question, datasets, lang) {
  const language = lang === 'hi' ? 'Hindi (Devanagari)' : 'English';
  return `You are a chart-config generator for Recharts.
Return ONLY valid JSON.
Language for title/insight: ${language}.

Input question: ${question}

Available datasets (pre-aggregated):
1) byZone: ${JSON.stringify(datasets.byZone)}
2) byDate: ${JSON.stringify(datasets.byDate)}
3) byWorker: ${JSON.stringify(datasets.byWorker)}

Choose ONE best dataset and generate JSON with exact shape:
{
  "chartType": "BarChart" | "LineChart",
  "title": "string",
  "data": [ { "x": "value", "metric": number } ],
  "xKey": "field-name",
  "series": [
    { "key": "metricField", "label": "display label", "color": "#hex" }
  ],
  "insight": "short, one sentence"
}

Rules:
- Use only fields that exist in selected dataset rows.
- Keep data length <= 16.
- Keep series length between 1 and 4.
- Numeric metrics must be numbers.
- No markdown fences.
`;
}

async function generateAiAuditChart(input = {}) {
  const question = String(input.question || '').trim();
  if (!question) throw new Error('question is required');

  const lang = normalizeLang(input.lang);
  const rows = normalizeAuditRows(input.auditRows || []);
  if (rows.length === 0) {
    throw new Error('auditRows is required and must contain at least one row');
  }

  const datasets = {
    byZone: aggregateByZone(rows),
    byDate: aggregateByDate(rows),
    byWorker: aggregateByWorker(rows),
  };

  const fallback = fallbackChart(question, datasets, lang);

  if (!process.env.GEMINI_API_KEY) {
    return {
      success: true,
      chart: fallback,
      source: 'fallback',
      generatedAt: new Date().toISOString(),
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const response = await model.generateContent(buildAiPrompt(question, datasets, lang));
    const parsed = safeParseAiChart(response.response.text());
    const chart = sanitizeChartConfig(parsed, fallback);

    return {
      success: true,
      chart,
      source: 'ai',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      success: true,
      chart: fallback,
      source: 'fallback',
      generatedAt: new Date().toISOString(),
    };
  }
}

module.exports = { generateAiAuditChart };

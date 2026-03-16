const { GoogleGenerativeAI } = require('@google/generative-ai');
const { workers, jobs } = require('../data/seed');
const { haversineKm } = require('../utils/evaluatePlan');

async function getRecommendations(lang = 'en') {
    const normalizedLang = String(lang || 'en').toLowerCase().startsWith('hi') ? 'hi' : 'en';
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 1. Find idle workers
    const idleWorkers = workers.filter(w => w.status === 'IDLE');

    // 2. Find unassigned jobs (not held by any worker)
    const assignedJobIds = new Set(workers.map(w => w.job).filter(j => j !== '—'));
    const openJobs = jobs.filter(j => !assignedJobIds.has(j.id));

    if (idleWorkers.length === 0 || openJobs.length === 0) {
        const noIdleWorkersMsg = normalizedLang === 'hi'
            ? 'इस समय असाइनमेंट के लिए कोई खाली वर्कर उपलब्ध नहीं है। सभी वर्कर अभी काम में लगे हुए हैं।'
            : 'No idle workers are available for assignment at this time. All workers are currently engaged.';
        const noOpenJobsMsg = normalizedLang === 'hi'
            ? 'असाइनमेंट के लिए कोई खुला जॉब उपलब्ध नहीं है। सभी जॉब पहले से असाइन हो चुके हैं।'
            : 'No open jobs are available for assignment. All jobs have been assigned.';
        return {
            success: true,
            recommendation: idleWorkers.length === 0
                ? noIdleWorkersMsg
                : noOpenJobsMsg,
            context: { idleWorkers: idleWorkers.length, openJobs: openJobs.length }
        };
    }

    // 3. Build distance matrix
    const distanceMatrix = idleWorkers.map(worker => ({
        workerId: worker.id,
        workerName: worker.name,
        badge: worker.badge,
        battery: worker.battery,
        signal: worker.signal,
        entries: worker.entries,
        maxEntries: worker.maxEntries,
        distances: openJobs.map(job => ({
            jobId: job.id,
            address: job.address,
            zone: job.zone,
            risk: job.risk,
            priority: job.priority,
            distanceKm: parseFloat(haversineKm(worker.lat, worker.lng, job.lat, job.lng).toFixed(2))
        }))
    }));

    // 4. Build prompt
    const prompt = buildPrompt(distanceMatrix, idleWorkers, openJobs, normalizedLang);

    // 5. Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);
    let text = result.response.text();

    // Gemini may occasionally ignore language instructions; enforce Hindi output.
    if (normalizedLang === 'hi') {
        text = await ensureHindiResponse(model, text);
    }

    return {
        success: true,
        recommendation: text,
        context: {
            idleWorkers: idleWorkers.length,
            openJobs: openJobs.length,
            distanceMatrix
        }
    };
}

async function ensureHindiResponse(model, text) {
    const source = String(text || '').trim();
    if (!source) return source;

    const translationPrompt = `Translate the following response into natural Hindi (Devanagari script).\n\nRules:\n1. Keep worker names, job IDs, badges, and numeric values unchanged.\n2. Preserve bullets and headings where possible.\n3. Return only the translated response text, no extra commentary.\n\nResponse to translate:\n${source}`;

    try {
        const translated = await model.generateContent(translationPrompt);
        const translatedText = translated.response.text()?.trim();
        return translatedText || source;
    } catch {
        return source;
    }
}

function buildPrompt(distanceMatrix, idleWorkers, openJobs, lang) {
    const langInstruction = lang === 'hi'
        ? '\n\nIMPORTANT: Respond ENTIRELY in Hindi (Devanagari script). Use Hindi for all explanations, headings, and safety summaries. Keep job IDs, worker names, badges, and numbers as-is.'
        : '';

    return `You are SafeWorker AI, a safety-focused job assignment assistant for manhole/sewer maintenance workers in Mumbai, India.

CONTEXT:
You have ${idleWorkers.length} idle worker(s) available and ${openJobs.length} open job(s) to assign.

AVAILABLE IDLE WORKERS:
${distanceMatrix.map(w => `- ${w.workerName} (${w.badge}): Battery ${w.battery}%, Signal ${w.signal}/4, Fatigue ${w.entries}/${w.maxEntries} entries used`).join('\n')}

OPEN JOBS:
${openJobs.map(j => `- ${j.id} at ${j.address} (${j.zone}): Risk=${j.risk}, Priority=${j.priority}, Depth=${j.depth}m, Recent Incidents=${j.recentIncidents}, Weather=${j.weather}, Equipment=${j.equipment}`).join('\n')}

DISTANCE MATRIX (worker -> job distances in km):
${distanceMatrix.map(w => w.distances.map(d => `  ${w.workerName} -> ${d.jobId} (${d.address}): ${d.distanceKm} km`).join('\n')).join('\n')}

SAFETY RULES:
1. Workers with high fatigue (entries near maxEntries) should NOT be assigned to HIGH risk jobs
2. Closer workers are preferred to minimize travel time and fatigue
3. HIGH priority/Urgent jobs should be assigned first
4. Workers with low battery (<30%) or weak signal (<2) need consideration
5. HIGH risk + heavy_rain weather requires the most experienced/equipped worker

TASK:
Provide specific worker-to-job assignment recommendations. For each recommendation:
1. State which worker should go to which job
2. Explain WHY (distance, safety factors, priority)
3. Flag any safety concerns

Keep the response concise, actionable, and structured. Use bullet points. End with a brief overall safety summary.${langInstruction}`;
}

module.exports = { getRecommendations };

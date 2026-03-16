const { GoogleGenerativeAI } = require('@google/generative-ai');
const { workers: seedWorkers, jobs: seedJobs } = require('../data/seed');
const { haversineKm } = require('../utils/evaluatePlan');

function normalizeLang(lang = 'en') {
    return String(lang || 'en').toLowerCase().startsWith('hi') ? 'hi' : 'en';
}

function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function riskWeight(risk = '') {
    const v = String(risk || '').toLowerCase();
    if (v.includes('high')) return 35;
    if (v.includes('medium')) return 20;
    return 10;
}

function fatigueWeight(worker) {
    const ratio = worker.maxEntries > 0 ? worker.entries / worker.maxEntries : 0;
    if (ratio >= 1) return 35;
    if (ratio >= 0.75) return 25;
    if (ratio >= 0.5) return 12;
    return 4;
}

function batteryWeight(battery = 100) {
    if (battery < 20) return 20;
    if (battery < 30) return 15;
    if (battery < 50) return 8;
    return 0;
}

function signalWeight(signal = 4) {
    if (signal < 2) return 12;
    if (signal < 3) return 6;
    return 0;
}

function weatherWeight(weather = '', risk = '') {
    const w = String(weather || '').toLowerCase();
    const r = String(risk || '').toLowerCase();
    const severeWeather = w.includes('rain') || w.includes('storm') || w.includes('flood');
    const highRisk = r.includes('high');
    if (severeWeather && highRisk) return 20;
    if (severeWeather) return 10;
    return 0;
}

function distanceWeight(distanceKm = 0) {
    return Math.min(20, distanceKm * 4);
}

function scoreBand(score, lang = 'en') {
    if (score <= 34) {
        return {
            key: 'safe',
            label: lang === 'hi' ? 'सुरक्षित' : 'Safe',
        };
    }
    if (score <= 59) {
        return {
            key: 'caution',
            label: lang === 'hi' ? 'सावधानी' : 'Caution',
        };
    }
    return {
        key: 'high',
        label: lang === 'hi' ? 'उच्च जोखिम' : 'High Risk',
    };
}

function baseWorkerRisk(worker) {
    return (
        fatigueWeight(worker)
        + batteryWeight(worker.battery)
        + signalWeight(worker.signal)
    );
}

function assignmentRisk(worker, job, distanceKm) {
    return (
        baseWorkerRisk(worker)
        + riskWeight(job.risk)
        + weatherWeight(job.weather, job.risk)
        + distanceWeight(distanceKm)
    );
}

function buildMitigations(worker, job, afterScore, lang = 'en') {
    const mitigations = [];

    if (worker.entries >= worker.maxEntries) {
        mitigations.push(lang === 'hi'
            ? 'वर्कर की fatigue limit पूरी हो चुकी है, तुरंत वैकल्पिक वर्कर चुनें।'
            : 'Worker has reached fatigue limit; assign an alternate worker immediately.');
    }
    if (worker.battery < 30) {
        mitigations.push(lang === 'hi'
            ? 'डिस्पैच से पहले डिवाइस बैटरी 50%+ तक चार्ज करें।'
            : 'Charge worker device to at least 50% before dispatch.');
    }
    if (worker.signal < 2) {
        mitigations.push(lang === 'hi'
            ? 'लो-सिग्नल ज़ोन के लिए रेडियो या बैकअप कम्युनिकेशन सक्षम करें।'
            : 'Enable radio or backup communication for low-signal route.');
    }

    const weather = String(job.weather || '').toLowerCase();
    const risk = String(job.risk || '').toLowerCase();
    if ((weather.includes('rain') || weather.includes('storm') || weather.includes('flood')) && risk.includes('high')) {
        mitigations.push(lang === 'hi'
            ? 'High-risk + खराब मौसम के लिए गैस-टेस्ट रीचेक और standby rescue टीम रखें।'
            : 'For high-risk with bad weather, enforce gas retest and keep rescue standby.');
    }

    if (afterScore >= 60) {
        mitigations.push(lang === 'hi'
            ? 'यह असाइनमेंट हाई-रिस्क है; पहले AI suggested alternative worker पर विचार करें।'
            : 'This is a high-risk assignment; prefer AI-suggested alternative workers first.');
    }

    if (mitigations.length === 0) {
        mitigations.push(lang === 'hi'
            ? 'यह असाइनमेंट स्वीकार्य है; standard PPE, pre-entry checklist, और live gas monitoring जारी रखें।'
            : 'Assignment is acceptable; continue standard PPE, pre-entry checks, and live gas monitoring.');
    }

    return mitigations;
}

function buildSummary({ worker, job, beforeScore, afterScore, delta, distanceKm, lang }) {
    if (lang === 'hi') {
        return `${worker.name} को ${job.id} पर असाइन करने से risk score ${beforeScore} से ${afterScore} (${delta >= 0 ? '+' : ''}${delta}) होगा। दूरी ${distanceKm} km है।`;
    }
    return `Assigning ${worker.name} to ${job.id} changes risk score from ${beforeScore} to ${afterScore} (${delta >= 0 ? '+' : ''}${delta}). Route distance is ${distanceKm} km.`;
}

function pickAlternatives(targetWorkerId, job, allWorkers, lang = 'en') {
    return allWorkers
        .filter(w => w.id !== targetWorkerId && w.status !== 'SOS')
        .map(w => {
            const d = parseFloat(haversineKm(w.lat, w.lng, job.lat, job.lng).toFixed(2));
            const score = clampScore(assignmentRisk(w, job, d));
            return {
                workerId: w.id,
                workerName: w.name,
                badge: w.badge,
                score,
                band: scoreBand(score, lang),
                distanceKm: d,
            };
        })
        .sort((a, b) => a.score - b.score || a.distanceKm - b.distanceKm)
        .slice(0, 3);
}

function buildSimulationPayload(input = {}) {
    const lang = normalizeLang(input.lang);
    const allWorkers = Array.isArray(input.workers) && input.workers.length > 0 ? input.workers : seedWorkers;
    const allJobs = Array.isArray(input.jobs) && input.jobs.length > 0 ? input.jobs : seedJobs;

    const workerId = Number(input.workerId);
    const jobId = String(input.jobId || '').trim();

    if (!workerId || !jobId) {
        throw new Error('workerId and jobId are required');
    }

    const worker = allWorkers.find(w => w.id === workerId);
    const job = allJobs.find(j => j.id === jobId);

    if (!worker) throw new Error(`Worker ${workerId} not found`);
    if (!job) throw new Error(`Job ${jobId} not found`);

    if (typeof worker.lat !== 'number' || typeof worker.lng !== 'number') {
        throw new Error(`Worker ${workerId} is missing coordinates`);
    }
    if (typeof job.lat !== 'number' || typeof job.lng !== 'number') {
        throw new Error(`Job ${jobId} is missing coordinates`);
    }

    const distanceKm = parseFloat(haversineKm(worker.lat, worker.lng, job.lat, job.lng).toFixed(2));
    const beforeScore = clampScore(baseWorkerRisk(worker));
    const afterScore = clampScore(assignmentRisk(worker, job, distanceKm));
    const delta = afterScore - beforeScore;

    return {
        lang,
        worker: {
            id: worker.id,
            name: worker.name,
            badge: worker.badge,
            status: worker.status,
            entries: worker.entries,
            maxEntries: worker.maxEntries,
            battery: worker.battery,
            signal: worker.signal,
        },
        job: {
            id: job.id,
            address: job.address,
            zone: job.zone,
            risk: job.risk,
            priority: job.priority,
            weather: job.weather,
        },
        distanceKm,
        before: {
            score: beforeScore,
            band: scoreBand(beforeScore, lang),
        },
        after: {
            score: afterScore,
            band: scoreBand(afterScore, lang),
        },
        delta,
        summary: buildSummary({ worker, job, beforeScore, afterScore, delta, distanceKm, lang }),
        mitigations: buildMitigations(worker, job, afterScore, lang),
        alternatives: pickAlternatives(worker.id, job, allWorkers, lang),
    };
}

function hasDevanagari(text = '') {
    return /[\u0900-\u097F]/.test(text);
}

async function ensureHindiText(model, text) {
    const source = String(text || '').trim();
    if (!source) return source;

    if (hasDevanagari(source)) return source;

    const translationPrompt = `Translate the following response into natural Hindi (Devanagari script).\n\nRules:\n1. Keep worker names, job IDs, and numbers unchanged.\n2. Keep bullets and structure.\n3. Return only translated text.\n\nText:\n${source}`;

    try {
        const translated = await model.generateContent(translationPrompt);
        return translated.response.text()?.trim() || source;
    } catch {
        return source;
    }
}

function fallbackNarrative(sim) {
    if (sim.lang === 'hi') {
        return `### Counterfactual परिणाम\n- वर्कर: ${sim.worker.name} (${sim.worker.badge})\n- जॉब: ${sim.job.id} (${sim.job.zone})\n- जोखिम स्कोर: ${sim.before.score} (${sim.before.band.label}) → ${sim.after.score} (${sim.after.band.label})\n- बदलाव: ${sim.delta >= 0 ? '+' : ''}${sim.delta}\n- दूरी: ${sim.distanceKm} km\n\n**निष्कर्ष:** ${sim.after.score >= 60 ? 'यह असाइनमेंट उच्च जोखिम दिखा रहा है; वैकल्पिक वर्कर पर विचार करें।' : 'यह असाइनमेंट नियंत्रित जोखिम में है, लेकिन SOP पालन जरूरी है।'}`;
    }

    return `### Counterfactual Result\n- Worker: ${sim.worker.name} (${sim.worker.badge})\n- Job: ${sim.job.id} (${sim.job.zone})\n- Risk score: ${sim.before.score} (${sim.before.band.label}) → ${sim.after.score} (${sim.after.band.label})\n- Delta: ${sim.delta >= 0 ? '+' : ''}${sim.delta}\n- Distance: ${sim.distanceKm} km\n\n**Conclusion:** ${sim.after.score >= 60 ? 'This assignment trends high-risk; consider alternate workers.' : 'This assignment remains manageable if SOPs are strictly followed.'}`;
}

async function buildAiNarrative(sim) {
    if (!process.env.GEMINI_API_KEY) {
        return fallbackNarrative(sim);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `You are SafeWorker AI. Explain a what-if job assignment simulation for a safety supervisor.

Simulation Data:
- Worker: ${sim.worker.name} (${sim.worker.badge}), status=${sim.worker.status}, fatigue=${sim.worker.entries}/${sim.worker.maxEntries}, battery=${sim.worker.battery}%, signal=${sim.worker.signal}/4
- Job: ${sim.job.id}, zone=${sim.job.zone}, risk=${sim.job.risk}, priority=${sim.job.priority}, weather=${sim.job.weather}
- Distance: ${sim.distanceKm} km
- Score change: ${sim.before.score} (${sim.before.band.label}) to ${sim.after.score} (${sim.after.band.label}), delta=${sim.delta >= 0 ? '+' : ''}${sim.delta}
- Mitigations: ${sim.mitigations.join(' | ')}
- Alternatives: ${sim.alternatives.map(a => `${a.workerName}(${a.badge}) score=${a.score} dist=${a.distanceKm}km`).join('; ') || 'none'}

Task:
1) Give a concise recommendation on whether to proceed.
2) Explain the top 3 drivers of risk change.
3) Mention the best alternative worker (if any).
4) End with a one-line operational action.

Use markdown bullets and keep it under 140 words.`;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text()?.trim();
        if (!text) text = fallbackNarrative(sim);

        if (sim.lang === 'hi') {
            text = await ensureHindiText(model, text);
        }

        return text;
    } catch {
        return fallbackNarrative(sim);
    }
}

async function buildCounterfactualSimulation(input = {}) {
    const simulation = buildSimulationPayload(input);
    const aiNarrative = await buildAiNarrative(simulation);
    return {
        success: true,
        simulation: {
            ...simulation,
            aiNarrative,
        },
    };
}

module.exports = { buildCounterfactualSimulation };

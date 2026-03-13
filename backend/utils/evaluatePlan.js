/**
 * SAMVED — Pre-deployment Safety Plan Evaluator
 * Checks a batch of today's job assignments for safety violations
 * before the admin confirms deployment.
 */

function haversineKm(la1, lo1, la2, lo2) {
    const R = 6371;
    const r = Math.PI / 180;
    const dLa = (la2 - la1) * r;
    const dLo = (lo2 - lo1) * r;
    const a = Math.sin(dLa / 2) ** 2
            + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeKm(jobs) {
    let d = 0;
    for (let i = 1; i < jobs.length; i++) {
        d += haversineKm(
            jobs[i - 1].lat, jobs[i - 1].lng,
            jobs[i].lat,     jobs[i].lng
        );
    }
    return d;
}

/**
 * evaluateTodaysPlan(assignments)
 *
 * @param {Array<{ workerId, workerName, jobId, risk, zone, lat, lng }>} assignments
 * @returns {Array<Issue>} list of safety violations found
 *
 * Rules enforced:
 *   1. High-risk overload  — worker has > 2 high-risk jobs today
 *   2. Route fatigue       — total route distance > 3.5 km
 *   3. Job count overload  — worker assigned > 3 jobs in one day
 */
function evaluateTodaysPlan(assignments) {
    const byWorker = assignments.reduce((acc, job) => {
        if (!acc[job.workerId]) acc[job.workerId] = [];
        acc[job.workerId].push(job);
        return acc;
    }, {});

    const issues = [];

    Object.entries(byWorker).forEach(([workerId, wJobs]) => {
        const { workerName } = wJobs[0];
        const hrCount = wJobs.filter(j => j.risk === 'High-risk').length;

        // Rule 1: High-risk overload
        if (hrCount > 2) {
            issues.push({
                id: `overload-${workerId}`,
                workerId,
                workerName,
                type: 'overload',
                severity: 'high',
                message: `वर्कर ${workerName} (${workerId}) के पास आज ${hrCount} हाई-रिस्क जॉब्स हैं — अधिकतम 2 की अनुमति है`,
                affectedJobs: wJobs.filter(j => j.risk === 'High-risk').map(j => j.jobId),
            });
        }

        // Rule 2: Route fatigue (mock distance via Haversine)
        if (wJobs.length >= 2) {
            const km = routeKm(wJobs);
            if (km > 3.5) {
                issues.push({
                    id: `fatigue-${workerId}`,
                    workerId,
                    workerName,
                    type: 'fatigue',
                    severity: 'medium',
                    message: `वर्कर ${workerName} के जॉब्स ${km.toFixed(1)} km में फैले हैं — लंबे रूट से थकान बढ़ सकती है`,
                    distanceKm: +km.toFixed(2),
                });
            }
        }

        // Rule 3: Too many jobs in one shift
        if (wJobs.length > 3) {
            issues.push({
                id: `workload-${workerId}`,
                workerId,
                workerName,
                type: 'workload',
                severity: 'medium',
                message: `वर्कर ${workerName} को आज ${wJobs.length} जॉब्स असाइन हैं — एक शिफ्ट में काम का बोझ अधिक है`,
            });
        }
    });

    return issues;
}

module.exports = { evaluateTodaysPlan, haversineKm, routeKm };

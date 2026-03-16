import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    LogOut, Download, Search, Filter, TrendingUp, AlertTriangle,
    Users, CheckCircle2, Shield, Calendar, FileText,
    MessageSquare, MapPin, Activity, Award, Zap, Building2, ExternalLink, Flag, Lightbulb, Volume2, VolumeX
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

/* ── Static data ──────────────────────────────────────── */
const KPI = [
    { label: 'Total Entries', value: '1,284', sub: 'This month',    icon: <Users size={22}/>,         delta: '+6.2%' },
    { label: 'Incident Rate', value: '2.1%',  sub: 'Last 30 days',  icon: <AlertTriangle size={22}/>, delta: '-0.4%' },
    { label: 'Near-Misses',   value: '17',     sub: 'This month',    icon: <TrendingUp size={22}/>,    delta: '+3'   },
    { label: 'Compliance',    value: '94.7%',  sub: 'PPE + Gas verified', icon: <CheckCircle2 size={22}/>, delta: '+1.2%' },
];

const BAR_DATA = [
    { zone: 'Zone A', entries: 240, incidents: 4 },
    { zone: 'Zone B', entries: 310, incidents: 7 },
    { zone: 'Zone C', entries: 185, incidents: 2 },
    { zone: 'Zone D', entries: 260, incidents: 5 },
    { zone: 'Zone E', entries: 175, incidents: 1 },
    { zone: 'Zone F', entries: 114, incidents: 3 },
];

const LINE_DATA = [
    { week: 'W1',  incidents: 6 }, { week: 'W2',  incidents: 4 },
    { week: 'W3',  incidents: 7 }, { week: 'W4',  incidents: 3 },
    { week: 'W5',  incidents: 9 }, { week: 'W6',  incidents: 5 },
    { week: 'W7',  incidents: 4 }, { week: 'W8',  incidents: 6 },
    { week: 'W9',  incidents: 2 }, { week: 'W10', incidents: 4 },
    { week: 'W11', incidents: 3 }, { week: 'W12', incidents: 2 },
];

// 8x8 heatmap grid — intensity 0-10
const HEATMAP = [
    [0,1,2,3,1,0,0,0], [1,3,6,8,5,2,1,0], [0,2,5,9,7,4,2,1],
    [0,1,3,7,10,6,3,1], [0,0,2,4,6,8,5,2], [0,0,1,2,4,5,4,1],
    [0,0,0,1,2,3,2,1], [0,0,0,0,1,1,1,0],
];
const ZONE_LABELS = ['Z-A','Z-B','Z-C','Z-D','Z-E','Z-F','Z-G','Z-H'];
const WARD_LABELS = ['W1','W2','W3','W4','W5','W6','W7','W8'];

const AUDIT_LOG = [
    { id:'E-1021', worker:'Ravi Kumar',    badge:'SW-041', job:'MH-2041', zone:'Zone B', entryTime:'08:14', exitTime:'08:52', duration:'38m', ppe:'✓', gas:'✓', supervisor:'Priya Sharma', date:'2026-02-19' },
    { id:'E-1020', worker:'Suresh Babu',   badge:'SW-018', job:'MH-1874', zone:'Zone C', entryTime:'07:55', exitTime:'08:30', duration:'35m', ppe:'✓', gas:'✓', supervisor:'Priya Sharma', date:'2026-02-19' },
    { id:'E-1019', worker:'Meena Devi',    badge:'SW-029', job:'MH-0933', zone:'Zone A', entryTime:'09:10', exitTime:'09:58', duration:'48m', ppe:'✓', gas:'✗', supervisor:'Priya Sharma', date:'2026-02-18' },
    { id:'E-1018', worker:'Kamla Singh',   badge:'SW-007', job:'MH-3310', zone:'Zone D', entryTime:'10:00', exitTime:'10:31', duration:'31m', ppe:'✓', gas:'✓', supervisor:'Raj Mehta',   date:'2026-02-18' },
    { id:'E-1017', worker:'Anwar Sheikh',  badge:'SW-055', job:'MH-0521', zone:'Zone B', entryTime:'11:05', exitTime:'11:43', duration:'38m', ppe:'✓', gas:'✓', supervisor:'Raj Mehta',   date:'2026-02-17' },
    { id:'E-1016', worker:'Deepak Rao',    badge:'SW-060', job:'MH-2200', zone:'Zone F', entryTime:'13:20', exitTime:'14:00', duration:'40m', ppe:'✗', gas:'✓', supervisor:'Priya Sharma', date:'2026-02-17' },
    { id:'E-1015', worker:'Ravi Kumar',    badge:'SW-041', job:'MH-1100', zone:'Zone B', entryTime:'14:30', exitTime:'15:05', duration:'35m', ppe:'✓', gas:'✓', supervisor:'Priya Sharma', date:'2026-02-16' },
    { id:'E-1014', worker:'Suresh Babu',   badge:'SW-018', job:'MH-0090', zone:'Zone C', entryTime:'08:45', exitTime:'09:22', duration:'37m', ppe:'✓', gas:'✓', supervisor:'Raj Mehta',   date:'2026-02-16' },
    { id:'E-1013', worker:'Meena Devi',    badge:'SW-029', job:'MH-4402', zone:'Zone A', entryTime:'07:30', exitTime:'08:10', duration:'40m', ppe:'✓', gas:'✓', supervisor:'Priya Sharma', date:'2026-02-15' },
    { id:'E-1012', worker:'Kamla Singh',   badge:'SW-007', job:'MH-6610', zone:'Zone E', entryTime:'09:55', exitTime:'10:28', duration:'33m', ppe:'✓', gas:'✓', supervisor:'Raj Mehta',   date:'2026-02-15' },
];

const WORKER_HEALTH = [
    { name:'Ravi Kumar',   badge:'SW-041', score:87, entries:24, checkup:'Due in 6 days',  streak:4,  incidentFree: false },
    { name:'Suresh Babu',  badge:'SW-018', score:94, entries:18, checkup:'Up to date',     streak:12, incidentFree: true  },
    { name:'Meena Devi',   badge:'SW-029', score:72, entries:29, checkup:'OVERDUE',        streak:2,  incidentFree: false },
    { name:'Anwar Sheikh', badge:'SW-055', score:96, entries:15, checkup:'Up to date',     streak:22, incidentFree: true  },
    { name:'Kamla Singh',  badge:'SW-007', score:88, entries:21, checkup:'Due in 14 days', streak:7,  incidentFree: true  },
    { name:'Deepak Rao',   badge:'SW-060', score:78, entries:20, checkup:'Due in 3 days',  streak:3,  incidentFree: false },
];

const NAMASTE_SSW = [
    { id:'SW-041', name:'Ravi Kumar',   zone:'Zone B', aadhaar:'✓', pmjay:'✗', training:'Expired 2026-01-10',  training_ok:false, kyc:'✓', lastCamp:'2025-08-10', status:'red'    },
    { id:'SW-018', name:'Suresh Babu',  zone:'Zone C', aadhaar:'✓', pmjay:'✓', training:'Valid – 2026-11-05',  training_ok:true,  kyc:'✓', lastCamp:'2025-11-22', status:'green'  },
    { id:'SW-029', name:'Meena Devi',   zone:'Zone A', aadhaar:'✓', pmjay:'✗', training:'Expired 2025-12-05',  training_ok:false, kyc:'✗', lastCamp:'2025-06-01', status:'red'    },
    { id:'SW-055', name:'Anwar Sheikh', zone:'Zone B', aadhaar:'✓', pmjay:'✓', training:'Valid – 2027-03-14',  training_ok:true,  kyc:'✓', lastCamp:'2025-12-15', status:'green'  },
    { id:'SW-007', name:'Kamla Singh',  zone:'Zone D', aadhaar:'✓', pmjay:'✓', training:'Exp. in 60 days',    training_ok:true,  kyc:'✓', lastCamp:'2025-10-20', status:'yellow' },
    { id:'SW-060', name:'Deepak Rao',   zone:'Zone F', aadhaar:'✗', pmjay:'✗', training:'Expired 2025-11-20',  training_ok:false, kyc:'✗', lastCamp:'Never',       status:'red'    },
    { id:'SW-032', name:'Priti Devi',   zone:'Zone E', aadhaar:'✓', pmjay:'✓', training:'Valid – 2026-12-01',  training_ok:true,  kyc:'✓', lastCamp:'2026-01-08', status:'green'  },
];

const INCIDENTS = [
    { id:'INC-007', date:'2026-02-18', time:'22:14', worker:'Meena Devi',  badge:'SW-029', location:'MH-0933 · Zone A', type:'Near-Miss – H₂S Spike',      supervisor:'Priya Sharma', overrideUsed:true,  ppeUploaded:false, gasTest:false, severity:'high',
      gasAtIncident: { H2S: 12.4, CO: 45,  O2: 18.1, CH4: 22.0 } },
    { id:'INC-006', date:'2026-02-15', time:'11:32', worker:'Deepak Rao',  badge:'SW-060', location:'MH-2200 · Zone F', type:'PPE Non-Compliance',           supervisor:'Priya Sharma', overrideUsed:false, ppeUploaded:false, gasTest:true,  severity:'medium',
      gasAtIncident: null },
    { id:'INC-005', date:'2026-02-10', time:'09:05', worker:'Ravi Kumar',  badge:'SW-041', location:'MH-1140 · Zone B', type:'Duration Overrun (8 min)',     supervisor:'Raj Mehta',    overrideUsed:false, ppeUploaded:true,  gasTest:true,  severity:'low',
      gasAtIncident: { H2S: 0.4, CO: 18,  O2: 20.8, CH4: 4.1  } },
    { id:'INC-004', date:'2026-01-29', time:'14:51', worker:'Kamla Singh', badge:'SW-007', location:'MH-3300 · Zone D', type:'Fatigue Flag Dismissed',       supervisor:'Raj Mehta',    overrideUsed:true,  ppeUploaded:true,  gasTest:true,  severity:'medium',
      gasAtIncident: { H2S: 2.1, CO: 190, O2: 19.2, CH4: 14.7 } },
];

const LEADERBOARD = [
    { rank:1, name:'Anwar Sheikh', badge:'SW-055', score:96, years:7, streak:22, ppeCompliance:100, incidentFree:true,  subsidy:'Eligible'      },
    { rank:2, name:'Suresh Babu',  badge:'SW-018', score:94, years:5, streak:12, ppeCompliance:100, incidentFree:true,  subsidy:'Eligible'      },
    { rank:3, name:'Kamla Singh',  badge:'SW-007', score:88, years:4, streak:7,  ppeCompliance: 97, incidentFree:true,  subsidy:'Near-Eligible' },
    { rank:4, name:'Ravi Kumar',   badge:'SW-041', score:87, years:3, streak:4,  ppeCompliance: 89, incidentFree:false, subsidy:'—'             },
    { rank:5, name:'Deepak Rao',   badge:'SW-060', score:78, years:2, streak:3,  ppeCompliance: 74, incidentFree:false, subsidy:'—'             },
    { rank:6, name:'Meena Devi',   badge:'SW-029', score:72, years:2, streak:2,  ppeCompliance: 68, incidentFree:false, subsidy:'—'             },
];

/* ── Ward-level data for Decision Support ─────────────── */
const WARD_JOBS_DATA = {
    W1: [{ risk:'Low' },{ risk:'Low' },{ risk:'Medium' },{ risk:'Low' },{ risk:'Medium' }],
    W2: [{ risk:'High-risk' },{ risk:'Medium' },{ risk:'High-risk' },{ risk:'Low' },{ risk:'High-risk' },{ risk:'Medium' }],
    W3: [{ risk:'Medium' },{ risk:'Low' },{ risk:'Medium' },{ risk:'Low' }],
    W4: [{ risk:'High-risk' },{ risk:'High-risk' },{ risk:'High-risk' },{ risk:'Medium' },{ risk:'High-risk' }],
    W5: [{ risk:'High-risk' },{ risk:'High-risk' },{ risk:'Medium' },{ risk:'High-risk' },{ risk:'Medium' },{ risk:'High-risk' }],
    W6: [{ risk:'Medium' },{ risk:'Low' },{ risk:'Medium' },{ risk:'Medium' }],
    W7: [{ risk:'Low' },{ risk:'Medium' },{ risk:'Low' },{ risk:'Low' }],
    W8: [{ risk:'Medium' },{ risk:'Low' },{ risk:'High-risk' },{ risk:'Low' }],
};
const WARD_INC_DATA  = { W1:2, W2:6, W3:0, W4:7, W5:4, W6:3, W7:1, W8:2 };
const WARD_WASTE_PCT = { W1:0.08, W2:0.12, W3:0.25, W4:0.18, W5:0.15, W6:0.05, W7:0.03, W8:0.28 };

function generateWardRecommendations() {
    return WARD_LABELS.map(ward => {
        const jobs          = WARD_JOBS_DATA[ward] || [];
        const highRisk      = jobs.filter(j => j.risk === 'High-risk').length;
        const total         = jobs.length;
        const highRiskRatio = total ? highRisk / total : 0;
        const hazardous     = WARD_WASTE_PCT[ward] || 0;
        const incidentCount = WARD_INC_DATA[ward]  || 0;

        let recommendation, type;
        if (highRiskRatio > 0.4) {
            type = 'equipment';
            recommendation = 'यहाँ मेकेनाइज़्ड सफाई उपकरण और गैस टेस्टिंग पर ध्यान दें';
        } else if (hazardous > 0.2) {
            type = 'waste';
            recommendation = 'इस वार्ड में अलग से हानिकारक कचरा संग्रहण की ज़रूरत है';
        } else if (incidentCount > 5) {
            type = 'training';
            recommendation = 'वर्करों के लिए अतिरिक्त ट्रेनिंग सेशंस करें';
        } else {
            type = 'ok';
            recommendation = 'मौजूदा प्रैक्टिस जारी रखें, कोई बड़ा जोखिम पैटर्न नहीं दिख रहा';
        }
        return { ward, highRiskRatio, hazardous, incidentCount, recommendation, type };
    });
}

const WARD_RECS = generateWardRecommendations();

function buildWardSnapshot(ward) {
    const jobs = WARD_JOBS_DATA[ward] || [];
    const totalJobs = jobs.length;
    const highRiskJobs = jobs.filter(j => String(j.risk || '').toLowerCase().includes('high')).length;
    const mediumRiskJobs = jobs.filter(j => String(j.risk || '').toLowerCase().includes('medium')).length;
    const incidentCount = WARD_INC_DATA[ward] || 0;
    const hazardousWastePct = WARD_WASTE_PCT[ward] || 0;

    const ppeCompliance = Math.max(70, Math.round(98 - incidentCount * 2 - hazardousWastePct * 20));

    const trendSeed = [incidentCount + 1, incidentCount, Math.max(0, incidentCount - 1)];

    return {
        jobs,
        totalJobs,
        highRiskJobs,
        mediumRiskJobs,
        incidentCount,
        hazardousWastePct,
        ppeCompliance,
        incidentTrend: trendSeed,
    };
}

function renderAiMarkdown(text) {
    if (!text) return null;

    const lines = String(text).split(/\r?\n/);
    const elements = [];
    let listItems = [];

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(
                <ul key={`ds-md-ul-${elements.length}`} className="ds-ai-md-list">
                    {listItems}
                </ul>
            );
            listItems = [];
        }
    };

    const renderInline = (value, idx) => {
        const parts = [];
        const regex = /\*\*(.+?)\*\*/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(value)) !== null) {
            if (match.index > lastIndex) {
                parts.push(value.slice(lastIndex, match.index));
            }
            parts.push(
                <strong key={`ds-md-b-${idx}-${match.index}`}>
                    {match[1]}
                </strong>
            );
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < value.length) {
            parts.push(value.slice(lastIndex));
        }

        return parts.length > 0 ? parts : value;
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
            flushList();
            elements.push(<div key={`ds-md-space-${index}`} className="ds-ai-md-space" />);
            return;
        }

        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            flushList();
            const level = headingMatch[1].length;
            const Tag = level <= 2 ? 'h4' : 'h5';
            elements.push(
                <Tag key={`ds-md-h-${index}`} className="ds-ai-md-heading">
                    {renderInline(headingMatch[2], index)}
                </Tag>
            );
            return;
        }

        const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
            listItems.push(
                <li key={`ds-md-li-${index}`}>
                    {renderInline(bulletMatch[1], index)}
                </li>
            );
            return;
        }

        const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
        if (numberedMatch) {
            listItems.push(
                <li key={`ds-md-li-${index}`}>
                    {renderInline(numberedMatch[1], index)}
                </li>
            );
            return;
        }

        flushList();
        elements.push(
            <p key={`ds-md-p-${index}`} className="ds-ai-md-paragraph">
                {renderInline(trimmed, index)}
            </p>
        );
    });

    flushList();
    return elements;
}

function normalizeIncidentSeverity(severity = 'low') {
    const v = String(severity || '').toLowerCase();
    if (v === 'critical' || v === 'high') return 'high';
    if (v === 'warning' || v === 'medium') return 'medium';
    return 'low';
}

function buildLiveIncidentFromPostmortem(event = {}) {
    const ts = event.generatedAt ? new Date(event.generatedAt) : new Date();
    const date = Number.isNaN(ts.getTime()) ? new Date().toISOString().slice(0, 10) : ts.toISOString().slice(0, 10);
    const time = event.eventTime || (Number.isNaN(ts.getTime()) ? new Date().toTimeString().slice(0, 5) : ts.toTimeString().slice(0, 5));
    const zone = event.zone || 'Zone N/A';
    const location = event.location || 'Field location';
    const eventType = String(event.eventType || '').toUpperCase();
    const hazard = String(event.hazard || '').trim();

    return {
        id: `AUTO-${event.incidentId || event.id || Date.now()}`,
        date,
        time,
        worker: event.workerName || 'Unknown Worker',
        badge: event.badge || `SW-${String(event.workerId || 'NA')}`,
        location: `${location} · ${zone}`,
        type: eventType === 'SOS_MANUAL'
            ? 'Auto Postmortem — Manual SOS'
            : `Auto Postmortem — ${hazard || 'Hazard Report'}`,
        supervisor: 'Auto Incident Engine',
        overrideUsed: false,
        ppeUploaded: false,
        gasTest: false,
        severity: normalizeIncidentSeverity(event.severity),
        gasAtIncident: null,
        source: 'auto',
        postmortem: {
            timeline: Array.isArray(event.timeline) ? event.timeline : [],
            probableRootCause: String(event.probableRootCause || ''),
            correctiveActions: Array.isArray(event.correctiveActions) ? event.correctiveActions : [],
            confidence: String(event.confidence || 'मध्यम'),
            summaryMarkdown: String(event.summaryMarkdown || ''),
        },
    };
}

/* ── Safe Route & Team Planning — today's assignments ─────── */
const TODAY_ASSIGNMENTS = [
    // Ravi Kumar — 3 High-risk (triggers overload) + spread across zones (triggers fatigue)
    { workerId:'SW-041', workerName:'Ravi Kumar',   jobId:'MH-4420', risk:'High-risk', zone:'Zone C', lat:19.0640, lng:72.8820 },
    { workerId:'SW-041', workerName:'Ravi Kumar',   jobId:'MH-0078', risk:'High-risk', zone:'Zone B', lat:19.0700, lng:72.8720 },
    { workerId:'SW-041', workerName:'Ravi Kumar',   jobId:'MH-5501', risk:'High-risk', zone:'Zone D', lat:19.0950, lng:72.8950 },
    // Suresh Babu — 1 Medium + 1 Low
    { workerId:'SW-018', workerName:'Suresh Babu',  jobId:'MH-2215', risk:'Medium',    zone:'Zone A', lat:19.0880, lng:72.8900 },
    { workerId:'SW-018', workerName:'Suresh Babu',  jobId:'MH-1874', risk:'Low',       zone:'Zone C', lat:19.0710, lng:72.8730 },
    // Meena Devi — 1 High-risk + 1 Low
    { workerId:'SW-029', workerName:'Meena Devi',   jobId:'MH-0933', risk:'High-risk', zone:'Zone A', lat:19.0760, lng:72.8600 },
    { workerId:'SW-029', workerName:'Meena Devi',   jobId:'MH-4402', risk:'Low',       zone:'Zone A', lat:19.0770, lng:72.8615 },
    // Kamla Singh — 1 High-risk + 1 Medium
    { workerId:'SW-007', workerName:'Kamla Singh',  jobId:'MH-3310', risk:'High-risk', zone:'Zone D', lat:19.0820, lng:72.8955 },
    { workerId:'SW-007', workerName:'Kamla Singh',  jobId:'MH-6610', risk:'Medium',    zone:'Zone E', lat:19.0835, lng:72.8560 },
    // Anwar Sheikh — 1 Low (lightest load → best swap target)
    { workerId:'SW-055', workerName:'Anwar Sheikh', jobId:'MH-0521', risk:'Low',       zone:'Zone B', lat:19.0825, lng:72.8555 },
    // Deepak Rao — 1 Medium
    { workerId:'SW-060', workerName:'Deepak Rao',   jobId:'MH-2200', risk:'Medium',    zone:'Zone F', lat:19.0645, lng:72.8825 },
];

function planHaversineKm(la1, lo1, la2, lo2) {
    const R = 6371, r = Math.PI / 180;
    const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function planRouteKm(jobs) {
    let d = 0;
    for (let i = 1; i < jobs.length; i++) d += planHaversineKm(jobs[i-1].lat, jobs[i-1].lng, jobs[i].lat, jobs[i].lng);
    return d;
}

function evaluatePlanLocally(assignments) {
    const byWorker = assignments.reduce((acc, job) => {
        if (!acc[job.workerId]) acc[job.workerId] = [];
        acc[job.workerId].push(job);
        return acc;
    }, {});
    const issues = [];
    Object.entries(byWorker).forEach(([workerId, wJobs]) => {
        const { workerName } = wJobs[0];
        const hrCount = wJobs.filter(j => j.risk === 'High-risk').length;
        if (hrCount > 2) {
            issues.push({
                id: `overload-${workerId}`, workerId, workerName, type: 'overload', severity: 'high',
                message: `वर्कर ${workerName} (${workerId}) के पास आज ${hrCount} हाई-रिस्क जॉब्स हैं — अधिकतम 2 की अनुमति है`,
                affectedJobs: wJobs.filter(j => j.risk === 'High-risk').map(j => j.jobId),
            });
        }
        if (wJobs.length >= 2) {
            const km = planRouteKm(wJobs);
            if (km > 3.5) {
                issues.push({
                    id: `fatigue-${workerId}`, workerId, workerName, type: 'fatigue', severity: 'medium',
                    message: `वर्कर ${workerName} के जॉब्स ${km.toFixed(1)} km में फैले हैं — लंबे रूट से थकान बढ़ सकती है`,
                    distanceKm: +km.toFixed(2),
                });
            }
        }
        if (wJobs.length > 3) {
            issues.push({
                id: `workload-${workerId}`, workerId, workerName, type: 'workload', severity: 'medium',
                message: `वर्कर ${workerName} को आज ${wJobs.length} जॉब्स असाइन हैं — एक शिफ्ट में बोझ अधिक है`,
            });
        }
    });
    return issues;
}

function suggestSwapForWorker(workerId, assignments) {
    const byWorker = assignments.reduce((acc, job) => {
        if (!acc[job.workerId]) acc[job.workerId] = { workerName: job.workerName, jobs: [] };
        acc[job.workerId].jobs.push(job);
        return acc;
    }, {});
    const extraHRJob = (byWorker[workerId]?.jobs ?? []).filter(j => j.risk === 'High-risk').at(-1);
    if (!extraHRJob) return null;
    let bestTarget = null, minHR = Infinity;
    Object.entries(byWorker).forEach(([wId, { workerName, jobs }]) => {
        if (wId === workerId) return;
        const hr = jobs.filter(j => j.risk === 'High-risk').length;
        if (hr < minHR) { minHR = hr; bestTarget = { workerId: wId, workerName }; }
    });
    if (!bestTarget) return null;
    const fromName = byWorker[workerId].workerName;
    return {
        jobId: extraHRJob.jobId, zone: extraHRJob.zone,
        toWorkerId: bestTarget.workerId, toWorkerName: bestTarget.workerName,
        message: `जॉब ${extraHRJob.jobId} (${extraHRJob.zone}) को ${fromName} से ${bestTarget.workerName} (${bestTarget.workerId}) को ट्रांसफर करें`,
    };
}

// Pre-compute per-worker route summary for the plan table
const WORKER_PLAN_SUMMARY = (() => {
    const byWorker = {};
    TODAY_ASSIGNMENTS.forEach(a => {
        if (!byWorker[a.workerId]) byWorker[a.workerId] = { workerId: a.workerId, workerName: a.workerName, jobs: [], highRiskCount: 0 };
        byWorker[a.workerId].jobs.push(a);
        if (a.risk === 'High-risk') byWorker[a.workerId].highRiskCount++;
    });
    return Object.values(byWorker).map(w => ({ ...w, routeKm: planRouteKm(w.jobs) }));
})();

function exportCSV(rows) {
    const headers = ['ID','Worker','Badge','Job','Zone','Entry Time','Exit Time','Duration','PPE','Gas','Supervisor','Date'];
    const lines = [
        headers.join(','),
        ...rows.map(r => [r.id,r.worker,r.badge,r.job,r.zone,r.entryTime,r.exitTime,r.duration,r.ppe,r.gas,r.supervisor,r.date].join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'safeWorker_audit.csv'; a.click();
    URL.revokeObjectURL(url);
}

/* ── Component ────────────────────────────────────────── */
export default function AdminDashboard() {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const { socket } = useSocket();

    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo]   = useState('');
    const [activeTab, setActiveTab] = useState('audit');
    const [nFilter,          setNFilter]          = useState('all');
    const [selectedWorkers,  setSelectedWorkers]  = useState(new Set());
    const [smsSent,          setSmsSent]          = useState(false);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [flaggedSups,      setFlaggedSups]      = useState(new Set());
    const [liveIncidents,    setLiveIncidents]    = useState([]);
    const [sanFilter,        setSanFilter]        = useState(false);
    const [selectedLeaders,  setSelectedLeaders]  = useState(new Set());
    const [jlgSubmitted,     setJlgSubmitted]     = useState(false);
    const [ersuDeployed,     setErsuDeployed]     = useState(false);
    const [dsExpanded,       setDsExpanded]       = useState(false);
    const [aiStates,         setAiStates]         = useState({});
    const [speakState,       setSpeakState]       = useState({ ward: null });
    const typingRefs = useRef({});
    const planCopilotTypingRef = useRef(null);

    useEffect(() => {
        const refs = typingRefs.current;
        return () => {
            Object.values(refs).forEach(clearTimeout);
            if (planCopilotTypingRef.current) clearTimeout(planCopilotTypingRef.current);
        };
    }, []);

    useEffect(() => {
        if (!socket) return;

        const onAutoPostmortem = (event) => {
            const next = buildLiveIncidentFromPostmortem(event);
            setLiveIncidents((prev) => [next, ...prev.filter(i => i.id !== next.id)].slice(0, 12));
        };

        socket.on('auto_incident_postmortem', onAutoPostmortem);
        return () => {
            socket.off('auto_incident_postmortem', onAutoPostmortem);
        };
    }, [socket]);

    const startAI = async (ward) => {
        if (typingRefs.current[ward]) clearTimeout(typingRefs.current[ward]);

        setAiStates(prev => ({
            ...prev,
            [ward]: { phase: 'loading', text: '', fullText: '', evidence: null, error: '' },
        }));

        try {
            const res = await fetch('http://localhost:3001/api/ai/ward-intelligence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ward,
                    lang: 'hi',
                    wardSnapshot: buildWardSnapshot(ward),
                }),
                signal: AbortSignal.timeout(30000),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to generate AI analysis');

            const full = data.analysis || '';
            const evidence = data.evidence || null;

            let i = 0;
            const tick = () => {
                i++;
                setAiStates(prev => ({
                    ...prev,
                    [ward]: {
                        phase: i < full.length ? 'typing' : 'done',
                        text: full.slice(0, i),
                        fullText: full,
                        evidence,
                        error: '',
                    },
                }));
                if (i < full.length) typingRefs.current[ward] = setTimeout(tick, 16);
            };
            typingRefs.current[ward] = setTimeout(tick, 16);
        } catch (err) {
            setAiStates(prev => ({
                ...prev,
                [ward]: {
                    phase: 'error',
                    text: '',
                    fullText: '',
                    evidence: null,
                    error: err.message || 'AI analysis failed',
                },
            }));
        }
    };

    const toggleSpeak = (ward) => {
        if (speakState.ward === ward && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            setSpeakState({ ward: null });
            return;
        }

        const state = aiStates[ward];
        const speakText = (state?.fullText || state?.text || '').trim();
        if (!speakText) return;

        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(speakText);
        msg.lang = /[\u0900-\u097F]/.test(speakText) ? 'hi-IN' : 'en-IN';
        msg.rate = 0.88;
        msg.onend = () => setSpeakState(s => s.ward === ward ? { ward: null } : s);
        window.speechSynthesis.speak(msg);
        setSpeakState({ ward });
    };

    // Plan safety check state
    const [planModal,     setPlanModal]     = useState(false);
    const [planIssues,    setPlanIssues]    = useState(null);   // null = not yet run
    const [swapMap,       setSwapMap]       = useState({});
    const [planConfirmed, setPlanConfirmed] = useState(false);
    const [planCopilot,   setPlanCopilot]   = useState(null);

    const runSafetyCheck = () => {
        setPlanIssues(null);
        setSwapMap({});
        setPlanConfirmed(false);
        // Call backend, fall back to local evaluation seamlessly
        fetch('http://localhost:3001/api/plan/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignments: TODAY_ASSIGNMENTS }),
            signal: AbortSignal.timeout(2000),
        })
            .then(r => r.json())
            .then(data => setPlanIssues(data.issues))
            .catch(() => setPlanIssues(evaluatePlanLocally(TODAY_ASSIGNMENTS)))
            .finally(() => setPlanModal(true));
    };

    const runPlanCopilot = async () => {
        if (planCopilotTypingRef.current) clearTimeout(planCopilotTypingRef.current);

        setPlanCopilot({
            phase: 'loading',
            text: '',
            fullText: '',
            evidence: null,
            actions: [],
            error: '',
        });

        try {
            const res = await fetch('http://localhost:3001/api/plan/copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignments: TODAY_ASSIGNMENTS,
                    issues: Array.isArray(planIssues) ? planIssues : undefined,
                    lang: 'hi',
                }),
                signal: AbortSignal.timeout(30000),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to generate plan copilot analysis');

            const full = data.analysis || '';
            const evidence = data.evidence || null;
            const actions = Array.isArray(data.actions) ? data.actions : [];

            let i = 0;
            const tick = () => {
                i++;
                setPlanCopilot({
                    phase: i < full.length ? 'typing' : 'done',
                    text: full.slice(0, i),
                    fullText: full,
                    evidence,
                    actions,
                    error: '',
                });
                if (i < full.length) planCopilotTypingRef.current = setTimeout(tick, 14);
            };

            planCopilotTypingRef.current = setTimeout(tick, 14);
        } catch (err) {
            setPlanCopilot({
                phase: 'error',
                text: '',
                fullText: '',
                evidence: null,
                actions: [],
                error: err.message || 'AI plan copilot failed',
            });
        }
    };

    const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

    const filteredLog = useMemo(() => AUDIT_LOG.filter(r => {
        const q = search.toLowerCase();
        const matchText =
            !q ||
            r.worker.toLowerCase().includes(q) ||
            r.job.toLowerCase().includes(q) ||
            r.zone.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q);
        const matchFrom = !dateFrom || r.date >= dateFrom;
        const matchTo   = !dateTo   || r.date <= dateTo;
        return matchText && matchFrom && matchTo;
    }), [search, dateFrom, dateTo]);

    const filteredNamaste = useMemo(
        () => nFilter === 'all' ? NAMASTE_SSW : NAMASTE_SSW.filter(w => w.status === nFilter),
        [nFilter]
    );
    const filteredLeaders = useMemo(
        () => sanFilter ? LEADERBOARD.filter(w => w.ppeCompliance === 100) : LEADERBOARD,
        [sanFilter]
    );
    const incidentFeed = useMemo(
        () => [...liveIncidents, ...INCIDENTS],
        [liveIncidents]
    );

    return (
        <div className="ad-root">
            {/* ── TOP BAR ──────────────────────────── */}
            <header className="ad-header">
                <div className="ad-header-left">
                    <div className="ad-logo"><Shield size={18}/></div>
                    <div>
                        <div className="ad-title">City Administrator Portal</div>
                        <div className="ad-subtitle">{currentUser?.name} · {currentUser?.zone}</div>
                    </div>
                </div>
                <button className="ad-logout" onClick={handleLogout}><LogOut size={15}/> Logout</button>
            </header>

            <div className="ad-body">
                {/* ── KPI ROW ───────────────────────── */}
                <section className="ad-kpi-row">
                    {KPI.map(k => (
                        <div key={k.label} className="ad-kpi-card">
                            <div className="ad-kpi-icon">{k.icon}</div>
                            <div className="ad-kpi-body">
                                <div className="ad-kpi-value">{k.value}</div>
                                <div className="ad-kpi-label">{k.label}</div>
                                <div className="ad-kpi-row2">
                                    <span className="ad-kpi-sub">{k.sub}</span>
                                    <span className={`ad-kpi-delta ${k.delta.startsWith('+') ? 'pos' : 'neg'}`}>{k.delta}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>

                {/* ── CHARTS ROW ───────────────────── */}
                <section className="ad-charts-row">
                    <div className="ad-chart-card">
                        <div className="ad-chart-title">Weekly Entries by Zone</div>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={BAR_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis dataKey="zone" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13 }}
                                    cursor={{ fill: 'rgba(23,23,23,0.06)' }}
                                />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="entries"   fill="#404040" radius={[4,4,0,0]} name="Entries" />
                                <Bar dataKey="incidents" fill="#d4d4d4" radius={[4,4,0,0]} name="Incidents" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="ad-chart-card">
                        <div className="ad-chart-title">12-Week Incident Trend</div>
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={LINE_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis dataKey="week" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13 }}
                                />
                                <Line dataKey="incidents" stroke="#171717" strokeWidth={2.5} dot={{ r: 4, fill: '#171717' }} activeDot={{ r: 6 }} name="Incidents" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* ── HEATMAP ──────────────────────── */}
                <section className="ad-card ad-heatmap-section">
                    <div className="ad-card-header">
                        <div className="ad-card-title">Risk Hotspot Heatmap — Incident Cluster Density</div>
                    </div>
                    <div className="ad-heatmap-wrap">
                        <div className="ad-heatmap-grid">
                            {/* Y axis labels */}
                            <div className="ad-hm-y-axis">
                                {ZONE_LABELS.map(l => <div key={l} className="ad-hm-label">{l}</div>)}
                            </div>
                            <div>
                                {/* X axis labels */}
                                <div className="ad-hm-x-axis">
                                    {WARD_LABELS.map(l => <div key={l} className="ad-hm-label">{l}</div>)}
                                </div>
                                {/* Cells */}
                                <div className="ad-hm-cells">
                                    {HEATMAP.map((row, ri) => row.map((val, ci) => (
                                        <div
                                            key={`${ri}-${ci}`}
                                            className="ad-hm-cell"
                                            title={`${ZONE_LABELS[ri]} / ${WARD_LABELS[ci]}: ${val} incidents`}
                                            style={{ opacity: val === 0 ? 0.05 : 0.12 + val * 0.088 }}
                                        />
                                    )))}
                                </div>
                            </div>
                        </div>
                        <div className="ad-hm-legend">
                            <span>Low</span>
                            <div className="ad-hm-gradient" />
                            <span>High</span>
                        </div>
                    </div>
                    <div className="ad-ersu-bar">
                        <div className="ad-ersu-info">
                            <MapPin size={13}/>
                            <strong>High-Risk Wards (&gt;5 manual entries/month):</strong>
                            <span className="ad-ersu-wards">Ward 4 – Zone C &nbsp;·&nbsp; Ward 5 – Zone D &nbsp;·&nbsp; Ward 4 – Zone B</span>
                        </div>
                        {!ersuDeployed ? (
                            <button className="ad-ersu-btn" onClick={()=>setErsuDeployed(true)}>
                                <Building2 size={13}/> Deploy ERSU Vehicle to These Wards
                            </button>
                        ) : (
                            <span className="ad-ersu-deployed">✓ ERSU deployment order sent to Zone C, D &amp; B</span>
                        )}
                    </div>
                </section>

                {/* ── DECISION SUPPORT ────────────────── */}
                <section className="ad-card">
                    <button
                        className={`ds-panel-header${dsExpanded ? ' open' : ''}`}
                        onClick={() => setDsExpanded(p => !p)}
                    >
                        <div className="ad-card-title" style={{ display:'flex', alignItems:'center', gap:8, color:'inherit' }}>
                            <Lightbulb size={15}/> Decision Support — वार्ड-स्तरीय कार्रवाई सुझाव
                        </div>
                        <div className="ds-header-right">
                            <span className="ds-ai-badge"><Zap size={11}/> Rules + AI Engine</span>
                            <span className="ds-chevron">{dsExpanded ? '▲' : '▼'}</span>
                        </div>
                    </button>
                    <div className={`ds-panel-body${dsExpanded ? ' open' : ''}`}>
                        <div className="ds-panel-inner">
                            <div className="ds-grid">
                                {WARD_RECS.map(rec => {
                                    const ai = aiStates[rec.ward];
                                    return (
                                        <div key={rec.ward} className={`ds-rec-card ds-rec--${rec.type}`}>
                                            <div className="ds-rec-top">
                                                <span className="ds-ward-badge">{rec.ward}</span>
                                                <span className={`ds-type-pill ds-type--${rec.type}`}>
                                                    {rec.type === 'equipment' ? '⚙ उपकरण' :
                                                     rec.type === 'waste'     ? '☣ कचरा'  :
                                                     rec.type === 'training'  ? '📚 ट्रेनिंग' : '✓ ठीक है'}
                                                </span>
                                            </div>
                                            <div className="ds-metrics">
                                                <div className="ds-metric-row">
                                                    <span className="ds-metric-label">उच्च जोखिम</span>
                                                    <div className="ds-bar-wrap">
                                                        <div className="ds-bar-fill" style={{
                                                            width: `${Math.round(rec.highRiskRatio * 100)}%`,
                                                            background: rec.highRiskRatio > 0.4 ? '#dc2626' : rec.highRiskRatio > 0.2 ? '#d97706' : '#16a34a',
                                                        }}/>
                                                    </div>
                                                    <span className="ds-metric-num">{Math.round(rec.highRiskRatio * 100)}%</span>
                                                </div>
                                                <div className="ds-mpill-row">
                                                    <span className="ds-mpill">{rec.incidentCount} घटनाएँ</span>
                                                    <span className="ds-mpill">{Math.round(rec.hazardous * 100)}% हानि. कचरा</span>
                                                </div>
                                            </div>
                                            <p className="ds-rec-text">{rec.recommendation}</p>
                                            {!ai ? (
                                                <button className="ds-ai-btn" onClick={() => startAI(rec.ward)}>
                                                    <Zap size={11}/> AI से विश्लेषण
                                                </button>
                                            ) : ai.phase === 'loading' ? (
                                                <div className="ds-ai-loading">
                                                    <span className="ds-spinner"/>
                                                    <span className="ds-loading-text">AI विश्लेषण कर रहा है…</span>
                                                </div>
                                            ) : ai.phase === 'error' ? (
                                                <div className="ds-ai-error">
                                                    <AlertTriangle size={12}/>
                                                    <span>{ai.error || 'AI analysis failed'}</span>
                                                    <button className="ds-ai-btn" onClick={() => startAI(rec.ward)}>
                                                        <Zap size={11}/> Retry
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="ds-ai-response">
                                                    <div className="ds-ai-label-row">
                                                        <div className="ds-ai-label"><Zap size={10}/> AI विश्लेषण</div>
                                                        <button
                                                            className="ds-speak-btn"
                                                            onClick={() => toggleSpeak(rec.ward)}
                                                            title={speakState.ward === rec.ward ? "बंद करें" : "सुनें"}
                                                        >
                                                            {speakState.ward === rec.ward
                                                                ? <VolumeX size={13}/>
                                                                : <Volume2 size={13}/>
                                                            }
                                                        </button>
                                                    </div>
                                                    {ai.evidence && (
                                                        <div className="ds-ai-evidence-grid">
                                                            <div className="ds-ai-evidence-item">
                                                                <span className="ds-ai-evidence-k">Risk Index</span>
                                                                <span className="ds-ai-evidence-v">{ai.evidence.riskIndex}/100</span>
                                                            </div>
                                                            <div className="ds-ai-evidence-item">
                                                                <span className="ds-ai-evidence-k">Priority</span>
                                                                <span className="ds-ai-evidence-v">{ai.evidence.actionPriority || 'monitor'}</span>
                                                            </div>
                                                            <div className="ds-ai-evidence-item">
                                                                <span className="ds-ai-evidence-k">High-Risk</span>
                                                                <span className="ds-ai-evidence-v">{ai.evidence.highRiskRatioPct}%</span>
                                                            </div>
                                                            <div className="ds-ai-evidence-item">
                                                                <span className="ds-ai-evidence-k">Incidents</span>
                                                                <span className="ds-ai-evidence-v">{ai.evidence.incidentCount}</span>
                                                            </div>
                                                            <div className="ds-ai-evidence-item">
                                                                <span className="ds-ai-evidence-k">PPE</span>
                                                                <span className="ds-ai-evidence-v">{ai.evidence.ppeCompliance}%</span>
                                                            </div>
                                                            <div className="ds-ai-evidence-item">
                                                                <span className="ds-ai-evidence-k">Haz Waste</span>
                                                                <span className="ds-ai-evidence-v">{ai.evidence.hazardousWastePctValue}%</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="ds-ai-text">
                                                        {renderAiMarkdown(ai.text)}
                                                        {ai.phase === 'typing' && <span className="ds-cursor">|</span>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── DATA TABS ────────────────────── */}
                <section className="ad-card">
                    <div className="ad-card-header">
                        <div className="ad-tabs">
                            <button className={`ad-tab ${activeTab==='audit'?'active':''}`} onClick={()=>setActiveTab('audit')}>
                                <FileText size={14}/> Audit Log
                            </button>
                            <button className={`ad-tab ${activeTab==='health'?'active':''}`} onClick={()=>setActiveTab('health')}>
                                <Users size={14}/> Worker Health
                            </button>
                            <button className={`ad-tab ${activeTab==='namaste'?'active':''}`} onClick={()=>setActiveTab('namaste')}>
                                <Shield size={14}/> NAMASTE Compliance
                            </button>
                            <button className={`ad-tab ${activeTab==='incident'?'active':''}`} onClick={()=>setActiveTab('incident')}>
                                <Activity size={14}/> Incident Review
                            </button>
                            <button className={`ad-tab ${activeTab==='sanipreneur'?'active':''}`} onClick={()=>setActiveTab('sanipreneur')}>
                                <Award size={14}/> Sanipreneur
                            </button>
                            <button className={`ad-tab ${activeTab==='plan'?'active':''}`} onClick={()=>setActiveTab('plan')}>
                                <MapPin size={14}/> Route Plan
                            </button>
                        </div>
                        {activeTab === 'audit' && (
                            <button className="ad-export-btn" onClick={() => exportCSV(filteredLog)}>
                                <Download size={14}/> Export CSV
                            </button>
                        )}
                    </div>

                    {activeTab === 'audit' && (
                        <>
                            <div className="ad-filters">
                                <div className="ad-search-wrap">
                                    <Search size={15} className="ad-search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search worker, job, zone…"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="ad-search"
                                    />
                                </div>
                                <div className="ad-date-range">
                                    <Calendar size={14} />
                                    <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="ad-date-input" />
                                    <span>—</span>
                                    <input type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   className="ad-date-input" />
                                </div>
                                <div className="ad-result-count">{filteredLog.length} records</div>
                            </div>
                            <div className="ad-table-wrap">
                                <table className="ad-table">
                                    <thead>
                                        <tr>
                                            {['Entry ID','Worker','Badge','Job','Zone','Entry','Exit','Duration','PPE','Gas','Supervisor','Date'].map(h=>(
                                                <th key={h}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLog.map(r => (
                                            <tr key={r.id}>
                                                <td><code>{r.id}</code></td>
                                                <td>{r.worker}</td>
                                                <td><code>{r.badge}</code></td>
                                                <td><code>{r.job}</code></td>
                                                <td>{r.zone}</td>
                                                <td>{r.entryTime}</td>
                                                <td>{r.exitTime}</td>
                                                <td>{r.duration}</td>
                                                <td><span className={`ad-check ${r.ppe==='✓'?'pass':'fail'}`}>{r.ppe}</span></td>
                                                <td><span className={`ad-check ${r.gas==='✓'?'pass':'fail'}`}>{r.gas}</span></td>
                                                <td>{r.supervisor}</td>
                                                <td>{r.date}</td>
                                            </tr>
                                        ))}
                                        {filteredLog.length === 0 && (
                                            <tr><td colSpan={12} className="ad-no-results">No records match your filters.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {activeTab === 'health' && (
                        <div className="ad-table-wrap">
                            <table className="ad-table">
                                <thead>
                                    <tr>
                                        {['Worker','Badge','Safety Score','Total Entries','Medical Checkup','Streak (clean months)','Recognition'].map(h=>(
                                            <th key={h}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {WORKER_HEALTH.map(w => (
                                        <tr key={w.badge}>
                                            <td>{w.name}</td>
                                            <td><code>{w.badge}</code></td>
                                            <td>
                                                <div className="ad-score-wrap">
                                                    <div className="ad-score-bar">
                                                        <div className="ad-score-fill" style={{ width: `${w.score}%` }} />
                                                    </div>
                                                    <span>{w.score}%</span>
                                                </div>
                                            </td>
                                            <td>{w.entries}</td>
                                            <td>
                                                <span className={`ad-checkup ${w.checkup==='OVERDUE'?'overdue':w.checkup==='Up to date'?'ok':''}`}>
                                                    {w.checkup}
                                                </span>
                                            </td>
                                            <td>{w.streak} months</td>
                                            <td>
                                                {w.incidentFree
                                                    ? <span className="ad-award">🏅 Incident-Free</span>
                                                    : <span className="ad-no-award">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── NAMASTE COMPLIANCE ──────────────────────────── */}
                    {activeTab === 'namaste' && (
                        <>
                            <div className="ad-filters">
                                <div className="ad-wf-info">
                                    <Shield size={14}/>
                                    <span>NAMASTE Scheme — Worker Profiling &amp; Entitlement Verification (MoHUA)</span>
                                </div>
                                <div className="ad-wf-filters">
                                    {[
                                        { key:'all',    label:'All Workers'       },
                                        { key:'red',    label:'🔴 Non-Compliant'    },
                                        { key:'yellow', label:'🟡 Expiring Soon'    },
                                        { key:'green',  label:'🟢 Compliant'         },
                                    ].map(f => (
                                        <button key={f.key}
                                            className={`ad-wf-filter-btn${nFilter===f.key?' active':''}`}
                                            onClick={()=>{setNFilter(f.key);setSmsSent(false);setSelectedWorkers(new Set());}}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                                {selectedWorkers.size > 0 && !smsSent && (
                                    <button className="ad-sms-btn" onClick={()=>setSmsSent(true)}>
                                        <MessageSquare size={13}/> Send SMS to {selectedWorkers.size} Worker{selectedWorkers.size>1?'s':''}
                                    </button>
                                )}
                                {smsSent && <span className="ad-action-confirm">✓ SMS dispatched to {selectedWorkers.size} worker{selectedWorkers.size>1?'s':''} for next profiling camp</span>}
                            </div>
                            <div className="ad-table-wrap">
                                <table className="ad-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                <input type="checkbox" onChange={e=>{
                                                    setSmsSent(false);
                                                    if(e.target.checked) setSelectedWorkers(new Set(filteredNamaste.map(w=>w.id)));
                                                    else setSelectedWorkers(new Set());
                                                }}/>
                                            </th>
                                            {['Badge','Name','Zone','Aadhaar','PM-JAY Insurance','Safety Training','KYC','Last Camp','Compliance','Action'].map(h=><th key={h}>{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredNamaste.map(w=>(
                                            <tr key={w.id}>
                                                <td>
                                                    <input type="checkbox"
                                                        checked={selectedWorkers.has(w.id)}
                                                        onChange={e=>{
                                                            const n=new Set(selectedWorkers);
                                                            e.target.checked?n.add(w.id):n.delete(w.id);
                                                            setSelectedWorkers(n);setSmsSent(false);
                                                        }}/>
                                                </td>
                                                <td><code>{w.id}</code></td>
                                                <td>{w.name}</td>
                                                <td>{w.zone}</td>
                                                <td><span className={`ad-tl ${w.aadhaar==='✓'?'tl-green':'tl-red'}`}>{w.aadhaar}</span></td>
                                                <td><span className={`ad-tl ${w.pmjay==='✓'?'tl-green':'tl-red'}`}>{w.pmjay==='✓'?'Enrolled':'Missing'}</span></td>
                                                <td><span className={`ad-tl ${w.training_ok?'tl-green':'tl-red'}`}>{w.training}</span></td>
                                                <td><span className={`ad-tl ${w.kyc==='✓'?'tl-green':'tl-red'}`}>{w.kyc}</span></td>
                                                <td>{w.lastCamp}</td>
                                                <td><span className={`ad-tl-pill tl-${w.status}`}>{w.status==='red'?'Non-Compliant':w.status==='yellow'?'Expiring':'Compliant'}</span></td>
                                                <td><button className="ad-view-id-btn"><ExternalLink size={12}/> View ID Card</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* ── INCIDENT REVIEW ────────────────────────────── */}
                    {activeTab === 'incident' && (
                        <>
                            <div className="ad-filters">
                                <div className="ad-wf-info">
                                    <Activity size={14}/>
                                    <span>Incident Investigation &amp; Root Cause Analysis — Post-Incident Digital Audit</span>
                                </div>
                            </div>
                            <div className="ad-incident-list">
                                {incidentFeed.map(inc=>(
                                    <div key={inc.id}
                                        className={`ad-incident-row sev-row-${inc.severity}${selectedIncident?.id===inc.id?' expanded':''}`}
                                        onClick={()=>setSelectedIncident(selectedIncident?.id===inc.id ? null : inc)}>
                                        <div className="ad-incident-summary">
                                            <div className="ad-inc-left">
                                                <span className={`ad-sev-badge sev-${inc.severity}`}>{inc.severity.toUpperCase()}</span>
                                                <div>
                                                    <div className="ad-inc-type">{inc.type}</div>
                                                    <div className="ad-inc-meta">{inc.id} · {inc.worker} ({inc.badge}) · {inc.location} · {inc.date} {inc.time}</div>
                                                </div>
                                            </div>
                                            <div className="ad-inc-right">
                                                {inc.source === 'auto' && (
                                                    <span className="ad-auto-badge"><Zap size={12}/> Auto Postmortem</span>
                                                )}
                                                {inc.overrideUsed && <span className="ad-override-badge">⚠ Override Used</span>}
                                                <span className="ad-inc-chevron">{selectedIncident?.id===inc.id?'▲':'▼'}</span>
                                            </div>
                                        </div>
                                        {selectedIncident?.id===inc.id && (
                                            <div className="ad-incident-detail" onClick={e=>e.stopPropagation()}>
                                                <div className="ad-inc-detail-grid">
                                                    {inc.source === 'auto' ? (
                                                        <div className="ad-inc-det-card">
                                                            <div className="ad-inc-det-title">Auto Signal Snapshot</div>
                                                            <div className="ad-inc-det-row"><span>Event Type</span><strong>{inc.type}</strong></div>
                                                            <div className="ad-inc-det-row"><span>Severity</span><span className={`ad-sev-badge sev-${inc.severity}`}>{String(inc.severity || '').toUpperCase()}</span></div>
                                                            <div className="ad-inc-det-row"><span>Hazard</span><strong>{inc.type.includes('Hazard') ? inc.type.replace('Auto Postmortem — ', '') : 'SOS'}</strong></div>
                                                            <div className="ad-inc-det-row"><span>AI Confidence</span><strong>{inc.postmortem?.confidence || 'मध्यम'}</strong></div>
                                                        </div>
                                                    ) : (
                                                        <div className="ad-inc-det-card">
                                                            <div className="ad-inc-det-title">Pre-Entry Gate Log</div>
                                                            <div className="ad-inc-det-row"><span>PPE Photo Uploaded</span><span className={`ad-tl ${inc.ppeUploaded?'tl-green':'tl-red'}`}>{inc.ppeUploaded?'✓ Uploaded':'✗ Missing'}</span></div>
                                                            <div className="ad-inc-det-row"><span>Gas Reading Confirmed</span><span className={`ad-tl ${inc.gasTest?'tl-green':'tl-red'}`}>{inc.gasTest?'✓ Safe confirmed':'✗ Not confirmed'}</span></div>
                                                            <div className="ad-inc-det-row"><span>Supervisor Override Used</span><span className={`ad-tl ${inc.overrideUsed?'tl-red':'tl-green'}`}>{inc.overrideUsed?'✗ Yes — bypass detected':'✓ No'}</span></div>
                                                        </div>
                                                    )}
                                                    <div className="ad-inc-det-card">
                                                        <div className="ad-inc-det-title">Incident Context</div>
                                                        <div className="ad-inc-det-row"><span>Location</span><strong>{inc.location}</strong></div>
                                                        <div className="ad-inc-det-row"><span>Date / Time</span><strong>{inc.date} · {inc.time}</strong></div>
                                                        <div className="ad-inc-det-row"><span>Supervisor on Duty</span><strong>{inc.supervisor}</strong></div>
                                                        <div className="ad-inc-det-row"><span>Type</span><strong>{inc.type}</strong></div>
                                                    </div>
                                                </div>
                                                {inc.postmortem && (
                                                    <div className="ad-inc-postmortem">
                                                        <div className="ad-inc-det-title">Auto Incident Postmortem</div>
                                                        <div className="ad-inc-postmortem-text">
                                                            {renderAiMarkdown(inc.postmortem.summaryMarkdown || '')}
                                                        </div>
                                                        {Array.isArray(inc.postmortem.correctiveActions) && inc.postmortem.correctiveActions.length > 0 && (
                                                            <div className="ad-inc-postmortem-actions">
                                                                {inc.postmortem.correctiveActions.slice(0, 3).map((a, idx) => (
                                                                    <div key={`pm-${inc.id}-${idx}`} className="ad-inc-postmortem-action">
                                                                        <span className="ad-inc-postmortem-action-label">A{idx + 1}</span>
                                                                        <span className="ad-inc-postmortem-action-text">{a.action}</span>
                                                                        <span className="ad-inc-postmortem-owner">Owner: {a.owner} · Due: {a.due}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {inc.gasAtIncident && (
                                                    <div className="ad-inc-gas-section">
                                                        <div className="ad-inc-det-title">Gas Readings at Incident</div>
                                                        <div className="ad-inc-gas-pills">
                                                            {[
                                                                { gas:'H2S', label:'H₂S', value: inc.gasAtIncident.H2S, unit:'ppm',   safe: inc.gasAtIncident.H2S <  1,    warn: inc.gasAtIncident.H2S < 10   },
                                                                { gas:'CO',  label:'CO',  value: inc.gasAtIncident.CO,  unit:'ppm',   safe: inc.gasAtIncident.CO  < 25,    warn: inc.gasAtIncident.CO  < 200  },
                                                                { gas:'O2',  label:'O₂',  value: inc.gasAtIncident.O2,  unit:'%',     safe: inc.gasAtIncident.O2  >= 19.5 && inc.gasAtIncident.O2 <= 23.5, warn: inc.gasAtIncident.O2  >= 16  },
                                                                { gas:'CH4', label:'CH₄', value: inc.gasAtIncident.CH4, unit:'% LEL', safe: inc.gasAtIncident.CH4 < 10,    warn: inc.gasAtIncident.CH4 < 25   },
                                                            ].map(({ gas, label, value, unit, safe, warn }) => {
                                                                const cls = safe ? 'gas-safe' : warn ? 'gas-warn' : 'gas-danger';
                                                                return (
                                                                    <span key={gas} className={`ad-gas-badge ${cls}`}>
                                                                        {label} {value}{unit}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="ad-inc-actions">
                                                    {inc.overrideUsed && !flaggedSups.has(inc.id) && (
                                                        <button className="ad-flag-btn" onClick={()=>{const n=new Set(flaggedSups);n.add(inc.id);setFlaggedSups(n);}}>
                                                            <Flag size={13}/> Flag {inc.supervisor} for Disciplinary Review
                                                        </button>
                                                    )}
                                                    {flaggedSups.has(inc.id) && (
                                                        <span className="ad-action-confirm">⚑ {inc.supervisor} — Disciplinary review initiated</span>
                                                    )}
                                                    <button className="ad-export-btn" onClick={()=>{}}>
                                                        <Download size={13}/> Export Watermarked Audit Trail (PDF)
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── SANIPRENEUR ────────────────────────────────── */}
                    {activeTab === 'sanipreneur' && (
                        <>
                            <div className="ad-filters">
                                <div className="ad-wf-info">
                                    <Award size={14}/>
                                    <span>Swachhata Udyami Yojana — Identify top workers for vehicle subsidy &amp; JLG formation (up to ₹5 Lakhs)</span>
                                </div>
                                <label className="ad-toggle-label">
                                    <input type="checkbox" checked={sanFilter} onChange={e=>{setSanFilter(e.target.checked);setSelectedLeaders(new Set());setJlgSubmitted(false);}}/>
                                    <span>100% PPE Compliance (12 months only)</span>
                                </label>
                                {selectedLeaders.size > 0 && !jlgSubmitted && (
                                    <button className="ad-jlg-btn" onClick={()=>setJlgSubmitted(true)}>
                                        <Zap size={13}/> Form JLG &amp; Push {selectedLeaders.size} Profile{selectedLeaders.size>1?'s':''} to Banking Portal
                                    </button>
                                )}
                                {jlgSubmitted && <span className="ad-action-confirm">✓ {selectedLeaders.size} profile{selectedLeaders.size>1?'s':''} submitted to State Banking Portal (Swachhata Udyami Yojana)</span>}
                            </div>
                            <div className="ad-table-wrap">
                                <table className="ad-table">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            {['Rank','Worker','Badge','Safety Score','Exp.','Clean Streak','PPE (12m)','Subsidy Status'].map(h=><th key={h}>{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLeaders.map(w=>(
                                            <tr key={w.badge}>
                                                <td>
                                                    {w.subsidy==='Eligible' && (
                                                        <input type="checkbox"
                                                            checked={selectedLeaders.has(w.badge)}
                                                            onChange={e=>{const n=new Set(selectedLeaders);e.target.checked?n.add(w.badge):n.delete(w.badge);setSelectedLeaders(n);setJlgSubmitted(false);}}/>
                                                    )}
                                                </td>
                                                <td><strong>#{w.rank}</strong></td>
                                                <td>{w.name}</td>
                                                <td><code>{w.badge}</code></td>
                                                <td>
                                                    <div className="ad-score-wrap">
                                                        <div className="ad-score-bar"><div className="ad-score-fill" style={{width:`${w.score}%`}}/></div>
                                                        <span>{w.score}%</span>
                                                    </div>
                                                </td>
                                                <td>{w.years} yrs</td>
                                                <td>{w.streak} mo</td>
                                                <td>
                                                    <div className="ad-score-wrap">
                                                        <div className="ad-score-bar"><div className={`ad-score-fill${w.ppeCompliance===100?' fill-full':''}`} style={{width:`${w.ppeCompliance}%`}}/></div>
                                                        <span>{w.ppeCompliance}%</span>
                                                    </div>
                                                </td>
                                                <td><span className={`ad-subsidy-badge${w.subsidy==='Eligible'?' elig':w.subsidy==='Near-Eligible'?' near':''}`}>{w.subsidy}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* ── ROUTE PLAN TAB ───────────────────────────────── */}
                    {activeTab === 'plan' && (
                        <>
                            <div className="ad-filters">
                                <div className="ad-wf-info">
                                    <MapPin size={14}/>
                                    <span>आज की तैनाती योजना — Safety Check से पहले असाइनमेंट की समीक्षा करें</span>
                                </div>
                                <div className="ad-plan-stats">
                                    <span className="ad-plan-stat"><Users size={11}/> {WORKER_PLAN_SUMMARY.length} Workers</span>
                                    <span className="ad-plan-stat">{TODAY_ASSIGNMENTS.length} Jobs</span>
                                    <span className="ad-plan-stat ad-plan-stat--risk">
                                        <AlertTriangle size={11}/> {TODAY_ASSIGNMENTS.filter(a=>a.risk==='High-risk').length} High-Risk
                                    </span>
                                </div>
                                <div className="ad-plan-actions">
                                    <button className="ad-plan-check-btn" onClick={runSafetyCheck}>
                                        <Shield size={14}/> Safety Check करें
                                    </button>
                                    <button className="ad-plan-ai-btn" onClick={runPlanCopilot}>
                                        <Zap size={14}/> AI Plan Co-Pilot
                                    </button>
                                </div>
                            </div>
                            <div className="ad-table-wrap">
                                <table className="ad-table">
                                    <thead>
                                        <tr>
                                            {['Worker','Badge','Jobs Assigned','High-Risk','Est. Route','Safety Status'].map(h=><th key={h}>{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {WORKER_PLAN_SUMMARY.map(w => {
                                            const wIssues = planIssues?.filter(i => i.workerId === w.workerId) ?? null;
                                            const hasIssue = wIssues?.length > 0;
                                            return (
                                                <tr key={w.workerId} className={hasIssue ? 'plan-row-warn' : planIssues ? 'plan-row-ok' : ''}>
                                                    <td>{w.workerName}</td>
                                                    <td><code>{w.workerId}</code></td>
                                                    <td>
                                                        <div className="ad-plan-job-tags">
                                                            {w.jobs.map(j => (
                                                                <span key={j.jobId} className={`ad-plan-tag plan-tag--${j.risk === 'High-risk' ? 'high' : j.risk === 'Medium' ? 'medium' : 'low'}`}>
                                                                    {j.jobId}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={w.highRiskCount > 2 ? 'plan-over' : ''}>
                                                            {w.highRiskCount}{w.highRiskCount > 2 ? ' ⚠' : ''}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={w.routeKm > 3.5 ? 'plan-over' : ''}>
                                                            {w.routeKm.toFixed(1)} km{w.routeKm > 3.5 ? ' ⚠' : ''}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {wIssues === null
                                                            ? <span className="ad-dimmed">—</span>
                                                            : hasIssue
                                                                ? <span className="plan-status-warn">⚠ {wIssues.length} समस्या</span>
                                                                : <span className="plan-status-ok">✓ ठीक है</span>
                                                        }
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {planCopilot && (
                                <div className="ad-plan-ai-panel">
                                    {planCopilot.phase === 'loading' ? (
                                        <div className="ad-plan-ai-loading">
                                            <span className="ds-spinner"/>
                                            <span>AI deployment optimization तैयार कर रहा है…</span>
                                        </div>
                                    ) : planCopilot.phase === 'error' ? (
                                        <div className="ad-plan-ai-error">
                                            <AlertTriangle size={13}/>
                                            <span>{planCopilot.error || 'AI plan copilot failed'}</span>
                                            <button className="ad-plan-ai-btn" onClick={runPlanCopilot}>
                                                <Zap size={12}/> Retry
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="ad-plan-ai-head">
                                                <div className="ad-plan-ai-title"><Zap size={12}/> AI Route Co-Pilot</div>
                                                {planCopilot.evidence && (
                                                    <span className="ad-plan-ai-risk">Risk {planCopilot.evidence.riskScore}/100</span>
                                                )}
                                            </div>

                                            {planCopilot.evidence && (
                                                <div className="ad-plan-ai-evidence">
                                                    <span className="ad-plan-ai-chip">Issues {planCopilot.evidence.issuesTotal}</span>
                                                    <span className="ad-plan-ai-chip">High Sev {planCopilot.evidence.highSeverityIssues}</span>
                                                    <span className="ad-plan-ai-chip">Overload {planCopilot.evidence.overloadedWorkers}</span>
                                                    <span className="ad-plan-ai-chip">Fatigue {planCopilot.evidence.fatigueWorkers}</span>
                                                </div>
                                            )}

                                            {Array.isArray(planCopilot.actions) && planCopilot.actions.length > 0 && (
                                                <ul className="ad-plan-ai-actions">
                                                    {planCopilot.actions.map((action, idx) => (
                                                        <li key={`${action.id || 'action'}-${idx}`}>{action.message}</li>
                                                    ))}
                                                </ul>
                                            )}

                                            <div className="ad-plan-ai-text">
                                                {renderAiMarkdown(planCopilot.text)}
                                                {planCopilot.phase === 'typing' && <span className="ds-cursor">|</span>}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            {planConfirmed && (
                                <div className="ad-plan-deployed-bar">
                                    <CheckCircle2 size={14}/>
                                    <span>✓ Deployment confirmed — orders sent to all supervisors</span>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>

            {/* ── PLAN SAFETY CHECK MODAL ─────────────── */}
            {planModal && (
                <div className="ad-plan-overlay" onClick={() => setPlanModal(false)}>
                    <div className="ad-plan-modal" onClick={e => e.stopPropagation()}>
                        <div className="ad-plan-modal-hdr">
                            <div className="ad-plan-modal-title">
                                <Shield size={16}/> सुरक्षा जाँच — आज की योजना
                            </div>
                            <button className="ad-plan-modal-close" onClick={() => setPlanModal(false)}>✕</button>
                        </div>

                        <div className="ad-plan-modal-body">
                            {planIssues === null ? (
                                <div className="ad-plan-loading">
                                    <span className="ds-spinner"/> जाँच हो रही है…
                                </div>
                            ) : planIssues.length === 0 ? (
                                <div className="ad-plan-all-clear">
                                    <CheckCircle2 size={32} className="plan-clear-icon"/>
                                    <div>
                                        <div className="ad-plan-clear-title">✓ कोई समस्या नहीं</div>
                                        <div className="ad-plan-clear-sub">सभी असाइनमेंट सुरक्षा मानकों के अनुसार हैं।</div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="ad-plan-issues-banner">
                                        <AlertTriangle size={14}/> {planIssues.length} समस्या{planIssues.length > 1 ? 'एँ' : ''} मिली — तैनाती से पहले समाधान करें
                                    </div>
                                    <div className="ad-plan-issues-list">
                                        {planIssues.map(issue => (
                                            <div key={issue.id} className={`ad-plan-issue-card issue-sev-${issue.severity}`}>
                                                <div className="ad-plan-issue-top">
                                                    <span className={`ad-sev-badge sev-${issue.severity}`}>
                                                        {issue.severity === 'high' ? 'HIGH' : 'MEDIUM'}
                                                    </span>
                                                    <span className="ad-plan-issue-type">
                                                        {issue.type === 'overload' ? 'रिस्क ओवरलोड' : issue.type === 'fatigue' ? 'थकान जोखिम' : 'काम का बोझ'}
                                                    </span>
                                                </div>
                                                <p className="ad-plan-issue-msg">{issue.message}</p>
                                                {issue.affectedJobs?.length > 0 && (
                                                    <div className="ad-plan-affected">
                                                        <span className="ad-plan-affected-lbl">प्रभावित:</span>
                                                        {issue.affectedJobs.map(j => <code key={j} className="ad-plan-job-code">{j}</code>)}
                                                    </div>
                                                )}
                                                {issue.type === 'overload' && (
                                                    !swapMap[issue.workerId] ? (
                                                        <button className="ad-plan-swap-btn" onClick={() => {
                                                            const swap = suggestSwapForWorker(issue.workerId, TODAY_ASSIGNMENTS);
                                                            if (swap) setSwapMap(prev => ({ ...prev, [issue.workerId]: swap }));
                                                        }}>
                                                            <Zap size={12}/> Suggest Swap
                                                        </button>
                                                    ) : (
                                                        <div className="ad-plan-swap-result">
                                                            <CheckCircle2 size={13}/>
                                                            <span>{swapMap[issue.workerId].message}</span>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="ad-plan-modal-ftr">
                            <button className="ad-plan-cancel-btn" onClick={() => setPlanModal(false)}>
                                वापस जाएं
                            </button>
                            {!planConfirmed ? (
                                <button className="ad-plan-confirm-btn" onClick={() => { setPlanConfirmed(true); setPlanModal(false); }}>
                                    <Zap size={13}/> Confirm Deployment
                                </button>
                            ) : (
                                <span className="ad-action-confirm">✓ Deployment आदेश भेजा गया</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

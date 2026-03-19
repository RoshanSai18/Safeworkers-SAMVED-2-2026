import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    LogOut, Shield, Bell, Users, Activity, Wifi,
    AlertTriangle, CheckCircle2, X, Clock, MapPin, Zap,
    ChevronRight, Camera, Wind, Phone, Navigation,
    Briefcase, UserCheck, UserX, Battery, Signal
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import './SupervisorDashboard.css';

const CENTER = [19.076, 72.8777];

const WORKERS_SEED = [
    { id: 1, name: 'Ravi Kumar',    badge: 'SW-041', status: 'SOS',        job: 'MH-2041', address: 'Rajiv Nagar, Lane 4',     entries: 3, maxEntries: 4, elapsed: 34, battery: 22, signal: 1, lat: 19.0760, lng: 72.8600 },
    { id: 2, name: 'Suresh Babu',   badge: 'SW-018', status: 'IN_MANHOLE', job: 'MH-1874', address: 'Gandhi Road, Block C',    entries: 2, maxEntries: 4, elapsed: 18, battery: 67, signal: 3, lat: 19.0880, lng: 72.8900 },
    { id: 3, name: 'Meena Devi',    badge: 'SW-029', status: 'DELAYED',    job: 'MH-0933', address: 'Nehru St, Sector 2',      entries: 4, maxEntries: 4, elapsed: 42, battery: 45, signal: 2, lat: 19.0700, lng: 72.8720 },
    { id: 4, name: 'Anwar Sheikh',  badge: 'SW-055', status: 'IDLE',       job: '—',       address: 'Base Station',            entries: 1, maxEntries: 4, elapsed: 0,  battery: 89, signal: 4, lat: 19.0820, lng: 72.8550 },
    { id: 5, name: 'Kamla Singh',   badge: 'SW-007', status: 'IN_MANHOLE', job: 'MH-3310', address: 'Industrial Blvd, Unit 9', entries: 2, maxEntries: 4, elapsed: 9,  battery: 54, signal: 3, lat: 19.0950, lng: 72.8950 },
    { id: 6, name: 'Deepak Rao',    badge: 'SW-060', status: 'IDLE',       job: '—',       address: 'Base Station',            entries: 0, maxEntries: 4, elapsed: 0,  battery: 92, signal: 4, lat: 19.0640, lng: 72.8820 },
    { id: 7, name: 'Priti Gupta',   badge: 'SW-033', status: 'TRANSIT',    job: 'MH-4410', address: 'En route Lal Bazaar',     entries: 1, maxEntries: 4, elapsed: 0,  battery: 71, signal: 4, lat: 19.0760, lng: 72.9040 },
];

const JOBS_SEED = [
    { id: 'MH-4420', address: 'Lal Bazaar, Gate 7',       zone: 'Zone C', risk: 'HIGH',   priority: 'Urgent', equipment: 'Breathing Apparatus, Gas Meter', lat: 19.0830, lng: 72.8810 },
    { id: 'MH-2215', address: 'Shivaji Colony, Main Rd',  zone: 'Zone A', risk: 'MEDIUM', priority: 'Normal', equipment: 'Standard PPE, Safety Rope',      lat: 19.0720, lng: 72.8630 },
    { id: 'MH-0078', address: 'Station Rd, Junction 3',   zone: 'Zone B', risk: 'LOW',    priority: 'Low',    equipment: 'Standard PPE',                   lat: 19.0900, lng: 72.8700 },
    { id: 'MH-5501', address: 'Park Lane, Sector 9',      zone: 'Zone D', risk: 'MEDIUM', priority: 'Normal', equipment: 'Gas Meter, Standard PPE',         lat: 19.0680, lng: 72.8920 },
];

const PPE_QUEUE_SEED = [
    { id: 'p1', workerId: 2, name: 'Suresh Babu', badge: 'SW-018', job: 'MH-1874', time: '08:42' },
    { id: 'p2', workerId: 7, name: 'Priti Gupta', badge: 'SW-033', job: 'MH-4410', time: '09:15' },
];

const STATUS_CFG = {
    SOS:         { color: '#ff3b30', label: 'SOS',          css: 'sos',     pulse: true  },
    DELAYED:     { color: '#ff9f0a', label: 'Delayed',      css: 'delayed', pulse: true  },
    IN_MANHOLE:  { color: '#0a84ff', label: 'In Manhole',   css: 'manhole', pulse: true  },
    TRANSIT:     { color: '#5ac8fa', label: 'In Transit',   css: 'transit', pulse: false },
    IDLE:        { color: '#34c759', label: 'Idle',         css: 'idle',    pulse: false },
    SIGNAL_LOST: { color: '#8e8e93', label: 'Signal Lost',  css: 'lost',    pulse: false },
};

function makeIcon(status, selected, initials = '', alertLevel = null) {
    const cfg = STATUS_CFG[status] || STATUS_CFG.IDLE;
    const size = selected ? 20 : 14;
    const alertClass = alertLevel === 'critical' ? ' wp-alert-critical'
                     : alertLevel === 'warning'  ? ' wp-alert-warning' : '';
    const labelHtml  = initials ? `<div class="wp-label">${initials}</div>` : '';
    const html = `<div class="wp-outer wp-${cfg.css}${cfg.pulse ? ' wp-pulse' : ''}${selected ? ' wp-selected' : ''}${alertClass}"><div class="wp-core" style="width:${size}px;height:${size}px;background:${cfg.color};"></div>${labelHtml}</div>`;
    return L.divIcon({ html, className: '', iconSize: [40, 52], iconAnchor: [20, 20], popupAnchor: [0, -30] });
}

function useSosAlarm(active) {
    const ctxRef = useRef(null);
    const intvRef = useRef(null);
    useEffect(() => {
        if (active) {
            try {
                ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                let beat = 0;
                intvRef.current = setInterval(() => {
                    const ctx = ctxRef.current;
                    if (!ctx) return;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.frequency.value = beat % 2 === 0 ? 880 : 660;
                    gain.gain.setValueAtTime(0.3, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.22);
                    beat++;
                }, 420);
            } catch { /* audio not available in this context */ }
        } else {
            if (intvRef.current) clearInterval(intvRef.current);
            if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
        }
        return () => {
            if (intvRef.current) clearInterval(intvRef.current);
            if (ctxRef.current) { ctxRef.current.close().catch(() => {}); }
        };
    }, [active]);
}

function RecenterOnWorker({ pos }) {
    const map = useMap();
    useEffect(() => { if (pos) map.flyTo(pos, 16, { duration: 0.8 }); }, [pos, map]);
    return null;
}

function renderMarkdown(text) {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];
    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(<ul key={`ul-${elements.length}`} className="sd-ai-md-ul">{listItems}</ul>);
            listItems = [];
        }
    };
    const inlineFormat = (str, idx) => {
        const parts = [];
        const regex = /\*\*(.+?)\*\*/g;
        let last = 0, match;
        while ((match = regex.exec(str)) !== null) {
            if (match.index > last) parts.push(str.slice(last, match.index));
            parts.push(<strong key={`b-${idx}-${match.index}`}>{match[1]}</strong>);
            last = regex.lastIndex;
        }
        if (last < str.length) parts.push(str.slice(last));
        return parts.length ? parts : str;
    };
    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) { flushList(); elements.push(<div key={`br-${i}`} className="sd-ai-md-br" />); return; }
        const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (hMatch) {
            flushList();
            const level = hMatch[1].length;
            const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
            elements.push(<Tag key={`h-${i}`} className="sd-ai-md-heading">{inlineFormat(hMatch[2], i)}</Tag>);
            return;
        }
        const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
            listItems.push(<li key={`li-${i}`}>{inlineFormat(bulletMatch[1], i)}</li>);
            return;
        }
        const numMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
        if (numMatch) {
            listItems.push(<li key={`li-${i}`}>{inlineFormat(numMatch[1], i)}</li>);
            return;
        }
        flushList();
        elements.push(<p key={`p-${i}`} className="sd-ai-md-p">{inlineFormat(trimmed, i)}</p>);
    });
    flushList();
    return elements;
}

function riskPriorityHi(priority) {
    if (priority === 'high') return 'उच्च';
    if (priority === 'medium') return 'मध्यम';
    return 'कम';
}

function parseGasExplainability(alert) {
    const explain = alert?.explainability || {};
    const immediateSteps = Array.isArray(explain.immediateSteps) && explain.immediateSteps.length > 0
        ? explain.immediateSteps
        : (Array.isArray(alert?.immediateSteps) ? alert.immediateSteps : []);

    return {
        summaryHi: explain.summaryHi || alert?.reasoningHi || '',
        confidence: explain.confidence || alert?.confidence || '',
        immediateSteps,
    };
}

function buildIncidentContextFromAlert(alert, workers, jobs) {
    const worker = workers.find((w) => w.id === alert.workerId);
    const activeJob = worker?.job && worker.job !== '—'
        ? jobs.find((j) => j.id === worker.job)
        : null;
    const eventType = String(alert.type || 'INCIDENT').toUpperCase();
    const severity = alert.severity || (eventType.includes('SOS') ? 'critical' : eventType === 'HAZARD' ? 'medium' : 'info');

    return {
        incidentId: alert.id || `inc-${Date.now()}`,
        eventType,
        severity,
        workerId: alert.workerId ?? null,
        workerName: alert.workerName || worker?.name || `Worker ${alert.workerId ?? 'N/A'}`,
        badge: worker?.badge || 'N/A',
        zone: activeJob?.zone || alert.zone || 'Zone N/A',
        location: alert.location || worker?.address || activeJob?.address || 'Field location',
        eventTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        hazard: alert.hazard || (eventType === 'AUTO_GAS' ? (alert.gas ? `${alert.gas} threshold breach` : 'gas anomaly') : ''),
        alertMessage: alert.msg || '',
    };
}

export default function SupervisorDashboard() {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    const [workers, setWorkers] = useState(WORKERS_SEED);
    const [jobs, setJobs]       = useState(JOBS_SEED);
    const [ppeQueue, setPpeQueue] = useState(PPE_QUEUE_SEED);
    const [alerts, setAlerts]   = useState([
        { id: 'a1', type: 'SOS',   workerId: 1, msg: 'SOS triggered by Ravi Kumar at MH-2041',  time: '2m ago' },
        { id: 'a2', type: 'DELAY', workerId: 3, msg: 'Meena Devi overdue by 12 min at MH-0933', time: '5m ago' },
    ]);

    const [selectedWorker, setSelectedWorker] = useState(null);
    const [flyTo,          setFlyTo]          = useState(null);
    const [sosModal,       setSosModal]       = useState(null);
    const [sosAck,         setSosAck]         = useState(false);
    const [draggingJob,    setDraggingJob]    = useState(null);
    const [dropTargetId,   setDropTargetId]   = useState(null);
    const [draggingWorker, setDraggingWorker] = useState(null);
    const [dropJobId,      setDropJobId]      = useState(null);
    const [fatigueWarn,    setFatigueWarn]    = useState(null);
    const [activeTab,      setActiveTab]      = useState('alerts');
    const [shiftTime,      setShiftTime]      = useState(0);
    const [gasCache,             setGasCache]             = useState({});
    const [hoveredAlertWorkerId, setHoveredAlertWorkerId] = useState(null);

    const [aiRecModal, setAiRecModal]   = useState(false);
    const [aiRecState, setAiRecState]   = useState('idle');    // 'idle' | 'loading' | 'typing' | 'done' | 'error'
    const [aiRecText,  setAiRecText]    = useState('');
    const [aiRecError, setAiRecError]   = useState('');
    const [aiRecLang,  setAiRecLang]    = useState('en');   // 'en' | 'hi'
    const aiRecTypingRef = useRef(null);

    const [simWorkerId, setSimWorkerId] = useState('');
    const [simJobId, setSimJobId]       = useState('');
    const [simState, setSimState]       = useState('idle'); // 'idle' | 'loading' | 'done' | 'error'
    const [simResult, setSimResult]     = useState(null);
    const [simError, setSimError]       = useState('');

    const [rcaModalOpen, setRcaModalOpen] = useState(false);
    const [rcaIncident, setRcaIncident]   = useState(null);
    const [rcaGuide, setRcaGuide]         = useState([]);
    const [rcaAnswers, setRcaAnswers]     = useState({});
    const [rcaSimilar, setRcaSimilar]     = useState([]);
    const [rcaResult, setRcaResult]       = useState(null);
    const [rcaLang, setRcaLang]           = useState('hi');
    const [rcaState, setRcaState]         = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
    const [rcaError, setRcaError]         = useState('');

    const { socket } = useSocket();

    useEffect(() => {
        const t = setInterval(() => setShiftTime(s => s + 1), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const sos = workers.find(w => w.status === 'SOS');
        if (sos && !sosModal) setSosModal(sos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const simulationWorkers = workers.filter(w => w.status !== 'SOS');

        if (simulationWorkers.length === 0) {
            if (simWorkerId) setSimWorkerId('');
        } else if (!simulationWorkers.some(w => String(w.id) === String(simWorkerId))) {
            setSimWorkerId(String(simulationWorkers[0].id));
        }

        if (jobs.length === 0) {
            if (simJobId) setSimJobId('');
        } else if (!jobs.some(j => j.id === simJobId)) {
            setSimJobId(jobs[0].id);
        }
    }, [workers, jobs, simWorkerId, simJobId]);

    // Real-time socket: live gas readings cache + auto-alerts from sensor engine
    useEffect(() => {
        if (!socket) return;

        const handleSensorUpdate = (data) => {
            setGasCache(prev => ({ ...prev, [data.workerId]: data }));
        };

        const handleAutoAlert = (alert) => {
            setAlerts(prev => [alert, ...prev]);
            if (alert.severity === 'critical') {
                setWorkers(prev => {
                    const w = prev.find(wk => wk.id === alert.workerId);
                    if (w) setSosModal(w);
                    return prev;
                });
            }
        };

        const handleWorkerStatusChange = ({ workerId, status }) => {
            setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, status } : w));
            if (status === 'SOS') {
                setWorkers(prev => {
                    const w = prev.find(wk => wk.id === workerId);
                    if (w) setSosModal({ ...w, status: 'SOS' });
                    return prev;
                });
            }
        };

        socket.on('sensor_update',        handleSensorUpdate);
        socket.on('auto_alert',           handleAutoAlert);
        socket.on('worker_status_change', handleWorkerStatusChange);
        return () => {
            socket.off('sensor_update',        handleSensorUpdate);
            socket.off('auto_alert',           handleAutoAlert);
            socket.off('worker_status_change', handleWorkerStatusChange);
        };
    }, [socket]);

    useSosAlarm(!!sosModal && !sosAck);

    const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

    const acknowledgeAlert = (id) => setAlerts(prev => prev.filter(a => a.id !== id));

    const acknowledgeSOSModal = () => {
        setSosAck(true);
        setWorkers(prev => prev.map(w => w.id === sosModal?.id ? { ...w, status: 'DELAYED' } : w));
        setAlerts(prev => prev.filter(a => a.workerId !== sosModal?.id));
        setTimeout(() => { setSosModal(null); setSosAck(false); }, 700);
    };

    const approvePPE = (id) => setPpeQueue(prev => prev.filter(p => p.id !== id));
    const denyPPE    = (id) => setPpeQueue(prev => prev.filter(p => p.id !== id));

    const handleDragStart = (job) => setDraggingJob(job);
    const handleDragEnd   = ()    => { setDraggingJob(null); setDropTargetId(null); };

    const handleDragStartWorker = (worker) => setDraggingWorker(worker);
    const handleDragEndWorker   = ()       => { setDraggingWorker(null); setDropJobId(null); };

    const handleDropWorkerOnJob = (job) => {
        if (!draggingWorker) return;
        const pct = (draggingWorker.entries / draggingWorker.maxEntries) * 100;
        if (pct >= 100) {
            setFatigueWarn({ worker: draggingWorker, job });
        } else {
            doAssign(job, draggingWorker.id);
        }
        setDraggingWorker(null); setDropJobId(null);
    };

    const handleDropOnWorker = (workerId) => {
        if (!draggingJob) return;
        const worker = workers.find(w => w.id === workerId);
        if (!worker) return;
        const pct = (worker.entries / worker.maxEntries) * 100;
        if (pct >= 100) {
            setFatigueWarn({ worker, job: draggingJob });
        } else {
            doAssign(draggingJob, workerId);
        }
        setDraggingJob(null); setDropTargetId(null);
    };

    const doAssign = (job, workerId) => {
        setJobs(prev => prev.filter(j => j.id !== job.id));
        setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, status: 'TRANSIT', job: job.id } : w));
    };

    const formatElapsed = (m) => m === 0 ? '—' : `${m}m`;
    const shiftLabel    = () => {
        const h = Math.floor(shiftTime / 3600), m = Math.floor((shiftTime % 3600) / 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const fetchRecommendations = async (lang = aiRecLang) => {
        const normalizedLang = lang === 'hi' ? 'hi' : 'en';
        setAiRecLang(normalizedLang);
        setAiRecModal(true);
        setAiRecState('loading');
        setAiRecText('');
        setAiRecError('');
        if (aiRecTypingRef.current) clearTimeout(aiRecTypingRef.current);

        try {
            const res = await fetch('http://localhost:3001/api/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lang: normalizedLang }),
                signal: AbortSignal.timeout(30000),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Unknown error');

            const fullText = data.recommendation;
            let i = 0;
            setAiRecState('typing');
            const tick = () => {
                i++;
                setAiRecText(fullText.slice(0, i));
                if (i < fullText.length) {
                    aiRecTypingRef.current = setTimeout(tick, 12);
                } else {
                    setAiRecState('done');
                }
            };
            aiRecTypingRef.current = setTimeout(tick, 12);
        } catch (err) {
            setAiRecState('error');
            setAiRecError(err.message || 'Failed to get recommendations');
        }
    };

    const runCounterfactualSimulation = async () => {
        if (!simWorkerId || !simJobId) return;

        setAiRecModal(true);
        setSimState('loading');
        setSimError('');
        setSimResult(null);

        try {
            const res = await fetch('http://localhost:3001/api/recommendations/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workerId: Number(simWorkerId),
                    jobId: simJobId,
                    lang: aiRecLang,
                    workers,
                    jobs,
                }),
                signal: AbortSignal.timeout(30000),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Unknown simulation error');

            setSimResult(data.simulation);
            setSimState('done');
        } catch (err) {
            setSimState('error');
            setSimError(err.message || 'Failed to run simulation');
        }
    };

    const closeAiRecModal = () => {
        setAiRecModal(false);
        setAiRecState('idle');
        setAiRecText('');
        setAiRecError('');
        setSimState('idle');
        setSimResult(null);
        setSimError('');
        if (aiRecTypingRef.current) clearTimeout(aiRecTypingRef.current);
    };

    const fetchRcaAssistant = async (incidentContext, answers = {}, language = rcaLang) => {
        if (!incidentContext) return;
        setRcaState('loading');
        setRcaError('');

        try {
            const res = await fetch('http://localhost:3001/api/incident/rca-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    incident: incidentContext,
                    interviewAnswers: answers,
                    lang: language,
                }),
                signal: AbortSignal.timeout(30000),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to generate RCA report');

            const assistant = data.assistant || {};
            setRcaGuide(Array.isArray(assistant.interviewGuide) ? assistant.interviewGuide : []);
            setRcaSimilar(Array.isArray(assistant.similarIncidents) ? assistant.similarIncidents : []);
            setRcaResult(assistant.report || null);
            setRcaState('ready');
        } catch (err) {
            setRcaState('error');
            setRcaError(err.message || 'Failed to run RCA assistant');
        }
    };

    const openRcaAssistant = (alertItem) => {
        const incidentContext = buildIncidentContextFromAlert(alertItem, workers, jobs);
        setRcaIncident(incidentContext);
        setRcaAnswers({});
        setRcaGuide([]);
        setRcaSimilar([]);
        setRcaResult(null);
        setRcaError('');
        setRcaModalOpen(true);
        fetchRcaAssistant(incidentContext, {}, rcaLang);
    };

    const closeRcaAssistant = () => {
        setRcaModalOpen(false);
        setRcaState('idle');
        setRcaError('');
    };

    const updateRcaAnswer = (questionId, value) => {
        setRcaAnswers((prev) => ({ ...prev, [questionId]: value }));
    };

    const generateRcaReport = () => {
        if (!rcaIncident) return;
        fetchRcaAssistant(rcaIncident, rcaAnswers, rcaLang);
    };

    const inManholeCount = workers.filter(w => w.status === 'IN_MANHOLE').length;
    const sosCount       = workers.filter(w => w.status === 'SOS').length;
    const onlineCount    = workers.filter(w => w.status !== 'SIGNAL_LOST').length;
    const simulationWorkers = workers.filter(w => w.status !== 'SOS');
    const simulationJobs = jobs;

    return (
        <div className="sd-root">
            {/* SOS MODAL */}
            {sosModal && (
                <div className="sd-sos-overlay" role="alertdialog" aria-modal="true">
                    <div className={`sd-sos-modal${sosAck ? ' ack' : ''}`}>
                        <div className="sd-sos-flash" />
                        <div className="sd-sos-header">
                            <div className="sd-sos-badge"><AlertTriangle size={28} /></div>
                            <div>
                                <div className="sd-sos-title">SOS ALERT</div>
                                <div className="sd-sos-sub">Emergency signal received</div>
                            </div>
                        </div>
                        <div className="sd-sos-rows">
                            <div className="sd-sos-row"><MapPin size={13} /><span>Location</span><strong>{sosModal.address}</strong></div>
                            <div className="sd-sos-row"><Briefcase size={13} /><span>Job ID</span><strong>{sosModal.job}</strong></div>
                            <div className="sd-sos-row"><Users size={13} /><span>Worker</span><strong>{sosModal.name}  {sosModal.badge}</strong></div>
                            <div className="sd-sos-row"><Clock size={13} /><span>Underground</span><strong>{formatElapsed(sosModal.elapsed)}</strong></div>
                            <div className="sd-sos-row"><Navigation size={13} /><span>GPS</span><strong>{sosModal.lat.toFixed(4)}, {sosModal.lng.toFixed(4)}</strong></div>
                        </div>
                        <div className="sd-sos-actions">
                            <button className="sd-dispatch-btn"><Phone size={15} /> Dispatch Emergency</button>
                            <button className="sd-ack-btn" onClick={acknowledgeSOSModal}>
                                <CheckCircle2 size={15} /> {sosAck ? 'Acknowledged' : 'Acknowledge & Silence'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FATIGUE WARNING */}
            {fatigueWarn && (
                <div className="sd-sos-overlay">
                    <div className="sd-fatigue-modal">
                        <AlertTriangle size={32} className="sd-fat-icon" />
                        <h3>High Fatigue Warning</h3>
                        <p><strong>{fatigueWarn.worker.name}</strong> has reached the maximum of {fatigueWarn.worker.maxEntries} high-risk entries this shift.</p>
                        <p className="sd-fat-sub">Assigning <strong>{fatigueWarn.job.id}</strong> exceeds safety guidelines.</p>
                        <div className="sd-fat-actions">
                            <button className="sd-fat-cancel" onClick={() => setFatigueWarn(null)}>Cancel</button>
                            <button className="sd-fat-override" onClick={() => { doAssign(fatigueWarn.job, fatigueWarn.worker.id); setFatigueWarn(null); }}>
                                Override & Assign
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RCA ASSISTANT MODAL */}
            {rcaModalOpen && (
                <div className="sd-rca-overlay" role="dialog" aria-modal="true">
                    <div className="sd-rca-modal">
                        <div className="sd-rca-header">
                            <div>
                                <div className="sd-rca-title">Post-Incident Root Cause AI Assistant</div>
                                <div className="sd-rca-sub">Structured interview + bilingual RCA report</div>
                            </div>
                            <button className="sd-rca-close" onClick={closeRcaAssistant}><X size={16} /></button>
                        </div>

                        {rcaIncident && (
                            <div className="sd-rca-incident-meta">
                                <span>{rcaIncident.eventType}</span>
                                <span>{rcaIncident.workerName}</span>
                                <span>{rcaIncident.zone}</span>
                                <span>{rcaIncident.location}</span>
                            </div>
                        )}

                        <div className="sd-rca-lang-toggle">
                            <button className={`sd-rca-lang-btn${rcaLang === 'hi' ? ' active' : ''}`} onClick={() => setRcaLang('hi')}>HI</button>
                            <button className={`sd-rca-lang-btn${rcaLang === 'en' ? ' active' : ''}`} onClick={() => setRcaLang('en')}>EN</button>
                        </div>

                        <div className="sd-rca-grid">
                            <div className="sd-rca-col">
                                <div className="sd-rca-section-title">Structured Interview</div>
                                <div className="sd-rca-interview-list">
                                    {rcaGuide.map((q) => (
                                        <div key={q.id} className="sd-rca-question-card">
                                            <div className="sd-rca-question">{rcaLang === 'en' ? q.questionEn : q.questionHi}</div>
                                            <div className="sd-rca-hint">{rcaLang === 'en' ? q.hintEn : q.hintHi}</div>
                                            <textarea
                                                className="sd-rca-answer"
                                                value={rcaAnswers[q.id] || ''}
                                                onChange={(e) => updateRcaAnswer(q.id, e.target.value)}
                                                placeholder={rcaLang === 'en' ? 'Supervisor notes...' : 'सुपरवाइजर नोट्स...'}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <button className="sd-rca-generate" onClick={generateRcaReport} disabled={rcaState === 'loading'}>
                                    <Zap size={13} /> {rcaState === 'loading' ? 'Generating RCA...' : 'Generate RCA Report'}
                                </button>
                            </div>

                            <div className="sd-rca-col">
                                <div className="sd-rca-section-title">RCA Report</div>

                                {rcaState === 'loading' && (
                                    <div className="sd-rca-loading">
                                        <span className="sd-ai-spinner" />
                                        <span>Analyzing interview and similar incidents...</span>
                                    </div>
                                )}

                                {rcaState === 'error' && (
                                    <div className="sd-rca-error">
                                        <AlertTriangle size={16} />
                                        <span>{rcaError}</span>
                                    </div>
                                )}

                                {rcaState === 'ready' && rcaResult && (
                                    <>
                                        <div className="sd-rca-similar">
                                            <div className="sd-rca-similar-title">Similar incidents considered</div>
                                            {rcaSimilar.length === 0 ? (
                                                <div className="sd-rca-empty">No similar incidents found. Using baseline preventive controls.</div>
                                            ) : (
                                                <div className="sd-rca-similar-list">
                                                    {rcaSimilar.map((item) => (
                                                        <div key={item.incidentId} className="sd-rca-similar-item">
                                                            <strong>{item.eventType}</strong>
                                                            <span>{item.zone}</span>
                                                            <span>{item.hazard || 'N/A'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="sd-rca-markdown">
                                            {renderMarkdown(rcaLang === 'en' ? rcaResult.markdownEn : rcaResult.markdownHi)}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AI SMART ASSIGN SLIDE-IN PANEL */}
            <div className={`sd-ai-panel-overlay${aiRecModal ? ' open' : ''}`} onClick={closeAiRecModal} />
            <div className={`sd-ai-panel${aiRecModal ? ' open' : ''}`}>
                <div className="sd-ai-panel-header">
                    <div className="sd-ai-panel-icon"><Zap size={18} /></div>
                    <div>
                        <div className="sd-ai-panel-title">AI Smart Assign</div>
                        <div className="sd-ai-panel-sub">Powered by Gemini</div>
                    </div>
                    <button className="sd-ai-panel-close" onClick={closeAiRecModal}><X size={16} /></button>
                </div>

                <div className="sd-ai-panel-scroll">
                    {/* AI Recommendation Section */}
                    <div className="sd-ai-panel-section">
                        <div className="sd-ai-panel-section-label">
                            <Zap size={12} /> Recommendation
                            <div className="sd-lang-toggle">
                                <button
                                    className={`sd-lang-btn${aiRecLang === 'en' ? ' active' : ''}`}
                                    onClick={() => fetchRecommendations('en')}
                                >EN</button>
                                <button
                                    className={`sd-lang-btn${aiRecLang === 'hi' ? ' active' : ''}`}
                                    onClick={() => fetchRecommendations('hi')}
                                >HI</button>
                            </div>
                        </div>
                        <div className="sd-ai-rec-body">
                            {aiRecState === 'idle' && (
                                <div className="sd-ai-rec-idle">Click the button above or wait for analysis...</div>
                            )}
                            {aiRecState === 'loading' && (
                                <div className="sd-ai-rec-loading">
                                    <span className="sd-ai-spinner" />
                                    <span>Analyzing workers, jobs & distances...</span>
                                </div>
                            )}
                            {aiRecState === 'error' && (
                                <div className="sd-ai-rec-error">
                                    <AlertTriangle size={16} />
                                    <p>{aiRecError}</p>
                                    <button className="sd-ai-rec-retry" onClick={fetchRecommendations}>Retry</button>
                                </div>
                            )}
                            {(aiRecState === 'typing' || aiRecState === 'done') && (
                                <div className="sd-ai-rec-text">
                                    {renderMarkdown(aiRecText)}
                                    {aiRecState === 'typing' && <span className="sd-ai-cursor">|</span>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Counterfactual Simulator */}
                    <div className="sd-ai-panel-section">
                        <div className="sd-ai-panel-section-label"><ChevronRight size={12} /> Counterfactual Simulator</div>
                        <div className="sd-ai-sim-controls">
                            <div className="sd-ai-sim-field">
                                <label>Worker</label>
                                <select
                                    className="sd-ai-sim-select"
                                    value={simWorkerId}
                                    onChange={(e) => setSimWorkerId(e.target.value)}
                                    disabled={simState === 'loading' || simulationWorkers.length === 0}
                                >
                                    {simulationWorkers.map(w => (
                                        <option key={w.id} value={String(w.id)}>
                                            {w.name} ({w.badge}) · {STATUS_CFG[w.status]?.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="sd-ai-sim-field">
                                <label>Open Job</label>
                                <select
                                    className="sd-ai-sim-select"
                                    value={simJobId}
                                    onChange={(e) => setSimJobId(e.target.value)}
                                    disabled={simState === 'loading' || simulationJobs.length === 0}
                                >
                                    {simulationJobs.map(j => (
                                        <option key={j.id} value={j.id}>
                                            {j.id} · {j.zone} · {j.risk}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                className="sd-ai-sim-btn"
                                onClick={runCounterfactualSimulation}
                                disabled={simState === 'loading' || !simWorkerId || !simJobId}
                            >
                                {simState === 'loading' ? 'Running simulation...' : 'Run What-If Simulation'}
                            </button>
                        </div>

                        <div className="sd-ai-sim-body">
                            {simulationJobs.length === 0 && (
                                <div className="sd-ai-rec-idle">No open jobs available for simulation.</div>
                            )}

                            {simulationJobs.length > 0 && simState === 'idle' && (
                                <div className="sd-ai-rec-idle">Pick a worker and open job to preview risk before dispatch.</div>
                            )}

                            {simState === 'error' && (
                                <div className="sd-ai-rec-error">
                                    <AlertTriangle size={16} />
                                    <p>{simError}</p>
                                </div>
                            )}

                            {simState === 'done' && simResult && (
                                <div className="sd-ai-sim-result">
                                    <div className="sd-ai-sim-metrics">
                                        <span className={`sd-ai-sim-chip band-${simResult.before.band.key}`}>
                                            Before {simResult.before.score} ({simResult.before.band.label})
                                        </span>
                                        <span className={`sd-ai-sim-chip band-${simResult.after.band.key}`}>
                                            After {simResult.after.score} ({simResult.after.band.label})
                                        </span>
                                        <span className={`sd-ai-sim-chip delta ${simResult.delta >= 0 ? 'up' : 'down'}`}>
                                            Delta {simResult.delta >= 0 ? '+' : ''}{simResult.delta}
                                        </span>
                                    </div>

                                    <p className="sd-ai-sim-summary">{simResult.summary}</p>

                                    {Array.isArray(simResult.mitigations) && simResult.mitigations.length > 0 && (
                                        <ul className="sd-ai-sim-list">
                                            {simResult.mitigations.map((tip, idx) => (
                                                <li key={`sim-tip-${idx}`}>{tip}</li>
                                            ))}
                                        </ul>
                                    )}

                                    {Array.isArray(simResult.alternatives) && simResult.alternatives.length > 0 && (
                                        <div className="sd-ai-sim-alt">
                                            <div className="sd-ai-sim-alt-title">Best alternatives</div>
                                            {simResult.alternatives.map(alt => (
                                                <div className="sd-ai-sim-alt-row" key={alt.workerId}>
                                                    <span>{alt.workerName} ({alt.badge})</span>
                                                    <span>{alt.score} · {alt.distanceKm} km</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="sd-ai-sim-narrative">
                                        {renderMarkdown(simResult.aiNarrative)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Jobs Assignment Section */}
                    <div className="sd-ai-panel-section">
                        <div className="sd-ai-panel-section-label"><UserCheck size={12} /> Workers</div>
                        <div className="sd-dispatch-workers">
                            {workers.map(w => (
                                <div
                                    key={w.id}
                                    className={`sd-dispatch-worker${draggingWorker?.id === w.id ? ' dragging' : ''}${
                                        ['SOS', 'IN_MANHOLE', 'DELAYED'].includes(w.status) ? ' busy' : ''
                                    }`}
                                    draggable
                                    onDragStart={() => handleDragStartWorker(w)}
                                    onDragEnd={handleDragEndWorker}
                                    title={STATUS_CFG[w.status]?.label}
                                >
                                    <span className="sd-dispatch-worker-dot" style={{ background: STATUS_CFG[w.status]?.color }} />
                                    <span className="sd-dispatch-worker-name">{w.name}</span>
                                    <span className="sd-dispatch-worker-badge">{w.badge}</span>
                                    <span className="sd-dispatch-worker-status" style={{ color: STATUS_CFG[w.status]?.color }}>
                                        {STATUS_CFG[w.status]?.label}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="sd-ai-panel-section-label" style={{ marginTop: 10 }}><Briefcase size={12} /> Open Jobs — drop a worker here</div>
                        {jobs.length === 0 ? (
                            <div className="sd-empty-state"><CheckCircle2 size={24} /><p>All jobs assigned</p></div>
                        ) : jobs.map(job => (
                            <div
                                key={job.id}
                                className={`sd-job-card${draggingJob?.id === job.id ? ' dragging' : ''}${dropJobId === job.id ? ' drop-hover' : ''}`}
                                draggable
                                onDragStart={() => handleDragStart(job)}
                                onDragEnd={handleDragEnd}
                                onDragOver={e => { e.preventDefault(); if (draggingWorker) setDropJobId(job.id); }}
                                onDragLeave={() => setDropJobId(null)}
                                onDrop={() => handleDropWorkerOnJob(job)}
                            >
                                <div className="sd-job-top">
                                    <code className="sd-job-id">{job.id}</code>
                                    <span className={`sd-job-risk risk-${job.risk.toLowerCase()}`}>{job.risk}</span>
                                </div>
                                <div className="sd-job-addr">{job.address}</div>
                                <div className="sd-job-zone">{job.zone}</div>
                                <div className="sd-job-eq"><Zap size={11} />{job.equipment}</div>
                                <div className="sd-job-footer">
                                    <span className={`sd-priority p-${job.priority.toLowerCase()}`}>{job.priority}</span>
                                    {draggingWorker
                                        ? <span className="sd-drag-hint sd-drag-hint--active">drop here</span>
                                        : <span className="sd-drag-hint">drag worker here</span>
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* TOP BAR */}
            <header className="sd-header">
                <div className="sd-header-brand">
                    <div className="sd-logo"><Shield size={17} /></div>
                    <span className="sd-h-title">SafeWorker Control</span>
                    <span className="sd-h-role">Supervisor</span>
                </div>
                <div className="sd-header-stats">
                    <div className="sd-stat"><Users size={13} /><span>{onlineCount} Online</span></div>
                    <div className="sd-stat sd-stat-manhole"><Activity size={13} /><span>{inManholeCount} In-Manhole</span></div>
                    {sosCount > 0 && (
                        <div className="sd-stat sd-stat-sos" onClick={() => setSosModal(workers.find(w => w.status === 'SOS'))}>
                            <AlertTriangle size={13} /><span>{sosCount} SOS Active</span>
                        </div>
                    )}
                    <div className="sd-stat sd-stat-ok"><Wifi size={13} /><span>System: Online</span></div>
                    <div className="sd-stat sd-stat-clock"><Clock size={13} /><span>Shift {shiftLabel()}</span></div>
                </div>
                <div className="sd-header-right">
                    <span className="sd-operator">{currentUser?.name}</span>
                    <button className="sd-logout-btn" onClick={handleLogout} title="Logout"><LogOut size={15} /></button>
                </div>
            </header>

            {/* BODY */}
            <div className="sd-body">
                {/* MAP */}
                <section className="sd-map-section">
                    <MapContainer center={CENTER} zoom={13} className="sd-leaflet-map" zoomControl={false}>
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                        />
                        {flyTo && <RecenterOnWorker pos={flyTo} />}
                        {workers.map(worker => (
                            <Marker
                                key={worker.id}
                                position={[worker.lat, worker.lng]}
                                icon={makeIcon(
                                    worker.status,
                                    selectedWorker?.id === worker.id || hoveredAlertWorkerId === worker.id,
                                    worker.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase(),
                                    alerts.some(a => a.workerId === worker.id && (a.severity === 'critical' || a.type === 'SOS' || a.type === 'SOS_MANUAL'))
                                        ? 'critical'
                                        : alerts.some(a => a.workerId === worker.id) ? 'warning' : null
                                )}
                                eventHandlers={{
                                    click: () => {
                                        setSelectedWorker(w => w?.id === worker.id ? null : worker);
                                        setFlyTo([worker.lat, worker.lng]);
                                    },
                                }}
                            >
                                <Popup className="sd-popup">
                                    <div className="sd-popup-inner">
                                        <div className="sd-popup-top">
                                            <span className="sd-popup-name">{worker.name}</span>
                                            <span className={`sd-popup-status badge-${STATUS_CFG[worker.status]?.css}`}>
                                                {STATUS_CFG[worker.status]?.label}
                                            </span>
                                        </div>
                                        <div className="sd-popup-row"><MapPin size={11} />{worker.address}</div>
                                        <div className="sd-popup-row"><Briefcase size={11} />{worker.job}</div>
                                        <div className="sd-popup-row">
                                            <Battery size={11} />
                                            <div className="sd-popup-bar">
                                                <div className="sd-popup-fill" style={{ width: `${worker.battery}%`, background: worker.battery < 30 ? '#ff9f0a' : '#34c759' }} />
                                            </div>
                                            <span>{worker.battery}%</span>
                                        </div>
                                        <div className="sd-popup-row">
                                            <Signal size={11} />
                                            <div className="sd-popup-signal">
                                                {[1, 2, 3, 4].map(i => (
                                                    <div key={i} className={`sd-sig-bar${i <= worker.signal ? ' active' : ''}`} style={{ height: `${i * 4 + 2}px` }} />
                                                ))}
                                            </div>
                                        </div>
                                        {(worker.status === 'IN_MANHOLE' || worker.status === 'DELAYED') && (
                                            <div className="sd-popup-row sd-popup-timer">
                                                <Clock size={11} /><strong>{formatElapsed(worker.elapsed)}</strong>&nbsp;underground
                                            </div>
                                        )}
                                        {gasCache[worker.id] && (
                                            <div className="sd-popup-gas-pills">
                                                {['H2S', 'CO', 'O2', 'CH4', 'WATER'].map(gas => {
                                                    const st     = gasCache[worker.id].statuses[gas];
                                                    const val    = gasCache[worker.id].readings[gas];
                                                    const units  = { H2S: 'ppm', CO: 'ppm', O2: '%', CH4: '%LEL', WATER: 'cm' };
                                                    const labels = { H2S: 'H₂S', CO: 'CO',  O2: 'O₂', CH4: 'CH₄', WATER: 'H₂O' };
                                                    const clr    = st === 'danger' ? 'var(--sd-sos)' : st === 'warning' ? 'var(--sd-delayed)' : 'var(--sd-ok)';
                                                    if (val == null) return null;
                                                    return (
                                                        <span key={gas} className="sd-gas-pill" style={{ background: clr }}>
                                                            {labels[gas]} {val < 10 ? val.toFixed(1) : Math.round(val)}{units[gas]}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {worker.status === 'IN_MANHOLE' && (
                                            <button
                                                className="sd-evac-btn"
                                                onClick={() => socket?.emit('evac_command', { workerId: worker.id })}
                                            >
                                                Evacuate
                                            </button>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>

                    {/* Legend */}
                    <div className="sd-map-legend">
                        {Object.entries(STATUS_CFG).map(([k, v]) => (
                            <div key={k} className="sd-legend-item">
                                <span className="sd-legend-dot" style={{ background: v.color }} />
                                {v.label}
                            </div>
                        ))}
                        <div className="sd-legend-sep" />
                        <div className="sd-legend-item">
                            <span className="sd-legend-dot sd-legend-alert-dot" />
                            Active Alert
                        </div>
                    </div>
                </section>

                {/* SIDEBAR */}
                <aside className="sd-sidebar">
                    <div className="sd-tabs">
                        {[
                            { id: 'alerts', icon: <Bell size={13} />,       label: 'Alerts',    badge: alerts.length },
                            { id: 'ppe',    icon: <Camera size={13} />,     label: 'PPE',       badge: ppeQueue.length },
                            { id: 'roster', icon: <Users size={13} />,      label: 'Roster',    badge: null },
                            { id: 'jobs',   icon: <Briefcase size={13} />,  label: 'Jobs',      badge: jobs.length },
                        ].map(t => (
                            <button key={t.id} className={`sd-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
                                {t.icon}{t.label}
                                {t.badge > 0 && <span className="sd-tab-badge">{t.badge}</span>}
                            </button>
                        ))}
                    </div>

                    <div className="sd-sidebar-body">
                        {/* ALERTS */}
                        {activeTab === 'alerts' && (
                            <div className="sd-tab-content">
                                {alerts.length === 0 ? (
                                    <div className="sd-empty-state"><CheckCircle2 size={30} /><p>All clear</p></div>
                                ) : alerts.map(a => {
                                    const isGas = a.type === 'AUTO_GAS';
                                    const isSos = a.type === 'SOS' || a.type === 'SOS_MANUAL';
                                    const isOfflineSync = a.type === 'OFFLINE_SYNC';
                                    const canRunRca = !isOfflineSync;
                                    const gasExplain = isGas ? parseGasExplainability(a) : null;
                                    const cardCss = isSos ? 'sos'
                                        : isGas && a.severity === 'critical' ? 'sos'
                                        : isGas ? 'delay'
                                        : isOfflineSync ? 'info'
                                        : a.type.toLowerCase();
                                    return (
                                    <div key={a.id} className={`sd-alert-card sd-alert-${cardCss}`}
                                        onMouseEnter={() => setHoveredAlertWorkerId(a.workerId)}
                                        onMouseLeave={() => setHoveredAlertWorkerId(null)}
                                    >
                                        <div className="sd-alert-header">
                                            <AlertTriangle size={14} style={{ color: (isSos || a.severity === 'critical') ? 'var(--sd-sos)' : isOfflineSync ? 'var(--sd-ok)' : 'var(--sd-delayed)', flexShrink: 0 }} />
                                            <span className="sd-alert-type-label">
                                                {isSos ? 'SOS Emergency'
                                                    : isGas ? `Gas Alert${a.gas ? ` · ${a.gas}` : ''}`
                                                    : isOfflineSync ? 'Offline Sync'
                                                    : 'Delayed Exit'}
                                            </span>
                                            <span className="sd-alert-time">{a.time}</span>
                                        </div>
                                        <p className="sd-alert-msg">{a.msg}</p>

                                        {isGas && gasExplain && (gasExplain.summaryHi || gasExplain.immediateSteps.length > 0) && (
                                            <div className="sd-alert-explain">
                                                {gasExplain.summaryHi && (
                                                    <p className="sd-alert-explain-line">{gasExplain.summaryHi}</p>
                                                )}
                                                <div className="sd-alert-explain-meta">
                                                    {gasExplain.confidence && <span>विश्वास: {gasExplain.confidence}</span>}
                                                    {a.riskPriority && <span>जोखिम: {riskPriorityHi(a.riskPriority)}</span>}
                                                </div>
                                                {gasExplain.immediateSteps.length > 0 && (
                                                    <ul className="sd-alert-explain-steps">
                                                        {gasExplain.immediateSteps.slice(0, 2).map((step, idx) => (
                                                            <li key={`${a.id}-step-${idx}`}>{step}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}

                                        <div className="sd-alert-actions">
                                            {(isSos || (isGas && a.severity === 'critical')) && (
                                                <button className="sd-btn-danger" onClick={() => setSosModal(workers.find(w => w.id === a.workerId))}>
                                                    <AlertTriangle size={12} /> View SOS
                                                </button>
                                            )}
                                            {canRunRca && (
                                                <button className="sd-btn-rca" onClick={() => openRcaAssistant(a)}>
                                                    <Zap size={12} /> RCA Assistant
                                                </button>
                                            )}
                                            <button className="sd-btn-ack" onClick={() => acknowledgeAlert(a.id)}>
                                                <CheckCircle2 size={12} /> Acknowledge
                                            </button>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* PPE */}
                        {activeTab === 'ppe' && (
                            <div className="sd-tab-content">
                                {ppeQueue.length === 0 ? (
                                    <div className="sd-empty-state"><CheckCircle2 size={30} /><p>No pending approvals</p></div>
                                ) : ppeQueue.map(p => (
                                    <div key={p.id} className="sd-ppe-card">
                                        <div className="sd-ppe-header">
                                            <div>
                                                <div className="sd-ppe-name">{p.name}</div>
                                                <div className="sd-ppe-meta">{p.badge}  {p.job}  {p.time}</div>
                                            </div>
                                            <span className="sd-ppe-pending-badge">Pending</span>
                                        </div>
                                        <div className="sd-ppe-photos">
                                            <div className="sd-ppe-photo-slot">
                                                <Camera size={18} />
                                                <span>PPE Photo</span>
                                                <div className="sd-photo-mock"><Users size={24} /></div>
                                            </div>
                                            <div className="sd-ppe-photo-slot">
                                                <Wind size={18} />
                                                <span>Gas Meter</span>
                                                <div className="sd-photo-mock"><Activity size={24} /></div>
                                            </div>
                                        </div>
                                        <div className="sd-ppe-actions">
                                            <button className="sd-btn-deny" onClick={() => denyPPE(p.id)}><UserX size={13} /> Deny & Hold</button>
                                            <button className="sd-btn-approve" onClick={() => approvePPE(p.id)}><UserCheck size={13} /> Authorize Entry</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ROSTER */}
                        {activeTab === 'roster' && (
                            <div className="sd-tab-content">
                                {workers.map(w => {
                                    const pct = (w.entries / w.maxEntries) * 100;
                                    const fatigueColor = pct >= 100 ? '#ff3b30' : pct >= 75 ? '#ff9f0a' : '#34c759';
                                    const isSelected = selectedWorker?.id === w.id;
                                    return (
                                        <div
                                            key={w.id}
                                            className={`sd-roster-row${isSelected ? ' selected' : ''}${draggingJob && dropTargetId === w.id ? ' drop-hover' : ''}`}
                                            onClick={() => { setSelectedWorker(v => v?.id === w.id ? null : w); setFlyTo([w.lat, w.lng]); }}
                                            onDragOver={e => { e.preventDefault(); setDropTargetId(w.id); }}
                                            onDragLeave={() => setDropTargetId(null)}
                                            onDrop={() => handleDropOnWorker(w.id)}
                                        >
                                            <div className="sd-roster-avatar" style={{ borderColor: STATUS_CFG[w.status]?.color }}>
                                                {w.name[0]}
                                            </div>
                                            <div className="sd-roster-info">
                                                <div className="sd-roster-name">
                                                    {w.name}
                                                    <span className="sd-roster-badge-id">{w.badge}</span>
                                                </div>
                                                <div className="sd-roster-job">{w.job !== '—' ? w.job : 'Unassigned'}  {STATUS_CFG[w.status]?.label}</div>
                                                <div className="sd-fatigue-wrap">
                                                    <div className="sd-fatigue-track">
                                                        <div className="sd-fatigue-bar" style={{ width: `${pct}%`, background: fatigueColor }} />
                                                    </div>
                                                    <span className="sd-fatigue-label" style={{ color: fatigueColor }}>{w.entries}/{w.maxEntries}</span>
                                                </div>
                                                {pct >= 100 && <div className="sd-fatigue-warning"><AlertTriangle size={11} /> High Fatigue Warning</div>}
                                            </div>
                                            <div className="sd-roster-side">
                                                <span className="sd-batt" style={{ color: w.battery < 30 ? '#ff9f0a' : '#8e8e93' }}>
                                                    <Battery size={11} />{w.battery}%
                                                </span>
                                                <span className="sd-locate-btn" title="Center on map"
                                                    onClick={e => { e.stopPropagation(); setFlyTo([w.lat, w.lng]); }}>
                                                    <MapPin size={13} />
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* JOBS */}
                        {activeTab === 'jobs' && (
                            <div className="sd-tab-content">
                                <button className="sd-ai-rec-btn" onClick={fetchRecommendations}>
                                    <Zap size={13} /> AI Smart Assign
                                </button>

                                {/* Workers section — drag these */}
                                <div className="sd-dispatch-section-label">
                                    <UserCheck size={12} /> Workers — drag onto a job to assign
                                </div>
                                <div className="sd-dispatch-workers">
                                    {workers.map(w => (
                                        <div
                                            key={w.id}
                                            className={`sd-dispatch-worker${draggingWorker?.id === w.id ? ' dragging' : ''}${
                                                ['SOS', 'IN_MANHOLE', 'DELAYED'].includes(w.status) ? ' busy' : ''
                                            }`}
                                            draggable
                                            onDragStart={() => handleDragStartWorker(w)}
                                            onDragEnd={handleDragEndWorker}
                                            title={STATUS_CFG[w.status]?.label}
                                        >
                                            <span
                                                className="sd-dispatch-worker-dot"
                                                style={{ background: STATUS_CFG[w.status]?.color }}
                                            />
                                            <span className="sd-dispatch-worker-name">{w.name}</span>
                                            <span className="sd-dispatch-worker-badge">{w.badge}</span>
                                            <span className="sd-dispatch-worker-status" style={{ color: STATUS_CFG[w.status]?.color }}>
                                                {STATUS_CFG[w.status]?.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Jobs section — drop workers here */}
                                <div className="sd-dispatch-section-label" style={{ marginTop: 6 }}>
                                    <Briefcase size={12} /> Open Jobs — drop a worker here
                                </div>
                                {jobs.length === 0 ? (
                                    <div className="sd-empty-state"><CheckCircle2 size={30} /><p>All jobs assigned</p></div>
                                ) : jobs.map(job => (
                                    <div
                                        key={job.id}
                                        className={`sd-job-card${
                                            draggingJob?.id === job.id ? ' dragging' : ''
                                        }${dropJobId === job.id ? ' drop-hover' : ''}`}
                                        draggable
                                        onDragStart={() => handleDragStart(job)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={e => { e.preventDefault(); if (draggingWorker) setDropJobId(job.id); }}
                                        onDragLeave={() => setDropJobId(null)}
                                        onDrop={() => handleDropWorkerOnJob(job)}
                                    >
                                        <div className="sd-job-top">
                                            <code className="sd-job-id">{job.id}</code>
                                            <span className={`sd-job-risk risk-${job.risk.toLowerCase()}`}>{job.risk}</span>
                                        </div>
                                        <div className="sd-job-addr">{job.address}</div>
                                        <div className="sd-job-zone">{job.zone}</div>
                                        <div className="sd-job-eq"><Zap size={11} />{job.equipment}</div>
                                        <div className="sd-job-footer">
                                            <span className={`sd-priority p-${job.priority.toLowerCase()}`}>{job.priority}</span>
                                            {draggingWorker
                                                ? <span className="sd-drag-hint sd-drag-hint--active">↓ drop here</span>
                                                : <span className="sd-drag-hint">drag worker here</span>
                                            }
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}

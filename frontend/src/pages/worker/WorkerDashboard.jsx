import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    LogOut, Camera, Wind, CheckCircle2, AlertTriangle,
    ChevronRight, X, Lock, Shield, Clock, Flame,
    Droplets, ZapOff, TriangleAlert, CircleAlert,
    Ruler, User, Calendar, Volume2,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useNavigate } from 'react-router-dom';
import './WorkerDashboard.css';
import { useSocket } from '../../hooks/useSocket';
import GasGauge from '../../components/GasGauge';
import SafetyDiary from './SafetyDiary';

/*  Constants  */
const ENTRY_DURATION = 30 * 60;   // 30 min in seconds
const SOS_HOLD_MS    = 1500;      // 1.5 s long-press for SOS

const PHASE = {
    DASHBOARD:  'DASHBOARD',
    PRE_ENTRY:  'PRE_ENTRY',
    CAMERA:     'CAMERA',
    IN_MANHOLE: 'IN_MANHOLE',
    EXITED:     'EXITED',
};

const JOB = {
    id: 'MH-2041',
    address: 'Rajiv Nagar, Lane 4',
    zone: 'Zone B – Sector 7',
    risk: 'HIGH',
    depth: '4.2 m',
    depthM: 4.2,           // numeric — used by Safety Co-Pilot
    recentIncidents: 1,    // incidents logged at this site
    weather: 'heavy_rain', // current weather condition
    lastService: '14 days ago',
    supervisor: 'Priya Sharma',
};

const fmt       = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const fmtShift  = (s) => `${String(Math.floor(s/3600)).padStart(2,'0')}h ${String(Math.floor((s%3600)/60)).padStart(2,'0')}m`;

/*  Audio chime  */
function playChime(type = 'ok') {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        if (type === 'ok') {
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'sos') {
            osc.frequency.value = 660;
            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
        } else {
            osc.frequency.value = 440;
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
        }
        setTimeout(() => ctx.close(), 1000);
    } catch (e) { void e; }
}

const vibrate = (pattern) => { try { navigator.vibrate?.(pattern); } catch (e) { void e; } };

/* Safety Co-Pilot — TTS in Hindi */
function speak(text) {
    try {
        window.speechSynthesis.cancel(); // stop any previous utterance
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang  = 'hi-IN';
        msg.rate  = 0.9;
        window.speechSynthesis.speak(msg);
    } catch (e) { void e; }
}

/* Safety Co-Pilot — local risk evaluation (mirrors backend evaluateRisk.js).
   Runs instantly on the client so the card appears even without a live socket. */
const WEATHER_MSGS = {
    heavy_rain:    'तेज़ बारिश के कारण पानी भरने का खतरा है',
    thunderstorm:  'तूफान के कारण मैनहोल के अंदर काम करना खतरनाक है',
    flood_warning: 'बाढ़ की चेतावनी — काम तुरंत बंद करें',
    heatwave:      'अत्यधिक गर्मी के कारण ऑक्सीजन कम हो सकती है',
};
const WEATHER_SIGNAL_LABELS = {
    heavy_rain: 'तेज़ बारिश',
    thunderstorm: 'तूफानी मौसम',
    flood_warning: 'बाढ़ का खतरा',
    heatwave: 'अत्यधिक गर्मी',
};
const STANDARD_TIPS = [
    'PPE को सही तरीके से पहनें और फोटो अपलोड करें',
    'पहले ऊपर से गैस टेस्ट और पानी का बहाव चेक करें',
    'किसी भी वक्त घबराहट हो तो SOS दबाएँ — कोई निगरानी नहीं, सिर्फ़ बचाव के लिए',
];

function buildLocalConfidence(priority, signals) {
    const dangerCount  = signals.filter(s => s.severity === 'danger').length;
    const warningCount = signals.filter(s => s.severity === 'warning').length;
    const infoCount    = signals.filter(s => s.severity === 'info').length;
    const base = priority === 'high' ? 72 : priority === 'medium' ? 62 : 84;
    const score = Math.max(55, Math.min(97, Math.round(base + (dangerCount * 6) + (warningCount * 4) + (infoCount * 2))));
    const bandHi = score >= 90 ? 'उच्च' : score >= 75 ? 'मध्यम-उच्च' : 'मध्यम';
    return { score, labelHi: `${score}% (${bandHi})` };
}

function buildLocalImmediateSteps(priority, signalKeys) {
    const steps = [];
    const hasGas = signalKeys.some(k => ['h2s', 'co', 'o2_low', 'ch4'].includes(k));
    const hasWaterOrWeather = signalKeys.some(k => ['water', 'heavy_rain', 'thunderstorm', 'flood_warning'].includes(k));
    const hasDepthOrHistory = signalKeys.some(k => ['depth', 'incidents'].includes(k));

    if (priority === 'high') {
        steps.push('तुरंत निकासी करें और एरिया को कॉर्डन करें');
    } else if (priority === 'medium') {
        steps.push('एंट्री रोकें और दोबारा गैस टेस्ट करें');
    } else {
        steps.push('काम शुरू रखने से पहले PPE और गैस मीटर दोबारा जांचें');
    }

    if (hasGas) steps.push('ब्लोअर/वेंटिलेशन चालू करें और 2 मिनट बाद रीडिंग रीचेक करें');
    if (hasWaterOrWeather) steps.push('पानी का बहाव और ड्रेनेज क्लियरेंस तुरंत सुनिश्चित करें');
    if (hasDepthOrHistory) steps.push('रेस्क्यू लाइन और स्टैंडबाय टीम तैयार रखें');

    steps.push('सुपरवाइजर को तुरंत अपडेट करें और अनुमति लेकर ही आगे बढ़ें');
    return [...new Set(steps)].slice(0, 3);
}

function buildLocalExplainability(priority, signals) {
    const triggerSignals = signals.map(s => s.label);
    const topSignals = triggerSignals.slice(0, 3);
    const actionClause = priority === 'high'
        ? 'तुरंत बाहर निकलें और आपात प्रोटोकॉल लागू करें'
        : priority === 'medium'
            ? 'कार्य रोककर सुरक्षा जांच दोबारा करें'
            : 'सामान्य सावधानी के साथ कार्य जारी रखें';
    const summaryHi = topSignals.length > 0
        ? `${topSignals.join(' + ')} = ${actionClause}`
        : `सभी संकेत सुरक्षित हैं = ${actionClause}`;
    const confidence = buildLocalConfidence(priority, signals);
    return {
        summaryHi,
        confidence: confidence.labelHi,
        confidenceScore: confidence.score,
        immediateSteps: buildLocalImmediateSteps(priority, signals.map(s => s.key)),
        triggerSignals,
    };
}

function normalizeAdvisoryPayload(payload) {
    if (!payload) return null;
    const fallbackExplainability = buildLocalExplainability(payload.priority || 'low', []);
    const explainability = payload.explainability || fallbackExplainability;
    const immediateSteps = Array.isArray(explainability.immediateSteps) && explainability.immediateSteps.length > 0
        ? explainability.immediateSteps
        : [...STANDARD_TIPS];

    return {
        ...payload,
        tips: Array.isArray(payload.tips) ? payload.tips : [...STANDARD_TIPS],
        explainability: {
            summaryHi: explainability.summaryHi || fallbackExplainability.summaryHi,
            confidence: explainability.confidence || fallbackExplainability.confidence,
            confidenceScore: Number.isFinite(explainability.confidenceScore)
                ? explainability.confidenceScore
                : fallbackExplainability.confidenceScore,
            immediateSteps,
            triggerSignals: Array.isArray(explainability.triggerSignals)
                ? explainability.triggerSignals
                : fallbackExplainability.triggerSignals,
        },
    };
}

function computeLocalAdvisory({ depth = 0, recentIncidents = 0, weather = 'clear', gasReadings = null } = {}) {
    const reasons = [];
    const signals = [];

    const addSignal = (reason, key, label, severity = 'warning') => {
        reasons.push(reason);
        signals.push({ key, label, severity });
    };

    if (depth > 3) {
        addSignal(
            `मैनहोल बहुत गहरा है (${depth} मीटर — 3 मीटर से अधिक)`,
            'depth',
            `अधिक गहराई (${depth}m)`,
            'warning'
        );
    }
    if (recentIncidents > 0) {
        addSignal(
            `इस जगह हाल ही में ${recentIncidents} घटना दर्ज हुई है`,
            'incidents',
            `${recentIncidents} हालिया घटना`,
            'warning'
        );
    }

    const wMsg = WEATHER_MSGS[weather];
    if (wMsg) {
        addSignal(
            wMsg,
            weather,
            WEATHER_SIGNAL_LABELS[weather] || 'मौसम जोखिम',
            weather === 'flood_warning' || weather === 'thunderstorm' ? 'danger' : 'warning'
        );
    }

    if (gasReadings) {
        if (gasReadings.H2S >= 10) {
            addSignal(
                `H₂S गैस खतरनाक स्तर पर है — ${gasReadings.H2S} ppm`,
                'h2s',
                `H2S बढ़ रहा है (${gasReadings.H2S} ppm)`,
                'danger'
            );
        }
        if (gasReadings.CO >= 200) {
            addSignal(
                `CO गैस खतरनाक स्तर पर है — ${gasReadings.CO} ppm`,
                'co',
                `CO बढ़ रहा है (${gasReadings.CO} ppm)`,
                'danger'
            );
        }
        if (gasReadings.O2 < 19.5) {
            addSignal(
                `ऑक्सीजन का स्तर कम है — ${gasReadings.O2}%`,
                'o2_low',
                `ऑक्सीजन कम है (${gasReadings.O2}%)`,
                'danger'
            );
        }
        if (gasReadings.CH4 >= 25) {
            addSignal(
                `मीथेन गैस खतरे के स्तर पर है — ${gasReadings.CH4}% LEL`,
                'ch4',
                `मीथेन बढ़ रही है (${gasReadings.CH4}% LEL)`,
                'danger'
            );
        }
        if (gasReadings.WATER >= 30) {
            addSignal(
                `मैनहोल में पानी भर रहा है — ${gasReadings.WATER} सेंटीमीटर`,
                'water',
                `पानी का स्तर बढ़ रहा है (${gasReadings.WATER} cm)`,
                'warning'
            );
        }
    }

    const priority = reasons.length >= 2 ? 'high' : reasons.length === 1 ? 'medium' : 'low';
    const isHigh   = priority !== 'low';
    const explainability = buildLocalExplainability(priority, signals);

    return normalizeAdvisoryPayload({
        priority,
        title:   isHigh ? '⚠️ उच्च जोखिम का काम' : 'ℹ️ सामान्य जोखिम',
        reasons,
        tips:    [...STANDARD_TIPS],
        speak:   isHigh
            ? `सावधान! ${explainability.summaryHi}. ${explainability.immediateSteps[0] || STANDARD_TIPS[2]}`
            : 'सब ठीक है। PPE पहनें और सावधान रहें।',
        explainability,
        source:  'local',
    });
}

function getReasonIcon(reason) {
    if (reason.includes('गहरा') || reason.includes('गहर'))        return '🕳️';
    if (reason.includes('बाढ़'))                                   return '🌊';
    if (reason.includes('बारिश') || reason.includes('पानी भर'))   return '🌧️';
    if (reason.includes('तूफान'))                                  return '⛈️';
    if (reason.includes('गर्मी'))                                  return '🌡️';
    if (reason.includes('H₂S') || reason.includes('CO') ||
        reason.includes('ऑक्सीजन') || reason.includes('मीथेन') ||
        reason.includes('पानी भर रहा'))                            return '☣️';
    if (reason.includes('घटना'))                                   return '⚠️';
    return '⚠️';
}

function buildAdvisorySpeechText(currentAdvisory) {
    if (!currentAdvisory) return '';
    const explanation = currentAdvisory.explainability?.summaryHi;
    const firstStep = currentAdvisory.explainability?.immediateSteps?.[0];
    if (explanation) {
        return `${explanation}.${firstStep ? ` ${firstStep}` : ''}`;
    }
    return currentAdvisory.speak || 'सुरक्षा निर्देश उपलब्ध नहीं हैं';
}

/*  Swipe-to-Confirm  */
function SwipeConfirm({ label, onConfirm, confirmed, blocked }) {
    const trackRef  = useRef(null);
    const [dragging,    setDragging]    = useState(false);
    const [offset,      setOffset]      = useState(0);
    const [trackWidth,  setTrackWidth]  = useState(260);
    const startXRef = useRef(0);
    const THUMB = 56;

    // Measure track width once on mount
    useEffect(() => {
        if (trackRef.current) {
            setTrackWidth(trackRef.current.offsetWidth - THUMB);
        }
    }, []);

    const start = useCallback((clientX) => {
        if (confirmed) return;
        setDragging(true);
        startXRef.current = clientX - offset;
    }, [confirmed, offset]);

    const move = useCallback((clientX) => {
        if (!dragging) return;
        const raw = clientX - startXRef.current;
        setOffset(Math.min(Math.max(0, raw), trackWidth));
    }, [dragging, trackWidth]);

    const end = useCallback(() => {
        if (!dragging) return;
        setDragging(false);
        if (offset >= trackWidth * 0.82) {
            setOffset(trackWidth);
            vibrate([60, 30, 100]);
            onConfirm();
        } else {
            setOffset(0);
        }
    }, [dragging, offset, trackWidth, onConfirm]);

    const pct = confirmed ? 100 : Math.round((offset / (trackWidth || 1)) * 100);
    const thumbX = confirmed ? trackWidth : offset;

    return (
        <div
            ref={trackRef}
            className={`swipe-track${confirmed ? ' swipe-confirmed' : ''}${blocked ? ' swipe-retry' : ''}`}
            onMouseMove={e => move(e.clientX)}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchMove={e => move(e.touches[0].clientX)}
            onTouchEnd={end}
        >
            <div className="swipe-fill" style={{ width: `${pct}%` }} />
            <div
                className={`swipe-thumb${dragging ? ' dragging' : ''}`}
                style={{ transform: `translateX(${thumbX}px)` }}
                onMouseDown={e => start(e.clientX)}
                onTouchStart={e => start(e.touches[0].clientX)}
            >
                {confirmed ? <CheckCircle2 size={22} /> : <ChevronRight size={22} />}
            </div>
            <span className="swipe-label">{confirmed ? 'Gas Levels Confirmed' : label}</span>
        </div>
    );
}

/*  Long-Press SOS FAB  */
function SosFab({ onActivate }) {
    const [progress, setProgress]   = useState(0);
    const [holding,  setHolding]    = useState(false);
    const rafRef    = useRef(null);
    const startRef  = useRef(0);
    const CIRC = 2 * Math.PI * 24; // r=24

    const startHold = useCallback((e) => {
        e.preventDefault();
        setHolding(true);
        startRef.current = performance.now();
        vibrate(50);
        const tick = () => {
            const pct = Math.min((performance.now() - startRef.current) / SOS_HOLD_MS, 1);
            setProgress(pct);
            if (pct < 1) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                setProgress(1);
                vibrate([100, 50, 200, 50, 300]);
                playChime('sos');
                onActivate();
            }
        };
        rafRef.current = requestAnimationFrame(tick);
    }, [onActivate]);

    const cancelHold = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        setHolding(false);
        setProgress(0);
    }, []);

    return (
        <button
            className={`sos-fab${holding ? ' holding' : ''}`}
            aria-label="Emergency SOS — hold 1.5 seconds"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onContextMenu={e => e.preventDefault()}
        >
            <svg className="sos-fab-ring" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" className="sos-fab-track" />
                <circle
                    cx="28" cy="28" r="24"
                    className="sos-fab-arc"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - progress)}
                    transform="rotate(-90 28 28)"
                />
            </svg>
            <span className="sos-fab-text">SOS</span>
            {holding && (
                <span className="sos-fab-pct">{Math.round(progress * 100)}%</span>
            )}
        </button>
    );
}

/*  Hazard Grid  */
const HAZARDS = [
    { id: 'gas',    label: 'Gas Cloud',    Icon: Wind,          color: '#ff9f0a' },
    { id: 'water',  label: 'Water Flood',  Icon: Droplets,      color: '#0a84ff' },
    { id: 'struct', label: 'Broken Wall',  Icon: ZapOff,        color: '#ff3b30' },
    { id: 'other',  label: 'Other Hazard', Icon: TriangleAlert, color: '#ff9f0a' },
];

/* 
   MAIN COMPONENT
 */
export default function WorkerDashboard() {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    // Core state
    const [phase,         setPhase]         = useState(PHASE.DASHBOARD);
    const [onDuty,        setOnDuty]        = useState(true);
    const [ppeConfirmed,  setPpeConfirmed]  = useState(false);
    const [gasConfirmed,  setGasConfirmed]  = useState(false);
    const [cameraOpen,    setCameraOpen]    = useState(false);
    const [countdown,     setCountdown]     = useState(ENTRY_DURATION);
    const [shiftSecs,     setShiftSecs]     = useState(0);
    const [entryTime,     setEntryTime]     = useState(null);
    const [sosActive,     setSosActive]     = useState(false);
    const [hazardModal,   setHazardModal]   = useState(false);
    const [reportedHazard, setReportedHazard] = useState(null);

    // Pre-entry gas check state
    const [preCheck, setPreCheck] = useState({ state: 'idle', readings: null, statuses: null }); // state: idle|checking|cleared|blocked

    // Live gas readings from the backend sensor engine (null = awaiting first reading)
    const [gasReadings, setGasReadings] = useState(null);
    const [evacModal,   setEvacModal]   = useState(false);
    const prevGasStatusRef = useRef({});

    // Safety Co-Pilot advisory state
    const [advisory,        setAdvisory]        = useState(null);
    const [advisoryVisible, setAdvisoryVisible] = useState(false);

    // Dashboard tab navigation
    const [activeTab,   setActiveTab]   = useState('job'); // 'job' | 'diary'

    const { socket } = useSocket();

    const timerRef = useRef(null);


    // Shift timer — always runs
    useEffect(() => {
        const t = setInterval(() => setShiftSecs(s => s + 1), 1000);
        return () => clearInterval(t);
    }, []);

    // Manhole countdown
    useEffect(() => {
        if (phase === PHASE.IN_MANHOLE) {
            timerRef.current = setInterval(() => {
                setCountdown(c => (c <= 1 ? 0 : c - 1));
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [phase]);

    // Hard duration cutoff — auto SOS + exit when countdown hits zero
    useEffect(() => {
        if (phase === PHASE.IN_MANHOLE && countdown === 0) {
            clearInterval(timerRef.current);
            socket?.emit('sos_manual', {
                workerId:   currentUser?.id,
                workerName: currentUser?.name,
                reason:     'duration_exceeded',
            });
            playChime('sos');
            vibrate([200, 100, 200, 100, 400]);
            setSosActive(true);
            setPhase(PHASE.EXITED);
            setGasReadings(null);
            prevGasStatusRef.current = {};
            socket?.emit('worker_exit_manhole', { workerId: currentUser?.id });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdown, phase]);

    // Socket: live gas readings + evacuation command
    useEffect(() => {
        if (!socket) return;

        const handleSensorUpdate = (data) => {
            if (data.workerId !== currentUser?.id) return;

            const prev = prevGasStatusRef.current;
            let hasNewWarning = false;
            let hasNewDanger  = false;

            for (const gas of ['H2S', 'CO', 'O2', 'CH4']) {
                const next = data.statuses[gas];
                if (next !== prev[gas]) {
                    if (next === 'danger')  hasNewDanger  = true;
                    if (next === 'warning') hasNewWarning = true;
                }
            }
            prevGasStatusRef.current = { ...data.statuses };
            setGasReadings(data);

            const liveAdvisory = computeLocalAdvisory({
                depth: JOB.depthM,
                recentIncidents: JOB.recentIncidents,
                weather: JOB.weather,
                gasReadings: data.readings,
            });
            setAdvisory(liveAdvisory);
            setAdvisoryVisible(true);

            if (hasNewDanger) {
                playChime('sos');
                vibrate([100, 50, 200, 50, 300]);
                setHazardModal(true);
            } else if (hasNewWarning) {
                playChime('warn');
            }
        };

        const handleEvacCommand = (data) => {
            if (data.workerId !== currentUser?.id) return;
            setEvacModal(true);
            playChime('sos');
            vibrate([300, 100, 300, 100, 500]);
        };

        // Safety Co-Pilot: server pushed a live advisory (job risk, weather, gas spike)
        const handleAdvisory = (data) => {
            // Filter: if advisory is targeted to a specific worker, skip if it's not me
            if (data.workerId !== null && data.workerId !== undefined && data.workerId !== currentUser?.id) return;
            const normalized = normalizeAdvisoryPayload(data);
            setAdvisory(normalized);
            setAdvisoryVisible(true);
            if (normalized.priority === 'high') {
                playChime('sos');
                vibrate([100, 50, 200]);
                speak(buildAdvisorySpeechText(normalized));
            }
        };

        socket.on('sensor_update',       handleSensorUpdate);
        socket.on('evac_command',        handleEvacCommand);
        socket.on('live_safety_advisory', handleAdvisory);
        return () => {
            socket.off('sensor_update',       handleSensorUpdate);
            socket.off('evac_command',        handleEvacCommand);
            socket.off('live_safety_advisory', handleAdvisory);
        };
    }, [socket, currentUser?.id]);

    // Safety Co-Pilot: compute + show advisory whenever the DASHBOARD phase loads.
    // Local computation runs instantly (card always visible).
    // Socket request updates it with richer server data if backend is available.
    useEffect(() => {
        if (phase !== PHASE.DASHBOARD) return;

        const jobParams = {
            depth:           JOB.depthM,
            recentIncidents: JOB.recentIncidents,
            weather:         JOB.weather,
        };

        // Always show immediately from local logic
        const localAdvisory = computeLocalAdvisory(jobParams);
        setAdvisory(localAdvisory);
        setAdvisoryVisible(true);

        // Also ask the server — it will enrich with live gas data if available
        if (socket) {
            socket.emit('request_advisory', {
                workerId:  currentUser?.id,
                jobParams,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, socket]);

    // Reset to job tab whenever the worker leaves the dashboard (e.g. enters manhole)
    useEffect(() => {
        if (phase !== PHASE.DASHBOARD) setActiveTab('job');
    }, [phase]);

    const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

    const handleDutyToggle = () => {
        setOnDuty(v => !v);
        vibrate(30);
        playChime('ok');
    };

    const handlePpeCaptured = () => {
        setPpeConfirmed(true);
        vibrate([50, 30, 80]);
        playChime('ok');
        setCameraOpen(false);
    };

    const handleGasConfirm = () => {
        setGasConfirmed(true);
    };

    // Called when swipe completes — hit backend to validate gas levels
    const handleRunGasCheck = async () => {
        setPreCheck({ state: 'checking', readings: null, statuses: null });
        try {
            const res  = await fetch('http://localhost:3001/api/workers/gas-check');
            const data = await res.json();
            const allSafe = Object.values(data.statuses).every(s => s === 'safe');
            if (allSafe) {
                setPreCheck({ state: 'cleared', readings: data.readings, statuses: data.statuses });
                setGasConfirmed(true);
                playChime('ok');
                vibrate([60, 30, 80]);
            } else {
                setPreCheck({ state: 'blocked', readings: data.readings, statuses: data.statuses });
                playChime('sos');
                vibrate([200, 100, 200]);
            }
        } catch {
            setPreCheck({ state: 'idle', readings: null, statuses: null });
        }
    };

    const handleStartChecklist = () => {
        setPhase(PHASE.PRE_ENTRY);
    };

    const handleEnter = () => {
        vibrate([80, 40, 120]);
        playChime('ok');
        setPhase(PHASE.IN_MANHOLE);
        setCountdown(ENTRY_DURATION);
        setEntryTime(new Date());
        socket?.emit('worker_enter_manhole', { workerId: currentUser?.id });
    };

    const handleExit = () => {
        clearInterval(timerRef.current);
        vibrate([100, 50, 100]);
        playChime('ok');
        setPhase(PHASE.EXITED);
        setGasReadings(null);
        prevGasStatusRef.current = {};
        socket?.emit('worker_exit_manhole', { workerId: currentUser?.id });
    };

    const handleSosTriggered = () => {
        setSosActive(true);
        socket?.emit('sos_manual', { workerId: currentUser?.id, workerName: currentUser?.name });
    };

    const handleHazardReport = (hazard) => {
        setReportedHazard(hazard);
        vibrate([60, 30, 60]);
        playChime('ok');
        socket?.emit('hazard_report', { workerId: currentUser?.id, workerName: currentUser?.name, hazard: hazard.label });
        setTimeout(() => { setHazardModal(false); setReportedHazard(null); }, 2000);
    };

    const handleNewJob = () => {
        setPhase(PHASE.DASHBOARD);
        setPpeConfirmed(false); setGasConfirmed(false);
        setCountdown(ENTRY_DURATION);
        setPreCheck({ state: 'idle', readings: null, statuses: null });
    };

    // Timer color
    const pctLeft = countdown / ENTRY_DURATION;
    const isOverdue = countdown === 0;
    const nearEnd   = countdown <= 5 * 60;
    const halfway   = countdown <= ENTRY_DURATION / 2;
    const ringColor = isOverdue ? '#ff3b30'
                    : nearEnd   ? '#ff3b30'
                    : halfway   ? '#ff9f0a'
                    : '#00ff88';
    const canEnter = ppeConfirmed && gasConfirmed;
    const CIRC = 2 * Math.PI * 88;

    /*  Render  */
    return (
        <div className="wd-root">

            {/*  SOS SENT MODAL  */}
            {sosActive && (
                <div className="wd-overlay" role="alertdialog" aria-modal="true">
                    <div className="wd-sos-modal">
                        <div className="wd-sos-ring" />
                        <Flame size={52} color="#ff3b30" />
                        <h2 className="wd-sos-title">SOS SENT</h2>
                        <p className="wd-sos-msg">Emergency alert dispatched to supervisor &amp; control room.</p>
                        <p className="wd-sos-time">{new Date().toLocaleTimeString()}</p>
                        <button className="wd-btn-dismiss" onClick={() => setSosActive(false)}>
                            <X size={18} /> Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/*  CAMERA OVERLAY  */}
            {cameraOpen && (
                <div className="wd-overlay wd-camera-overlay">
                    <div className="wd-camera-frame">
                        <div className="wd-camera-heading">Position your helmet &amp; vest in frame</div>
                        <div className="wd-silhouette-box">
                            <div className="wd-silhouette" />
                            <div className="wd-corner wd-corner-tl" />
                            <div className="wd-corner wd-corner-tr" />
                            <div className="wd-corner wd-corner-bl" />
                            <div className="wd-corner wd-corner-br" />
                        </div>
                        <p className="wd-camera-hint">Ensure helmet, vest and gloves are visible</p>
                        <label className="wd-btn-capture">
                            <Camera size={20} /> Capture Photo
                            <input
                                type="file" accept="image/*" capture="environment"
                                className="wd-file-hidden"
                                onChange={handlePpeCaptured}
                            />
                        </label>
                        <button className="wd-btn-cancel-cam" onClick={() => setCameraOpen(false)}>
                            <X size={16} /> Cancel
                        </button>
                    </div>
                </div>
            )}

            {/*  HAZARD REPORT MODAL  */}
            {hazardModal && (
                <div className="wd-overlay">
                    <div className="wd-hazard-modal">
                        <div className="wd-hazard-top">
                            <h3 className="wd-hazard-title">Report Hazard</h3>
                            <button className="wd-hazard-close" onClick={() => setHazardModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        {reportedHazard ? (
                            <div className="wd-hazard-sent">
                                <CheckCircle2 size={52} color="#ffffff" />
                                <p>Hazard reported to supervisor</p>
                            </div>
                        ) : (
                            <div className="wd-hazard-grid">
                                {HAZARDS.map(h => (
                                    <button
                                        key={h.id}
                                        className="wd-hazard-btn"
                                        onClick={() => handleHazardReport(h)}
                                        style={{ '--hcolor': h.color }}
                                    >
                                        <h.Icon size={36} style={{ color: h.color }} />
                                        <span>{h.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/*  EVACUATION ORDER MODAL  */}
            {evacModal && (
                <div className="wd-overlay wd-evac-overlay">
                    <div className="wd-evac-modal">
                        <div className="wd-evac-icon">🚨</div>
                        <h2 className="wd-evac-title">EVACUATE NOW</h2>
                        <p className="wd-evac-msg">Your supervisor has issued an immediate evacuation order. Exit the manhole immediately.</p>
                        <button
                            className="wd-evac-dismiss"
                            onClick={() => { setEvacModal(false); handleExit(); }}
                        >
                            <LogOut size={20} /> EXIT &amp; CONFIRM
                        </button>
                    </div>
                </div>
            )}

            <div className="wd-card">
            {/*  HEADER  */}
            <header className="wd-header">
                <div className="wd-header-left">
                    <div className="wd-avatar">{currentUser?.name?.[0] ?? 'R'}</div>
                    <div>
                        <div className="wd-name">{currentUser?.name}</div>
                        <div className="wd-shift"><Clock size={11} /> {fmtShift(shiftSecs)}</div>
                    </div>
                </div>
                <div className="wd-header-right">
                    {/* Duty toggle */}
                    <button
                        className={`wd-duty-toggle ${onDuty ? 'on-duty' : 'idle'}`}
                        onClick={handleDutyToggle}
                        aria-label={onDuty ? 'On Duty — tap to go idle' : 'Idle — tap to go on duty'}
                    >
                        <span className="wd-duty-thumb" />
                        <span className="wd-duty-label">{onDuty ? 'ON DUTY' : 'IDLE'}</span>
                    </button>
                    <button className="wd-logout-btn" onClick={handleLogout} aria-label="Logout">
                        <LogOut size={17} />
                    </button>
                </div>
            </header>

            {/*  MAIN  */}
            <main className="wd-main">

                {/*  DASHBOARD  */}
                {phase === PHASE.DASHBOARD && (
                    <div className="wd-dashboard">
                        {/* Tab switcher */}
                        <div className="wd-tabs">
                            <button
                                className={`wd-tab ${activeTab === 'job' ? 'wd-tab-active' : ''}`}
                                onClick={() => setActiveTab('job')}
                            >
                                📋 कार्य
                            </button>
                            <button
                                className={`wd-tab ${activeTab === 'diary' ? 'wd-tab-active' : ''}`}
                                onClick={() => setActiveTab('diary')}
                            >
                                📖 मेरी डायरी
                            </button>
                        </div>

                        {/* ── JOB TAB ── */}
                        {activeTab === 'job' && (<>
                        <div className={`wd-job-hero risk-${JOB.risk.toLowerCase()}`}>
                            <div className="wd-job-risk-badge">
                                {JOB.risk === 'HIGH'     && <AlertTriangle size={36} />}
                                {JOB.risk === 'MEDIUM'   && <CircleAlert   size={36} />}
                                {JOB.risk === 'LOW'      && <Shield        size={36} />}
                                <span>{JOB.risk} RISK</span>
                            </div>
                            <div className="wd-job-id-badge">{JOB.id}</div>
                            <div className="wd-job-address">{JOB.address}</div>
                            <div className="wd-job-zone">{JOB.zone}</div>
                            <div className="wd-job-meta-row">
                                <span className="wd-meta-item"><Ruler size={12} /> {JOB.depth}</span>
                                <span className="wd-meta-dot">•</span>
                                <span className="wd-meta-item"><Calendar size={12} /> {JOB.lastService}</span>
                            </div>
                            <div className="wd-job-super">
                                <User size={12} /> Supervisor: {JOB.supervisor}
                            </div>
                        </div>

                        {/* Safety Co-Pilot advisory card */}
                        {advisoryVisible && advisory && (
                            <div className={`wd-copilot-card copilot-${advisory.priority}`} role="status" aria-live="polite">
                                <div className="wd-copilot-header">
                                    <span className="wd-copilot-title">{advisory.title}</span>
                                    <div className="wd-copilot-actions">
                                        <button
                                            className="wd-copilot-speak-btn"
                                            onClick={() => speak(buildAdvisorySpeechText(advisory))}
                                            aria-label="सलाह सुनें"
                                            title="Read aloud in Hindi"
                                        >
                                            <Volume2 size={20} />
                                        </button>
                                        <button
                                            className="wd-copilot-close-btn"
                                            onClick={() => setAdvisoryVisible(false)}
                                            aria-label="बंद करें"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>
                                {advisory.reasons.length > 0 && (
                                    <ul className="wd-copilot-reasons">
                                        {advisory.reasons.map((r, i) => (
                                            <li key={i}>
                                                <span className="wd-copilot-reason-icon">{getReasonIcon(r)}</span>
                                                {r}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {advisory.explainability?.summaryHi && (
                                    <div className="wd-copilot-explain">
                                        <p className="wd-copilot-summary">{advisory.explainability.summaryHi}</p>
                                        <div className="wd-copilot-meta">
                                            <span>विश्वास: {advisory.explainability.confidence}</span>
                                            {Array.isArray(advisory.explainability.triggerSignals) && advisory.explainability.triggerSignals.length > 0 && (
                                                <span>{advisory.explainability.triggerSignals.slice(0, 2).join(' • ')}</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="wd-copilot-tip-heading">तुरंत कदम</div>
                                <ul className="wd-copilot-tips">
                                    {(advisory.explainability?.immediateSteps?.length
                                        ? advisory.explainability.immediateSteps
                                        : advisory.tips).map((t, i) => (
                                        <li key={i}>{t}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <button className="wd-btn-primary wd-btn-start" onClick={handleStartChecklist}>
                            Begin Pre-Entry Checklist <ChevronRight size={24} />
                        </button>

                        <button className="wd-btn-secondary" onClick={() => setHazardModal(true)}>
                            <TriangleAlert size={18} /> Report Hazard
                        </button>
                        </>)}  {/* end job tab */}

                        {/* ── DIARY TAB ── */}
                        {activeTab === 'diary' && (
                            <SafetyDiary
                                workerId={currentUser?.id}
                                workerName={currentUser?.name}
                                badge={currentUser?.badge}
                                socket={socket}
                            />
                        )}
                    </div>
                )}

                {/*  PRE-ENTRY  */}
                {phase === PHASE.PRE_ENTRY && (
                    <div className="wd-preentry">
                        <h2 className="wd-gate-heading">PRE-ENTRY CHECKS</h2>
                        <p className="wd-gate-sub">Both checks must be completed before entry</p>

                        {/* PPE Check */}
                        <div className={`wd-check-card ${ppeConfirmed ? 'done' : ''}`}>
                            <div className="wd-check-left">
                                <div className="wd-check-dot">{ppeConfirmed ? <CheckCircle2 size={22} /> : '1'}</div>
                                <div>
                                    <div className="wd-check-title">PPE Photo</div>
                                    <div className="wd-check-desc">{ppeConfirmed ? 'Photo captured & verified' : 'Full-view helmet, vest & gloves required'}</div>
                                </div>
                            </div>
                            {!ppeConfirmed ? (
                                <button className="wd-check-btn" onClick={() => setCameraOpen(true)}>
                                    <Camera size={18} /> Capture
                                </button>
                            ) : (
                                <span className="wd-check-tick"><CheckCircle2 size={26} /></span>
                            )}
                        </div>

                        {/* Gas Test — Swipe triggers real backend sensor check */}
                        <div className={`wd-check-card ${gasConfirmed ? 'done' : preCheck.state === 'blocked' ? 'blocked' : ''}`}>
                            <div className="wd-check-left">
                                <div className="wd-check-dot">{gasConfirmed ? <CheckCircle2 size={22} /> : preCheck.state === 'checking' ? '⟳' : '2'}</div>
                                <div>
                                    <div className="wd-check-title">Gas Level Test</div>
                                    <div className="wd-check-desc">
                                        {gasConfirmed             ? 'All sensors confirmed safe' :
                                         preCheck.state === 'checking' ? 'Scanning sensors…' :
                                         preCheck.state === 'blocked'  ? 'Entry blocked — unsafe gas detected' :
                                         'Swipe to run live sensor check'}
                                    </div>
                                </div>
                            </div>
                            {gasConfirmed && (
                                <span className="wd-check-tick"><CheckCircle2 size={26} /></span>
                            )}
                        </div>

                        {/* Swipe slider — active until cleared or blocked */}
                        {!gasConfirmed && preCheck.state !== 'checking' && (
                            <SwipeConfirm
                                key={preCheck.state}
                                label={preCheck.state === 'blocked' ? 'Swipe to retry scan ↺' : 'Swipe to scan gas levels →'}
                                onConfirm={handleRunGasCheck}
                                confirmed={false}
                                blocked={preCheck.state === 'blocked'}
                            />
                        )}

                        {/* Scanning pulse */}
                        {preCheck.state === 'checking' && (
                            <div className="wd-gascheck-scanning-bar">
                                <span className="wd-check-scanning">Scanning all sensors…</span>
                            </div>
                        )}

                        {/* Results pills */}
                        {preCheck.readings && (
                            <div className={`wd-gascheck-results ${preCheck.state}`}>
                                {['H2S','CO','O2','CH4','WATER'].map(gas => {
                                    const st  = preCheck.statuses[gas];
                                    const val = preCheck.readings[gas];
                                    const unit = { H2S:'ppm', CO:'ppm', O2:'%', CH4:'% LEL', WATER:'cm' }[gas];
                                    const lbl  = { H2S:'H₂S', CO:'CO', O2:'O₂', CH4:'CH₄', WATER:'Water' }[gas];
                                    return (
                                        <span key={gas} className={`wd-gascheck-pill pill-${st}`}>
                                            {st === 'safe' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                                            {lbl} {val}{unit}
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {preCheck.state === 'blocked' && (
                            <div className="wd-gascheck-blocked">
                                ⚠️ Unsafe gas detected. Swipe again to retry or contact supervisor.
                            </div>
                        )}

                        {/* Enter button */}
                        <button
                            className={`wd-btn-enter ${canEnter ? 'unlocked' : 'locked'}`}
                            disabled={!canEnter}
                            onClick={handleEnter}
                        >
                            {canEnter ? (
                                <>ENTER MANHOLE <ChevronRight size={26} /></>
                            ) : (
                                <><Lock size={20} /> Complete both checks</>
                            )}
                        </button>

                        <button className="wd-btn-back" onClick={() => setPhase(PHASE.DASHBOARD)}>
                             Back to job
                        </button>
                    </div>
                )}

                {/*  IN MANHOLE  */}
                {phase === PHASE.IN_MANHOLE && (
                    <div className="wd-inmanhole">
                        <div className={`wd-status-pill${isOverdue ? ' pill-sos' : nearEnd ? ' pill-warn' : ''}`}>
                            {isOverdue ? ' OVERDUE — EXIT NOW' : nearEnd ? 'WARNING — EXIT SOON' : 'INSIDE MANHOLE'}
                        </div>
                        <div className="wd-clock-wrap">
                            <svg viewBox="0 0 200 200" className="wd-clock-svg">
                                <circle cx="100" cy="100" r="88" className="wd-ring-track" />
                                <circle
                                    cx="100" cy="100" r="88"
                                    className={`wd-ring-fill${nearEnd || isOverdue ? ' ring-flash' : ''}`}
                                    stroke={ringColor}
                                    strokeDasharray={CIRC}
                                    strokeDashoffset={CIRC * (1 - pctLeft)}
                                    transform="rotate(-90 100 100)"
                                />
                            </svg>
                            <div className="wd-clock-inner">
                                <div className="wd-clock-label">TIME LEFT</div>
                                <div className="wd-clock-digits" style={{ color: ringColor }}>
                                    {isOverdue ? 'EXIT!' : fmt(countdown)}
                                </div>
                                <div className="wd-clock-total">of {fmt(ENTRY_DURATION)}</div>
                            </div>
                        </div>

                        {/* Live gas readings — 2×3 gauge grid (4 gases + water) */}
                        <div className="wd-gas-grid">
                            {['H2S', 'CO', 'O2', 'CH4', 'WATER'].map(gas => (
                                gasReadings ? (
                                    <GasGauge
                                        key={gas}
                                        gas={gas}
                                        value={gasReadings.readings[gas]}
                                        unit={{ H2S: 'ppm', CO: 'ppm', O2: '%', CH4: '% LEL', WATER: 'cm' }[gas]}
                                        status={gasReadings.statuses[gas]}
                                    />
                                ) : (
                                    <div key={gas} className="wd-gas-skeleton" />
                                )
                            ))}
                        </div>

                        <div className="wd-inmanhole-job">{JOB.id}  {JOB.address}</div>

                        <button className="wd-btn-exit" onClick={handleExit}>
                            <LogOut size={28} /> CHECK OUT &amp; EXIT
                        </button>

                        <button className="wd-btn-report-hazard" onClick={() => setHazardModal(true)}>
                            <TriangleAlert size={17} /> Report Issue
                        </button>
                    </div>
                )}

                {/*  EXITED  */}
                {phase === PHASE.EXITED && (
                    <div className="wd-exited">
                        <div className="wd-exited-icon"><CheckCircle2 size={72} color="#ffffff" /></div>
                        <h2 className="wd-exited-title">JOB COMPLETE</h2>
                        <p className="wd-exited-sub">Safely exited {JOB.id}. Supervisor notified.</p>
                        <div className="wd-summary">
                            <div className="wd-summary-row"><span>Entry</span><strong>{entryTime?.toLocaleTimeString()}</strong></div>
                            <div className="wd-summary-row"><span>Exit</span><strong>{new Date().toLocaleTimeString()}</strong></div>
                            <div className="wd-summary-row"><span>Duration</span><strong>{fmt(ENTRY_DURATION - countdown)}</strong></div>
                            <div className="wd-summary-row"><span>Location</span><strong>{JOB.id} — {JOB.address}</strong></div>
                        </div>
                        <button className="wd-btn-primary" onClick={handleNewJob}>Start Next Job</button>
                    </div>
                )}
            </main>
            </div>

            {/*  OMNIPRESENT SOS FAB  */}
            {!sosActive && phase !== PHASE.EXITED && (
                <SosFab onActivate={handleSosTriggered} />
            )}
        </div>
    );
}

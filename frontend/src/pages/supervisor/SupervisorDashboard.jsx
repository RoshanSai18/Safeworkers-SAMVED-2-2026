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
    { id: 'MH-4420', address: 'Lal Bazaar, Gate 7',       zone: 'Zone C', risk: 'HIGH',   priority: 'Urgent', equipment: 'Breathing Apparatus, Gas Meter' },
    { id: 'MH-2215', address: 'Shivaji Colony, Main Rd',  zone: 'Zone A', risk: 'MEDIUM', priority: 'Normal', equipment: 'Standard PPE, Safety Rope' },
    { id: 'MH-0078', address: 'Station Rd, Junction 3',   zone: 'Zone B', risk: 'LOW',    priority: 'Low',    equipment: 'Standard PPE' },
    { id: 'MH-5501', address: 'Park Lane, Sector 9',      zone: 'Zone D', risk: 'MEDIUM', priority: 'Normal', equipment: 'Gas Meter, Standard PPE' },
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

    const inManholeCount = workers.filter(w => w.status === 'IN_MANHOLE').length;
    const sosCount       = workers.filter(w => w.status === 'SOS').length;
    const onlineCount    = workers.filter(w => w.status !== 'SIGNAL_LOST').length;

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
                                    const cardCss = isSos ? 'sos'
                                        : isGas && a.severity === 'critical' ? 'sos'
                                        : isGas ? 'delay'
                                        : a.type.toLowerCase();
                                    return (
                                    <div key={a.id} className={`sd-alert-card sd-alert-${cardCss}`}
                                        onMouseEnter={() => setHoveredAlertWorkerId(a.workerId)}
                                        onMouseLeave={() => setHoveredAlertWorkerId(null)}
                                    >
                                        <div className="sd-alert-header">
                                            <AlertTriangle size={14} style={{ color: (isSos || a.severity === 'critical') ? 'var(--sd-sos)' : 'var(--sd-delayed)', flexShrink: 0 }} />
                                            <span className="sd-alert-type-label">
                                                {isSos ? 'SOS Emergency'
                                                    : isGas ? `Gas Alert${a.gas ? ` · ${a.gas}` : ''}`
                                                    : 'Delayed Exit'}
                                            </span>
                                            <span className="sd-alert-time">{a.time}</span>
                                        </div>
                                        <p className="sd-alert-msg">{a.msg}</p>
                                        <div className="sd-alert-actions">
                                            {(isSos || (isGas && a.severity === 'critical')) && (
                                                <button className="sd-btn-danger" onClick={() => setSosModal(workers.find(w => w.id === a.workerId))}>
                                                    <AlertTriangle size={12} /> View SOS
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

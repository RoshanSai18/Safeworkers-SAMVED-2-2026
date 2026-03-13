import React, { useState, useEffect } from 'react';
import './SafetyDiary.css';
import { Lock, Briefcase, AlertTriangle, ClipboardCheck, Flame } from 'lucide-react';

/* ── Local demo seed ─────────────────────────────────────────────────────── */
const TODAY   = new Date();
const daysAgo = (n) => {
    const d = new Date(TODAY - n * 86_400_000);
    return d.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' });
};

const LOCAL_DEMO = {
    1: {
        displayScore:       87,
        rawScore:           35,
        highRiskCompleted:  5,
        proactiveReports:   3,
        checklistCount:     11,
        totalJobs:          8,
        incidentFreeDays:   336,
        joinDate:           '2023-04-10',
        messages: [
            'पिछले 336 दिनों से कोई गंभीर घटना नहीं – बहुत अच्छा काम!',
            'उच्च जोखिम वाले काम में भी आप सुरक्षित रहे – यही असली हिम्मत है!',
            'आप हमारे सबसे सुरक्षित कर्मचारियों में से एक हैं!',
        ],
        badges: [
            { id: 'first_step',   emoji: '🦶', label: 'पहला कदम',          desc: 'पहली बार सुरक्षित काम किया',         earned: true  },
            { id: 'brave_heart',  emoji: '🛡️', label: 'निडर योद्धा',        desc: 'उच्च जोखिम काम पूरा किया',           earned: true  },
            { id: 'eagle_eye',    emoji: '👁️', label: 'सुरक्षा प्रहरी',     desc: '3 बार खतरे की सूचना दी',             earned: true  },
            { id: 'checklist',    emoji: '✅', label: 'चेकलिस्ट चैम्पियन',  desc: '5+ बार जाँच के बाद उतरे',            earned: true  },
            { id: 'streak_30',    emoji: '🔥', label: '30 दिन सुरक्षित',    desc: '30 दिन बिना घटना के काम',            earned: true  },
            { id: 'safety_star',  emoji: '⭐', label: 'सुरक्षा सितारा',     desc: 'स्कोर 50 से अधिक',                    earned: true  },
            { id: 'elite_worker', emoji: '🏆', label: 'श्रेष्ठ कर्मचारी',   desc: 'स्कोर 80 से अधिक — शीर्ष स्तर',      earned: true  },
        ],
        recentJobs: [
            { id: 'MH-2041', date: daysAgo(1),  risk: 'HIGH',   duration: 38, zone: 'Zone B', ppeOk: true, gasOk: true },
            { id: 'MH-1874', date: daysAgo(3),  risk: 'MEDIUM', duration: 25, zone: 'Zone C', ppeOk: true, gasOk: true },
            { id: 'MH-2200', date: daysAgo(5),  risk: 'HIGH',   duration: 42, zone: 'Zone F', ppeOk: true, gasOk: true },
            { id: 'MH-0933', date: daysAgo(8),  risk: 'HIGH',   duration: 31, zone: 'Zone A', ppeOk: true, gasOk: true },
            { id: 'MH-1100', date: daysAgo(12), risk: 'LOW',    duration: 18, zone: 'Zone B', ppeOk: true, gasOk: true },
        ],
    },
};

function getLocalProfile(workerId) {
    return LOCAL_DEMO[workerId] ?? {
        displayScore: 0, rawScore: 0, highRiskCompleted: 0,
        proactiveReports: 0, checklistCount: 0, totalJobs: 0,
        incidentFreeDays: 0, joinDate: new Date().toISOString().split('T')[0],
        messages: ['अपनी सुरक्षा डायरी बनाना शुरू करें – हर सुरक्षित दिन मायने रखता है!'],
        badges: [], recentJobs: [],
    };
}

const RISK_LABEL = { HIGH: 'उच्च', MEDIUM: 'मध्यम', LOW: 'कम' };
const RISK_CLASS  = { HIGH: 'risk-high', MEDIUM: 'risk-med', LOW: 'risk-low' };
const RISK_DOT    = { HIGH: '#ff3b30', MEDIUM: '#ff9f0a', LOW: '#30d158' };

function scoreLevel(s) {
    return s >= 80 ? 'great' : s >= 50 ? 'good' : 'start';
}
function scoreColor(s) {
    return s >= 80 ? '#30d158' : s >= 50 ? '#ff9f0a' : '#0a84ff';
}
function scoreCaption(s) {
    return s >= 80 ? 'उत्कृष्ट – शीर्ष स्तर' : s >= 50 ? 'अच्छा – बढ़ता रहें' : 'शुरुआत – जारी रखें';
}

/* ── Score arc ───────────────────────────────────────────────────────────── */
function ScoreArc({ score }) {
    const R    = 52;
    const CIRC = 2 * Math.PI * R;
    const fill = CIRC * (1 - score / 100);
    const c    = scoreColor(score);
    return (
        <svg className="sd-arc-svg" viewBox="0 0 120 120" width="110" height="110">
            <circle cx="60" cy="60" r={R} className="sd-arc-track" strokeWidth="9" fill="none" />
            <circle
                cx="60" cy="60" r={R}
                stroke={c} strokeWidth="9" fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={fill}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease' }}
            />
            <text x="60" y="56" className="sd-arc-num" textAnchor="middle" dominantBaseline="middle">
                {score}
            </text>
            <text x="60" y="73" className="sd-arc-sub" textAnchor="middle" dominantBaseline="middle">
                / 100
            </text>
        </svg>
    );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function SafetyDiary({ workerId, workerName, badge, socket }) {
    const [profile, setProfile] = useState(() => getLocalProfile(workerId));

    useEffect(() => {
        if (!socket) return;
        const handleProfile = (data) => {
            if (data.workerId !== workerId) return;
            setProfile(data);
        };
        socket.on('safety_profile', handleProfile);
        socket.emit('get_safety_profile', { workerId });
        return () => socket.off('safety_profile', handleProfile);
    }, [socket, workerId]);

    const earnedBadges = profile.badges.filter(b => b.earned);
    const lockedBadges = profile.badges.filter(b => !b.earned);
    const level        = scoreLevel(profile.displayScore);
    const color        = scoreColor(profile.displayScore);

    return (
        <div className="sd-root">

            {/* ── Header ── */}
            <div className="sd-header">
                <div>
                    <div className="sd-title">मेरी सुरक्षा डायरी</div>
                    <div className="sd-subtitle">{workerName} · {badge}</div>
                </div>
                <div className="sd-since-pill">
                    {new Date(profile.joinDate).toLocaleDateString('hi-IN', { year: 'numeric', month: 'short' })} से
                </div>
            </div>

            {/* ── Score hero card ── */}
            <div className={`sd-score-hero sd-score-hero--${level}`}>
                <div className="sd-score-hero-top">
                    <div className="sd-score-label">सुरक्षा शक्ति</div>
                    <div className="sd-streak-pill">
                        <Flame size={13} />
                        {profile.incidentFreeDays} दिन
                    </div>
                </div>
                <div className="sd-score-body">
                    <ScoreArc score={profile.displayScore} />
                    <div className="sd-score-detail">
                        <div className="sd-score-caption" style={{ color }}>
                            {scoreCaption(profile.displayScore)}
                        </div>
                        <div className="sd-score-bar-wrap">
                            <div
                                className="sd-score-bar-fill"
                                style={{ width: `${profile.displayScore}%`, background: color }}
                            />
                        </div>
                        <div className="sd-score-raw">
                            कुल अंक: {profile.rawScore} → {profile.displayScore}/100
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Stats 2×2 grid ── */}
            <div className="sd-stats-grid">
                <div className="sd-stat-card sd-stat-jobs">
                    <Briefcase size={18} className="sd-stat-icon" />
                    <span className="sd-stat-val">{profile.totalJobs}</span>
                    <span className="sd-stat-lbl">काम पूरे</span>
                </div>
                <div className="sd-stat-card sd-stat-highrisk">
                    <AlertTriangle size={18} className="sd-stat-icon" />
                    <span className="sd-stat-val">{profile.highRiskCompleted}</span>
                    <span className="sd-stat-lbl">उच्च जोखिम</span>
                </div>
                <div className="sd-stat-card sd-stat-hazard">
                    <span className="sd-stat-emoji">👁️</span>
                    <span className="sd-stat-val">{profile.proactiveReports}</span>
                    <span className="sd-stat-lbl">खतरे की सूचना</span>
                </div>
                <div className="sd-stat-card sd-stat-check">
                    <ClipboardCheck size={18} className="sd-stat-icon" />
                    <span className="sd-stat-val">{profile.checklistCount}</span>
                    <span className="sd-stat-lbl">चेकलिस्ट</span>
                </div>
            </div>

            {/* ── Positive messages ── */}
            {profile.messages.length > 0 && (
                <div className="sd-messages">
                    <div className="sd-messages-heading">🌟 आपकी सराहना</div>
                    {profile.messages.map((msg, i) => (
                        <div key={i} className="sd-message-row">
                            <span className="sd-msg-text">{msg}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Earned badges ── */}
            {earnedBadges.length > 0 && (
                <div className="sd-section">
                    <div className="sd-section-title">
                        <span className="sd-section-dot" />
                        अर्जित पुरस्कार
                        <span className="sd-section-count">{earnedBadges.length}</span>
                    </div>
                    <div className="sd-badges-grid">
                        {earnedBadges.map(b => (
                            <div key={b.id} className="sd-badge sd-badge-earned">
                                <div className="sd-badge-glow" />
                                <span className="sd-badge-emoji">{b.emoji}</span>
                                <span className="sd-badge-label">{b.label}</span>
                                <span className="sd-badge-desc">{b.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Locked badges ── */}
            {lockedBadges.length > 0 && (
                <div className="sd-section">
                    <div className="sd-section-title">
                        <span className="sd-section-dot sd-section-dot--dim" />
                        अगले लक्ष्य
                    </div>
                    <div className="sd-badges-grid">
                        {lockedBadges.map(b => (
                            <div key={b.id} className="sd-badge sd-badge-locked">
                                <div className="sd-badge-lock-wrap">
                                    <span className="sd-badge-emoji sd-badge-emoji-dim">{b.emoji}</span>
                                    <Lock size={11} className="sd-lock-icon" />
                                </div>
                                <span className="sd-badge-label sd-badge-label-dim">{b.label}</span>
                                <span className="sd-badge-desc sd-badge-desc-dim">{b.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Recent jobs timeline ── */}
            {profile.recentJobs.length > 0 && (
                <div className="sd-section">
                    <div className="sd-section-title">
                        <span className="sd-section-dot" />
                        हाल के काम
                    </div>
                    <div className="sd-timeline">
                        {profile.recentJobs.map((job, i) => (
                            <div key={i} className="sd-tl-row">
                                <div
                                    className="sd-tl-dot"
                                    style={{ background: RISK_DOT[job.risk] }}
                                />
                                <div className="sd-tl-content">
                                    <div className="sd-tl-top">
                                        <span className="sd-tl-id">{job.id}</span>
                                        <span className={`sd-tl-risk ${RISK_CLASS[job.risk]}`}>
                                            {RISK_LABEL[job.risk]}
                                        </span>
                                    </div>
                                    <div className="sd-tl-bottom">
                                        <span className="sd-tl-zone">{job.zone}</span>
                                        <span className="sd-tl-sep">·</span>
                                        <span className="sd-tl-dur">{job.duration} मिनट</span>
                                        <span className="sd-tl-sep">·</span>
                                        <span className="sd-tl-checks">
                                            <span className={job.ppeOk ? 'check-ok' : 'check-no'}>PPE ✓</span>
                                            <span className={job.gasOk ? 'check-ok' : 'check-no'}>Gas ✓</span>
                                        </span>
                                    </div>
                                </div>
                                <span className="sd-tl-date">{job.date}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

import React from 'react';
import { Shield, AlertTriangle, Activity } from 'lucide-react';
import './Hero.css';

const MOCK_WORKERS = [
    { initials: 'RK', status: '#ff3b30', label: 'SOS',     job: 'MH-2041' },
    { initials: 'SB', status: '#0a84ff', label: 'Active',  job: 'MH-1874' },
    { initials: 'MD', status: '#ff9f0a', label: 'Delayed', job: 'MH-0933' },
];

const titleLines = [
    ['Protecting'],
    ['Those', 'Who'],
    ['Keep', 'Our', 'Cities'],
    ['Clean'],
];

const ProductMockup = () => (
    <div className="pm-scene">
        {/* Supervisor dashboard — dark card (back) */}
        <div className="pm-supervisor">
            <div className="pm-sup-header">
                <span className="pm-sup-logo"><Shield size={10} /></span>
                <span className="pm-sup-title">SafeWorker Control</span>
                <span className="pm-sup-live"><span className="pm-live-dot" />LIVE</span>
            </div>
            <div className="pm-map">
                <div className="pm-map-grid" />
                <span className="pm-map-dot pm-map-dot--sos"  style={{ top: '30%', left: '22%' }} />
                <span className="pm-map-dot pm-map-dot--blue" style={{ top: '55%', left: '54%' }} />
                <span className="pm-map-dot pm-map-dot--amr"  style={{ top: '67%', left: '73%' }} />
                <span className="pm-map-dot pm-map-dot--grn"  style={{ top: '22%', left: '70%' }} />
            </div>
            <div className="pm-worker-list">
                {MOCK_WORKERS.map((w, i) => (
                    <div key={i} className="pm-worker-row">
                        <span className="pm-wdot" style={{ background: w.status }} />
                        <span className="pm-winitials">{w.initials}</span>
                        <span className="pm-wjob">{w.job}</span>
                        <span className="pm-wstatus" style={{ color: w.status }}>{w.label}</span>
                    </div>
                ))}
            </div>
            <div className="pm-alert-strip">
                <AlertTriangle size={9} />
                <span>SOS · Ravi Kumar · MH-2041</span>
            </div>
        </div>

        {/* Worker app — light foreground card */}
        <div className="pm-worker-card">
            <div className="pm-wcard-top">
                <span className="pm-wcard-id">MH-2041</span>
                <span className="pm-wcard-risk">HIGH</span>
            </div>
            <div className="pm-gauges">
                {[
                    { label: 'H₂S', color: '#30d158', pct: 18 },
                    { label: 'CO',  color: '#30d158', pct: 12 },
                    { label: 'O₂',  color: '#ff9f0a', pct: 72 },
                    { label: 'CH₄', color: '#30d158', pct: 8  },
                ].map((g, i) => (
                    <div key={i} className="pm-gauge">
                        <svg viewBox="0 0 32 32" className="pm-gauge-svg">
                            <circle cx="16" cy="16" r="11" fill="none" stroke="rgba(0,0,0,.08)" strokeWidth="4" />
                            <circle cx="16" cy="16" r="11" fill="none" stroke={g.color} strokeWidth="4"
                                strokeDasharray={`${69.1 * g.pct / 100} 69.1`}
                                strokeLinecap="round" transform="rotate(-90 16 16)" />
                        </svg>
                        <span className="pm-gauge-lbl">{g.label}</span>
                    </div>
                ))}
            </div>
            <div className="pm-wcard-timer"><Activity size={9} /> 24:38 remaining</div>
            <div className="pm-wcard-sos">SOS</div>
        </div>

        {/* Floating status pills */}
        <div className="pm-pill pm-pill-tl">
            <span className="pm-pill-dot pm-pill-dot--green" />
            Worker safe
        </div>
        <div className="pm-pill pm-pill-br">
            <span className="pm-pill-dot pm-pill-dot--blue" />
            SOS cleared
        </div>
    </div>
);

const Hero = () => (
    <section className="hero" id="hero">
        <div className="hero-blob hero-blob--1" aria-hidden="true" />
        <div className="hero-blob hero-blob--2" aria-hidden="true" />
        <div className="container hero-container">
            <div className="hero-content">
    
                <h1 className="hero-title">
                    {titleLines.map((line, lineIdx) => {
                        const offset = titleLines.slice(0, lineIdx).reduce((s, l) => s + l.length, 0);
                        return (
                            <span key={lineIdx} className="title-line">
                                {line.map((word, wi) => (
                                    <span
                                        key={wi}
                                        className="word"
                                        style={{ animationDelay: `${(offset + wi) * 0.08}s` }}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </span>
                        );
                    })}
                </h1>
                <p className="hero-subtitle">
                    A comprehensive safety and management platform for sanitation workers.
                    Real-time tracking, offline-first reliability, and seamless integration.
                </p>
            </div>
            <div className="hero-visual">
                <ProductMockup />
            </div>
        </div>
    </section>
);

export default Hero;

import React from 'react';
import ScrollReveal from './ScrollReveal';
import { Smartphone, Monitor, Server, Database, Radio, ArrowUpRight } from 'lucide-react';
import './TechStack.css';

const stack = [
    {
        category: "Frontend (Worker)",
        tech: "React Native",
        description: "Cross-platform mobile app with native GPS, camera, and offline storage access.",
        icon: <Smartphone size={28} />,
        accentTop: '#d4d4d4',
        span: 'wide',
    },
    {
        category: "Frontend (Supervisor)",
        tech: "React.js + Mapbox",
        description: "Responsive web dashboard with high-performance real-time mapping.",
        icon: <Monitor size={28} />,
        accentTop: '#a3a3a3',
        span: '',
    },
    {
        category: "Backend",
        tech: "Node.js (Express)",
        description: "Scalable REST API handling real-time data and high concurrency.",
        icon: <Server size={28} />,
        accentTop: '#737373',
        span: '',
    },
    {
        category: "Database",
        tech: "PostgreSQL + PostGIS",
        description: "Robust relational database with native geospatial query support.",
        icon: <Database size={28} />,
        accentTop: '#a3a3a3',
        span: '',
    },
    {
        category: "Real-time Layer",
        tech: "WebSockets / FCM",
        description: "Instant SOS alerts and safety check-in push notifications.",
        icon: <Radio size={28} />,
        accentTop: '#d4d4d4',
        span: '',
    },
];

const TechStack = () => (
    <section className="tech-stack section" id="tech-stack">
        <div className="container">
            <ScrollReveal>
                <div className="text-center mb-xl">
                    <span className="section-label tech-label">Blueprint</span>
                    <h2 className="section-title tech-title">Recommended Tech Stack</h2>
                    <p className="section-subtitle tech-subtitle">
                        Proven, production-grade technologies chosen for reliability and scale.
                    </p>
                </div>
            </ScrollReveal>

            <div className="tech-bento">
                {stack.map((item, index) => (
                    <ScrollReveal key={index} delay={index * 120} className={item.span === 'wide' ? 'tech-wide' : ''}>
                        <div className="tech-card" style={{ '--tc-top': item.accentTop }}>
                            <div className="tech-card-icon">{item.icon}</div>
                            <span className="tech-category">{item.category}</span>
                            <div className="tech-name">{item.tech}</div>
                            <p className="tech-description">{item.description}</p>
                            <div className="tech-arrow"><ArrowUpRight size={16} /></div>
                        </div>
                    </ScrollReveal>
                ))}
            </div>
        </div>
    </section>
);

export default TechStack;

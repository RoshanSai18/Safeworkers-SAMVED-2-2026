import React from 'react';
import ScrollReveal from './ScrollReveal';
import { Smartphone, Monitor, Server, CheckCircle, ArrowRight } from 'lucide-react';
import './Features.css';

const pillars = [
    {
        title: "Worker Application",
        description: "Mobile-first PWA designed for high-contrast visibility and offline capability. Built for field workers in the harshest conditions.",
        icon: <Smartphone size={36} />,
        accent: '#171717',
        accentBg: 'rgba(23,23,23,0.07)',
        details: ["Offline-first architecture", "SOS & Safety check-ins", "Large high-contrast UI"],
        tag: "PWA",
        large: true,
    },
    {
        title: "Supervisor Control Room",
        description: "Real-time web portal for monitoring worker safety and location.",
        icon: <Monitor size={32} />,
        accent: '#404040',
        accentBg: 'rgba(64,64,64,0.07)',
        details: ["Live map tracking", "Instant alert dashboard", "Historical data analysis"],
        tag: "Dashboard",
        large: false,
    },
    {
        title: "Backend & Integration",
        description: "Centralized server handling logic, auth, and IoT data ingestion.",
        icon: <Server size={32} />,
        accent: '#525252',
        accentBg: 'rgba(82,82,82,0.07)',
        details: ["REST API & WebSockets", "Secure authentication", "Scalable infrastructure"],
        tag: "API",
        large: false,
    },
];

const Features = () => (
    <section className="features section" id="features">
        <div className="container">
            <ScrollReveal>
                <div className="text-center mb-xl">
                    <span className="section-label">Our Platform</span>
                    <h2 className="section-title">System Architecture Pillars</h2>
                    <p className="section-subtitle">
                        Three tightly integrated layers that work together to keep every worker safe.
                    </p>
                </div>
            </ScrollReveal>

            <div className="features-bento">
                {pillars.map((pillar, index) => (
                    <ScrollReveal key={index} delay={index * 150} className={pillar.large ? 'bento-large' : ''}>
                        <div
                            className="feature-card"
                            style={{ '--card-accent': pillar.accent, '--card-accent-bg': pillar.accentBg }}
                        >
                            <div className="feature-card-top">
                                <div className="feature-icon-wrap">{pillar.icon}</div>
                                <span className="feature-tag">{pillar.tag}</span>
                            </div>
                            <h3 className="feature-title">{pillar.title}</h3>
                            <p className="feature-description">{pillar.description}</p>
                            <ul className="feature-details">
                                {pillar.details.map((detail, idx) => (
                                    <li key={idx}>
                                        <CheckCircle size={14} strokeWidth={2.5} />
                                        {detail}
                                    </li>
                                ))}
                            </ul>
                            <div className="feature-footer">
                                <a href="#tech-stack" className="feature-link">
                                    Learn more <ArrowRight size={14} />
                                </a>
                            </div>
                        </div>
                    </ScrollReveal>
                ))}
            </div>
        </div>
    </section>
);

export default Features;

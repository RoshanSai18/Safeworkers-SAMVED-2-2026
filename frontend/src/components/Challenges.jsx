import React from 'react';
import ScrollReveal from './ScrollReveal';
import { WifiOff, MapPinOff, BatteryLow, CheckCircle2, ArrowUpRight } from 'lucide-react';
import './Challenges.css';

const challenges = [
    {
        category: "Connectivity",
        title: "Offline-First Reality",
        description: "Workers often operate in deep manholes with zero connectivity. The app ensures critical data is stored locally and synced when connection is restored.",
        icon: <WifiOff size={28} />,
        solution: "Local Storage & Background Sync",
        accentTop: '#d4d4d4',
        wide: true,
    },
    {
        category: "Location",
        title: "GPS Inaccuracy",
        description: "Urban canyons and underground work make GPS unreliable. We use supervisor pins and QR code scanning for precise location verification.",
        icon: <MapPinOff size={28} />,
        solution: "QR Verification & Manual Pins",
        accentTop: '#a3a3a3',
        wide: false,
    },
    {
        category: "Hardware",
        title: "Device Constraints",
        description: "Sanitation workers may use older devices with limited battery. The app is optimized for low power consumption and minimal storage usage.",
        icon: <BatteryLow size={28} />,
        solution: "Lightweight Code & Battery Optimization",
        accentTop: '#737373',
        wide: false,
    },
];

const Challenges = () => (
    <section className="challenges section" id="challenges">
        <div className="container">
            <ScrollReveal>
                <div className="text-center mb-xl">
                    <span className="section-label ch-label">Hard Problems</span>
                    <h2 className="section-title ch-title">Critical Technical Considerations</h2>
                    <p className="section-subtitle ch-subtitle">
                        Real-world field conditions demand more than textbook engineering solutions.
                    </p>
                </div>
            </ScrollReveal>

            <div className="challenges-bento">
                {challenges.map((c, index) => (
                    <ScrollReveal
                        key={index}
                        delay={index * 120}
                        className={c.wide ? 'challenge-wide' : ''}
                    >
                        <div className="challenge-card" style={{ '--tc-top': c.accentTop }}>
                            <div className="challenge-icon">{c.icon}</div>
                            <span className="challenge-category">{c.category}</span>
                            <div className="challenge-title">{c.title}</div>
                            <p className="challenge-description">{c.description}</p>
                            <div className="challenge-solution">
                                <CheckCircle2 size={15} />
                                {c.solution}
                            </div>
                            <div className="challenge-arrow"><ArrowUpRight size={16} /></div>
                        </div>
                    </ScrollReveal>
                ))}
            </div>
        </div>
    </section>
);

export default Challenges;

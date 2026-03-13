import React from 'react';
import { Shield, Twitter, Linkedin, Github, Mail, Phone } from 'lucide-react';
import './Footer.css';

const Footer = () => (
    <footer className="footer">
        {/* Wave separator */}
        <div className="footer-wave" aria-hidden="true">
            <svg viewBox="0 0 1440 72" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                <path d="M0,40 C360,80 1080,0 1440,40 L1440,72 L0,72 Z" fill="#171717" />
            </svg>
        </div>

        <div className="footer-inner">
            <div className="container">
                <div className="footer-grid">
                    {/* Brand */}
                    <div className="footer-brand">
                        <div className="footer-logo">
                            <div className="footer-logo-icon"><Shield size={22} /></div>
                            <span>SafeWorker</span>
                        </div>
                        <p className="footer-tagline">
                            Empowering sanitation workers with technology for a safer, smarter future.
                        </p>
                        <div className="footer-socials">
                            <a href="#" className="social-btn" aria-label="Twitter"><Twitter size={16} /></a>
                            <a href="#" className="social-btn" aria-label="LinkedIn"><Linkedin size={16} /></a>
                            <a href="#" className="social-btn" aria-label="GitHub"><Github size={16} /></a>
                        </div>
                    </div>

                    {/* Links */}
                    <div className="footer-col">
                        <h4 className="footer-col-title">Navigation</h4>
                        <ul className="footer-nav">
                            <li><a href="#hero">Home</a></li>
                            <li><a href="#features">Architecture</a></li>
                            <li><a href="#challenges">Challenges</a></li>
                            <li><a href="#tech-stack">Tech Stack</a></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="footer-col">
                        <h4 className="footer-col-title">Contact</h4>
                        <ul className="footer-contact-list">
                            <li><Mail size={14} /><span>contact@safeworker.io</span></li>
                            <li><Phone size={14} /><span>+1 (555) 123-4567</span></li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; {new Date().getFullYear()} SafeWorker Platform. All rights reserved.</p>
                    <p className="footer-sub">Built for impact. Designed with purpose.</p>
                </div>
            </div>
        </div>
    </footer>
);

export default Footer;

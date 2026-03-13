    import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Sun, Moon, Shield, LogIn, LogOut, LayoutDashboard } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/useAuth';
import './Header.css';

const navLinks = [
    { href: '#hero',       label: 'Home'         },
    { href: '#features',   label: 'Architecture' },
    { href: '#challenges', label: 'Challenges'   },
    
];

const ROLE_PATH = { worker: '/worker', supervisor: '/supervisor', admin: '/admin' };

const Header = () => {
    const [isFloating, setIsFloating] = useState(false);
    const [menuOpen,   setMenuOpen]   = useState(false);
    const { isDark, toggleTheme }     = useTheme();
    const { currentUser, logout }     = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => { logout(); navigate('/', { replace: true }); };

    useEffect(() => {
        const onScroll = () => setIsFloating(window.scrollY > 72);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const closeMenu = () => setMenuOpen(false);

    return (
        <div className="header-wrapper">
            <header className={`header${isFloating ? ' header--floating' : ''}`}>
                <div className="header-inner">
                    <a href="#hero" className="logo" onClick={closeMenu}>
                        <span className="logo-icon-wrap"><Shield size={20} strokeWidth={2.5} /></span>
                        <span className="logo-text">SafeWorker</span>
                    </a>

                    <nav className="nav" aria-label="Main navigation">
                        <ul className="nav-list">
                            {navLinks.map(({ href, label }) => (
                                <li key={href} className="nav-item">
                                    <a href={href} className="nav-link">{label}</a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="header-actions">
                        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
                            {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
                        </button>
                        {currentUser ? (
                            <>
                                <Link to={ROLE_PATH[currentUser.role]} className="btn btn-outline btn-sm header-dash-btn">
                                    <LayoutDashboard size={15} /> Dashboard
                                </Link>
                                <button className="btn btn-primary btn-sm" onClick={handleLogout}>
                                    <LogOut size={15} /> Logout
                                </button>
                            </>
                        ) : (
                            <Link to="/login" className="btn btn-primary btn-sm">
                                <LogIn size={15} /> Login
                            </Link>
                        )}
                        <button
                            className="hamburger"
                            onClick={() => setMenuOpen(o => !o)}
                            aria-label="Toggle menu"
                            aria-expanded={menuOpen}
                        >
                            {menuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>

                <div className={`mobile-nav${menuOpen ? ' open' : ''}`}>
                    <ul className="mobile-nav-list">
                        {navLinks.map(({ href, label }) => (
                            <li key={href}>
                                <a href={href} className="mobile-nav-link" onClick={closeMenu}>{label}</a>
                            </li>
                        ))}
                        <li><a href="#contact" className="btn btn-primary mobile-cta" onClick={closeMenu}>Get Demo</a></li>
                    </ul>
                </div>
            </header>
        </div>
    );
};

export default Header;

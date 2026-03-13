import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, ArrowRight, User, Lock } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import './Login.css';

const DEMO_CREDS = [
    { role: 'Sanitation Worker', username: 'ravi.kumar', password: 'worker123', icon: '🧹' },
    { role: 'On-Site Supervisor', username: 'priya.sharma', password: 'super123', icon: '📋' },
    { role: 'City Administrator', username: 'arjun.das', password: 'admin2024', icon: '🏛️' },
];

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        await new Promise(r => setTimeout(r, 500)); // slight UX delay
        const result = login(username.trim(), password);
        setLoading(false);
        if (result.success) {
            navigate(result.user.redirect, { replace: true });
        } else {
            setError(result.error);
        }
    };

    const fillCreds = (cred) => {
        setUsername(cred.username);
        setPassword(cred.password);
        setError('');
    };

    return (
        <div className="login-bg">
            <div className="login-blob login-blob-1" />
            <div className="login-blob login-blob-2" />

            <div className="login-wrap">
                {/* Logo */}
                <Link to="/" className="login-logo">
                    <div className="login-logo-icon"><Shield size={22} /></div>
                    <span>SafeWorker</span>
                </Link>

                <div className="login-card">
                    <div className="login-card-header">
                        <h1 className="login-title">Welcome back</h1>
                        <p className="login-subtitle">Sign in to access your dashboard</p>
                    </div>

                    {error && (
                        <div className="login-error" role="alert">
                            {error}
                        </div>
                    )}

                    <form className="login-form" onSubmit={handleSubmit} noValidate>
                        <div className="login-field">
                            <label htmlFor="username">Username</label>
                            <div className="login-input-wrap">
                                <User size={16} className="login-input-icon" />
                                <input
                                    id="username"
                                    type="text"
                                    placeholder="e.g. ravi.kumar"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    autoComplete="username"
                                    required
                                />
                            </div>
                        </div>

                        <div className="login-field">
                            <label htmlFor="password">Password</label>
                            <div className="login-input-wrap">
                                <Lock size={16} className="login-input-icon" />
                                <input
                                    id="password"
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="login-pw-toggle"
                                    onClick={() => setShowPw(v => !v)}
                                    aria-label={showPw ? 'Hide password' : 'Show password'}
                                >
                                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="login-submit"
                            disabled={loading || !username || !password}
                        >
                            {loading ? (
                                <span className="login-spinner" />
                            ) : (
                                <>Sign In <ArrowRight size={16} /></>
                            )}
                        </button>
                    </form>
                </div>

                {/* Demo credentials */}
                <div className="login-demo">
                    <div className="login-demo-label">Demo credentials — click to fill</div>
                    <div className="login-demo-cards">
                        {DEMO_CREDS.map(c => (
                            <button
                                key={c.username}
                                className="login-demo-card"
                                onClick={() => fillCreds(c)}
                                type="button"
                            >
                                <span className="login-demo-icon">{c.icon}</span>
                                <div>
                                    <div className="login-demo-role">{c.role}</div>
                                    <div className="login-demo-user">{c.username}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;

import React, { createContext, useState } from 'react';

const USERS = [
    {
        id: 1,
        username: 'ravi.kumar',
        password: 'worker123',
        name: 'Ravi Kumar',
        role: 'worker',
        badge: 'SW-041',
        zone: 'Zone B – Sector 7',
        redirect: '/worker',
    },
    {
        id: 2,
        username: 'priya.sharma',
        password: 'super123',
        name: 'Priya Sharma',
        role: 'supervisor',
        badge: 'SV-012',
        zone: 'District 4 – North',
        redirect: '/supervisor',
    },
    {
        id: 3,
        username: 'arjun.das',
        password: 'admin2024',
        name: 'Arjun Das',
        role: 'admin',
        badge: 'ADM-001',
        zone: 'City-Wide',
        redirect: '/admin',
    },
];

const AuthContext = createContext(null);

const SESSION_KEY = 'samved_user';

const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const saved = sessionStorage.getItem(SESSION_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const login = (username, password) => {
        const user = USERS.find(
            u => u.username === username && u.password === password
        );
        if (user) {
            const { password: _pw, ...safeUser } = user;
            setCurrentUser(safeUser);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
            return { success: true, user: safeUser };
        }
        return { success: false, error: 'Invalid username or password.' };
    };

    const logout = () => {
        setCurrentUser(null);
        sessionStorage.removeItem(SESSION_KEY);
    };

    return (
        <AuthContext.Provider value={{ currentUser, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export { AuthContext, AuthProvider };

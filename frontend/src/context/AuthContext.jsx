import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [isAuthenticated, setIsAuthenticated] = useState(!!token);
    const [dashboardResults, setDashboardResults] = useState(null);

    const login = (newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setIsAuthenticated(true);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setIsAuthenticated(false);
        setDashboardResults(null);
    };

    return (
        <AuthContext.Provider value={{ token, isAuthenticated, login, logout, dashboardResults, setDashboardResults }}>
            {children}
        </AuthContext.Provider>
    );
};

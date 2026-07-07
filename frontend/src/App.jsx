import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventario from './pages/Inventario';
import Pacientes from './pages/Pacientes';
import Analitica from './pages/Analitica';
import './App.css';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useContext(AuthContext);
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#020617', overflow: 'hidden' }}>
            <Sidebar />
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
};

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
                    <Route path="/pacientes" element={<ProtectedRoute><Pacientes /></ProtectedRoute>} />
                    <Route path="/analitica" element={<ProtectedRoute><Analitica /></ProtectedRoute>} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

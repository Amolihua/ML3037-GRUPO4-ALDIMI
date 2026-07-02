import React, { useContext, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LayoutDashboard, Users, Package, LogOut, Clock } from 'lucide-react';

export default function Sidebar() {
    const { logout, token } = useContext(AuthContext);
    const [currentDate, setCurrentDate] = useState('');
    const navigate = useNavigate();

    const fetchDate = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/date', {
                headers: {'Authorization': `Bearer ${token}`}
            });
            const data = await res.json();
            setCurrentDate(data.date);
        } catch(e) {}
    }

    useEffect(() => {
        fetchDate();
    }, [token]);

    const handleAvanzarDia = async () => {
        try {
            await fetch('http://localhost:8000/api/avanzar_dia', {
                method: 'POST',
                headers: {'Authorization': `Bearer ${token}`}
            });
            fetchDate();
            window.location.reload();
        } catch(e) {}
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    }

    const navStyle = ({isActive}) => ({
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', 
        borderRadius: '0.5rem', color: isActive ? '#60a5fa' : '#94a3b8', 
        background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
        textDecoration: 'none', fontWeight: isActive ? 'bold' : 'normal',
        transition: 'all 0.2s'
    });

    return (
        <div style={{ width: '260px', background: 'rgba(15, 23, 42, 0.8)', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', padding: '1.5rem', backdropFilter: 'blur(10px)' }}>
            <h1 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#3b82f6' }}>ALDIMI</span> Predict
            </h1>
            
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '2rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Fecha del Sistema</p>
                <p style={{ color: 'white', fontSize: '1.25rem', fontWeight: 'bold' }}>{currentDate}</p>
                <button onClick={handleAvanzarDia} style={{ marginTop: '0.5rem', background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
                    <Clock size={16} /> Avanzar Día
                </button>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <NavLink to="/" style={navStyle}>
                    <LayoutDashboard size={20} /> Censo y Dashboards
                </NavLink>
                <NavLink to="/inventario" style={navStyle}>
                    <Package size={20} /> Inventario y Logística
                </NavLink>
                <NavLink to="/pacientes" style={navStyle}>
                    <Users size={20} /> Pacientes
                </NavLink>
            </nav>

            <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '1rem', textAlign: 'left', borderRadius: '0.5rem' }}>
                <LogOut size={20} /> Cerrar Sesión
            </button>
        </div>
    );
}

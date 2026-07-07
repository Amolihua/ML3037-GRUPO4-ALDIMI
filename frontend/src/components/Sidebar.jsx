import React, { useContext, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LayoutDashboard, Users, Package, LogOut, Clock, Bell, Brain } from 'lucide-react';

export default function Sidebar() {
    const { logout, token } = useContext(AuthContext);
    const [currentDate, setCurrentDate] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
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

    const fetchAlerts = async () => {
        try {
            const notifs = [];
            // Check High Risk
            const resP = await fetch('http://localhost:8000/api/pacientes', {
                headers: {'Authorization': `Bearer ${token}`}
            });
            const pacientes = await resP.json();
            const highRiskCount = pacientes.filter(p => p.dado_de_alta === 0 && p.riesgo_actual === 'High').length;
            if (highRiskCount > 0) {
                notifs.push(`🚨 ALERTA IA: ${highRiskCount} paciente(s) activos con Alto Riesgo de deterioro detectados. Se recomienda revisión médica inmediata.`);
            }

            // Check Inventory
            const resI = await fetch('http://localhost:8000/api/inventario', {
                headers: {'Authorization': `Bearer ${token}`}
            });
            const invData = await resI.json();
            invData.inventario.forEach(med => {
                if (med.recomendacion_7d.cajas_a_comprar > 0) {
                    notifs.push(`⚠️ Stock Crítico: Predicciones indican falta de ${med.nombre} en menos de 7 días. Requiere compra.`);
                }
            });
            setNotifications(notifs);
        } catch(e) {}
    };

    useEffect(() => {
        fetchDate();
        fetchAlerts();
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <h1 style={{ color: 'white', fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#3b82f6' }}>ALDIMI</span> Predict
                </h1>
                
                <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowNotifications(!showNotifications)} style={{ background: 'transparent', border: 'none', color: notifications.length > 0 ? '#ef4444' : '#94a3b8', cursor: 'pointer', position: 'relative' }}>
                        <Bell size={24} />
                        {notifications.length > 0 && (
                            <span style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {notifications.length}
                            </span>
                        )}
                    </button>
                    
                    {showNotifications && (
                        <div style={{ position: 'absolute', top: '100%', left: '100%', marginTop: '0.5rem', marginLeft: '1rem', width: '320px', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '1rem', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                            <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>Alertas Tempranas</h3>
                            {notifications.length === 0 ? (
                                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No hay alertas críticas por ahora.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {notifications.map((n, i) => (
                                        <div key={i} style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid #ef4444', padding: '0.75rem', borderRadius: '0.25rem', color: '#f87171', fontSize: '0.85rem', lineHeight: '1.4' }}>
                                            {n}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
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
                <NavLink to="/analitica" style={navStyle}>
                    <Brain size={20} /> Análisis IA
                </NavLink>
            </nav>

            <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '1rem', textAlign: 'left', borderRadius: '0.5rem' }}>
                <LogOut size={20} /> Cerrar Sesión
            </button>
        </div>
    );
}

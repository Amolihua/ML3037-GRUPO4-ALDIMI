import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Search, UserMinus, UserCheck, Trash2 } from 'lucide-react';

export default function Pacientes() {
    const { token } = useContext(AuthContext);
    const [pacientes, setPacientes] = useState([]);
    const [search, setSearch] = useState('');

    const fetchPacientes = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/pacientes', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setPacientes(data);
        } catch(e) {}
    };

    useEffect(() => { fetchPacientes(); }, [token]);

    const toggleAlta = async (dni) => {
        await fetch(`http://localhost:8000/api/pacientes/${dni}/alta`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchPacientes();
    };

    const eliminarPaciente = async (dni, nombre) => {
        const motivo = prompt(`¿Motivo para eliminar al paciente ${nombre} (ej: Se curó, Falleció)?`);
        if (!motivo) return;
        
        await fetch(`http://localhost:8000/api/pacientes/${dni}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ motivo })
        });
        fetchPacientes();
    };

    const filtered = pacientes.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || p.dni.includes(search));

    const getRiskColor = (risk) => {
        if(risk === 'High') return '#ef4444';
        if(risk === 'Medium') return '#f59e0b';
        if(risk === 'Low') return '#10b981';
        return '#94a3b8';
    };

    return (
        <div style={{ padding: '2rem', color: 'white' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '2rem', fontWeight: 'bold' }}>Registro de Pacientes</h1>
            
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '0.5rem', width: '300px' }}>
                <Search size={20} color="#94a3b8" />
                <input 
                    type="text" 
                    placeholder="Buscar por DNI o Nombre..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', marginLeft: '0.5rem', width: '100%' }}
                />
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '1rem', overflow: 'hidden' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                        <tr>
                            <th style={{ padding: '1rem' }}>DNI</th>
                            <th style={{ padding: '1rem' }}>Nombre Completo</th>
                            <th style={{ padding: '1rem' }}>Fecha de Ingreso</th>
                            <th style={{ padding: '1rem' }}>Último Riesgo Predicho</th>
                            <th style={{ padding: '1rem' }}>Estado</th>
                            <th style={{ padding: '1rem' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(p => (
                            <tr key={p.dni} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '1rem' }}>{p.dni}</td>
                                <td style={{ padding: '1rem' }}>{p.nombre}</td>
                                <td style={{ padding: '1rem' }}>{p.ingreso}</td>
                                <td style={{ padding: '1rem', fontWeight: 'bold', color: getRiskColor(p.riesgo_actual) }}>
                                    {p.riesgo_actual}
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    {p.dado_de_alta === 1 
                                        ? <span style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem' }}>Dado de Alta / Salió</span>
                                        : <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem' }}>Activo (Internado)</span>
                                    }
                                </td>
                                <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => toggleAlta(p.dni)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {p.dado_de_alta === 1 ? <UserCheck size={16} /> : <UserMinus size={16} />}
                                        {p.dado_de_alta === 1 ? 'Reingresar' : 'Dar de Alta'}
                                    </button>
                                    <button onClick={() => eliminarPaciente(p.dni, p.nombre)} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Trash2 size={16} /> Eliminar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No hay pacientes registrados. Sube el Censo en el Dashboard para registrarlos.</div>}
            </div>
        </div>
    );
}

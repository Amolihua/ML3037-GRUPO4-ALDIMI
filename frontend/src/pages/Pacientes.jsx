import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Search, UserCheck, Plus, FileText, X, Archive, ArrowRightLeft, LogOut, Download } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

const METRIC_FIELDS = [
    'Age', 'Gender', 'Air Pollution', 'Alcohol use', 'Dust Allergy', 'OccuPational Hazards', 
    'Genetic Risk', 'chronic Lung Disease', 'Balanced Diet', 'Obesity', 'Smoking', 'Passive Smoker', 
    'Chest Pain', 'Coughing of Blood', 'Fatigue', 'Weight Loss', 'Shortness of Breath', 'Wheezing', 
    'Swallowing Difficulty', 'Clubbing of Finger Nails', 'Frequent Cold', 'Dry Cough', 'Snoring'
];

const METRIC_TRANSLATIONS = {
    'Age': 'Edad',
    'Gender': 'Género (1=H, 2=M)',
    'Air Pollution': 'Contaminación del Aire',
    'Alcohol use': 'Consumo de Alcohol',
    'Dust Allergy': 'Alergia al Polvo',
    'OccuPational Hazards': 'Riesgos Laborales',
    'Genetic Risk': 'Riesgo Genético',
    'chronic Lung Disease': 'Enfermedad Pulmonar Crónica',
    'Balanced Diet': 'Dieta Balanceada',
    'Obesity': 'Obesidad',
    'Smoking': 'Fumar',
    'Passive Smoker': 'Fumador Pasivo',
    'Chest Pain': 'Dolor de Pecho',
    'Coughing of Blood': 'Tos con Sangre',
    'Fatigue': 'Fatiga',
    'Weight Loss': 'Pérdida de Peso',
    'Shortness of Breath': 'Dificultad Respiratoria',
    'Wheezing': 'Sibilancias',
    'Swallowing Difficulty': 'Dificultad al Tragar',
    'Clubbing of Finger Nails': 'Acropaquia (Dedos)',
    'Frequent Cold': 'Resfriado Frecuente',
    'Dry Cough': 'Tos Seca',
    'Snoring': 'Ronquidos'
};

const MOTIVOS_ALTA = ['Se curó', 'Falleció', 'Traslado a otra instalación', 'Alta Voluntaria', 'Otro motivo'];
const CHART_COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

export default function Pacientes() {
    const { token } = useContext(AuthContext);
    const [pacientes, setPacientes] = useState([]);
    const [search, setSearch] = useState('');
    const [riesgoFiltro, setRiesgoFiltro] = useState('Todos'); // Todos | Low | Medium | High
    
    // Modals state
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedPaciente, setSelectedPaciente] = useState(null);
    
    const [showDarAltaModal, setShowDarAltaModal] = useState(false);
    const [altaMotivo, setAltaMotivo] = useState('Se curó');
    const [selectedAltaPaciente, setSelectedAltaPaciente] = useState(null);

    const [showHistorialModal, setShowHistorialModal] = useState(false);
    const [historial, setHistorial] = useState([]);
    const [historialStats, setHistorialStats] = useState([]);

    // Form state
    const [formData, setFormData] = useState({
        dni: '',
        nombre: '',
        features: METRIC_FIELDS.reduce((acc, field) => {
            acc[field] = field === 'Age' ? 30 : field === 'Gender' ? 1 : 1;
            return acc;
        }, {})
    });
    const [formLoading, setFormLoading] = useState(false);

    const fetchPacientes = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/pacientes', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setPacientes(data);
        } catch(e) {}
    };

    const fetchHistorial = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/pacientes/historial', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setHistorial(data);
            
            const resStats = await fetch('http://localhost:8000/api/pacientes/historial/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataStats = await resStats.json();
            setHistorialStats(dataStats);
        } catch(e) {}
    };

    useEffect(() => { fetchPacientes(); }, [token]);

    const toggleSalio = async (dni) => {
        await fetch(`http://localhost:8000/api/pacientes/${dni}/alta`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchPacientes();
    };

    const darDeAltaDefinitiva = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/pacientes/${selectedAltaPaciente.dni}/finalizar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ motivo: altaMotivo })
            });
            if(res.ok) {
                setShowDarAltaModal(false);
                fetchPacientes();
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleFeatureChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [field]: Number(value)
            }
        }));
    };

    const submitManualPaciente = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            const res = await fetch('http://localhost:8000/api/pacientes/manual', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            if(res.ok) {
                setShowAddModal(false);
                fetchPacientes();
                setFormData({
                    dni: '',
                    nombre: '',
                    features: METRIC_FIELDS.reduce((acc, f) => { acc[f] = f === 'Age' ? 30 : f === 'Gender' ? 1 : 1; return acc; }, {})
                });
            } else {
                const err = await res.json();
                alert(err.detail || 'Error guardando paciente');
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            setFormLoading(false);
        }
    };

    const filtered = pacientes.filter(p => {
        const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) || p.dni.includes(search);
        const matchRiesgo = riesgoFiltro === 'Todos' || p.riesgo_actual === riesgoFiltro;
        return matchSearch && matchRiesgo;
    });

    const getRiskColor = (risk) => {
        if(risk === 'High') return '#ef4444';
        if(risk === 'Medium') return '#f59e0b';
        if(risk === 'Low') return '#10b981';
        return '#94a3b8';
    };

    const activePacientes = pacientes.filter(p => p.dado_de_alta === 0);
    const nLow = activePacientes.filter(p => p.riesgo_actual === 'Low').length;
    const nMedium = activePacientes.filter(p => p.riesgo_actual === 'Medium').length;
    const nHigh = activePacientes.filter(p => p.riesgo_actual === 'High').length;

    const downloadCSV = () => {
        if (activePacientes.length === 0) {
            alert("No hay pacientes activos para descargar.");
            return;
        }
        
        const headers = ['DNI', 'Nombre', ...METRIC_FIELDS];
        let csvContent = headers.join(',') + '\n';
        
        activePacientes.forEach(p => {
            const row = [p.dni, p.nombre];
            if (p.metricas) {
                METRIC_FIELDS.forEach(field => {
                    row.push(p.metricas[field] !== undefined ? p.metricas[field] : '');
                });
            } else {
                METRIC_FIELDS.forEach(() => row.push(''));
            }
            csvContent += row.join(',') + '\n';
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `aldimi_censo_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{ padding: '2rem', color: 'white' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '2rem', fontWeight: 'bold' }}>Registro de Pacientes</h1>
            
            {/* Stats Dashboard — clic para filtrar por criticidad (Obs. 4) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '0.75rem' }}>
                {[
                    { key: 'Todos', label: 'Total Activos', value: activePacientes.length, color: '#e2e8f0', bg: 'rgba(255,255,255,0.05)' },
                    { key: 'Low', label: 'Riesgo Bajo', value: nLow, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                    { key: 'Medium', label: 'Riesgo Medio', value: nMedium, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                    { key: 'High', label: 'Riesgo Alto', value: nHigh, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                ].map(c => (
                    <div key={c.key} onClick={() => setRiesgoFiltro(c.key)}
                        style={{
                            background: c.bg, padding: '1.5rem', borderRadius: '1rem', textAlign: 'center', cursor: 'pointer',
                            border: riesgoFiltro === c.key ? `2px solid ${c.color}` : '2px solid transparent',
                            boxShadow: riesgoFiltro === c.key ? `0 0 0 3px ${c.color}22` : 'none', transition: 'all 0.15s',
                        }}>
                        <p style={{ color: c.key === 'Todos' ? '#94a3b8' : c.color, fontSize: '0.9rem', marginBottom: '0.5rem' }}>{c.label}</p>
                        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: c.key === 'Todos' ? 'white' : c.color }}>{c.value}</h2>
                    </div>
                ))}
            </div>
            {riesgoFiltro !== 'Todos' && (
                <div style={{ marginBottom: '1.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    Filtrando por criticidad: <strong style={{ color: getRiskColor(riesgoFiltro) }}>{riesgoFiltro}</strong> ·
                    <button onClick={() => setRiesgoFiltro('Todos')} style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline', marginLeft: '0.5rem' }}>quitar filtro</button>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '0.5rem', width: '300px' }}>
                    <Search size={20} color="#94a3b8" />
                    <input 
                        type="text" 
                        placeholder="Buscar por DNI o Nombre..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', marginLeft: '0.5rem', width: '100%' }}
                    />
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                        onClick={downloadCSV}
                        style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.5)', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                        <Download size={20} /> Descargar CSV
                    </button>
                    <button 
                        onClick={() => { fetchHistorial(); setShowHistorialModal(true); }}
                        style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                        <Archive size={20} /> Ver Historial (Dados de Alta)
                    </button>
                    <button 
                        onClick={() => setShowAddModal(true)}
                        style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                        <Plus size={20} /> Añadir Paciente
                    </button>
                </div>
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
                                        ? <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem' }}>Salió Temporalmente</span>
                                        : <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem' }}>Activo (Internado)</span>
                                    }
                                </td>
                                <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button onClick={() => { setSelectedPaciente(p); setShowDetailModal(true); }} style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', color: '#3b82f6', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FileText size={16} /> Detalles
                                    </button>
                                    <button onClick={() => toggleSalio(p.dni)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <ArrowRightLeft size={16} /> {p.dado_de_alta === 1 ? 'Reingresar' : 'Marcar Salió'}
                                    </button>
                                    <button onClick={() => { setSelectedAltaPaciente(p); setShowDarAltaModal(true); }} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <LogOut size={16} /> Dar de Alta
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No hay pacientes registrados activos. Sube el Censo o añade uno manual.</div>}
            </div>

            {/* Modal: Añadir Paciente */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '1rem', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2>Añadir Paciente Clínico Manual</h2>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <form onSubmit={submitManualPaciente}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>DNI</label>
                                    <input required type="text" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #475569', background: '#0f172a', color: 'white' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Nombre Completo</label>
                                    <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #475569', background: '#0f172a', color: 'white' }} />
                                </div>
                            </div>
                            
                            <h3 style={{ marginBottom: '1rem', color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>Métricas Clínicas</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                {METRIC_FIELDS.map(field => (
                                    <div key={field}>
                                        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                            {METRIC_TRANSLATIONS[field]} {field !== 'Age' && field !== 'Gender' ? '(1 al 9)' : ''}
                                        </label>
                                        {field === 'Gender' ? (
                                            <select
                                                required
                                                value={formData.features[field]}
                                                onChange={e => handleFeatureChange(field, e.target.value)}
                                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #475569', background: '#0f172a', color: 'white' }}
                                            >
                                                <option value={1}>Masculino (1)</option>
                                                <option value={2}>Femenino (2)</option>
                                            </select>
                                        ) : (
                                            <input 
                                                required 
                                                type="number" 
                                                min="1" max={field === 'Age' ? 120 : 9} 
                                                value={formData.features[field]} 
                                                onChange={e => handleFeatureChange(field, e.target.value)} 
                                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #475569', background: '#0f172a', color: 'white' }} 
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'transparent', color: 'white', border: '1px solid #475569', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" disabled={formLoading} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer' }}>
                                    {formLoading ? 'Procesando IA...' : 'Guardar y Predecir Riesgo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Detalles / Métricas del Paciente */}
            {showDetailModal && selectedPaciente && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '1rem', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ marginBottom: '0.5rem' }}>{selectedPaciente.nombre}</h2>
                                <p style={{ color: '#94a3b8' }}>DNI: {selectedPaciente.dni}</p>
                                <p>Riesgo Actual: <strong style={{ color: getRiskColor(selectedPaciente.riesgo_actual) }}>{selectedPaciente.riesgo_actual}</strong></p>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        
                        <h3 style={{ marginBottom: '1rem', color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>Historial Clínico Guardado</h3>
                        
                        {selectedPaciente.metricas ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {Object.entries(selectedPaciente.metricas).map(([k, v]) => (
                                    <div key={k} style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #334155' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block' }}>{METRIC_TRANSLATIONS[k] || k}</span>
                                        <strong>{k === 'Gender' ? (v === 1 ? 'Masculino' : 'Femenino') : v}</strong>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: '#ef4444' }}>Este paciente fue importado desde un censo masivo que no adjuntó sus métricas, o es un registro antiguo.</p>
                        )}
                        
                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <button onClick={() => setShowDetailModal(false)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Dar de Alta Definitiva */}
            {showDarAltaModal && selectedAltaPaciente && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 110 }}>
                    <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '1rem', width: '90%', maxWidth: '400px' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Dar de Alta a {selectedAltaPaciente.nombre}</h2>
                        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Este paciente pasará al Historial Clínico. Por favor seleccione el motivo del alta médica.</p>
                        
                        <form onSubmit={darDeAltaDefinitiva}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Motivo de Alta</label>
                            <select 
                                value={altaMotivo} 
                                onChange={e => setAltaMotivo(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #475569', background: '#0f172a', color: 'white', marginBottom: '2rem' }}
                            >
                                {MOTIVOS_ALTA.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button type="button" onClick={() => setShowDarAltaModal(false)} style={{ flex: 1, background: 'transparent', color: 'white', border: '1px solid #475569', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" disabled={formLoading} style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Archivar Paciente</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Ver Historial (Pacientes Dados de Alta) */}
            {showHistorialModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '1rem', width: '90%', maxWidth: '1200px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <Archive size={28} color="#3b82f6" />
                                <h2>Historial de Altas Médicas</h2>
                            </div>
                            <button onClick={() => setShowHistorialModal(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
                            {/* Panel Izquierdo: Gráfico */}
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <h3>Motivos de Alta</h3>
                                {historialStats.length > 0 ? (
                                    <PieChart width={350} height={350}>
                                        <Pie
                                            data={historialStats}
                                            dataKey="cantidad"
                                            nameKey="motivo"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            fill="#8884d8"
                                            label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = 25 + innerRadius + (outerRadius - innerRadius);
                                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                return (
                                                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                                                        {value}
                                                    </text>
                                                );
                                            }}
                                        >
                                            {historialStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '0.5rem', color: 'white' }} itemStyle={{ color: 'white' }} />
                                        <Legend />
                                    </PieChart>
                                ) : (
                                    <p style={{ color: '#94a3b8', marginTop: '2rem' }}>No hay datos suficientes para graficar.</p>
                                )}
                            </div>

                            {/* Panel Derecho: Tabla */}
                            <div style={{ flex: 1.5, overflowY: 'auto' }}>
                                {historial.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '4rem' }}>
                                        <Archive size={48} style={{ margin: '0 auto', marginBottom: '1rem', opacity: 0.5 }} />
                                        <p>No hay pacientes en el historial aún.</p>
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                                            <tr>
                                                <th style={{ padding: '1rem' }}>DNI</th>
                                                <th style={{ padding: '1rem' }}>Nombre</th>
                                                <th style={{ padding: '1rem' }}>Último Riesgo</th>
                                                <th style={{ padding: '1rem' }}>Motivo de Alta</th>
                                                <th style={{ padding: '1rem' }}>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historial.map(p => (
                                                <tr key={p.dni} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '1rem' }}>{p.dni}</td>
                                                    <td style={{ padding: '1rem' }}>{p.nombre}</td>
                                                    <td style={{ padding: '1rem', color: getRiskColor(p.riesgo_ultimo), fontWeight: 'bold' }}>{p.riesgo_ultimo}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.85rem' }}>
                                                            {p.motivo_salida}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        {p.motivo_salida !== 'Falleció' && (
                                                            <button 
                                                                onClick={async () => {
                                                                    await toggleSalio(p.dni);
                                                                    fetchHistorial();
                                                                }} 
                                                                style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)', color: '#10b981', padding: '0.25rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
                                                            >
                                                                Reingresar
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

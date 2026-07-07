import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { UploadCloud, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend, PieChart, Pie } from 'recharts';

export default function Dashboard() {
    const { token, dashboardResults, setDashboardResults } = useContext(AuthContext);
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;
        setLoading(true);
        setError('');
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const res = await fetch('http://localhost:8000/api/upload_census', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if(res.ok) setDashboardResults(data);
            else setError(data.detail || "Error");
        } catch(err) {
            setError("Error de red.");
        } finally {
            setLoading(false);
        }
    };

    // Calculate Box projections (assume 100 pills/box as per seed)
    const getCajas = (pills) => Math.ceil(pills / 100);

    // Prepare chart data
    let riskData = [];
    let forecastData = [];

    if (dashboardResults) {
        riskData = [
            { name: 'Riesgo Bajo', value: dashboardResults.census_counts.Low, color: '#10b981' },
            { name: 'Riesgo Medio', value: dashboardResults.census_counts.Medium, color: '#f59e0b' },
            { name: 'Riesgo Alto', value: dashboardResults.census_counts.High, color: '#ef4444' }
        ];

        // Format for BarChart (comparing horizons per drug)
        Object.entries(dashboardResults.cumulative_forecasts).forEach(([drug, horizons]) => {
            forecastData.push({
                name: drug,
                '7_días_pastillas': horizons['7_days'],
                '7_días_cajas': getCajas(horizons['7_days']),
                '14_días_pastillas': horizons['14_days'],
                '14_días_cajas': getCajas(horizons['14_days']),
                '60_días_pastillas': horizons['60_days'],
                '60_días_cajas': getCajas(horizons['60_days']),
            });
        });
    }

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '0.5rem', color: 'white' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{label}</p>
                    {payload.map(p => (
                        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ padding: '2rem', color: 'white' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>Dashboard Analítico</h1>
            
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem' }}>Cargar Censo Diario (CSV)</h2>
                <form onSubmit={handleUpload} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} style={{ color: 'white' }} />
                    <button type="submit" disabled={loading} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <UploadCloud size={20} /> {loading ? 'Procesando...' : 'Analizar Riesgos'}
                    </button>
                </form>
                {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>}
            </div>

            {dashboardResults && (
                <div>
                    <h2 style={{ marginBottom: '1rem' }}>Resultados del Censo</h2>
                    
                    {/* Tarjetas de Riesgo */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '1.5rem', borderRadius: '1rem', textAlign: 'center' }}>
                            <h3>Riesgo Bajo</h3>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{dashboardResults.census_counts.Low}</p>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '1.5rem', borderRadius: '1rem', textAlign: 'center' }}>
                            <h3>Riesgo Medio</h3>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{dashboardResults.census_counts.Medium}</p>
                        </div>
                        <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '1.5rem', borderRadius: '1rem', textAlign: 'center' }}>
                            <h3>Riesgo Alto</h3>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>{dashboardResults.census_counts.High}</p>
                        </div>
                    </div>

                    {/* Gráficos de Riesgo */}
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem', height: '350px' }}>
                        <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>Distribución de Pacientes por Riesgo</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={riskData} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    outerRadius={100} 
                                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {riskData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <h2 style={{ marginBottom: '1rem' }}>Proyecciones de Demanda Logística</h2>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', padding: '1rem', marginBottom: '1.5rem', borderRadius: '0.5rem' }}>
                        <p style={{ color: '#93c5fd', margin: 0 }}>
                            💡 <strong>Tip:</strong> Si deseas ver la diferencia exacta de cajas a comprar en base a tu stock físico actual, dirígete a la sección de <strong>Inventario y Logística</strong>.
                        </p>
                    </div>
                    
                    {/* Tarjetas de Proyecciones */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        {Object.entries(dashboardResults.cumulative_forecasts).map(([drug, horizons]) => (
                            <div key={drug} style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '1rem' }}>
                                <h3 style={{ marginBottom: '1rem', color: '#60a5fa' }}>{drug}</h3>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span>7 días:</span>
                                    <strong>{horizons['7_days']} pastillas <span style={{color: '#94a3b8', fontSize: '0.85em'}}>({getCajas(horizons['7_days'])} cajas)</span></strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span>14 días:</span>
                                    <strong>{horizons['14_days']} pastillas <span style={{color: '#94a3b8', fontSize: '0.85em'}}>({getCajas(horizons['14_days'])} cajas)</span></strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>60 días:</span>
                                    <strong>{horizons['60_days']} pastillas <span style={{color: '#94a3b8', fontSize: '0.85em'}}>({getCajas(horizons['60_days'])} cajas)</span></strong>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Gráficos de Cajas */}
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '1rem', height: '400px' }}>
                        <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>Proyección de Cajas Necesarias por Medicamento</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={forecastData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" label={{ value: 'Cajas', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar dataKey="7_días_cajas" name="7 Días" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="14_días_cajas" name="14 Días" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="60_días_cajas" name="60 Días" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                </div>
            )}
        </div>
    );
}

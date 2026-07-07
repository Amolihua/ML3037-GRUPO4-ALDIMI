import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Brain, Filter, FlaskConical, ArrowRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend } from 'recharts';

const API = 'http://localhost:8000';
const DRUG_COLORS = { N02BE: '#10b981', N05B: '#3b82f6', M01AB: '#ef4444' };
const NIVELES = [
    { key: 'Low', label: 'Bajo', color: '#10b981' },
    { key: 'Medium', label: 'Medio', color: '#f59e0b' },
    { key: 'High', label: 'Alto', color: '#ef4444' },
];

const card = { background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' };

export default function Analitica() {
    const { token } = useContext(AuthContext);
    const H = { 'Authorization': `Bearer ${token}` };

    const [vars, setVars] = useState(null);
    const [drugSel, setDrugSel] = useState('M01AB');
    const [critData, setCritData] = useState(null);
    const [critFiltro, setCritFiltro] = useState('Todos');

    // Simulador
    const [sim, setSim] = useState({
        ingreso: { Low: 0, Medium: 0, High: 0 },
        egreso: { Low: 0, Medium: 0, High: 0 },
        fallecimiento: { Low: 0, Medium: 0, High: 0 },
    });
    const [simResult, setSimResult] = useState(null);
    const [simLoading, setSimLoading] = useState(false);

    const fetchVars = async () => {
        try {
            const r = await fetch(`${API}/api/variables_criticas?top=8`, { headers: H });
            setVars(await r.json());
        } catch (e) {}
    };
    const fetchCrit = async () => {
        try {
            const r = await fetch(`${API}/api/demanda_por_criticidad`, { headers: H });
            setCritData(await r.json());
        } catch (e) {}
    };

    useEffect(() => { fetchVars(); fetchCrit(); }, [token]);

    const setEvento = (tipo, nivel, val) => {
        setSim(prev => ({ ...prev, [tipo]: { ...prev[tipo], [nivel]: Math.max(0, parseInt(val) || 0) } }));
    };
    const resetSim = () => setSim({
        ingreso: { Low: 0, Medium: 0, High: 0 },
        egreso: { Low: 0, Medium: 0, High: 0 },
        fallecimiento: { Low: 0, Medium: 0, High: 0 },
    });

    const correrSimulacion = async () => {
        setSimLoading(true);
        try {
            const r = await fetch(`${API}/api/simular_poblacion`, {
                method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
                body: JSON.stringify(sim),
            });
            setSimResult(await r.json());
        } catch (e) {} finally { setSimLoading(false); }
    };

    // --- datos para gráficos ---
    const riskChart = vars?.riesgo?.map(v => ({ name: v.variable_es, valor: v.importancia_pct })) || [];
    const drugDrivers = vars?.demanda?.[drugSel]?.drivers?.slice(0, 6) || [];

    const critRows = (critData?.por_criticidad || []).filter(
        r => critFiltro === 'Todos' || NIVELES.find(n => n.key === r.criticidad)?.label === critFiltro
    );
    const critChart = critRows.map(r => ({
        name: NIVELES.find(n => n.key === r.criticidad)?.label || r.criticidad,
        N02BE: r.N02BE, N05B: r.N05B, M01AB: r.M01AB,
    }));

    const DeltaTag = ({ v, unit }) => {
        const color = v > 0 ? '#ef4444' : v < 0 ? '#10b981' : '#94a3b8';
        const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
        return (
            <span style={{ color, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}>
                <Icon size={14} /> {v > 0 ? '+' : ''}{v} {unit}
            </span>
        );
    };

    return (
        <div style={{ padding: '2rem', color: 'white' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Brain size={30} color="#8b5cf6" /> Análisis Predictivo (IA)
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Variables críticas, demanda por criticidad y simulación de escenarios de población.</p>

            {/* ===================== OBS 1: VARIABLES CRÍTICAS ===================== */}
            <div style={card}>
                <h2 style={{ marginBottom: '0.25rem' }}>1 · Variables Críticas del Modelo</h2>
                <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Qué factores pesan más en las predicciones. Clave para sustentar el modelo.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div>
                        <h3 style={{ marginBottom: '1rem', color: '#60a5fa' }}>Riesgo del paciente</h3>
                        <div style={{ height: '320px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={riskChart} layout="vertical" margin={{ left: 40, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis type="number" stroke="#94a3b8" unit="%" />
                                    <YAxis type="category" dataKey="name" stroke="#94a3b8" width={130} tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem' }} formatter={v => `${v}%`} />
                                    <Bar dataKey="valor" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ color: '#60a5fa' }}>Demanda de medicamento</h3>
                            <select value={drugSel} onChange={e => setDrugSel(e.target.value)}
                                style={{ background: '#0f172a', color: 'white', border: '1px solid #475569', borderRadius: '0.5rem', padding: '0.4rem 0.75rem' }}>
                                {['N02BE', 'N05B', 'M01AB'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.75rem' }}>Modelo: {vars?.demanda?.[drugSel]?.tipo_modelo || '—'}</p>
                        <div style={{ height: '270px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={drugDrivers.map(d => ({ name: d.variable_es, valor: d.impacto_pct }))} layout="vertical" margin={{ left: 40, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis type="number" stroke="#94a3b8" unit="%" />
                                    <YAxis type="category" dataKey="name" stroke="#94a3b8" width={130} tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem' }} formatter={v => `${v}%`} />
                                    <Bar dataKey="valor" fill={DRUG_COLORS[drugSel]} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===================== OBS 4: DEMANDA POR CRITICIDAD ===================== */}
            <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <h2>2 · Demanda por Criticidad</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Filter size={16} color="#94a3b8" />
                        {['Todos', 'Bajo', 'Medio', 'Alto'].map(f => (
                            <button key={f} onClick={() => setCritFiltro(f)}
                                style={{
                                    background: critFiltro === f ? '#3b82f6' : 'rgba(255,255,255,0.08)',
                                    color: 'white', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '0.5rem',
                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: critFiltro === f ? 'bold' : 'normal',
                                }}>{f}</button>
                        ))}
                    </div>
                </div>
                <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Consumo diario (pastillas) que aporta cada grupo. Censo activo: <strong>{critData?.censo?.Total ?? 0}</strong> pacientes.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={critChart} margin={{ top: 10, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" label={{ value: 'Pastillas/día', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem' }} />
                                <Legend />
                                <Bar dataKey="N02BE" stackId="a" fill={DRUG_COLORS.N02BE} />
                                <Bar dataKey="N05B" stackId="a" fill={DRUG_COLORS.N05B} />
                                <Bar dataKey="M01AB" stackId="a" fill={DRUG_COLORS.M01AB} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem' }}>Nivel</th><th style={{ padding: '0.5rem' }}>Pac.</th>
                                    <th style={{ padding: '0.5rem' }}>N02BE</th><th style={{ padding: '0.5rem' }}>N05B</th><th style={{ padding: '0.5rem' }}>M01AB</th>
                                </tr>
                            </thead>
                            <tbody>
                                {critRows.map(r => {
                                    const niv = NIVELES.find(n => n.key === r.criticidad);
                                    return (
                                        <tr key={r.criticidad} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.6rem 0.5rem', color: niv?.color, fontWeight: 'bold' }}>{niv?.label}</td>
                                            <td style={{ padding: '0.6rem 0.5rem' }}>{r.n_pacientes}</td>
                                            <td style={{ padding: '0.6rem 0.5rem' }}>{r.N02BE}</td>
                                            <td style={{ padding: '0.6rem 0.5rem' }}>{r.N05B}</td>
                                            <td style={{ padding: '0.6rem 0.5rem' }}>{r.M01AB}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {critFiltro === 'Todos' && critData?.total_diario && (
                            <div style={{ marginTop: '1rem', background: 'rgba(59,130,246,0.1)', borderLeft: '3px solid #3b82f6', padding: '0.75rem', borderRadius: '0.25rem', fontSize: '0.85rem', color: '#93c5fd' }}>
                                Total diario → N02BE: {critData.total_diario.N02BE} · N05B: {critData.total_diario.N05B} · M01AB: {critData.total_diario.M01AB} pastillas
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ===================== OBS 2 + 5: SIMULADOR ===================== */}
            <div style={card}>
                <h2 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FlaskConical size={22} color="#8b5cf6" /> 3 · Simulador de Población → Proyección
                </h2>
                <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    ¿Cómo cambia la compra si <strong>ingresan</strong>, <strong>egresan</strong> o <strong>fallecen</strong> albergados? Aplica los cambios sobre el censo activo actual.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {[
                        { tipo: 'ingreso', label: 'Ingresos', color: '#10b981' },
                        { tipo: 'egreso', label: 'Egresos / Altas', color: '#f59e0b' },
                        { tipo: 'fallecimiento', label: 'Fallecimientos', color: '#ef4444' },
                    ].map(({ tipo, label, color }) => (
                        <div key={tipo} style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${color}33` }}>
                            <h4 style={{ color, marginBottom: '0.75rem' }}>{label}</h4>
                            {NIVELES.map(n => (
                                <div key={n.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: n.color }}>{n.label}</span>
                                    <input type="number" min="0" value={sim[tipo][n.key]} onChange={e => setEvento(tipo, n.key, e.target.value)}
                                        style={{ width: '70px', padding: '0.3rem 0.5rem', background: '#020617', color: 'white', border: '1px solid #475569', borderRadius: '0.4rem', textAlign: 'center' }} />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button onClick={correrSimulacion} disabled={simLoading}
                        style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FlaskConical size={18} /> {simLoading ? 'Simulando...' : 'Simular impacto'}
                    </button>
                    <button onClick={resetSim} style={{ background: 'transparent', color: 'white', border: '1px solid #475569', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Limpiar</button>
                </div>

                {simResult && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem 1.25rem', borderRadius: '0.75rem' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Censo base</span>
                                <div style={{ fontWeight: 'bold' }}>{simResult.censo_base.Total} pac. ({simResult.censo_base.Low}/{simResult.censo_base.Medium}/{simResult.censo_base.High})</div>
                            </div>
                            <ArrowRight color="#8b5cf6" />
                            <div style={{ background: 'rgba(139,92,246,0.15)', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(139,92,246,0.4)' }}>
                                <span style={{ color: '#c4b5fd', fontSize: '0.8rem' }}>Censo simulado</span>
                                <div style={{ fontWeight: 'bold' }}>{simResult.censo_simulado.Total} pac. ({simResult.censo_simulado.Low}/{simResult.censo_simulado.Medium}/{simResult.censo_simulado.High})</div>
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', textAlign: 'left' }}>
                                    <th style={{ padding: '0.6rem' }}>Medicamento</th>
                                    <th style={{ padding: '0.6rem' }}>Horizonte</th>
                                    <th style={{ padding: '0.6rem' }}>Cajas base</th>
                                    <th style={{ padding: '0.6rem' }}>Cajas simulado</th>
                                    <th style={{ padding: '0.6rem' }}>Δ Cajas</th>
                                    <th style={{ padding: '0.6rem' }}>Δ Pastillas</th>
                                    <th style={{ padding: '0.6rem' }}>Δ Costo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {simResult.proyeccion.flatMap(it => (
                                    [['h7', '7 días'], ['h14', '14 días'], ['h60', '60 días']].map(([k, lbl], idx) => (
                                        <tr key={it.medicamento + k} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            {idx === 0 && <td rowSpan={3} style={{ padding: '0.6rem', fontWeight: 'bold', color: DRUG_COLORS[it.medicamento], verticalAlign: 'top' }}>{it.medicamento}</td>}
                                            <td style={{ padding: '0.6rem' }}>{lbl}</td>
                                            <td style={{ padding: '0.6rem' }}>{it[k].base_cajas}</td>
                                            <td style={{ padding: '0.6rem' }}>{it[k].sim_cajas}</td>
                                            <td style={{ padding: '0.6rem' }}><DeltaTag v={it[k].delta_cajas} unit="cajas" /></td>
                                            <td style={{ padding: '0.6rem' }}><DeltaTag v={it[k].sim_pastillas - it[k].base_pastillas} unit="past." /></td>
                                            <td style={{ padding: '0.6rem', color: it[k].delta_costo > 0 ? '#ef4444' : '#10b981' }}>S/ {it[k].delta_costo.toFixed(2)}</td>
                                        </tr>
                                    ))
                                ))}
                            </tbody>
                        </table>
                        <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '1rem' }}>
                            * Proyección determinística (dosis por nivel de criticidad): responde de forma directa y trazable a los cambios del censo.
                            {simResult.forecast_ml ? ' El pronóstico ML avanzado también está disponible en el backend.' : ''}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

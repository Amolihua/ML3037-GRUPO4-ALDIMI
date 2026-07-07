import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { PackagePlus, Pill, AlertTriangle, ExternalLink } from 'lucide-react';

const INKA_LINKS = {
    'N02BE': 'https://inkafarma.pe/producto/paracetamol-500mg-tableta/030102',
    'N05B': 'https://inkafarma.pe/producto/alprazolam-0-5mg-tableta/073190',
    'M01AB': 'https://inkafarma.pe/producto/diclofenaco-50mg-tabletas-de-liberacion-retardada/016797'
};

export default function Inventario() {
    const { token } = useContext(AuthContext);
    const [inventario, setInventario] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInventario = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:8000/api/inventario', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setInventario(data.inventario);
        } catch(e) {}
        setLoading(false);
    };

    useEffect(() => { fetchInventario(); }, [token]);

    const comprar = async (codigo) => {
        const cajasStr = prompt(`Cuántas cajas de ${codigo} ingresarás?`);
        if(!cajasStr) return;
        const cajas = parseInt(cajasStr);
        if(isNaN(cajas) || cajas <= 0) return;

        await fetch('http://localhost:8000/api/inventario/comprar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ codigo, cajas })
        });
        fetchInventario();
    };

    const consumir = async (codigo) => {
        const pastillasStr = prompt(`Cuántas pastillas de ${codigo} se consumieron?`);
        if(!pastillasStr) return;
        const cantidad = parseInt(pastillasStr);
        if(isNaN(cantidad) || cantidad <= 0) return;

        await fetch('http://localhost:8000/api/inventario/consumir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ codigo, cantidad })
        });
        fetchInventario();
    };

    if(loading) return <div style={{color:'white', padding:'2rem'}}>Cargando Inventario...</div>;

    return (
        <div style={{ padding: '2rem', color: 'white' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '2rem', fontWeight: 'bold' }}>Gestión de Inventario (Logística)</h1>
            
            {inventario.map(med => (
                <div key={med.codigo} style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 300px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h2 style={{ color: '#3b82f6', marginBottom: '0.5rem' }}>{med.codigo} - {med.nombre}</h2>
                            <a href={INKA_LINKS[med.codigo]} target="_blank" rel="noreferrer" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.5rem 1rem', borderRadius: '0.5rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                <ExternalLink size={16} /> Inkafarma
                            </a>
                        </div>
                        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Precio Caja: S/ {med.precio_caja.toFixed(2)} (100 und)</p>
                        
                        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
                            <div>
                                <p style={{ color: '#94a3b8' }}>Stock Total (Pastillas)</p>
                                <p style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{med.stock_pastillas}</p>
                            </div>
                            <div>
                                <p style={{ color: '#94a3b8' }}>En Cajas Físicas</p>
                                <p style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{med.cajas_actuales} <span style={{fontSize:'1rem', fontWeight:'normal'}}>+ {med.pastillas_sueltas} sueltas</span></p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => comprar(med.codigo)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                <PackagePlus size={20} /> Ingresar Compra (Cajas)
                            </button>
                            <button onClick={() => consumir(med.codigo)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                <Pill size={20} /> Registrar Consumo (Pastillas)
                            </button>
                        </div>
                    </div>
                    
                    <div style={{ flex: '1 1 300px', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '0.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={20} color="#f59e0b" /> Recomendación de Compra
                        </h3>
                        <p style={{ marginBottom: '1rem', color: '#94a3b8' }}>Según el modelo predictivo IA y el stock actual:</p>
                        
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ padding: '0.5rem 0' }}>Horizonte</th>
                                    <th style={{ padding: '0.5rem 0' }}>Cajas Faltantes</th>
                                    <th style={{ padding: '0.5rem 0' }}>Costo Estimado</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '0.75rem 0' }}>Próximos 7 Días</td>
                                    <td style={{ padding: '0.75rem 0', color: med.recomendacion_7d.cajas_a_comprar > 0 ? '#ef4444' : '#10b981' }}>{med.recomendacion_7d.cajas_a_comprar} cajas</td>
                                    <td style={{ padding: '0.75rem 0' }}>S/ {med.recomendacion_7d.costo.toFixed(2)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '0.75rem 0' }}>Próximos 14 Días</td>
                                    <td style={{ padding: '0.75rem 0', color: med.recomendacion_14d.cajas_a_comprar > 0 ? '#ef4444' : '#10b981' }}>{med.recomendacion_14d.cajas_a_comprar} cajas</td>
                                    <td style={{ padding: '0.75rem 0' }}>S/ {med.recomendacion_14d.costo.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '0.75rem 0' }}>Próximos 60 Días</td>
                                    <td style={{ padding: '0.75rem 0', color: med.recomendacion_60d.cajas_a_comprar > 0 ? '#ef4444' : '#10b981' }}>{med.recomendacion_60d.cajas_a_comprar} cajas</td>
                                    <td style={{ padding: '0.75rem 0' }}>S/ {med.recomendacion_60d.costo.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}

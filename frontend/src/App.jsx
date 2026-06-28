import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Upload, ShieldAlert, Users, Package, Activity, Loader2 } from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('censo');
  
  // States for Censo
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [censusResult, setCensusResult] = useState(null);

  // States for Triaje
  const [singleRiskResult, setSingleRiskResult] = useState(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  
  const handleFileUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/upload_census', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setCensusResult(data);
    } catch (error) {
      console.error(error);
      alert('Error conectando al backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriajeSubmit = async (e) => {
    e.preventDefault();
    setLoadingRisk(true);
    
    // Recolectar datos del form
    const formData = new FormData(e.target);
    const features = {};
    for (let [key, value] of formData.entries()) {
      features[key] = Number(value);
    }

    try {
      const response = await fetch('http://localhost:8000/api/predict_single_risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      });
      const data = await response.json();
      setSingleRiskResult(data);
    } catch (error) {
      console.error(error);
      alert('Error conectando al backend.');
    } finally {
      setLoadingRisk(false);
    }
  };

  const renderDemandChart = (drugName, dataObj, color) => {
    const chartData = [
      { name: '7 Días', demanda: dataObj['7_days'] },
      { name: '14 Días', demanda: dataObj['14_days'] },
      { name: '60 Días', demanda: dataObj['60_days'] },
    ];
    return (
      <div className="card">
        <div className="card-header">
          <Package className="icon" size={24} color={color} />
          <h2>Pronóstico Acumulado ({drugName})</h2>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="demanda" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <header className="header">
        <div className="header-title">
          <h1>ALDIMI Predict</h1>
          <p>Ecosistema Inteligente de Gestión y Pronóstico</p>
        </div>
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'censo' ? 'active' : ''}`}
            onClick={() => setActiveTab('censo')}
          >
            <Users size={18} /> Censo Logístico
          </button>
          <button 
            className={`tab-btn ${activeTab === 'triaje' ? 'active' : ''}`}
            onClick={() => setActiveTab('triaje')}
          >
            <ShieldAlert size={18} /> Triaje Individual
          </button>
        </div>
      </header>

      {activeTab === 'censo' && (
        <div className="tab-content">
          <div className="upload-section card">
            <div className="card-header">
              <Upload className="icon" size={24} />
              <h2>Subir Censo Diario (CSV)</h2>
            </div>
            <div className="upload-controls">
              <input 
                type="file" 
                accept=".csv" 
                onChange={(e) => setFile(e.target.files[0])} 
                className="file-input"
              />
              <button 
                className="btn-primary" 
                onClick={handleFileUpload} 
                disabled={!file || loading}
              >
                {loading ? <Loader2 className="spinner" size={18} /> : 'Procesar Censo'}
              </button>
            </div>
          </div>

          {censusResult && (
            <>
              <div className="kpi-grid">
                <div className="kpi-card low">
                  <h3>Riesgo Bajo (LOW)</h3>
                  <div className="kpi-value">{censusResult.census_counts.Low}</div>
                  <p>Pacientes</p>
                </div>
                <div className="kpi-card medium">
                  <h3>Riesgo Medio (MEDIUM)</h3>
                  <div className="kpi-value">{censusResult.census_counts.Medium}</div>
                  <p>Pacientes</p>
                </div>
                <div className="kpi-card high">
                  <h3>Riesgo Alto (HIGH)</h3>
                  <div className="kpi-value">{censusResult.census_counts.High}</div>
                  <p>Pacientes</p>
                </div>
              </div>
              
              <div className="grid">
                {renderDemandChart('N02BE', censusResult.cumulative_forecasts.N02BE, '#3b82f6')}
                {renderDemandChart('M01AB', censusResult.cumulative_forecasts.M01AB, '#10b981')}
                {renderDemandChart('N05B', censusResult.cumulative_forecasts.N05B, '#f59e0b')}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'triaje' && (
        <div className="tab-content">
          <div className="card">
            <div className="card-header">
              <Activity className="icon" size={24} />
              <h2>Triaje Rápido (Random Forest)</h2>
            </div>
            <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem'}}>
              Ingrese los valores clínicos del paciente para obtener su clasificación de riesgo instantánea.
            </p>
            <form onSubmit={handleTriajeSubmit} className="triaje-form">
              <div className="form-grid">
                {/* Generando campos básicos para la demo */}
                {['Age', 'Gender', 'Air Pollution', 'Alcohol use', 'Dust Allergy', 'OccuPational Hazards', 'Genetic Risk', 'chronic Lung Disease', 'Balanced Diet', 'Obesity', 'Smoking', 'Passive Smoker', 'Chest Pain', 'Coughing of Blood', 'Fatigue', 'Weight Loss', 'Shortness of Breath', 'Wheezing', 'Swallowing Difficulty', 'Clubbing of Finger Nails', 'Frequent Cold', 'Dry Cough', 'Snoring'].map(f => (
                  <div className="form-group" key={f}>
                    <label>{f}</label>
                    <input type="number" name={f} required defaultValue="1" min="1" max="100"/>
                  </div>
                ))}
              </div>
              <button type="submit" className="btn-primary" disabled={loadingRisk}>
                {loadingRisk ? <Loader2 className="spinner" size={18} /> : 'Clasificar Paciente'}
              </button>
            </form>

            {singleRiskResult && (
              <div className={`result-box ${singleRiskResult.risk_level.toLowerCase()}`}>
                <h3>Resultado del Modelo</h3>
                <div className="result-content">
                  <div className="level">Riesgo: <strong>{singleRiskResult.risk_level}</strong></div>
                  <div className="prob">Confianza: {(singleRiskResult.probability * 100).toFixed(1)}%</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

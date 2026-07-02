import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            
            const res = await fetch('http://localhost:8000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            const data = await res.json();
            
            if (res.ok) {
                login(data.access_token);
                navigate('/');
            } else {
                setError(data.detail);
            }
        } catch(err) {
            setError("Error de conexión");
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0f172a' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '1rem', backdropFilter: 'blur(10px)', color: 'white', width: '300px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>ALDIMI Login</h2>
                {error && <p style={{ color: '#ef4444', marginBottom: '1rem', textAlign:'center' }}>{error}</p>}
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input type="text" placeholder="Usuario" value={username} onChange={e=>setUsername(e.target.value)}
                        style={{ padding: '0.75rem', borderRadius: '0.5rem', border: 'none', outline: 'none', background: 'rgba(255,255,255,0.2)', color: 'white' }} />
                    <input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)}
                        style={{ padding: '0.75rem', borderRadius: '0.5rem', border: 'none', outline: 'none', background: 'rgba(255,255,255,0.2)', color: 'white' }} />
                    <button type="submit" style={{ padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Ingresar</button>
                </form>
            </div>
        </div>
    );
}

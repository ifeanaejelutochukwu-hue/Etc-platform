import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api } from '../services/api';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function requestOTP() {
    try {
      setError('');
      await api.auth.requestOTP(phone);
      setStep('code');
    } catch (err) {
      setError(err.message);
    }
  }

  async function verifyOTP() {
    try {
      setError('');
      const { token, user } = await api.auth.verifyOTP(phone, code);
      setAuth(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  const styles = {
    page: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f0f23', fontFamily: 'system-ui, sans-serif', color: '#fff' },
    card: { background: '#1a1a3e', padding: '2.5rem', borderRadius: '16px', width: '380px', boxShadow: '0 0 40px rgba(0,0,0,0.5)' },
    logo: { fontSize: '2rem', fontWeight: 700, textAlign: 'center', color: '#6c63ff', marginBottom: '0.25rem' },
    subtitle: { textAlign: 'center', color: '#888', marginBottom: '2rem', fontSize: '0.9rem' },
    input: { width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #333', background: '#2a2a5a', color: '#fff', fontSize: '1rem', boxSizing: 'border-box', outline: 'none' },
    btn: { width: '100%', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', background: '#6c63ff', color: '#fff' },
    error: { color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '12px', textAlign: 'center' },
    back: { textAlign: 'center', marginTop: '12px', color: '#6c63ff', cursor: 'pointer', fontSize: '0.85rem' },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>ETC</div>
        <div style={styles.subtitle}>Easy Talk &amp; Connect</div>
        {error && <div style={styles.error}>{error}</div>}
        {step === 'phone' ? (
          <>
            <input style={styles.input} placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button style={styles.btn} onClick={requestOTP}>Send Code</button>
          </>
        ) : (
          <>
            <input style={styles.input} placeholder="Enter 6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
            <button style={styles.btn} onClick={verifyOTP}>Verify</button>
            <div style={styles.back} onClick={() => setStep('phone')}>Change phone number</div>
          </>
        )}
      </div>
    </div>
  );
}

const BASE = '/api';

async function request(path, options = {}) {
  const token = JSON.parse(localStorage.getItem('etc-auth') || '{}')?.state?.token;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  auth: {
    requestOTP: (phone) => request('/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
    verifyOTP: (phone, code) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) }),
  },
  rooms: {
    create: (data) => request('/rooms', { method: 'POST', body: JSON.stringify(data) }),
    get: (code) => request(`/rooms/${code}`),
    join: (code) => request(`/rooms/${code}/join`, { method: 'POST' }),
    leave: (code) => request(`/rooms/${code}/leave`, { method: 'POST' }),
  },
};

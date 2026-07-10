// In production (Railway) VITE_API_URL points to the backend service URL.
// In development the Vite proxy handles /api → localhost:8080.
const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

// WebSocket base — derived from VITE_API_URL if set, else relative to window.
export function getWsBase() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return apiUrl.replace(/^https?:\/\//, (p) => (p === 'https://' ? 'wss://' : 'ws://'));
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

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
    register: (username, password) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
    login: (username, password) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  },
  rooms: {
    create: (data)  => request('/rooms', { method: 'POST', body: JSON.stringify(data) }),
    get:    (code)  => request(`/rooms/${code}`),
    join:   (code)  => request(`/rooms/${code}/join`, { method: 'POST' }),
    leave:  (code)  => request(`/rooms/${code}/leave`, { method: 'POST' }),
  },
  social: {
    searchUsers:  (q)      => request(`/users/search?q=${encodeURIComponent(q)}`),
    getProfile:   (id)     => request(`/users/${id}`),
    getMyProfile: ()       => request('/me/profile'),
    updateBio:    (bio)    => request('/me/bio', { method: 'PATCH', body: JSON.stringify({ bio }) }),
    sendRequest:  (id)     => request(`/friends/request/${id}`, { method: 'POST' }),
    acceptRequest:(id)     => request(`/friends/accept/${id}`,  { method: 'POST' }),
    declineRequest:(id)    => request(`/friends/decline/${id}`, { method: 'POST' }),
    listFriends:  ()       => request('/friends'),
    listPending:  ()       => request('/friends/pending'),
    discover:     ()       => request('/discover'),
  },
  dm: {
    getOrCreateDirect: (userID) => request(`/dm/direct/${userID}`, { method: 'POST' }),
    createGroup: (name, members) =>
      request('/dm/group', { method: 'POST', body: JSON.stringify({ name, members }) }),
    listConversations: () => request('/dm/conversations'),
    getConversation:   (id) => request(`/dm/conversations/${id}`),
    getMessages:       (id) => request(`/dm/conversations/${id}/messages`),
    sendMessage:       (id, content, msg_type = 'text') =>
      request(`/dm/conversations/${id}/messages`, {
        method: 'POST', body: JSON.stringify({ content, msg_type }),
      }),
  },
};

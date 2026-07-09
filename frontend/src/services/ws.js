let socket = null;
let listeners = {};

function getToken() {
  const stored = localStorage.getItem('etc-auth');
  if (!stored) return null;
  try {
    return JSON.parse(stored)?.state?.token;
  } catch {
    return null;
  }
}

export function connectWebSocket() {
  if (socket?.readyState === WebSocket.OPEN) return socket;

  const token = getToken();
  if (!token) return null;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const url = `${protocol}//${host}/ws?token=${token}`;

  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log('ws connected');
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const typeHandlers = listeners[msg.type] || [];
      typeHandlers.forEach((fn) => fn(msg.payload || {}));
    } catch (err) {
      console.error('ws message error:', err);
    }
  };

  socket.onclose = () => {
    console.log('ws disconnected');
    setTimeout(() => connectWebSocket(), 3000);
  };

  socket.onerror = (err) => {
    console.error('ws error:', err);
  };

  return socket;
}

export function sendMessage(type, payload = {}) {
  if (socket?.readyState !== WebSocket.OPEN) {
    console.warn('ws not connected');
    return;
  }
  socket.send(JSON.stringify({ type, payload }));
}

export function onMessage(type, handler) {
  if (!listeners[type]) listeners[type] = [];
  listeners[type].push(handler);
  return () => {
    listeners[type] = listeners[type].filter((fn) => fn !== handler);
  };
}

export function disconnectWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
  listeners = {};
}

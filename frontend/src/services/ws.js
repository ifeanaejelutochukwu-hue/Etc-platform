import { getWsBase } from './api.js';

/**
 * Singleton WebSocket service.
 *
 * Key behaviours:
 *  - Messages sent before the socket is OPEN are queued and flushed on open.
 *  - Reconnects automatically every 3 s after a close.
 *  - Each connectWebSocket() call returns the existing socket if it is still
 *    OPEN or CONNECTING — no duplicate handlers are registered.
 *  - disconnectWebSocket() cancels the reconnect timer and closes cleanly.
 *  - Individual onMessage() unsubscribers manage their own cleanup;
 *    the global listener map is never wiped from outside.
 */

let socket = null;
let listeners = {};
let queue = [];          // messages buffered before socket is open
let reconnectTimer = null;
let manualClose = false; // true when we initiated the close (no reconnect)

function getToken() {
  try {
    return JSON.parse(localStorage.getItem('etc-auth') || '{}')?.state?.token ?? null;
  } catch {
    return null;
  }
}

function flushQueue() {
  while (queue.length > 0 && socket?.readyState === WebSocket.OPEN) {
    socket.send(queue.shift());
  }
}

export function connectWebSocket() {
  // Already live — nothing to do.
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return socket;
  }

  const token = getToken();
  if (!token) return null;

  manualClose = false;
  const url = `${getWsBase()}/ws?token=${token}`;

  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log('[ws] connected');
    flushQueue();
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const handlers = listeners[msg.type];
      if (handlers) handlers.forEach((fn) => fn(msg.payload ?? {}));
    } catch (err) {
      console.error('[ws] message parse error:', err);
    }
  };

  socket.onclose = () => {
    console.log('[ws] disconnected');
    socket = null;
    if (!manualClose) {
      reconnectTimer = setTimeout(() => connectWebSocket(), 3000);
    }
  };

  socket.onerror = (err) => {
    console.error('[ws] error:', err);
  };

  return socket;
}

/**
 * Send a typed message. If the socket is not yet open, the message is
 * buffered and sent automatically once the connection opens.
 */
export function sendMessage(type, payload = {}) {
  const raw = JSON.stringify({ type, payload });
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(raw);
  } else {
    queue.push(raw);
    // Also attempt to (re)connect in case we're fully disconnected.
    connectWebSocket();
  }
}

/**
 * Subscribe to a message type. Returns an unsubscribe function.
 */
export function onMessage(type, handler) {
  if (!listeners[type]) listeners[type] = [];
  listeners[type].push(handler);
  return () => {
    listeners[type] = listeners[type].filter((fn) => fn !== handler);
  };
}

/**
 * Subscribe to personal messages (dm.message, friend notifications etc.)
 * delivered to this user regardless of room. Same API as onMessage.
 */
export { onMessage as onPersonalMessage };

/**
 * Deliberately close the connection and stop reconnecting.
 * Pending queued messages are discarded.
 */
export function disconnectWebSocket() {
  manualClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  queue = [];
  if (socket) {
    socket.onclose = null; // skip the auto-reconnect path
    socket.close();
    socket = null;
  }
}

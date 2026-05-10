import { WS_URL, RECONNECT_DELAY_MS, MAX_RECONNECT_DELAY_MS } from '../config';
import { sendQueue } from './sendQueue';
import { HeartbeatManager } from './heartbeat';
import { parseTextFrame, parseBinaryFrame } from '../protocol/parsers';
import { PING, USER_JOINED, USER_LEFT, ERROR, MESSAGE_RECEIVED, DELIVERED } from '../protocol/messageTypes';

/**
 * WebSocket client wrapper with reconnection, heartbeat, and serialized sends.
 */
export class WebSocketClient {
  constructor() {
    this.ws = null;
    this.token = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeat = null;
    this.listeners = new Map();
    this.currentServiceId = null;
  }

  /**
   * Connect to the WebSocket server.
   * @param {string} token - JWT token
   * @returns {Promise<void>}
   */
  connect(token) {
    return new Promise((resolve, reject) => {
      this.token = token;

      try {
        this.ws = new WebSocket(WS_URL);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('open');
        resolve();
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const frame = parseTextFrame(event.data);
          if (frame) {
            this.handleFrame(frame);
            this.emit('message', frame);
          }
        } else if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
          this.handleBinary(event.data);
        }
      };

      this.ws.onclose = (event) => {
        this.cleanup();
        this.emit('close', event);
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };
    });
  }

  /**
   * Send a JSON text frame.
   * @param {object} json
   * @returns {Promise<void>}
   */
  async send(json) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    const text = JSON.stringify(json);
    await sendQueue.enqueue(this.ws, text);
  }

  /**
   * Send a binary frame.
   * @param {ArrayBuffer} data
   * @returns {Promise<void>}
   */
  async sendBinary(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    await sendQueue.enqueue(this.ws, data);
  }

  /**
   * Close the WebSocket connection gracefully.
   */
  close() {
    this.clearReconnect();
    if (this.ws) {
      this.ws.close(1000, 'Client closed');
    }
    this.cleanup();
  }

  /**
   * Register an event listener.
   * @param {string} event - 'open' | 'message' | 'close' | 'error' | 'suspicious'
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove an event listener.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  emit(event, data) {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        cb(data);
      }
    }
  }

  handleFrame(frame) {
    if (frame.type === PING) {
      if (!this.heartbeat) {
        this.heartbeat = new HeartbeatManager(this);
        this.heartbeat.start();
      }
      this.heartbeat.onPing();
      return;
    }

    if (frame.type === USER_JOINED) {
      this.emit('user_joined', frame);
      return;
    }

    if (frame.type === USER_LEFT) {
      this.emit('user_left', frame);
      return;
    }

    if (frame.type === ERROR) {
      this.emit('server_error', frame);
      if (frame.code === 'invalid_token') {
        this.emit('auth_error', frame);
      }
      return;
    }

    if (frame.type === MESSAGE_RECEIVED) {
      this.emit('message_received', frame);
      return;
    }

    if (frame.type === DELIVERED) {
      this.emit('delivered', frame);
      return;
    }
  }

  async handleBinary(data) {
    let buffer;
    if (data instanceof Blob) {
      buffer = await data.arrayBuffer();
    } else {
      buffer = data;
    }
    const frame = parseBinaryFrame(buffer);
    this.emit('binary', frame);
  }

  cleanup() {
    if (this.heartbeat) {
      this.heartbeat.stop();
      this.heartbeat = null;
    }
    sendQueue.clear();
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );
    this.reconnectAttempts++;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) {
        this.connect(this.token).catch((err) => {
          console.error('[WebSocket] Reconnect failed:', err.message);
        });
      }
    }, delay);
  }

  clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const wsClient = new WebSocketClient();

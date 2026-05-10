/**
 * Serialized send queue for WebSocket messages.
 * Ensures ws.send() is never called concurrently.
 */
export class SendQueue {
  constructor() {
    this.queue = [];
    this.sending = false;
  }

  /**
   * Enqueue a send operation.
   * @param {WebSocket} ws
   * @param {string|ArrayBuffer} data
   * @returns {Promise<void>}
   */
  async enqueue(ws, data) {
    return new Promise((resolve, reject) => {
      this.queue.push({ ws, data, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.sending || this.queue.length === 0) return;
    this.sending = true;

    while (this.queue.length > 0) {
      const { ws, data, resolve, reject } = this.queue.shift();

      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not open'));
        continue;
      }

      try {
        ws.send(data);
        resolve();
      } catch (err) {
        reject(err);
      }

      // Yield to event loop to prevent blocking
      await new Promise((r) => setTimeout(r, 0));
    }

    this.sending = false;
  }

  clear() {
    // Reject all pending sends
    for (const { reject } of this.queue) {
      reject(new Error('SendQueue cleared'));
    }
    this.queue = [];
    this.sending = false;
  }
}

export const sendQueue = new SendQueue();

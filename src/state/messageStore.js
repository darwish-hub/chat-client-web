/**
 * In-memory message store.
 * Persists nothing to localStorage per constitution.
 */
class MessageStore {
  constructor() {
    this.messages = new Map();
    this.deliveredIds = new Set();
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(conversationId) {
    for (const cb of this.listeners) {
      cb(conversationId);
    }
  }

  add(envelope) {
    const existing = this.messages.get(envelope.id);
    if (existing) {
      // Merge updates (e.g. deliveredAt)
      this.messages.set(envelope.id, { ...existing, ...envelope });
    } else {
      this.messages.set(envelope.id, envelope);
    }
    this.notify(envelope.conversationId);
  }

  getForConversation(conversationId) {
    return Array.from(this.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  ack(messageId) {
    this.deliveredIds.add(messageId);
    const msg = this.messages.get(messageId);
    if (msg) {
      msg.deliveredAt = new Date().toISOString();
      this.messages.set(messageId, msg);
      this.notify(msg.conversationId);
    }
  }

  findById(id) {
    return this.messages.get(id) || null;
  }

  isDelivered(messageId) {
    return this.deliveredIds.has(messageId);
  }

  clear() {
    this.messages.clear();
    this.deliveredIds.clear();
    this.listeners.forEach((cb) => cb(null));
  }
}

export const messageStore = new MessageStore();

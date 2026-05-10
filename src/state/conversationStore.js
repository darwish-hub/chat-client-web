/**
 * In-memory conversation store.
 * Persists nothing to localStorage per constitution.
 */
class ConversationStore {
  constructor() {
    this.conversations = new Map();
    this.currentId = null;
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb(this.list());
    }
  }

  addOrUpdate(conversation) {
    const existing = this.conversations.get(conversation.id);
    this.conversations.set(conversation.id, {
      ...existing,
      ...conversation,
    });
    this.notify();
  }

  get(id) {
    return this.conversations.get(id) || null;
  }

  list() {
    return Array.from(this.conversations.values()).sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );
  }

  setCurrent(id) {
    this.currentId = id;
    this.notify();
  }

  getCurrent() {
    return this.currentId;
  }

  clear() {
    this.conversations.clear();
    this.currentId = null;
    this.notify();
  }
}

export const conversationStore = new ConversationStore();

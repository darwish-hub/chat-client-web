/**
 * In-memory file attachment store.
 * Tracks file metadata before and after upload.
 * Persists nothing to localStorage per constitution.
 */

class FileAttachmentStore {
  constructor() {
    this.attachments = new Map(); // blobId -> FileAttachment
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(blobId) {
    for (const cb of this.listeners) {
      cb(blobId);
    }
  }

  /**
   * Add a file attachment to the store.
   * @param {{fileName: string, mimeType: string, sizeBytes: number, blobId?: string, url?: string, durationMs?: number}} file
   * @returns {string} The key (blobId or temp ID) for the attachment
   */
  add(file) {
    const key = file.blobId || `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.attachments.set(key, {
      ...file,
      blobId: file.blobId || key,
      state: file.blobId ? 'uploaded' : 'uploading',
    });
    this.notify(key);
    return key;
  }

  /**
   * Update a file attachment after upload completes.
   * @param {string} key - Temporary key or blobId
   * @param {{blobId: string, url?: string}} uploadResult
   */
  markUploaded(key, uploadResult) {
    const attachment = this.attachments.get(key);
    if (attachment) {
      this.attachments.delete(key);
      const newAttachment = {
        ...attachment,
        blobId: uploadResult.blobId,
        url: uploadResult.url || null,
        state: 'uploaded',
      };
      this.attachments.set(uploadResult.blobId, newAttachment);
      this.notify(uploadResult.blobId);
    }
  }

  /**
   * Mark a file attachment as shared (sent via file_attachment message).
   * @param {string} blobId
   */
  markShared(blobId) {
    const attachment = this.attachments.get(blobId);
    if (attachment) {
      attachment.state = 'shared';
      this.notify(blobId);
    }
  }

  /**
   * Get a file attachment by blobId.
   * @param {string} blobId
   * @returns {object|null}
   */
  get(blobId) {
    return this.attachments.get(blobId) || null;
  }

  /**
   * Remove a file attachment from the store.
   * @param {string} blobId
   */
  remove(blobId) {
    this.attachments.delete(blobId);
    this.notify(blobId);
  }

  /**
   * Clear all attachments.
   */
  clear() {
    this.attachments.clear();
    this.listeners.forEach((cb) => cb(null));
  }
}

export const fileAttachmentStore = new FileAttachmentStore();
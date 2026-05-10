import { useState, useRef, useEffect } from 'react';
import { MAX_TEXT_LENGTH } from '../config';
import { buildTextMessage, buildFileAttachment, buildTyping } from '../protocol/builders';
import { wsClient } from '../transport/wsClient';
import FileUploader from './FileUploader';

const TYPING_DEBOUNCE_MS = 3000;

export default function Composer({ conversationId, onSend, replyTo, onDismissReply, disabled, error }) {
  const [text, setText] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const clearTypingTimeout = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const emitTyping = (isTyping) => {
    if (!conversationId) return;
    try {
      wsClient.send(buildTyping(conversationId, isTyping));
    } catch {
      // Silently ignore if not connected
    }
  };

  const handleSend = () => {
    if (!text.trim() || !conversationId) return;
    clearTypingTimeout();
    emitTyping(false);
    const envelope = buildTextMessage(conversationId, text.trim(), replyTo?.id);
    wsClient.send(envelope);
    onSend?.(envelope);
    setText('');
    if (replyTo) {
      onDismissReply?.();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Emit typing on any keypress
    if (conversationId && e.key.length === 1) {
      clearTypingTimeout();
      emitTyping(true);
      typingTimeoutRef.current = setTimeout(() => {
        emitTyping(false);
      }, TYPING_DEBOUNCE_MS);
    }
  };

  const handleFileUpload = (fileResult) => {
    if (!conversationId) return;
    const envelope = buildFileAttachment(
      conversationId,
      fileResult.blobId,
      fileResult.fileName,
      fileResult.mimeType,
      fileResult.sizeBytes,
      fileResult.durationMs,
      replyTo?.id
    );
    wsClient.send(envelope);
    onSend?.(envelope);
    setShowUploader(false);
    if (replyTo) {
      onDismissReply?.();
    }
  };

  const remaining = MAX_TEXT_LENGTH - text.length;

  return (
    <div className="composer">
      {replyTo && (
        <div className="composer-reply-preview">
          <div className="composer-reply-line" />
          <div className="composer-reply-content">
            <span className="composer-reply-label">Replying to</span>
            <span className="composer-reply-sender">
              {replyTo.fromUserName || replyTo.fromUserId}
            </span>
            <span className="composer-reply-text">
              {replyTo.content?.text?.slice(0, 80) || '[attachment]'}
            </span>
          </div>
          <button
            className="composer-reply-dismiss"
            onClick={onDismissReply}
            title="Dismiss reply"
          >
            ×
          </button>
        </div>
      )}
      <textarea
        rows={2}
        placeholder={conversationId ? 'Type a message...' : 'Select a conversation first'}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
        onKeyDown={handleKeyDown}
        disabled={!conversationId || disabled}
        className={`composer-textarea ${error ? 'composer-error' : ''}`}
      />
      <div className="composer-footer">
        <div className="composer-actions">
          <button
            className="composer-attach-btn"
            onClick={() => setShowUploader((v) => !v)}
            disabled={!conversationId}
            title="Attach file"
          >
            📎
          </button>
          <span className={`composer-counter ${remaining < 100 ? 'composer-counter-warning' : ''}`}>
            {remaining}
          </span>
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || !conversationId || disabled}
          className="composer-send-btn"
        >
          Send
        </button>
      </div>
      {showUploader && (
        <FileUploader conversationId={conversationId} onUpload={handleFileUpload} />
      )}
    </div>
  );
}

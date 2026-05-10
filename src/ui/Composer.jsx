import { useState, useRef } from 'react';
import { MAX_TEXT_LENGTH } from '../config';
import { buildTextMessage, buildFileAttachment } from '../protocol/builders';
import { wsClient } from '../transport/wsClient';
import FileUploader from './FileUploader';

export default function Composer({ conversationId, onSend }) {
  const [text, setText] = useState('');
  const [showUploader, setShowUploader] = useState(false);

  const handleSend = () => {
    if (!text.trim() || !conversationId) return;
    const envelope = buildTextMessage(conversationId, text.trim());
    wsClient.send(envelope);
    onSend?.(envelope);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
      fileResult.durationMs
    );
    wsClient.send(envelope);
    onSend?.(envelope);
    setShowUploader(false);
  };

  const remaining = MAX_TEXT_LENGTH - text.length;

  return (
    <div className="composer">
      <textarea
        rows={2}
        placeholder={conversationId ? 'Type a message...' : 'Select a conversation first'}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
        onKeyDown={handleKeyDown}
        disabled={!conversationId}
        className="composer-textarea"
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
          disabled={!text.trim() || !conversationId}
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

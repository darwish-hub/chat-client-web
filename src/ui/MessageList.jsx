import { useEffect, useRef, useState } from 'react';
import { messageStore } from '../state/messageStore';
import { download } from '../api/download';
import { getVideoUrl } from '../media/videoPreview';

function FileMessage({ msg }) {
  const content = msg.content || {};
  const isVideo = content.mimeType?.startsWith('video/');
  const isImage = content.mimeType?.startsWith('image/');
  const fileUrl = content.url || (isVideo ? getVideoUrl(content.blobId) : `${import.meta.env.VITE_API_BASE || ''}/api/download/${content.blobId}`);

  return (
    <div className="file-message">
      <div className="file-message-icon">
        {isVideo ? '🎬' : isImage ? '🖼️' : '📎'}
      </div>
      <div className="file-message-info">
        <div className="file-message-name">{content.fileName || 'Unknown file'}</div>
        <div className="file-message-meta">
          {content.mimeType} · {formatBytes(content.sizeBytes)}
        </div>
      </div>
      <div className="file-message-actions">
        {isVideo && (
          <video
            controls
            src={fileUrl}
            preload="metadata"
            className="file-message-video"
            style={{ maxWidth: '200px', maxHeight: '150px' }}
          />
        )}
        <button
          className="file-message-download"
          onClick={() => download(content.blobId, content.fileName)}
        >
          ⬇️ Download
        </button>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function MessageList({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    const updateMessages = () => {
      if (conversationId) {
        setMessages(messageStore.getForConversation(conversationId));
      } else {
        setMessages([]);
      }
    };

    updateMessages();
    const unsubscribe = messageStore.subscribe(updateMessages);
    return unsubscribe;
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (!conversationId) {
    return <p>Select a conversation to view messages</p>;
  }

  return (
    <div className="message-list">
      {messages.length === 0 && <p className="message-empty">No messages yet</p>}
      {messages.map((msg) => (
        <div key={msg.id} className={`message-item ${msg.fromUserId === 'me' ? 'message-mine' : ''}`}>
          <div className="message-header">
            <span className="message-sender">{msg.fromUserName || msg.fromUserId || 'Unknown'}</span>
            <span className="message-time">{formatTime(msg.createdAt)}</span>
            {msg.deliveredAt && <span className="message-delivered" title="Delivered">✓</span>}
          </div>
          <div className="message-content">
            {msg.type === 'text' && msg.content?.text}
            {msg.type === 'voice' && (
              <div className="voice-message">
                <span>🎤 Voice message</span>
                {msg.content?.url && (
                  <audio controls src={msg.content.url} preload="metadata" />
                )}
              </div>
            )}
            {(msg.type === 'video' || msg.type === 'file') && <FileMessage msg={msg} />}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { messageStore } from '../state/messageStore';
import { download } from '../api/download';
import { getVideoUrl } from '../media/videoPreview';
import { fetchThread } from '../api/history';

function FileMessage({ msg }) {
  const attachment = msg.attachment || {};
  const isVideo = attachment.mimeType?.startsWith('video/');
  const isImage = attachment.mimeType?.startsWith('image/');
  const fileUrl = attachment.url || (isVideo ? getVideoUrl(attachment.blobId) : undefined);

  return (
    <div className="file-message">
      <div className="file-message-icon">
        {isVideo ? '\uD83C\uDFAC' : isImage ? '\uD83D\uDDBC\uFE0F' : '\uD83D\uDCC1'}
      </div>
      <div className="file-message-info">
        <div className="file-message-name">{attachment.fileName || 'Unknown file'}</div>
        <div className="file-message-meta">
          {attachment.mimeType} \u00B7 {formatBytes(attachment.sizeBytes)}
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
          onClick={() => download(attachment.blobId, attachment.fileName)}
        >
          \u2B07\uFE0F Download
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

export default function MessageList({ conversationId, onReply }) {
  const [messages, setMessages] = useState([]);
  const [viewingThread, setViewingThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadOriginal, setThreadOriginal] = useState(null);
  const bottomRef = useRef(null);
  const messageRefs = useRef(new Map());

  const currentUserId = useMemo(() => {
    try {
      const token = localStorage.getItem('chathub-token');
      if (token) {
        const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(b64));
        return payload.nid || payload.sub;
      }
    } catch {}
    return null;
  }, []);

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

  const handleReply = (msg) => {
    onReply?.(msg);
  };

  const handleScrollToOriginal = (replyToId) => {
    const el = messageRefs.current.get(replyToId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('message-highlight');
      setTimeout(() => el.classList.remove('message-highlight'), 2000);
    }
  };

  const handleViewThread = async (msg) => {
    if (!msg?.id || !conversationId) return;
    try {
      const result = await fetchThread(conversationId, msg.id);
      setThreadOriginal(result.originalMessage);
      setThreadMessages(result.replies || []);
      setViewingThread(msg);
    } catch (err) {
      console.error('Failed to load thread:', err);
    }
  };

  const closeThread = () => {
    setViewingThread(null);
    setThreadMessages([]);
    setThreadOriginal(null);
  };

  const renderMessageContent = (msg) => {
    if (msg.type === 'text' && msg.text) {
      return <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>;
    }
    if (msg.type === 'voice') {
      return (
        <div className="voice-message">
          <span>\uD83C\uDF99\uFE0F Voice message</span>
          {msg.attachment?.url && (
            <audio controls src={msg.attachment.url} preload="metadata" />
          )}
        </div>
      );
    }
    if (msg.type === 'video' || msg.type === 'file') {
      return <FileMessage msg={msg} />;
    }
    return '[unsupported]';
  };

  const renderMessage = (msg, isThreadView = false) => {
    const isReply = !!msg.replyToId;
    const originalMessage = isReply ? messageStore.findById(msg.replyToId) : null;
    const hasReplies = messages.some((m) => m.replyToId === msg.id);
    const isMine = msg.senderId === currentUserId;

    const dateGroup = formatTime(msg.createdAt);

    return (
      <div
        key={msg.id}
        ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
        className={`message-item ${isMine ? 'message-mine' : 'message-other'} ${isReply ? 'message-reply' : ''}`}
      >
        {isReply && originalMessage && (
          <div
            className="message-reply-context"
            onClick={() => !isThreadView && handleScrollToOriginal(msg.replyToId)}
            style={{ cursor: isThreadView ? 'default' : 'pointer' }}
          >
            <div className="message-reply-preview">
              <span className="message-reply-sender">
                {originalMessage.senderId || 'Unknown'}
              </span>
              <span className="message-reply-text">
                {originalMessage.text?.slice(0, 60) || '[attachment]'}
              </span>
            </div>
          </div>
        )}

        {!isMine && (
          <div className="message-sender-row">
            <span className="message-sender">{msg.senderId || 'Unknown'}</span>
          </div>
        )}

        <div className="message-body">
          <div className="message-content">
            {renderMessageContent(msg)}
          </div>
          <div className="message-meta">
            <span className="message-time">{dateGroup}</span>
            {msg.deliveredAt && <span className="message-delivered" title="Delivered">\u2713</span>}
          </div>
        </div>

        <div className="message-actions">
          <button
            className="message-action-btn"
            onClick={() => handleReply(msg)}
            title="Reply"
          >
            Reply
          </button>
          {hasReplies && !isThreadView && (
            <button
              className="message-action-btn"
              onClick={() => handleViewThread(msg)}
              title="View thread"
            >
              Thread ({messages.filter((m) => m.replyToId === msg.id).length})
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!conversationId) {
    return (
      <div className="message-list message-list-empty">
        <p className="message-empty">Select a conversation to view messages</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.length === 0 && !viewingThread && (
        <p className="message-empty">No messages yet</p>
      )}

      {viewingThread ? (
        <div className="thread-view">
          <div className="thread-header">
            <button className="thread-back-btn" onClick={closeThread}>\u2190 Back</button>
            <span className="thread-title">Thread</span>
          </div>
          {threadOriginal && renderMessage(threadOriginal, true)}
          <div className="thread-replies">
            {threadMessages.length === 0 ? (
              <p className="thread-empty">No replies yet</p>
            ) : (
              threadMessages.map((msg) => renderMessage(msg, true))
            )}
          </div>
        </div>
      ) : (
        messages.map((msg) => renderMessage(msg))
      )}

      <div ref={bottomRef} />
    </div>
  );
}
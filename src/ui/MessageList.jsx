import { useEffect, useRef, useState } from 'react';
import { messageStore } from '../state/messageStore';
import { download } from '../api/download';
import { getVideoUrl } from '../media/videoPreview';
import { fetchThread } from '../api/history';

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

const ITEM_HEIGHT = 80; // estimated average message height
const OVERSCAN = 5; // extra items to render above/below viewport

export default function MessageList({ conversationId, onReply }) {
  const [messages, setMessages] = useState([]);
  const [viewingThread, setViewingThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const bottomRef = useRef(null);
  const messageRefs = useRef(new Map());
  const containerRef = useRef(null);

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

  // Virtualization: measure container and track scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateMetrics = () => {
      setContainerHeight(el.clientHeight);
      setScrollTop(el.scrollTop);
    };

    updateMetrics();
    el.addEventListener('scroll', updateMetrics);
    window.addEventListener('resize', updateMetrics);

    return () => {
      el.removeEventListener('scroll', updateMetrics);
      window.removeEventListener('resize', updateMetrics);
    };
  }, [conversationId, viewingThread]);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    messages.length - 1,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
  );
  const visibleMessages = viewingThread ? messages : messages.slice(startIndex, endIndex + 1);
  const topPadding = startIndex * ITEM_HEIGHT;
  const bottomPadding = Math.max(0, (messages.length - endIndex - 1) * ITEM_HEIGHT);

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
    if (!msg?.id) return;
    try {
      const replies = await fetchThread(conversationId, msg.id);
      setThreadMessages(replies);
      setViewingThread(msg);
    } catch (err) {
      console.error('Failed to load thread:', err);
    }
  };

  const closeThread = () => {
    setViewingThread(null);
    setThreadMessages([]);
  };

  const renderMessageContent = (msg) => {
    if (msg.type === 'text' && msg.content?.text) {
      // React JSX automatically escapes content, preventing XSS
      return <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content.text}</span>;
    }
    if (msg.type === 'voice') {
      return (
        <div className="voice-message">
          <span>🎤 Voice message</span>
          {msg.content?.url && (
            <audio controls src={msg.content.url} preload="metadata" />
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

    return (
      <div
        key={msg.id}
        ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
        className={`message-item ${msg.fromUserId === 'me' ? 'message-mine' : ''} ${isReply ? 'message-reply' : ''}`}
      >
        {isReply && originalMessage && (
          <div
            className="message-reply-context"
            onClick={() => !isThreadView && handleScrollToOriginal(msg.replyToId)}
            style={{ cursor: isThreadView ? 'default' : 'pointer' }}
          >
            <div className="message-reply-line" />
            <div className="message-reply-preview">
              <span className="message-reply-sender">
                {originalMessage.fromUserName || originalMessage.fromUserId}
              </span>
              <span className="message-reply-text">
                {originalMessage.content?.text?.slice(0, 60) || '[attachment]'}
              </span>
            </div>
          </div>
        )}

        <div className="message-header">
          <span className="message-sender">{msg.fromUserName || msg.fromUserId || 'Unknown'}</span>
          <span className="message-time">{formatTime(msg.createdAt)}</span>
          {msg.deliveredAt && <span className="message-delivered" title="Delivered">✓</span>}
        </div>

        <div className="message-content">
          {renderMessageContent(msg)}
        </div>

        <div className="message-actions">
          <button
            className="message-action-btn"
            onClick={() => handleReply(msg)}
            title="Reply"
          >
            ↩️ Reply
          </button>
          {hasReplies && !isThreadView && (
            <button
              className="message-action-btn"
              onClick={() => handleViewThread(msg)}
              title="View thread"
            >
              🧵 View Thread ({messages.filter((m) => m.replyToId === msg.id).length})
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!conversationId) {
    return <p>Select a conversation to view messages</p>;
  }

  return (
    <div className="message-list" ref={containerRef}>
      {messages.length === 0 && !viewingThread && (
        <p className="message-empty">No messages yet</p>
      )}

      {viewingThread ? (
        <div className="thread-view">
          <div className="thread-header">
            <button className="thread-back-btn" onClick={closeThread}>← Back</button>
            <span className="thread-title">Thread</span>
          </div>
          {renderMessage(viewingThread, true)}
          <div className="thread-replies">
            {threadMessages.length === 0 ? (
              <p className="thread-empty">No replies yet</p>
            ) : (
              threadMessages.map((msg) => renderMessage(msg, true))
            )}
          </div>
        </div>
      ) : (
        <>
          {topPadding > 0 && <div style={{ height: topPadding }} />}
          {visibleMessages.map((msg) => renderMessage(msg))}
          {bottomPadding > 0 && <div style={{ height: bottomPadding }} />}
        </>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

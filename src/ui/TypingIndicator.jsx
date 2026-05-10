import { useEffect, useState } from 'react';
import { presenceStore } from '../state/presenceStore';

export default function TypingIndicator({ conversationId }) {
  const [typingUserIds, setTypingUserIds] = useState([]);

  useEffect(() => {
    const update = () => {
      setTypingUserIds(conversationId ? presenceStore.getTyping(conversationId) : []);
    };
    update();
    const unsubscribe = presenceStore.subscribe(update);
    return unsubscribe;
  }, [conversationId]);

  if (!conversationId || typingUserIds.length === 0) {
    return null;
  }

  const text = typingUserIds.length === 1
    ? `${typingUserIds[0]} is typing...`
    : `${typingUserIds.length} people are typing...`;

  return (
    <div className="typing-indicator">
      <span className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
      <span className="typing-text">{text}</span>
    </div>
  );
}

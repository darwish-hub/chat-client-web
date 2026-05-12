import { useEffect, useState } from 'react';
import { conversationStore } from '../state/conversationStore';

export default function ConversationList({ onSelect, onCreate }) {
  const [conversations, setConversations] = useState(conversationStore.list());
  const [currentId, setCurrentId] = useState(conversationStore.getCurrent());

  useEffect(() => {
    const unsubscribe = conversationStore.subscribe((list) => {
      setConversations(list);
      setCurrentId(conversationStore.getCurrent());
    });
    return unsubscribe;
  }, []);

  return (
    <div className="conversation-list">
      <ul className="conversation-items">
        {conversations.length === 0 && (
          <li className="conversation-empty">No conversations yet</li>
        )}
        {conversations.map((c) => (
          <li
            key={c.id}
            className={`conversation-item ${c.id === currentId ? 'active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <div className="conversation-title">{c.title || 'Untitled'}</div>
            <div className="conversation-meta">
              {c.participantIds?.length || 0} participants
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

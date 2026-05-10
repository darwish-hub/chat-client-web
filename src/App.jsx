import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { wsClient } from './transport/wsClient';
import { buildJoinService, buildTextMessage } from './protocol/builders';
import AuthPanel from './ui/AuthPanel';
import ConversationList from './ui/ConversationList';
import MessageList from './ui/MessageList';
import Composer from './ui/Composer';
import VoiceRecorder from './ui/VoiceRecorder';
import { conversationStore } from './state/conversationStore';
import { messageStore } from './state/messageStore';
import { createConversation, listMyConversations } from './api/conversations';
import { fetchHistory } from './api/history';

function App() {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [token, setToken] = useState(() => localStorage.getItem('chathub-token') || '');
  const [authError, setAuthError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [simulatePacketLoss, setSimulatePacketLoss] = useState(false);

  const addLog = useCallback((message) => {
    setLogs((prev) => [...prev, { timestamp: new Date().toISOString(), message }]);
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setConnectionStatus('connected');
      setAuthError(null);
      addLog('WebSocket connected');
    };

    const handleClose = (event) => {
      setConnectionStatus('disconnected');
      addLog(`WebSocket closed (code: ${event.code})`);
    };

    const handleMessage = (frame) => {
      addLog(`← ${frame.type}: ${JSON.stringify(frame)}`);
    };

    const handleError = (error) => {
      setConnectionStatus('disconnected');
      addLog(`WebSocket error: ${error.message || 'Unknown error'}`);
    };

    const handleUserJoined = (frame) => {
      addLog(`← user_joined: ${frame.userName} (${frame.userId}) joined service ${frame.serviceId}`);
      setOnlineUsers((prev) => {
        if (prev.find((u) => u.userId === frame.userId)) return prev;
        return [...prev, { userId: frame.userId, userName: frame.userName, serviceId: frame.serviceId }];
      });
    };

    const handleUserLeft = (frame) => {
      addLog(`← user_left: ${frame.userId} left service ${frame.serviceId}`);
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== frame.userId));
    };

    const handleAuthError = (frame) => {
      setAuthError(frame.message || 'Invalid token');
      setConnectionStatus('disconnected');
      addLog(`← auth_error: ${frame.code} - ${frame.message}`);
    };

    const handleServerError = (frame) => {
      addLog(`← error: ${frame.code} - ${frame.message}`);
    };

    const handleMessageReceived = (frame) => {
      messageStore.add(frame);
      addLog(`← message_received: ${frame.fromUserName}: ${frame.content?.text?.slice(0, 50) || '[non-text]'}`);
    };

    const handleDelivered = (frame) => {
      messageStore.ack(frame.messageId);
      addLog(`← delivered: ${frame.messageId}`);
    };

    wsClient.on('open', handleOpen);
    wsClient.on('close', handleClose);
    wsClient.on('message', handleMessage);
    wsClient.on('error', handleError);
    wsClient.on('user_joined', handleUserJoined);
    wsClient.on('user_left', handleUserLeft);
    wsClient.on('auth_error', handleAuthError);
    wsClient.on('server_error', handleServerError);
    wsClient.on('message_received', handleMessageReceived);
    wsClient.on('delivered', handleDelivered);

    return () => {
      wsClient.off('open', handleOpen);
      wsClient.off('close', handleClose);
      wsClient.off('message', handleMessage);
      wsClient.off('error', handleError);
      wsClient.off('user_joined', handleUserJoined);
      wsClient.off('user_left', handleUserLeft);
      wsClient.off('auth_error', handleAuthError);
      wsClient.off('server_error', handleServerError);
      wsClient.off('message_received', handleMessageReceived);
      wsClient.off('delivered', handleDelivered);
    };
  }, [addLog]);

  const handleConnect = async () => {
    if (!token.trim()) {
      setAuthError('Please enter a JWT token');
      return;
    }
    localStorage.setItem('chathub-token', token);
    setConnectionStatus('connecting');
    setAuthError(null);
    addLog('Connecting...');
    try {
      await wsClient.connect(token);
      wsClient.send(buildJoinService(token));
      addLog('→ join_service');
      // Load conversations after connect
      loadConversations();
    } catch (err) {
      setConnectionStatus('disconnected');
      setAuthError(err.message);
      addLog(`Connection failed: ${err.message}`);
    }
  };

  const handleDisconnect = () => {
    wsClient.close();
    setConnectionStatus('disconnected');
    setAuthError(null);
    setOnlineUsers([]);
    setCurrentConversationId(null);
    conversationStore.clear();
    messageStore.clear();
    addLog('Disconnected');
  };

  const handleTokenChange = (newToken) => {
    setToken(newToken);
    if (authError) setAuthError(null);
  };

  const loadConversations = async () => {
    try {
      const conversations = await listMyConversations();
      for (const c of conversations) {
        conversationStore.addOrUpdate(c);
      }
      addLog(`Loaded ${conversations.length} conversations`);
    } catch (err) {
      addLog(`Failed to load conversations: ${err.message}`);
    }
  };

  const handleSelectConversation = async (id) => {
    conversationStore.setCurrent(id);
    setCurrentConversationId(id);
    // Fetch history
    try {
      const history = await fetchHistory(id);
      for (const msg of history) {
        messageStore.add(msg);
      }
      addLog(`Loaded ${history.length} messages for conversation ${id}`);
    } catch (err) {
      addLog(`Failed to load history: ${err.message}`);
    }
  };

  const handleCreateConversation = async () => {
    const title = prompt('Conversation title:');
    if (!title) return;
    try {
      const conversation = await createConversation('default-service', title, []);
      conversationStore.addOrUpdate(conversation);
      conversationStore.setCurrent(conversation.id);
      setCurrentConversationId(conversation.id);
      addLog(`Created conversation: ${conversation.title} (${conversation.id})`);
    } catch (err) {
      addLog(`Failed to create conversation: ${err.message}`);
    }
  };

  const handleSendMessage = (envelope) => {
    // Optimistically add the message to the store
    const tokenPayload = parseJwt(token);
    const optimisticType = envelope.content?.blobId ? 'file' : 'text';
    messageStore.add({
      ...envelope,
      type: optimisticType,
      fromUserId: tokenPayload?.sub || 'me',
      fromUserName: tokenPayload?.name || 'Me',
      createdAt: new Date().toISOString(),
    });
    const logText = envelope.content?.text?.slice(0, 50) || envelope.content?.fileName || '[non-text]';
    addLog(`→ ${envelope.type}: ${logText}`);
  };

  // Simple JWT parser for display purposes
  function parseJwt(t) {
    try {
      const base64 = t.split('.')[1];
      const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>ChatHub Web Test Client</h1>
        <div className={`status-indicator ${connectionStatus}`}>
          {connectionStatus}
        </div>
      </header>

      <main className="app-main">
        <section className="panel auth-panel">
          <h2>Auth</h2>
          <AuthPanel
            token={token}
            connectionStatus={connectionStatus}
            authError={authError}
            onTokenChange={handleTokenChange}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </section>

        <section className="panel conversations-panel">
          <ConversationList
            onSelect={handleSelectConversation}
            onCreate={handleCreateConversation}
          />
        </section>

        <section className="panel messages-panel">
          <MessageList conversationId={currentConversationId} />
        </section>

        <section className="panel composer-panel">
          <Composer
            conversationId={currentConversationId}
            onSend={handleSendMessage}
          />
          <VoiceRecorder
            conversationId={currentConversationId}
            onSend={(envelope) => addLog(`→ voice_chunk: seq=${envelope.sequenceNumber} final=${envelope.isFinal}`)}
            simulatePacketLoss={simulatePacketLoss}
          />
          <label className="packet-loss-toggle">
            <input
              type="checkbox"
              checked={simulatePacketLoss}
              onChange={(e) => setSimulatePacketLoss(e.target.checked)}
            />
            Simulate packet loss (5%)
          </label>
        </section>

        <section className="panel presence-panel">
          <h2>Presence</h2>
          {onlineUsers.length > 0 ? (
            <ul className="online-users-list">
              {onlineUsers.map((user) => (
                <li key={user.userId} className="online-user">
                  <span className="online-dot" /> {user.userName}
                </li>
              ))}
            </ul>
          ) : (
            <p>No users online</p>
          )}
        </section>

        <section className="panel logs-panel">
          <h2>Logs</h2>
          <div className="logs-content">
            {logs.map((log, i) => (
              <div key={i} className="log-entry">
                <span className="log-timestamp">{log.timestamp}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

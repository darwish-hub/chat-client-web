import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { wsClient } from './transport/wsClient';
import { buildJoinService, buildTextMessage } from './protocol/builders';
import AuthPanel from './ui/AuthPanel';
import ConversationList from './ui/ConversationList';
import MessageList from './ui/MessageList';
import Composer from './ui/Composer';
import VoiceRecorder from './ui/VoiceRecorder';
import PresenceBar from './ui/PresenceBar';
import TypingIndicator from './ui/TypingIndicator';
import ProtocolLog from './ui/ProtocolLog';
import MetricsDashboard from './ui/MetricsDashboard';
import TestScenarios from './ui/TestScenarios';
import { conversationStore } from './state/conversationStore';
import { messageStore } from './state/messageStore';
import { presenceStore } from './state/presenceStore';
import { createConversation, listMyConversations } from './api/conversations';
import { fetchHistory } from './api/history';
import { fetchOnlineUsers } from './api/presence';

function App() {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [token, setToken] = useState(() => localStorage.getItem('chathub-token') || '');
  const [authError, setAuthError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [currentServiceId, setCurrentServiceId] = useState(null);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [simulatePacketLoss, setSimulatePacketLoss] = useState(false);
  const [composerDisabled, setComposerDisabled] = useState(false);
  const [composerError, setComposerError] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [networkThrottle, setNetworkThrottle] = useState('none');
  const [multiDeviceToken, setMultiDeviceToken] = useState('');

  // Metrics state
  const [connectTime, setConnectTime] = useState(null);
  const [messagesSent, setMessagesSent] = useState(0);
  const [messagesReceived, setMessagesReceived] = useState(0);
  const [deliveredLatencies, setDeliveredLatencies] = useState([]);
  const [voiceChunkLatencies, setVoiceChunkLatencies] = useState([]);
  const [queueDepth, setQueueDepth] = useState(0);
  const sentTimestamps = useRef(new Map());

  const addLog = useCallback((message) => {
    setLogs((prev) => [...prev, { timestamp: new Date().toISOString(), message }]);
  }, []);

  // Poll queue depth periodically
  useEffect(() => {
    const interval = setInterval(() => {
      // Access sendQueue depth if available through wsClient
      setQueueDepth(wsClient.queueDepth || 0);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setConnectionStatus('connected');
      setAuthError(null);
      setConnectTime(Date.now());
      addLog('WebSocket connected');
    };

    const handleClose = (event) => {
      setConnectionStatus('disconnected');
      setConnectTime(null);
      addLog(`WebSocket closed (code: ${event.code})`);
    };

    const handleMessage = (frame) => {
      addLog(`← ${frame.type}: ${JSON.stringify(frame)}`);
    };

    const handleError = (error) => {
      setConnectionStatus('disconnected');
      addLog(`WebSocket error: ${error.message || 'Unknown error'}`);
    };

    const handleUserJoined = async (frame) => {
      addLog(`← user_joined: ${frame.userName} (${frame.userId}) joined service ${frame.serviceId}`);
      presenceStore.setOnline(frame.serviceId, { userId: frame.userId, userName: frame.userName });
      setCurrentServiceId(frame.serviceId);
      // Fetch initial online users list on first join (our own join)
      try {
        const users = await fetchOnlineUsers(frame.serviceId);
        for (const user of users) {
          if (user.userId !== frame.userId) {
            presenceStore.setOnline(frame.serviceId, user);
          }
        }
      } catch {
        // Ignore fetch errors
      }
    };

    const handleUserLeft = (frame) => {
      addLog(`← user_left: ${frame.userId} left service ${frame.serviceId}`);
      presenceStore.setOffline(frame.serviceId, frame.userId);
    };

    const handleTyping = (frame) => {
      presenceStore.setTyping(frame.conversationId, frame.userId, frame.isTyping);
    };

    const handleAuthError = (frame) => {
      setAuthError(frame.message || 'Invalid token');
      setConnectionStatus('disconnected');
      addLog(`← auth_error: ${frame.code} - ${frame.message}`);
    };

    const handleServerError = (frame) => {
      addLog(`← error: ${frame.code} - ${frame.message}`);
      showToast(frame.code, frame.message);

      if (frame.code === 'rate_limit_exceeded') {
        setComposerDisabled(true);
        setTimeout(() => setComposerDisabled(false), 5000);
      }
      if (frame.code === 'not_participant') {
        setCurrentConversationId(null);
        conversationStore.setCurrent(null);
      }
      if (frame.code === 'invalid_message') {
        setComposerError(true);
        setTimeout(() => setComposerError(false), 5000);
      }
    };

    const handleMessageReceived = (frame) => {
      messageStore.add(frame);
      setMessagesReceived((c) => c + 1);
      addLog(`← message_received: ${frame.fromUserName}: ${frame.content?.text?.slice(0, 50) || '[non-text]'}`);
    };

    const handleDelivered = (frame) => {
      messageStore.ack(frame.messageId);
      addLog(`← delivered: ${frame.messageId}`);
      const sentAt = sentTimestamps.current.get(frame.messageId);
      if (sentAt) {
        const latency = Date.now() - sentAt;
        setDeliveredLatencies((prev) => [...prev.slice(-99), latency]);
        sentTimestamps.current.delete(frame.messageId);
      }
    };

    const handleReconnect = () => {
      addLog('WebSocket reconnected');
      // Re-join service and fetch missed messages
      if (token) {
        wsClient.send(buildJoinService(token));
        addLog('→ join_service (reconnect)');
        backfillHistory();
      }
    };

    wsClient.on('open', handleOpen);
    wsClient.on('close', handleClose);
    wsClient.on('message', handleMessage);
    wsClient.on('error', handleError);
    wsClient.on('user_joined', handleUserJoined);
    wsClient.on('user_left', handleUserLeft);
    wsClient.on('typing', handleTyping);
    wsClient.on('auth_error', handleAuthError);
    wsClient.on('server_error', handleServerError);
    wsClient.on('message_received', handleMessageReceived);
    wsClient.on('delivered', handleDelivered);
    wsClient.on('reconnect', handleReconnect);

    return () => {
      wsClient.off('open', handleOpen);
      wsClient.off('close', handleClose);
      wsClient.off('message', handleMessage);
      wsClient.off('error', handleError);
      wsClient.off('user_joined', handleUserJoined);
      wsClient.off('user_left', handleUserLeft);
      wsClient.off('typing', handleTyping);
      wsClient.off('auth_error', handleAuthError);
      wsClient.off('server_error', handleServerError);
      wsClient.off('message_received', handleMessageReceived);
      wsClient.off('delivered', handleDelivered);
      wsClient.off('reconnect', handleReconnect);
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
      // Load conversations after connect; online users fetched on user_joined
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
    setCurrentServiceId(null);
    setCurrentConversationId(null);
    conversationStore.clear();
    messageStore.clear();
    presenceStore.clear();
    addLog('Disconnected');
  };

  const handleSimulateDisconnect = () => {
    wsClient.forceClose();
    setConnectionStatus('disconnected');
    addLog('Simulated disconnect (no leave_service sent)');
  };

  const handleTokenChange = (newToken) => {
    setToken(newToken);
    if (authError) setAuthError(null);
  };

  const handleReply = (message) => {
    setReplyTo(message);
    addLog(`Replying to message: ${message.content?.text?.slice(0, 30) || '[attachment]'}`);
  };

  const handleDismissReply = () => {
    setReplyTo(null);
  };

  const showToast = (code, message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, code, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const backfillHistory = async () => {
    if (!currentConversationId) return;
    const msgs = messageStore.getForConversation(currentConversationId);
    const lastMsg = msgs[msgs.length - 1];
    const before = lastMsg ? lastMsg.createdAt : undefined;
    try {
      const history = await fetchHistory(currentConversationId, before);
      for (const msg of history) {
        messageStore.add(msg);
      }
      addLog(`Backfilled ${history.length} missed messages`);
    } catch (err) {
      addLog(`Failed to backfill history: ${err.message}`);
    }
  };

  const handleSendBurst = async () => {
    if (!currentConversationId) return;
    for (let i = 0; i < 20; i++) {
      const envelope = buildTextMessage(currentConversationId, `Burst message ${i + 1}`);
      try {
        wsClient.send(envelope);
        handleSendMessage(envelope);
      } catch (err) {
        addLog(`Burst send failed: ${err.message}`);
        break;
      }
      // Small delay to avoid overwhelming the queue
      await new Promise((r) => setTimeout(r, 50));
    }
    addLog('Sent 20 burst messages');
  };

  const handleMultiDeviceOpen = () => {
    if (!multiDeviceToken.trim()) {
      showToast('info', 'Enter a different JWT token first');
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('token', multiDeviceToken.trim());
    window.open(url.toString(), '_blank');
  };

  const handleExportLogs = () => {
    const ndjson = logs.map((log) => JSON.stringify(log)).join('\n');
    const blob = new Blob([ndjson], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-log-${new Date().toISOString()}.ndjson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('Exported protocol log');
  };

  const handleClearLogs = () => {
    setLogs([]);
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
    sentTimestamps.current.set(envelope.id, Date.now());
    setMessagesSent((c) => c + 1);
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

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.code}`}>
              <strong>{toast.code}</strong>: {toast.message}
            </div>
          ))}
        </div>
      )}

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
          {connectionStatus === 'connected' && (
            <button
              className="simulate-disconnect-btn"
              onClick={handleSimulateDisconnect}
              title="Close socket without sending leave_service"
            >
              Simulate Disconnect
            </button>
          )}
        </section>

        <section className="panel conversations-panel">
          <ConversationList
            onSelect={handleSelectConversation}
            onCreate={handleCreateConversation}
          />
        </section>

        <section className="panel messages-panel">
          <MessageList
            conversationId={currentConversationId}
            onReply={handleReply}
          />
        </section>

        <section className="panel composer-panel">
          <TypingIndicator conversationId={currentConversationId} />
          <Composer
            conversationId={currentConversationId}
            onSend={handleSendMessage}
            replyTo={replyTo}
            onDismissReply={handleDismissReply}
            disabled={composerDisabled}
            error={composerError}
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

          <div className="test-controls">
            <div className="test-control-row">
              <label>Network:</label>
              <select
                value={networkThrottle}
                onChange={(e) => setNetworkThrottle(e.target.value)}
                className="test-select"
              >
                <option value="none">No throttle</option>
                <option value="fast4g">Fast 4G</option>
                <option value="slow3g">Slow 3G</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <button
              className="test-btn"
              onClick={handleSendBurst}
              disabled={!currentConversationId}
              title="Send 20 messages rapidly"
            >
              Send Burst (20)
            </button>
            <div className="test-control-row multi-device">
              <input
                type="text"
                placeholder="Alt JWT for multi-device"
                value={multiDeviceToken}
                onChange={(e) => setMultiDeviceToken(e.target.value)}
                className="test-input"
              />
              <button
                className="test-btn"
                onClick={handleMultiDeviceOpen}
                disabled={!multiDeviceToken.trim()}
                title="Open second tab with different token"
              >
                Open Tab
              </button>
            </div>
          </div>
        </section>

        <section className="panel presence-panel">
          <h2>Presence</h2>
          <PresenceBar serviceId={currentServiceId} />
        </section>

        <section className="panel metrics-panel">
          <h2>Metrics</h2>
          <MetricsDashboard
            connectionStatus={connectionStatus}
            connectTime={connectTime}
            messagesSent={messagesSent}
            messagesReceived={messagesReceived}
            deliveredLatencies={deliveredLatencies}
            voiceChunkLatencies={voiceChunkLatencies}
            queueDepth={queueDepth}
          />
        </section>

        <section className="panel test-scenarios-panel">
          <TestScenarios
            token={token}
            conversationId={currentConversationId}
            onLog={addLog}
            onSetCurrentConversation={(id) => {
              setCurrentConversationId(id);
              conversationStore.setCurrent(id);
            }}
          />
        </section>

        <section className="panel logs-panel">
          <h2>Protocol Log</h2>
          <ProtocolLog
            logs={logs}
            onExport={handleExportLogs}
            onClear={handleClearLogs}
          />
        </section>
      </main>
    </div>
  );
}

export default App;

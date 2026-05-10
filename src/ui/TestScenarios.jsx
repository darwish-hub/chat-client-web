import { useState } from 'react';
import { buildTextMessage, buildTyping, buildFileAttachment } from '../protocol/builders';
import { wsClient } from '../transport/wsClient';
import { createConversation } from '../api/conversations';
import { uploadFile } from '../api/upload';
import { conversationStore } from '../state/conversationStore';
import { messageStore } from '../state/messageStore';

export default function TestScenarios({
  token,
  conversationId,
  onLog,
  onSelectConversation,
  onSetCurrentConversation,
}) {
  const [running, setRunning] = useState(null);

  const runTest = async (name, fn) => {
    setRunning(name);
    onLog?.(`[TEST] Starting: ${name}`);
    try {
      await fn();
      onLog?.(`[TEST] ✅ Passed: ${name}`);
    } catch (err) {
      onLog?.(`[TEST] ❌ Failed: ${name} — ${err.message}`);
    } finally {
      setRunning(null);
    }
  };

  const testTextMessages = async () => {
    if (!token) throw new Error('Not connected');
    let convoId = conversationId;
    if (!convoId) {
      const convo = await createConversation('default-service', 'Auto-test convo', []);
      conversationStore.addOrUpdate(convo);
      convoId = convo.id;
      onSetCurrentConversation?.(convoId);
    }

    const deliveredIds = new Set();
    const waitForDelivered = (messageId, timeout = 5000) =>
      new Promise((resolve, reject) => {
        if (deliveredIds.has(messageId)) return resolve();
        const handler = (frame) => {
          if (frame.messageId === messageId) {
            deliveredIds.add(messageId);
            wsClient.off('delivered', handler);
            resolve();
          }
        };
        wsClient.on('delivered', handler);
        setTimeout(() => {
          wsClient.off('delivered', handler);
          reject(new Error('Timeout waiting for delivered'));
        }, timeout);
      });

    for (let i = 0; i < 5; i++) {
      const envelope = buildTextMessage(convoId, 'default-service', `Test message ${i + 1}`);
      wsClient.send(envelope);
      await waitForDelivered(envelope.id);
    }
  };

  const testVoiceStream = async () => {
    if (!token) throw new Error('Not connected');
    let convoId = conversationId;
    if (!convoId) {
      const convo = await createConversation('default-service', 'Auto-test voice', []);
      conversationStore.addOrUpdate(convo);
      convoId = convo.id;
      onSetCurrentConversation?.(convoId);
    }

    // Simulate voice by sending a few mock voice chunks
    const messageId = crypto.randomUUID();
    for (let i = 0; i < 3; i++) {
      const chunk = new Uint8Array(100).fill(i);
      const header = {
        type: 'voice_chunk',
        id: messageId,
        conversationId: convoId,
        sequenceNumber: i,
        isFinal: i === 2,
      };
      await wsClient.send(header);
      await wsClient.sendBinary(chunk.buffer);
      await new Promise((r) => setTimeout(r, 200));
    }

    // Wait for message_received
    await new Promise((resolve, reject) => {
      const handler = (frame) => {
        if (frame.type === 'message_received' && frame.id === messageId) {
          wsClient.off('message_received', handler);
          resolve();
        }
      };
      wsClient.on('message_received', handler);
      setTimeout(() => {
        wsClient.off('message_received', handler);
        reject(new Error('Timeout waiting for voice message_received'));
      }, 5000);
    });
  };

  const testFileUpload = async () => {
    if (!token) throw new Error('Not connected');
    let convoId = conversationId;
    if (!convoId) {
      const convo = await createConversation('default-service', 'Auto-test file', []);
      conversationStore.addOrUpdate(convo);
      convoId = convo.id;
      onSetCurrentConversation?.(convoId);
    }

    // Generate a 1MB blob
    const blob = new Blob([new Uint8Array(1024 * 1024).fill(0xAB)]);
    const file = new File([blob], 'test-file.bin', { type: 'application/octet-stream' });

    const result = await uploadFile(file, (pct) => {
      onLog?.(`[TEST] Upload progress: ${pct}%`);
    });

    // Send file attachment message
    const envelope = buildFileAttachment(
      convoId,
      result.blobId,
      result.fileName,
      result.mimeType,
      result.sizeBytes
    );
    await wsClient.send(envelope);

    // Wait for message_received
    await new Promise((resolve, reject) => {
      const handler = (frame) => {
        if (frame.type === 'message_received' && frame.content?.blobId === result.blobId) {
          wsClient.off('message_received', handler);
          resolve();
        }
      };
      wsClient.on('message_received', handler);
      setTimeout(() => {
        wsClient.off('message_received', handler);
        reject(new Error('Timeout waiting for file message_received'));
      }, 5000);
    });
  };

  const testPresence = async () => {
    if (!token) throw new Error('Not connected');

    // Wait for user_joined (our own join)
    await new Promise((resolve, reject) => {
      const handler = () => {
        wsClient.off('user_joined', handler);
        resolve();
      };
      wsClient.on('user_joined', handler);
      setTimeout(() => {
        wsClient.off('user_joined', handler);
        reject(new Error('Timeout waiting for user_joined'));
      }, 5000);
    });

    // Emit typing
    const convoId = conversationId || 'test-convo';
    wsClient.send(buildTyping(convoId, true));
    await new Promise((r) => setTimeout(r, 500));
    wsClient.send(buildTyping(convoId, false));

    onLog?.('[TEST] Presence test completed (typing emitted)');
  };

  const scenarios = [
    { id: 'text', label: 'Run Text Message Test', fn: testTextMessages },
    { id: 'voice', label: 'Run Voice Stream Test', fn: testVoiceStream },
    { id: 'file', label: 'Run File Upload Test', fn: testFileUpload },
    { id: 'presence', label: 'Run Presence Test', fn: testPresence },
  ];

  return (
    <div className="test-scenarios">
      <h3>Test Scenarios</h3>
      <div className="scenario-buttons">
        {scenarios.map((s) => (
          <button
            key={s.id}
            className="scenario-btn"
            onClick={() => runTest(s.label, s.fn)}
            disabled={running !== null}
          >
            {running === s.label ? '⏳ Running...' : s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

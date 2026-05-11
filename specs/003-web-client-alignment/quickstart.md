# Quickstart: ChatHub Web Test Client (Aligned)

**Date**: 2026-05-11
**Purpose**: Get the realigned test client running locally and connected to a ChatHub server.

---

## Prerequisites

- Node.js 18+ and npm
- A modern web browser (Chrome 120+, Firefox 120+, Edge 120+, Safari 17+)
- A running ChatHub server at `http://localhost:8080` and `ws://localhost:8080/ws`
- A valid JWT token (see "Generating a Test Token" below)

> **Note**: The server must be running on port **8080** (not 5068). The previous spec incorrectly used port 5068.

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Start the Development Server

```bash
npm start
```

Open `http://localhost:3000` in your browser.

---

## Step 3: Generate a Test JWT Token

The client does not implement authentication. You must provide a valid JWT token.

If your ChatHub server includes a test-token endpoint:

```bash
curl -X POST http://localhost:8080/api/auth/test-token \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-1", "displayName": "Alice"}'
```

Copy the returned `token` value.

If no endpoint is available, generate a token using your server's signing secret. The token payload must include:

```json
{
  "sub": "user-uuid",
  "name": "Display Name",
  "iat": 1234567890,
  "exp": 9999999999
}
```

> **Changed**: The server uses `displayName` (not `userName`) in the protocol. Token generation should use `name` or `displayName` claims.

---

## Step 4: Connect

1. Open the client in your browser.
2. Paste the JWT token into the **Auth Panel** input field.
3. Click **Connect**.
4. Observe the connection status indicator turning green.
5. Check the **Protocol Log** for `user_joined` confirmation — the event now contains `displayName` (not `userName`).

---

## Step 5: Validate Alignment Fixes

### Text Messaging
1. Join or create a conversation.
2. Type a message in the composer and click **Send**.
3. Verify the message appears with `senderId` (not `fromUserId`) and flat `text` field (not `content.text`).
4. Check the Protocol Log to confirm the `text_message` frame uses the flat `text` field.

### REST API
1. Create a conversation via **New Conversation**.
2. Verify the response is parsed correctly (singular `/api/conversation` path, wrapped response shapes).
3. Fetch message history and confirm it unwraps `{conversationId, messages, hasMore}`.
4. Fetch online users and confirm it unwraps `{serviceId, onlineUsers: [{userId, displayName, lastSeen}]}`.

### File Upload
1. Drop a file under 100MB into the upload zone.
2. Verify it sends to `POST /api/upload/file` (not the old port).
3. Confirm the download URL uses `/api/upload/download/{blobId}` (not `/api/download/{blobId}`).

### Voice Streaming
1. Hold **Push to Talk** and speak.
2. Verify `voice_chunk` frames use `id` (not `messageId`).
3. In a second browser tab, verify incoming audio plays within 500ms.
4. Confirm `voice_chunk` text frames from the server include `fromUserId`.

### Error Handling
1. Trigger `service_not_found` by joining a nonexistent service.
2. Verify a toast appears and UI returns to the service selector.
3. Trigger `invalid_reply` by replying to a deleted message.
4. Verify the reply preview is dismissed and a toast shows the error.

---

## Key Changes from Previous Version

| Area | Old (002) | New (Aligned) |
|------|-----------|----------------|
| WS/REST port | 5068 | 8080 |
| Conversation paths | `/api/conversations/` (plural) | `/api/conversation/` (singular) |
| Download path | `/api/download/{blobId}` | `/api/upload/download/{blobId}` |
| Upload response status | 201 | 200 |
| Health endpoints | `/health`, `/health/ready` | `/healthz`, `/readyz` |
| Message `text` field | Nested in `content: {text}` | Flat top-level `text` |
| Message sender | `fromUserId`, `fromUserName` | `senderId`, lookup `displayName` from presence |
| `message_received` | Flat fields | Unwrapped from `envelope` sub-object |
| `user_joined` name | `userName` | `displayName` |
| `delivered` fields | `{messageId, conversationId, deliveredAt}` | `{messageId}` only |
| `voice_chunk` ID field | `messageId` | `id` |
| History response | Plain array | `{conversationId, messages, hasMore}` |
| Thread response | Plain array | `{originalMessage, replies}` |
| Presence response | Plain array | `{serviceId, onlineUsers: [...]}` |
| Online user fields | `{userId, userName, status}` | `{userId, displayName, lastSeen}` |
| Typing debounce | 3000ms | 300ms |
| Heartbeat start | After first PING | At connection time |
| File upload limit | None | 100MB client-side validation |
| Voice chunk size | None | < 64KB validation |
| `validateServerFrame()` | Defined but never called | Called on every inbound frame |
| Error handling | 3 codes | 9+ codes with specific UI actions |
| Token refresh | None | Silent refresh with login fallback |
| `fileAttachmentStore` | Never created | Tracked in state layer |

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Connection failed" immediately | Server not running | Start the ChatHub server |
| 404 on conversation/list endpoints | Wrong REST path | Ensure using singular `/api/conversation/` |
| `user_joined` shows `undefined` name | Parser not unwrapping `displayName` | Check `parsers.js` maps `displayName` correctly |
| Messages show `[object Object]` | `content.text` used instead of flat `text` | Check `MessageList.jsx` uses `msg.text` |
| Voice not streaming | No inbound `voice_chunk` handler | Check `wsClient.js` routes `voice_chunk` frames |
| File upload returns 404 | Wrong port or path | Verify `config.js` uses port 8080 and `/api/upload/file` |
| Typing indicator too slow | Debounce too long | Verify `Composer.jsx` uses 300ms, not 3000ms |
| Missing heartbeat detection | Heartbeat not started at connection time | Verify `heartbeat.start()` called in `onopen` |

---

## Environment Configuration

Edit `src/config.js` to change defaults:

```javascript
export const API_BASE = 'http://localhost:8080';
export const WS_URL = 'ws://localhost:8080/ws';
export const MAX_TEXT_LENGTH = 2000;
export const MAX_UPLOAD_BYTES = 104_857_600; // 100MB
export const MAX_VOICE_CHUNK_BYTES = 65536; // 64KB
export const TYPING_DEBOUNCE_MS = 300;
export const PING_INTERVAL_MS = 15000;
export const RECONNECT_DELAY_MS = 1000;
export const MAX_RECONNECT_DELAY_MS = 30000;
export const HEARTBEAT_TIMEOUT_MS = 30000;
```

The development server hot-reloads on changes.
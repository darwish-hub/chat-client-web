# Quickstart: ChatHub Web Test Client

**Date**: 2026-05-10
**Purpose**: Get the test client running locally and connected to a ChatHub server.

---

## Prerequisites

- Node.js 18+ and npm
- A modern web browser (Chrome 120+, Firefox 120+, Edge 120+, Safari 17+)
- A running ChatHub server at `http://localhost:8080` and `ws://localhost:8080/ws`
- A valid JWT token (see "Generating a Test Token" below)

---

## Step 1: Install Dependencies

```bash
cd client
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
  -d '{"userId": "test-user-1", "userName": "Alice"}'
```

Copy the returned `token` value.

If no endpoint is available, generate a token using your server's signing secret and a JWT library. The token payload must include at minimum:

```json
{
  "sub": "user-uuid",
  "name": "Display Name",
  "iat": 1234567890,
  "exp": 9999999999
}
```

---

## Step 4: Connect

1. Open the client in your browser.
2. Paste the JWT token into the **Auth Panel** input field.
3. Click **Connect**.
4. Observe the connection status indicator turning green.
5. Check the **Logs Panel** for `user_joined` confirmation.

---

## Step 5: Run a Quick Validation

### Text Messaging
1. Join or create a conversation.
2. Type a message in the composer and click **Send**.
3. Verify the message appears in the message list with a delivery checkmark.

### Presence
1. Open a second browser tab (or a different browser) with a different JWT token.
2. Join the same service.
3. Verify both users appear in the **Presence Bar**.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Connection failed" immediately | Server not running | Start the ChatHub server (`docker-compose up` or equivalent) |
| "Invalid token" | JWT expired or malformed | Generate a fresh token |
| No `user_joined` after connect | Token accepted but join_service failed | Check server logs for auth errors |
| Messages not appearing | Not joined to the conversation | Create or join a conversation first |
| Voice not streaming | Microphone permission denied | Click the lock icon in the browser address bar and allow microphone |
| File upload fails with 413 | File exceeds 100MB limit | Use a smaller test file |

---

## Running Test Scenarios

Once the client is fully implemented (Phase 8), use the **Test Scenarios** panel to run automated validation:

1. Click **Run Text Message Test** — auto-creates a conversation, sends 5 messages, and verifies delivery.
2. Click **Run Voice Stream Test** — auto-records 3 seconds of silence, sends chunks, and verifies the final message.
3. Click **Run File Upload Test** — generates a 1MB Blob, uploads, shares, and verifies `message_received`.
4. Click **Run Presence Test** — joins a service, waits for `user_joined`, emits typing, and verifies the indicator.

---

## Environment Configuration

Edit `src/config.js` to change defaults:

```javascript
export const API_BASE = 'http://localhost:8080';
export const WS_URL = 'ws://localhost:8080/ws';
export const MAX_TEXT_LENGTH = 2000;
export const PING_INTERVAL_MS = 15000;
export const RECONNECT_DELAY_MS = 1000;
```

The development server hot-reloads on changes.

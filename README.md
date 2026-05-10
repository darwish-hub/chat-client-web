# ChatHub Web Test Client

A browser-based test client for the ChatHub real-time chat service. Built with React 18 and Vite.

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- A running ChatHub server at `ws://localhost:8080/ws` and `http://localhost:8080`
- A valid JWT token for authentication

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Generating a Test JWT

The client requires a JWT token to authenticate. The token should include at minimum:
- `sub` (user ID)
- `name` (display name)

You can generate a test JWT using any JWT tool or the server’s auth endpoint if available.

Example payload:
```json
{
  "sub": "user-123",
  "name": "Test User"
}
```

## Panels

### Auth Panel
- Paste your JWT token
- Click **Connect** to establish WebSocket connection
- Click **Simulate Disconnect** to test server-side timeout detection

### Conversations Panel
- Lists all conversations you participate in
- Click to switch conversations
- Click **New Conversation** to create a test conversation

### Messages Panel
- Displays messages in chronological order
- Shows delivery checkmarks
- **Reply** button on each message
- **View Thread** button for messages with replies
- Supports text, voice, video, and file messages

### Composer Panel
- Type and send text messages
- **Attach file** button for file uploads
- Reply preview when replying to a message
- Typing indicator dots

### Voice Recorder
- Hold **Push to Talk** to record
- Toggle live streaming
- Simulate packet loss (5%) for testing

### Presence Panel
- Shows online users in current service
- Green dot = online, grey = offline

### Metrics Dashboard
- Connection uptime
- Messages sent / received
- Average message latency
- Send queue depth
- Voice chunk latency histogram

### Test Scenarios
One-click automated tests:
- **Run Text Message Test** — creates convo, sends 5 messages, verifies `delivered`
- **Run Voice Stream Test** — sends voice chunks, verifies final message
- **Run File Upload Test** — uploads 1MB blob, shares, verifies `message_received`
- **Run Presence Test** — verifies `user_joined` and typing indicators

### Protocol Log
- Raw JSON of every sent/received frame
- Expandable pretty-print
- Filterable
- **Export** button downloads as `.ndjson`

## Test Controls

- **Network throttle** — simulate Fast 4G, Slow 3G, or Offline
- **Send Burst (20)** — rapidly send 20 messages to test rate limiting
- **Multi-device** — open a second tab with a different JWT token

## Manual Test Scenarios

1. **Connection**: Paste JWT, connect, verify `user_joined` appears in logs
2. **Text Messaging**: Create conversation, send messages, verify delivery checkmarks
3. **Voice Streaming**: Hold Push to Talk, speak, verify remote user hears chunks
4. **File Upload**: Drop a file, verify progress bar, verify message appears
5. **Presence**: Open second tab, verify both users appear online
6. **Typing**: Type in one tab, verify typing indicator in other
7. **Replies**: Click Reply, send reply, verify thread view
8. **Reconnection**: Simulate disconnect, verify auto-reconnect and backfill
9. **Rate Limiting**: Send burst, verify composer disabled for 5s

## Architecture

```
src/
  protocol/     — Wire format builders and parsers
  transport/    — WebSocket client, heartbeat, send queue
  api/          — REST wrappers (conversations, history, upload, presence)
  state/        — In-memory stores (messages, conversations, presence)
  ui/           — React components
  media/        — Audio capture, playback, video preview
```

## Building for Production

```bash
npm run build
```

Static files are output to `dist/`. Serve with any static file server.

## Notes

- This is a **test client**, not a production consumer app
- No client-side persistence — all history comes from the server
- Works best in Chrome 120+, Firefox 120+, Edge 120+, Safari 17+

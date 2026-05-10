# Implementation Plan: ChatHub Web Test Client

**Branch**: `002-web-test-client` | **Date**: 2026-05-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-web-test-client/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build a standalone web test client that exercises every feature of the ChatHub real-time chat service. The client is a browser-based single-page application (SPA) built with React 18+ that connects via native WebSockets, renders a multi-user chat UI, and provides manual controls to test text messaging, live voice streaming, file/video uploads, presence indicators, typing indicators, message replies, reconnection recovery, and error handling.

This client is **not** a production consumer app — it is a testing and validation tool for developers and QA to verify that the server implementation satisfies all functional requirements and success criteria defined in the server spec.

## Technical Context

**Language/Version**: ES2022+ JavaScript / JSX; React 18+ with a build step
**Primary Dependencies**: React and related ecosystem packages (e.g., react, react-dom, build tools). Avoid unnecessary UI abstraction libraries.
**Storage**: `localStorage` for JWT token and last connection settings; in-memory `Map` for message/conversation state
**Testing**: React Testing Library for component tests; manual browser-based validation for integration testing
**Target Platform**: Modern web browsers (Chrome 120+, Firefox 120+, Edge 120+, Safari 17+)
**Project Type**: React single-page application (SPA); served by a static file server or development server
**Performance Goals** (client-side):
- First paint < 1 second
- Voice capture-to-send latency < 200ms (client contribution)
- Smooth message list rendering for 1,000+ messages
**Constraints**:
- No SignalR — native `WebSocket` only, matching the server protocol exactly
- No external CDN dependencies for core functionality (optional: simple CSS reset from CDN)
- Must work against `ws://localhost:8080/ws` out of the box
**Scale/Scope**: Single-tester client; multi-tab support for simulating multiple users

---

## Constitution Check

*GATE: Must pass before client implementation begins.*

### Principle I: WebSocket-First Real-time Communication ✅
- **Status**: COMPLIANT
- **Implementation**: Direct `new WebSocket(url)` with custom JSON wire format per `contracts/websocket-protocol.md`
- **No SignalR**: Handshake, heartbeat, binary frames, and reconnection are all handled manually to mirror the server's native WebSocket behavior

### Principle II: MongoDB Source of Truth (Client-Side History Recovery) ✅
- **Status**: COMPLIANT
- **Implementation**: On reconnect, client fetches missed messages via `GET /api/conversations/{id}/messages?before=...` before resuming real-time streaming
- **No client-side persistence of messages**: All durable history comes from the server

### Principle III: NATS Core for Cross-Pod Fan-out (Transparent to Client) ✅
- **Status**: COMPLIANT
- **Implementation**: Client has no knowledge of NATS; it simply sends/receives WebSocket frames as defined by the wire protocol

### Principle IV: Layered Client Architecture ✅
- **Status**: COMPLIANT
- **Implementation**:
  - `protocol/` — Wire format serialization, message builders, frame parsers
  - `transport/` — WebSocket connection manager, heartbeat handler, reconnection logic
  - `api/` — REST `fetch()` wrappers for upload, download, history
  - `ui/` — React components, hooks, and JSX markup; DOM rendering and event handlers
  - `state/` — In-memory stores for conversations, messages, presence, voice sessions

### Principle V: Background Services for I/O Offloading ✅
- **Status**: COMPLIANT
- **Implementation**: WebSocket send loop uses a `MessageChannel` (or simple async queue) to serialize sends; MediaRecorder data available events are batched and sent via the queue

---

## Project Structure

### Documentation (this feature)

```text
specs/002-web-test-client/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── websocket-protocol.md
│   └── rest-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
client/
├── public/
│   └── index.html               # SPA shell
├── src/
│   ├── index.js                 # React root render
│   ├── App.js                   # Main app component with panel layout
│   ├── config.js                # API base URL, WebSocket endpoint, rate limit defaults
│   ├── protocol/
│   │   ├── messageTypes.js      # Constants for all client→server and server→client types
│   │   ├── builders.js          # Factory functions for every outbound message envelope
│   │   └── parsers.js           # Inbound frame parser (text + binary voice chunks)
│   ├── transport/
│   │   ├── wsClient.js          # WebSocket lifecycle: connect, send, receive, close, reconnect
│   │   ├── heartbeat.js         # Ping/pong logic with timeout detection
│   │   └── sendQueue.js         # Per-connection serialized send queue (prevents concurrent sends)
│   ├── api/
│   │   ├── upload.js            # POST /api/upload/file + progress tracking
│   │   ├── download.js          # GET /api/download/{blobId}
│   │   ├── history.js           # GET /api/conversations/{id}/messages?before=&limit=
│   │   ├── conversations.js     # POST /api/conversations + GET list helpers
│   │   └── presence.js          # GET /api/services/{serviceId}/online
│   ├── state/
│   │   ├── conversationStore.js
│   │   ├── messageStore.js
│   │   ├── presenceStore.js
│   │   └── voiceSessionStore.js # Tracks live voice chunk sequences
│   ├── ui/
│   │   ├── AuthPanel.jsx        # JWT token input, connect button, connection status
│   │   ├── ConversationList.jsx
│   │   ├── MessageList.jsx      # Scrollable list with reply threading UI
│   │   ├── Composer.jsx         # Text input, send, reply-to selector
│   │   ├── VoiceRecorder.jsx    # Record/start/stop + live stream toggle
│   │   ├── FileUploader.jsx     # Drag-and-drop + file picker for attachments
│   │   ├── PresenceBar.jsx      # Online users, typing dots
│   │   └── Notifications.jsx    # Toast/error overlay for server errors
│   ├── media/
│   │   ├── audioCapture.js      # getUserMedia + MediaRecorder wrapper
│   │   ├── audioPlayer.js       # Sequence-ordered voice chunk playback
│   │   └── videoPreview.js      # <video> preview for uploaded/shared videos
│   └── hooks/
│       ├── useWebSocket.js      # React hook for WebSocket lifecycle
│       ├── useVoiceRecorder.js  # React hook for voice recording state
│       └── usePresence.js       # React hook for presence state
├── package.json
└── README.md                    # How to serve the client and run manual test scenarios
```

**Structure Decision**: Single React SPA with layered architecture. The `client/` directory contains all source code. Layers are strictly ordered: `protocol/` (lowest) → `transport/` → `api/` → `state/` → `ui/` (highest). No circular dependencies permitted.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Live voice streaming requires binary WebSocket frames + sequence-ordered playback | Server protocol demands it for walkie-talkie latency | Pre-recorded-only voice would not test FR-005/SC-003 |
| MediaRecorder API with `audio/webm` or `audio/ogg` codec negotiation | Must produce chunks the server can accept; client must test the binary frame path | Simple `<input type="file">` for voice would skip the streaming path entirely |

---

## Phase Breakdown

### Phase 1: Skeleton & Connection (Foundation)

**Goal**: Display a page, connect a WebSocket, authenticate, and stay alive with heartbeat.

- [ ] **C01** Create React project with Vite: `npm create vite@latest client -- --template react`
- [ ] **C02** Create `public/index.html` with semantic root `<div id="root">`
- [ ] **C03** Create `src/index.js` — React root render with `<App />`
- [ ] **C04** Create `src/App.js` — flex/grid layout with panels: Auth, Conversations, Messages, Composer, Presence, Logs
- [ ] **C05** Create `src/config.js` with `API_BASE`, `WS_URL`, `MAX_TEXT_LENGTH`, `PING_INTERVAL_MS`, `RECONNECT_DELAY_MS`
- [ ] **C06** Create `src/protocol/messageTypes.js` — export string constants for every `type` value in the wire protocol
- [ ] **C07** Create `src/protocol/builders.js` — factory functions: `buildJoinService()`, `buildTextMessage()`, `buildVoiceChunk()`, `buildTyping()`, `buildAck()`, `buildPong()`
- [ ] **C08** Create `src/transport/wsClient.js` — `connect(token)`, `send(json)`, `sendBinary(data)`, `close()`, `onMessage(callback)`, `onClose(callback)`
- [ ] **C09** Create `src/transport/heartbeat.js` — on `ping`, reply with `pong`; if no ping for `PING_INTERVAL_MS * 2`, flag connection suspicious
- [ ] **C10** Create `src/transport/sendQueue.js` — serialize all sends through a queue so `ws.send()` is never called concurrently
- [ ] **C11** Create `src/ui/AuthPanel.jsx` — input for JWT, connect/disconnect buttons, connection status indicator (connected / disconnected / reconnecting)
- [ ] **C12** Wire `src/App.js` bootstrap: read token from `localStorage`, attempt auto-connect, render auth state

**Independent Test**:
Open `http://localhost:3000` in browser, paste a JWT, click Connect. The Logs panel shows `user_joined` after `join_service`. A `ping` arrives every 15s and client responds `pong`. Disconnecting shows clean close.

---

### Phase 2: Text Messaging (MVP)

**Goal**: Send and receive text messages with delivery confirmation; display message history.

- [ ] **C13** Create `src/state/conversationStore.js` — `addOrUpdate(conversation)`, `get(id)`, `list()`, `setCurrent(id)`
- [ ] **C14** Create `src/state/messageStore.js` — `add(envelope)`, `getForConversation(conversationId)`, `ack(messageId)`, `findById(id)`
- [ ] **C15** Create `src/ui/ConversationList.jsx` — render store entries, highlight current, click to switch
- [ ] **C16** Create `src/ui/MessageList.jsx` — render messages chronologically, auto-scroll to bottom, show sender name, timestamp, delivery checkmark on `delivered`
- [ ] **C17** Create `src/ui/Composer.jsx` — textarea with `MAX_TEXT_LENGTH` counter, Send button emits `text_message` envelope with client-generated UUID
- [ ] **C18** Handle `message_received` in `wsClient.js` — route to `messageStore.add()`, re-render message list
- [ ] **C19** Handle `delivered` in `wsClient.js` — update message store, render delivery checkmark
- [ ] **C20** Create `src/api/conversations.js` — `createConversation(serviceId, title, participantIds)` and `listMyConversations()`
- [ ] **C21** Create `src/api/history.js` — `fetchHistory(conversationId, before, limit)`; call on conversation switch to backfill messages
- [ ] **C22** Add "New Conversation" button in UI to test creation flow end-to-end

**Independent Test**:
User A connects, creates a conversation, sends "Hello". User B connects, joins same service, sees conversation, sends "Hi". Both see each other's messages with sender names and delivery checkmarks. Scroll up triggers history fetch.

---

### Phase 3: Live Voice Streaming (P1)

**Goal**: Record microphone audio, stream chunks in real-time, play incoming live streams, and assemble final messages.

- [ ] **C23** Create `src/media/audioCapture.js` — `requestMic()`, `startRecording(onChunk)`, `stopRecording()` using `MediaRecorder` with `timeslice: 200` (200ms chunks)
- [ ] **C24** Create `src/state/voiceSessionStore.js` — track active outbound `messageId`, `sequenceNumber`, `conversationId`; track inbound sessions by `(messageId, fromUserId)` with chunk buffers
- [ ] **C25** Update `src/protocol/builders.js` — `buildVoiceChunkStart(messageId, conversationId, sequenceNumber, isFinal)`
- [ ] **C26** Update `src/transport/wsClient.js` — send binary frames: first a text `voice_chunk` envelope, then immediately a binary `ArrayBuffer` with the audio payload
- [ ] **C27** Create `src/media/audioPlayer.js` — `enqueueChunk(messageId, sequenceNumber, arrayBuffer)`, sort by sequence, decode via `AudioContext`, schedule playback with `AudioBufferSourceNode` to eliminate gaps
- [ ] **C28** Handle inbound `voice_chunk` (text envelope + binary frame) in parser: route to `audioPlayer.enqueueChunk()` if live, or store if not yet playing
- [ ] **C29** Create `src/ui/VoiceRecorder.jsx` — large "Push to Talk" button (hold to record, release to stop), visual recording indicator, live stream toggle checkbox, display elapsed seconds
- [ ] **C30** On `isFinal: true`, show a playable `<audio>` element in the message list pointing to the assembled message (or placeholder until server assembles)
- [ ] **C31** Add UI toggle: "Simulate packet loss" — randomly drop 1 in 20 outbound chunks to test server/client gap recovery (visual warning, not real protocol change)

**Independent Test**:
User A holds Push to Talk, speaks for 5 seconds, releases. User B (in same conversation) hears audio chunks within 500ms of User A speaking. When User A releases, a completed voice message appears in both histories with replay button.

---

### Phase 4: Pre-recorded Voice, Video & File Attachments (P2)

**Goal**: Upload files, videos, and pre-recorded voice files via REST; share via WebSocket; preview/download received attachments.

- [ ] **C32** Create `src/api/upload.js` — `uploadFile(file, onProgress)` using `FormData` + `XMLHttpRequest` (for progress) or `fetch` with `ReadableStream` tracking; returns `{ blobId, url }`
- [ ] **C33** Update `src/protocol/builders.js` — `buildFileAttachment(messageId, conversationId, blobId, fileName, mimeType, sizeBytes, durationMs?)`
- [ ] **C34** Create `src/ui/FileUploader.jsx` — drag-and-drop zone + `<input type="file">`, file type icon preview, upload progress bar, cancel button
- [ ] **C35** Update `src/ui/Composer.jsx` — attach button opens file picker; on upload completion, auto-sends `file_attachment` message
- [ ] **C36** Handle `message_received` with `type: "voice" | "video" | "file"` in message list: render media card with file name, size, MIME icon, download link
- [ ] **C37** Create `src/api/download.js` — `download(blobId)` opens `GET /api/download/{blobId}` in new tab or uses `fetch` + `URL.createObjectURL` for in-app download
- [ ] **C38** Create `src/media/videoPreview.js` — for `type: "video"`, render `<video controls src="...">` using the download URL (or pre-signed URL if available)
- [ ] **C39** Add "Upload from URL" test helper (paste a public URL, client fetches it and uploads) — useful for CI/automated testing

**Independent Test**:
User A drops a 5MB MP4 into the drop zone. Progress bar fills. On completion, a video message appears in the conversation. User B sees the video card, clicks play, video streams. User A also uploads a PDF; User B clicks download and receives the file.

---

### Phase 5: Presence & Typing Indicators (P2)

**Goal**: Display online users and real-time typing dots.

- [ ] **C40** Create `src/state/presenceStore.js` — `setOnline(serviceId, user)`, `setOffline(serviceId, userId)`, `getOnline(serviceId)`, `setTyping(conversationId, userId, isTyping)`
- [ ] **C41** Create `src/ui/PresenceBar.jsx` — render avatars/names of online users in current service; show green dot for online, grey for offline
- [ ] **C42** Handle `user_joined` / `user_left` in `wsClient.js` — update presence store, re-render presence bar
- [ ] **C43** Create `src/ui/TypingIndicator.jsx` — when `typing` event received with `isTyping: true`, show "Alice is typing..." dots above composer; clear after 5s of no refresh or on `isTyping: false`
- [ ] **C44** Add debounced typing emit in `src/ui/Composer.jsx` — on keydown, emit `typing: true`; 3s after last keystroke, emit `typing: false`
- [ ] **C45** Create `src/api/presence.js` — `fetchOnlineUsers(serviceId)` for initial load when joining a service
- [ ] **C46** Add "Simulate disconnect" button — forces `ws.close()` without sending `leave_service` to test server-side timeout detection

**Independent Test**:
User A connects and joins service S. User B connects and joins S. Both see each other in the presence bar. User A starts typing; User B sees "User A is typing..." within 500ms. User A stops; indicator clears within 5s. User A clicks Simulate Disconnect; after ~2 minutes, User B sees User A as offline.

---

### Phase 6: Message Replies & Threading (P3)

**Goal**: Reply to any message; view reply context; navigate to original message.

- [ ] **C47** Update `src/ui/MessageList.jsx` — add "Reply" action button on hover/focus of each message bubble
- [ ] **C48** Update `src/ui/Composer.jsx` — when replying, show a compact preview of the original message above the textarea with a dismiss button; include `replyToId` in outbound envelope
- [ ] **C49** Update `src/protocol/builders.js` — all builders accept optional `replyToId`
- [ ] **C50** Update `src/ui/MessageList.jsx` — render reply messages with a visual thread line connecting to the original; clicking the reply scrolls to and highlights the original message
- [ ] **C51** Create `src/api/history.js` — `fetchThread(conversationId, messageId)` calling `GET /api/conversations/{conversationId}/messages/{messageId}/replies`; add "View Thread" button on messages with replies
- [ ] **C52** Add reply support for voice and file messages — reply to a voice memo with a text message, reply to a file with another file, etc.

**Independent Test**:
User A sends "Meeting at 3?". User B clicks Reply, types "Works for me", sends. User A sees the reply visually linked to the original. User C opens the conversation, clicks "View Thread" on the original, sees only the reply chain.

---

### Phase 7: Reconnection, Errors & Edge Cases (Cross-Cutting)

**Goal**: Gracefully handle network interruptions, rate limits, auth failures, and message ordering.

- [ ] **C53** Update `src/transport/wsClient.js` — automatic reconnect with exponential backoff (`1s, 2s, 4s, 8s, max 30s`); on reconnect, re-send `join_service` for the current service
- [ ] **C54** On reconnect, call `fetchHistory(conversationId, lastKnownMessageTimestamp)` for every open conversation to backfill missed messages
- [ ] **C55** Handle `error` messages from server — display toast with `code` and `message`; specific handling for `rate_limit_exceeded` (disable send button for 5s), `not_participant` (redirect to conversation list), `invalid_message` (highlight composer in red)
- [ ] **C56** Add duplicate detection in `src/state/messageStore.js` — ignore `message_received` envelopes with already-known `id`
- [ ] **C57** Add local message ordering guard — if a message arrives with `createdAt` older than the last visible message, insert it in the correct chronological position rather than appending
- [ ] **C58** Add network throttle simulation — dropdown to select "Fast 4G", "Slow 3G", "Offline" using Chrome DevTools Protocol or manual delay injection for testing
- [ ] **C59** Add "Send burst" test button — sends 20 text messages rapidly to test rate limiting UI feedback (should show toasts and temporarily disable input)
- [ ] **C60** Add "Multi-device" simulation — allow opening a second WebSocket connection in the same tab (or instructions to open a second tab) with a different user token to test multi-device presence

**Independent Test**:
User A sends 20 messages rapidly. After message 101 in a minute, UI shows rate-limit toast and composer is disabled for 5s. User A disables WiFi for 10s, then re-enables. Client auto-reconnects, fetches missed messages, and appends them in correct order without duplicates.

---

### Phase 8: Logging, Metrics & Manual Test Scenarios (Polish)

**Goal**: Provide a developer/QA console to observe protocol internals and run repeatable test scripts.

- [ ] **C61** Add "Protocol Log" panel — raw JSON of every sent/received frame with timestamp, direction arrow, expandable pretty-print
- [ ] **C62** Add "Metrics Dashboard" mini-panel — connection uptime, messages sent/received, average latency (time between send and `delivered`), voice chunk latency histogram, current send queue depth
- [ ] **C63** Add "Test Scenarios" section with one-click buttons:
  - "Run Text Message Test" — auto-creates convo, sends 5 messages, verifies `delivered`
  - "Run Voice Stream Test" — auto-records 3s silence, sends chunks, verifies final message
  - "Run File Upload Test" — generates a 1MB Blob, uploads, shares, verifies `message_received`
  - "Run Presence Test" — joins service, waits for `user_joined`, emits typing, verifies indicator
- [ ] **C64** Add export button — download protocol log as `.ndjson` for post-mortem analysis
- [ ] **C65** Add `README.md` with: prerequisites, `npm start` instructions, how to generate a test JWT, screenshot of each panel, description of every test scenario
- [ ] **C66** Validate all manual tests against a running local server (`docker-compose up`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Skeleton & Connection)**: No dependencies; can be built against a mock or the real server
- **Phase 2 (Text Messaging)**: Depends on Phase 1
- **Phase 3 (Live Voice)**: Depends on Phase 1; can proceed in parallel with Phase 2 if staffed separately
- **Phase 4 (Files/Video)**: Depends on Phase 2 (needs message list to render attachments); can proceed in parallel with Phase 3
- **Phase 5 (Presence)**: Depends on Phase 1; can proceed in parallel with Phases 2–4
- **Phase 6 (Replies)**: Depends on Phase 2
- **Phase 7 (Reconnection/Errors)**: Depends on all previous phases
- **Phase 8 (Polish)**: Depends on all previous phases

### Recommended Implementation Order for a Single Developer

1. Phase 1 → Phase 2 → stop and validate MVP text chat
2. Phase 5 → validate presence/typing alongside text chat
3. Phase 3 → validate live voice
4. Phase 4 → validate files and video
5. Phase 6 → validate replies
6. Phase 7 → validate resilience
7. Phase 8 → polish and document

---

## Parallel Example: Phase 2 + Phase 5

```bash
# Two developers can work in parallel once Phase 1 is done:

Task: "Implement messageStore, MessageList, Composer, and history fetching (Phase 2)"
Task: "Implement presenceStore, PresenceBar, TypingIndicator, and debounced typing emit (Phase 5)"
```

Both only depend on `wsClient.js` from Phase 1 and can be integrated independently.

---

## Client-to-Server Feature Mapping

| Server Feature | Client Phase | Test Scenario |
|---|---|---|
| FR-001: Persistent WebSocket connection | Phase 1 | Connect with JWT, observe 101 upgrade |
| FR-002: Send text messages | Phase 2 | Type in composer, hit send, see delivery check |
| FR-003: Delivery within 1 second | Phase 2 + Phase 8 metrics | Metrics panel shows latency histogram |
| FR-004: Delivery confirmation | Phase 2 | `delivered` frame triggers checkmark render |
| FR-005: Live voice streaming | Phase 3 | Push to Talk → remote user hears within 500ms |
| FR-006: Voice/video assembly & storage | Phase 3 + Phase 4 | After stop, replayable audio/video appears |
| FR-006a: Video upload & share | Phase 4 | Drop MP4, share, remote plays inline |
| FR-007: File upload & share | Phase 4 | Drop PDF, share, remote downloads |
| FR-008: File metadata visibility | Phase 4 | Message card shows name, size, MIME type |
| FR-009: File download | Phase 4 | Click download, save blob locally |
| FR-010: Online/offline status | Phase 5 | Presence bar updates on join/leave |
| FR-011: Typing indicators | Phase 5 | "Alice is typing..." appears/disappears |
| FR-012: Reply to messages | Phase 6 | Reply button, thread view, navigation |
| FR-013: Chronological ordering | Phase 7 | History fetch inserts messages in correct order |
| FR-014: JWT authentication | Phase 1 | Invalid token rejected with 401 before upgrade |
| FR-015: Participant-only delivery | Phase 2 | Non-participant sees 403 on history fetch |
| FR-016: Graceful interruption handling | Phase 7 | Disconnect/reconnect with no duplicates |
| FR-017: Missed message retrieval | Phase 7 | Reconnect fetches messages sent while offline |

---

## Deliverable Order for SpecKit

Generate in this sequence — each phase depends on the previous:

1. `public/index.html` + `src/App.js` + `src/index.js` — React shell with all panels
2. `src/config.js` — environment constants
3. `src/protocol/messageTypes.js` + `src/protocol/builders.js` + `src/protocol/parsers.js`
4. `src/transport/sendQueue.js` + `src/transport/heartbeat.js` + `src/transport/wsClient.js`
5. `src/state/conversationStore.js` + `src/state/messageStore.js`
6. `src/ui/AuthPanel.jsx` + `src/ui/ConversationList.jsx` + `src/ui/MessageList.jsx` + `src/ui/Composer.jsx`
7. `src/api/conversations.js` + `src/api/history.js`
8. `src/media/audioCapture.js` + `src/media/audioPlayer.js` + `src/state/voiceSessionStore.js` + `src/ui/VoiceRecorder.jsx`
9. `src/api/upload.js` + `src/api/download.js` + `src/ui/FileUploader.jsx` + `src/media/videoPreview.js`
10. `src/state/presenceStore.js` + `src/ui/PresenceBar.jsx` + `src/ui/TypingIndicator.jsx` + `src/api/presence.js`
11. `src/ui/MessageList.jsx` (reply rendering) + `src/api/history.js` (thread endpoint)
12. `src/transport/wsClient.js` (reconnection) + `src/state/messageStore.js` (duplicate detection, ordering)
13. Protocol log panel + metrics dashboard + test scenario buttons
14. `README.md`
15. Validation run against local `docker-compose up` server

---

## Success Criteria (Client-Side Validation of Server)

| ID | Criterion | How Client Validates |
|---|---|---|
| CSC-001 | User can connect within 3 seconds | Auth panel timer from click to `onopen` |
| CSC-002 | Text messages deliver in < 1s | Metrics panel: `delivered` timestamp − send timestamp |
| CSC-003 | Voice stream latency < 500ms | Metrics panel: chunk receive time − chunk send time |
| CSC-004 | File upload up to 100MB | Drag 100MB file, progress bar completes, no crash |
| CSC-005 | 10,000 concurrent connections | Not client-scoped; client can open 2–3 tabs to test multi-device |
| CSC-006 | 100 messages/minute without rate limit | Burst button sends 100, verify no `rate_limit_exceeded` |
| CSC-007 | 99.9% delivery success | Send 1000 messages, count `delivered` vs `error` in log |
| CSC-008 | Missed messages retrieved in < 2s | Disconnect, send from another client, reconnect, measure history fetch time |
| CSC-009 | Presence updates in < 2s | Join service, measure time until remote client sees `user_joined` |
| CSC-010 | File download 1MB/s for < 50MB | Time download of 50MB file, display speed in metrics |

---

## Assumptions

- The server is running locally at `ws://localhost:8080/ws` and `http://localhost:8080` per `quickstart.md`
- A valid JWT token is available (the client does not implement an auth server; token is pasted)
- Browser supports `WebSocket`, `fetch`, `MediaRecorder`, `getUserMedia`, and `AudioContext`
- Microphone permission is granted when requested
- The test user is already a participant in at least one conversation (or the client can create one via REST)

---

**Status**: Ready for task generation (`/speckit.tasks`)

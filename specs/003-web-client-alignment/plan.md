# Implementation Plan: Web Client Realignment with ChatHub Server

**Branch**: `003-web-client-alignment` | **Date**: 2026-05-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-web-client-alignment/spec.md`

## Summary

Realign the existing web test client with the actual ChatHub server protocol, fixing 12 protocol field mismatches (Category A), 7 REST API mismatches (Category B), 9 missing client features (Category C), and adding 3 new clarifications (token refresh, frame validation, unknown delivery handling). The technical approach is surgical fixes to existing source files rather than a rewrite — fixing field names in the protocol layer, unwrapping the `envelope` object in parsers, updating REST paths and response shapes, implementing inbound voice streaming, and adding the missing error handling and validation.

## Technical Context

**Language/Version**: ES2022+ JavaScript / JSX; React 19+ with Vite build step
**Primary Dependencies**: React 19, React DOM 19, uuid, Vite 8, Vitest 4, React Testing Library
**Storage**: `localStorage` for JWT token and connection settings only; in-memory `Map` for transient state
**Testing**: Vitest for unit tests; React Testing Library for component tests; manual browser validation for integration
**Target Platform**: Modern web browsers (Chrome 120+, Firefox 120+, Edge 120+, Safari 17+)
**Project Type**: React single-page application (test/validation tool for ChatHub server)
**Performance Goals**: First paint < 1s; voice capture-to-send < 200ms; smooth rendering for 1000+ messages
**Constraints**: Native WebSocket only (no SignalR); no message persistence; strict layer separation
**Scale/Scope**: Single-tester client; multi-tab for simulating multiple users

## Constitution Check

*GATE: Must pass before implementation begins. Re-check after design.*

### Principle I: WebSocket-First Real-time Communication ✅
- **Status**: COMPLIANT
- **Implementation**: native `WebSocket` with custom JSON wire format per `contracts/websocket-protocol.md`
- **Changes**: Fix field names (`id` not `messageId`, `displayName` not `userName`), add inbound `voice_chunk` handling, add `voice_message` builder, call `validateServerFrame()` on every inbound frame

### Principle II: MongoDB Source of Truth (Client-Side History Recovery) ✅
- **Status**: COMPLIANT
- **Implementation**: On reconnect, client fetches missed messages via `GET /api/conversation/{id}/messages`
- **Changes**: Fix response shape parsing to unwrap `{conversationId, messages, hasMore}` and `{originalMessage, replies}`

### Principle III: NATS Core for Cross-Pod Fan-out (Transparent to Client) ✅
- **Status**: COMPLIANT
- **Implementation**: Client has no knowledge of NATS; sends/receives only standard WebSocket frames
- **Changes**: No changes needed

### Principle IV: Layered Client Architecture ✅
- **Status**: COMPLIANT
- **Implementation**: `protocol/` → `transport/` → `api/` → `state/` → `ui/` with no circular dependencies
- **Changes**: Add `src/state/fileAttachmentStore.js` (new store in state layer); fix all field name mappings in parsers before they reach state/UI

### Principle V: Background Services for I/O Offloading ✅
- **Status**: COMPLIANT
- **Implementation**: All WebSocket sends serialized through `sendQueue.js`; MediaRecorder events batched
- **Changes**: No architectural changes; add 64KB chunk validation before enqueueing

---

## Project Structure

### Documentation (this feature)

```text
specs/003-web-client-alignment/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: data model (aligned)
├── quickstart.md        # Phase 1: setup guide
├── contracts/
│   ├── websocket-protocol.md  # Phase 1: WS wire format
│   └── rest-api.md            # Phase 1: REST endpoints
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2: task breakdown (NOT YET CREATED)
```

### Source Code (repository root)

```text
src/
├── config.js                # FIX: port 5068→8080, add TYPING_DEBOUNCE_MS, MAX_UPLOAD_BYTES, etc.
├── protocol/
│   ├── messageTypes.js      # FIX: add VOICE_CHUNK to SERVER types, add VOICE_MESSAGE type
│   ├── builders.js           # FIX: add buildVoiceMessage(), verify builders match spec
│   └── parsers.js            # FIX: unwrap envelope, rename senderId/displayName, call validateServerFrame
├── transport/
│   ├── wsClient.js           # FIX: heartbeat start, inbound voice_chunk, frame validation, error handling, token refresh
│   ├── heartbeat.js           # OK: timing logic correct, start timing moved to wsClient
│   └── sendQueue.js           # OK: no changes needed
├── api/
│   ├── conversations.js      # OK: paths already correct
│   ├── history.js            # FIX: unwrap {conversationId, messages, hasMore} and {originalMessage, replies}
│   ├── upload.js             # FIX: add 100MB client-side validation
│   ├── download.js           # FIX: path /api/download/ → /api/upload/download/
│   └── presence.js           # FIX: unwrap {serviceId, onlineUsers}, rename userName→displayName
├── state/
│   ├── conversationStore.js  # FIX: sort by lastMessageAt, not updatedAt
│   ├── messageStore.js       # FIX: warn + discard unknown messageId in delivered
│   ├── presenceStore.js      # FIX: userName→displayName, add lastSeen/isTyping fields
│   ├── voiceSessionStore.js  # FIX: add conversationId param to startInbound()
│   └── fileAttachmentStore.js # NEW: Map<blobId, FileAttachment> for pre-upload tracking
├── media/
│   ├── audioCapture.js       # FIX: add 64KB chunk size validation
│   ├── audioPlayer.js        # FIX: implement real enqueueChunk() with AudioContext
│   └── videoPreview.js       # OK: no changes needed
├── ui/
│   ├── AuthPanel.jsx         # FIX: add token refresh flow
│   ├── Composer.jsx          # FIX: debounce 3000ms→300ms
│   ├── MessageList.jsx       # FIX: msg.senderId (not fromUserId), msg.text (not content.text), unwrap thread response
│   ├── PresenceBar.jsx       # FIX: user.displayName (not user.userName)
│   ├── FileUploader.jsx      # FIX: 100MB client-side validation
│   ├── VoiceRecorder.jsx     # OK: minor integration with fixed voiceSessionStore
│   └── ProtocolLog.jsx       # OK: already logs all frames
├── App.jsx                   # FIX: unwrap envelope, fix field names, add error handlers, fix presence parsing
└── App.css                   # OK: no changes needed
```

**Structure Decision**: Single React SPA with layered architecture. All changes are surgical fixes to existing files plus one new file (`src/state/fileAttachmentStore.js`). No restructuring needed — the existing layer separation is correct.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

No constitution violations. The realignment is a bug-fix and alignment effort that strengthens compliance with all five principles rather than requiring departures.

---

## Implementation Phases

### Phase 1: Protocol Layer Alignment (P0 — Blocks Everything)

**Goal**: Fix all wire format mismatches so the client can communicate with the server at all.

**Files**: `src/config.js`, `src/protocol/messageTypes.js`, `src/protocol/builders.js`, `src/protocol/parsers.js`

- [ ] **A01** `config.js`: Change `API_BASE` port from `5068` to `8080` and `WS_URL` port from `5068` to `8080`
- [ ] **A02** `config.js`: Add `MAX_UPLOAD_BYTES = 104_857_600`, `MAX_VOICE_CHUNK_BYTES = 65536`, `TYPING_DEBOUNCE_MS = 300`, `HEARTBEAT_TIMEOUT_MS = 30000`
- [ ] **A03** `messageTypes.js`: Add `VOICE_CHUNK` to `SERVER_MESSAGE_TYPES` array, add `VOICE_MESSAGE = 'voice_message'` constant
- [ ] **A04** `builders.js`: Add `buildVoiceMessage({id, conversationId, blobId, durationMs, mimeType, replyToId?})` factory function
- [ ] **A05** `parsers.js`: Fix `parseMessageReceived` to unwrap `frame.envelope` instead of treating `frame` as flat fields; map `env.senderId` (not `frame.fromUserId`), `env.text` (not `frame.text`/`frame.content.text`), `env.attachment` (not `frame.content`), `env.replyToId`, `env.createdAt`
- [ ] **A06** `parsers.js`: Fix `parseUserJoined` to map `frame.displayName` to `displayName` (not `userName`); remove `fromUserId`/`fromUserName` aliases
- [ ] **A07** `parsers.js`: Add `parseVoiceChunkInbound(frame)` parser for server→client `voice_chunk` text frames: `{id, conversationId, sequenceNumber, isFinal, fromUserId}`
- [ ] **A08** `parsers.js`: Ensure `parseDelivered` extracts only `messageId` (no `conversationId` or `deliveredAt`)
- [ ] **A09** `parsers.js`: Ensure `parseError` extracts `correlationId` (optional)
- [ ] **A10** `parsers.js`: Export `validateServerFrame` and ensure it is called in `wsClient.js` before processing

**Independent Test**: Connect to a running ChatHub server with a valid JWT. Send `join_service`, observe `user_joined` with `displayName`. Send a `text_message`, receive `message_received` with unwrapped `envelope`. Check Protocol Log shows correct field names.

---

### Phase 2: REST API & Transport Alignment (P0 — Blocks Non-Realtime Features)

**Goal**: Fix all REST paths, response shapes, and WebSocket lifecycle issues.

**Files**: `src/api/download.js`, `src/api/history.js`, `src/api/presence.js`, `src/api/upload.js`, `src/transport/wsClient.js`, `src/transport/heartbeat.js`

- [ ] **B01** `download.js`: Change download path from `/api/download/${blobId}` to `/api/upload/download/${blobId}`
- [ ] **B02** `history.js`: Update `fetchHistory` to parse and return `{conversationId, messages, hasMore}` shape instead of assuming a plain array
- [ ] **B03** `history.js`: Update `fetchThread` to parse and return `{originalMessage, replies}` shape instead of assuming a plain array
- [ ] **B04** `presence.js`: Update `fetchOnlineUsers` to parse and return `{serviceId, onlineUsers: [{userId, displayName, lastSeen}]}` instead of a flat array with `userName`
- [ ] **B05** `upload.js`: Add client-side validation `file.size <= MAX_UPLOAD_BYTES` before creating the upload request; reject with user-visible error toast if exceeded
- [ ] **B06** `wsClient.js`: Move `heartbeat.start()` from inside the PING handler to the `onopen` handler so monitoring begins at connection time
- [ ] **B07** `wsClient.js`: Call `validateServerFrame(frame)` on every inbound text frame; if it returns false, log to Protocol Panel and discard the frame (do not disconnect)
- [ ] **B08** `wsClient.js`: Add handler for `voice_chunk` text frames from server: route to `voiceSessionStore.startInbound()`
- [ ] **B09** `wsClient.js`: Route inbound binary frames to the active `voiceSession` and `audioPlayer.enqueueChunk()` when a voice session is active
- [ ] **B10** `wsClient.js`: Add error handling for `service_not_found` (toast + return to service selector), `invalid_reply` (toast + dismiss reply preview), `invalid_attachment` (toast), `voice_processing_error` (warning + log), `voice_assembly_error` (warning + discard voice session)

**Independent Test**: Create a conversation via REST; fetch conversation list; fetch message history — verify correct unwrapping of `{conversationId, messages, hasMore}`. Upload a file < 100MB and verify download via `/api/upload/download/{blobId}`. Try uploading a file > 100MB and verify rejection.

---

### Phase 3: UI & State Alignment (P1 — Blocks Correct Display)

**Goal**: Fix all field name references in UI components and state stores to match the canonical field names.

**Files**: `src/App.jsx`, `src/ui/MessageList.jsx`, `src/ui/Composer.jsx`, `src/ui/PresenceBar.jsx`, `src/state/presenceStore.js`, `src/state/conversationStore.js`, `src/state/messageStore.js`, `src/state/voiceSessionStore.js`

- [ ] **C01** `App.jsx`: Update `handleMessageReceived` to use `msg.senderId` (not `msg.fromUserId`), `msg.text` (not `msg.content.text`), `msg.attachment` (not `msg.content`)
- [ ] **C02** `App.jsx`: Update `handleUserJoined` to use `frame.displayName` (not `frame.userName`)
- [ ] **C03** `App.jsx`: Update `fetchOnlineUsers` callback to unwrap `{serviceId, onlineUsers}` and iterate `onlineUsers` array
- [ ] **C04** `App.jsx`: Add error handling for `service_not_found`, `invalid_reply`, `invalid_attachment`, `voice_processing_error`, `voice_assembly_error`
- [ ] **C05** `App.jsx`: Add token refresh logic: on `invalid_token` error, attempt silent refresh; if refresh fails, redirect to login with "Session expired" notification
- [ ] **C06** `MessageList.jsx`: Replace all `msg.fromUserId` with `msg.senderId`
- [ ] **C07** `MessageList.jsx`: Replace all `msg.fromUserName` with `msg.displayName` (look up from presence store or use `msg.senderId`)
- [ ] **C08** `MessageList.jsx`: Replace `msg.content?.text` with `msg.text`; replace `msg.content?.blobId` etc. with `msg.attachment?.blobId`
- [ ] **C09** `MessageList.jsx`: Fix `fetchThread` call to unwrap `{originalMessage, replies}` response shape
- [ ] **C10** `Composer.jsx`: Change `TYPING_DEBOUNCE_MS` from `3000` to `300` (or import from `config.js`)
- [ ] **C11** `PresenceBar.jsx`: Replace `user.userName` with `user.displayName`, replace `user.status` with `user.isOnline` / `user.lastSeen`
- [ ] **C12** `presenceStore.js`: Rename `userName` to `displayName` throughout; change store shape to `{userId, displayName, lastSeen, isOnline, isTyping, typingConversationId}`
- [ ] **C13** `presenceStore.js`: Update `setOnline` to accept `{userId, displayName, lastSeen}` from `user_joined` events and REST responses
- [ ] **C14** `conversationStore.js`: Change sort key from `updatedAt` to `lastMessageAt` per data model
- [ ] **C15** `messageStore.js`: Update `ack(messageId)` to log a warning and discard if `messageId` is not in the store (do not add to `deliveredIds`)
- [ ] **C16** `voiceSessionStore.js`: Update `startInbound()` signature to accept `conversationId` parameter from inbound `voice_chunk` frame

**Independent Test**: Connect two users. User A sends a message. User B sees the message with correct `senderId`, `displayName`, flat `text`, and `attachment` fields. Both see online users in PresenceBar with `displayName` and `lastSeen`. User B types and User A sees the typing indicator within 300ms.

---

### Phase 4: Inbound Voice & Audio Playback (P1 — Blocks Voice Feature)

**Goal**: Implement real `audioPlayer.enqueueChunk()` and complete inbound voice streaming.

**Files**: `src/media/audioPlayer.js`, `src/media/audioCapture.js`, `src/state/fileAttachmentStore.js` (new)

- [ ] **D01** `audioPlayer.js`: Implement `enqueueChunk(sessionId, sequenceNumber, arrayBuffer)` using `AudioContext.decodeAudioData()` and `AudioBufferSourceNode.start()` scheduling for gapless playback
- [ ] **D02** `audioPlayer.js`: Manage chunk buffer keyed by session ID; track current playback position; schedule next chunk based on `AudioContext.currentTime` of previous chunk end
- [ ] **D03** `audioPlayer.js`: Clean up session on `isFinal: true` — flush remaining buffer, emit completion event for UI
- [ ] **D04** `audioCapture.js`: Add chunk size validation — if a captured chunk exceeds `MAX_VOICE_CHUNK_BYTES` (64KB), log warning and skip/truncate it before sending
- [ ] **D05** Create `src/state/fileAttachmentStore.js` — `Map<blobId, FileAttachment>` with `add(file)`, `get(blobId)`, `remove(blobId)`, tracking state transitions `uploading → uploaded → shared`

**Independent Test**: User A holds Push to Talk and speaks for 5 seconds. User B receives `voice_chunk` text frames and binary frames, plays audio chunks within 500ms. When User A releases, both see a completed voice message with a replay button. Send a pre-recorded file attachment and verify `fileAttachmentStore` tracks it.

---

### Phase 5: Error Handling, Validation & Polish (P2)

**Goal**: Add all missing error handlers, frame validation, and token refresh.

**Files**: `src/App.jsx`, `src/ui/AuthPanel.jsx`, `src/ui/Notifications.jsx` (may need creation/update)

- [ ] **E01** Add handler for `service_not_found` error: toast "Service not found" + return to service selector view
- [ ] **E02** Add handler for `invalid_reply` error: toast error message + dismiss reply preview in Composer
- [ ] **E03** Add handler for `invalid_attachment` error: toast error detail
- [ ] **E04** Add handler for `voice_processing_error` error: warning toast + log to Protocol Panel
- [ ] **E05** Add handler for `voice_assembly_error` error: warning toast + discard incomplete voice session from `voiceSessionStore`
- [ ] **E06** `AuthPanel.jsx`: Implement token refresh flow — detect `invalid_token` WebSocket error, attempt silent refresh via REST endpoint, fall back to login screen
- [ ] **E07** `AuthPanel.jsx`: Add "Session expired" notification when token refresh fails
- [ ] **E08** `FileUploader.jsx`: Add 100MB client-side file size validation before upload, with user-visible error toast
- [ ] **E09** Wire all new error handlers into `wsClient.js` `handleFrame` switch and `App.jsx` error event handlers

**Independent Test**: Trigger each error code and verify UI feedback. Drop a 150MB file and verify rejection before upload. Let session expire and verify token refresh or login redirect.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Protocol)**: No dependencies; fix protocol layer first
- **Phase 2 (REST/Transport)**: Depends on Phase 1 (parsers must be correct)
- **Phase 3 (UI/State)**: Depends on Phases 1 and 2 (consumers of fixed data)
- **Phase 4 (Voice)**: Depends on Phase 1 (voice_chunk parser) and Phase 2 (wsClient routing)
- **Phase 5 (Errors/Polish)**: Depends on Phases 1–4 (needs working protocol before handling errors)

### Recommended Implementation Order for a Single Developer

1. Phase 1 → stop and validate text messaging works end-to-end
2. Phase 2 → validate REST calls and heartbeat behavior
3. Phase 3 → validate all UI fields display correctly
4. Phase 4 → validate bidirectional voice streaming
5. Phase 5 → validate error handling edge cases

---

## FR-to-Phase Mapping

| FR | Description | Phase |
|----|-------------|-------|
| FR-001 | WS connection with JWT query param | Phase 1 (config port fix) |
| FR-002 | `join_service` with no token | Phase 1 (already correct) |
| FR-003 | `leave_service` with serviceId | Phase 1 (already correct) |
| FR-004 | Flat `text` field | Phase 1 (parser fix) |
| FR-005 | `voice_chunk` uses `id` | Phase 1 (parser/builder) |
| FR-006 | `file_attachment` + `voice_message` types | Phase 1 (builders) |
| FR-007 | Unwrap `message_received` envelope | Phase 1 (parser) |
| FR-008 | `displayName` not `userName` | Phase 1+3 (parser + UI) |
| FR-009 | `delivered` with only `messageId` | Phase 1 (parser) |
| FR-010 | `error` with `correlationId` | Phase 1 (parser) |
| FR-011 | Route inbound `voice_chunk` | Phase 2 (wsClient) |
| FR-012 | Implement `audioPlayer.enqueueChunk()` | Phase 4 |
| FR-013 | 300ms typing debounce | Phase 3 (Composer) |
| FR-014 | Heartbeat starts at connection time | Phase 2 (wsClient) |
| FR-015 | 100MB file size validation | Phase 2 (upload) + Phase 5 (FileUploader) |
| FR-016 | Handle all error codes | Phase 5 |
| FR-017 | Correct REST paths | Phase 2 |
| FR-018 | Parse REST response shapes | Phase 2 |
| FR-019 | Correct base URL and WS URL | Phase 1 (config) |
| FR-020 | Call `validateServerFrame()` | Phase 2 (wsClient) |
| FR-021 | Token refresh on expiry | Phase 5 (AuthPanel) |
| FR-022 | Log and discard malformed frames | Phase 2 (wsClient) |
| FR-023 | Warn on unknown messageId in delivered | Phase 3 (messageStore) |

---

## Success Criteria Mapping

| SC | Criterion | Validation Phase |
|----|-----------|-----------------|
| SC-001 | Correct wire format field names | Phase 1 (Protocol Log observation) |
| SC-002 | REST calls return 2xx | Phase 2 (network tab verification) |
| SC-003 | Connect, send text, receive delivered | Phase 1+2 (end-to-end test) |
| SC-004 | Bidirectional voice streaming | Phase 4 (two-tab test) |
| SC-005 | Upload → share → download file | Phase 2 (REST + Phase 3 display) |
| SC-006 | Error codes produce UI feedback | Phase 5 (trigger each error code) |
| SC-007 | 100MB upload rejected client-side | Phase 5 (drag oversized file) |
| SC-008 | Typing debounced to ≤ 4/sec | Phase 3 (rapid keystroke test) |

---

## Assumptions

- The ChatHub server is running locally at `ws://localhost:8080/ws` and `http://localhost:8080`
- The server uses singular REST paths (`/api/conversation/`, `/api/upload/`, `/api/services/`)
- The server wraps `message_received` payloads in an `envelope` sub-object
- The server sends `displayName` (not `userName`) in `user_joined`
- JWT tokens are passed as WebSocket query parameters
- Token refresh is available via a REST endpoint (details TBD per server implementation)
- The browser supports `WebSocket`, `fetch`, `MediaRecorder`, `getUserMedia`, and `AudioContext`

---

**Status**: Ready for task generation (`/speckit.tasks`)
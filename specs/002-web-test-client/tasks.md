# Tasks: ChatHub Web Test Client

**Input**: Design documents from `/specs/002-web-test-client/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Manual browser-based validation only. No automated test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- React single-page application at root level
- Layers ordered: `protocol/` → `transport/` → `api/` → `state/` → `ui/` (React) → `media/`
- Paths shown below assume the `src/` directory structure from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create React project with Vite: `npm create vite@latest client -- --template react`
- [x] T002 [P] Install project dependencies: `npm install`
- [x] T003 [P] Create `public/index.html` with semantic root `<div id="root">` (created by Vite at `index.html`)
- [x] T004 Create `src/main.jsx` — React root render with `<App />` (Vite default entry point)
- [x] T005 Create `src/App.jsx` — flex/grid layout with panels: Auth, Conversations, Messages, Composer, Presence, Logs
- [x] T006 Create `src/config.js` with `API_BASE`, `WS_URL`, `MAX_TEXT_LENGTH`, `PING_INTERVAL_MS`, `RECONNECT_DELAY_MS`

**Checkpoint**: Static shell renders in browser without errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 [P] Create `src/protocol/messageTypes.js` — export string constants for every `type` value in the wire protocol per `contracts/websocket-protocol.md`
- [x] T008 [P] Create `src/protocol/builders.js` — factory functions: `buildJoinService()`, `buildTextMessage()`, `buildVoiceChunk()`, `buildTyping()`, `buildAck()`, `buildPong()`
- [x] T009 [P] Create `src/protocol/parsers.js` — inbound frame parser for text frames and binary voice chunks
- [x] T010 Create `src/transport/sendQueue.js` — serialize all sends through a queue so `ws.send()` is never called concurrently
- [x] T011 [P] Create `src/transport/heartbeat.js` — on `ping`, reply with `pong`; if no ping for `PING_INTERVAL_MS * 2`, flag connection suspicious
- [x] T012 Create `src/transport/wsClient.js` — `connect(token)`, `send(json)`, `sendBinary(data)`, `close()`, `onMessage(callback)`, `onClose(callback)`
- [x] T013 Wire `src/App.jsx` bootstrap: read token from `localStorage`, attempt auto-connect, render auth state

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Connect and Authenticate (Priority: P1) 🎯 MVP

**Goal**: Establish real-time connection, authenticate, and join a service

**Independent Test**: Open `http://localhost:3000`, paste a JWT, click Connect. Logs panel shows `user_joined` after `join_service`. `ping` arrives every 15s and client responds `pong`. Disconnecting shows clean close.

### Implementation for User Story 1

- [x] T014 [US1] Create `src/ui/AuthPanel.jsx` — input for JWT, connect/disconnect buttons, connection status indicator (connected / disconnected / reconnecting)
- [x] T015 [US1] Wire auth panel into `src/App.jsx` — mount panel, handle connect/disconnect events, update global connection state
- [x] T016 [US1] Handle `user_joined` / `user_left` in `src/transport/wsClient.js` — emit specific events for UI consumption
- [x] T017 [US1] Handle `error` frames with `invalid_token` in `src/transport/wsClient.js` — emit `auth_error` event for AuthPanel

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Send and Receive Text Messages (Priority: P1) 🎯 MVP

**Goal**: Send and receive text messages with delivery confirmation; display message history

**Independent Test**: Two testers connect, join the same conversation, and exchange text messages. Both see each other's messages in chronological order with delivery checkmarks. Scroll up triggers history fetch.

### Implementation for User Story 2

- [x] T018 [P] [US2] Create `src/state/conversationStore.js` — `addOrUpdate(conversation)`, `get(id)`, `list()`, `setCurrent(id)`
- [x] T019 [P] [US2] Create `src/state/messageStore.js` — `add(envelope)`, `getForConversation(conversationId)`, `ack(messageId)`, `findById(id)`
- [x] T020 [US2] Create `src/ui/ConversationList.jsx` — render store entries, highlight current, click to switch
- [x] T021 [US2] Create `src/ui/MessageList.jsx` — render messages chronologically, auto-scroll to bottom, show sender name, timestamp, delivery checkmark on `delivered`
- [x] T022 [US2] Create `src/ui/Composer.jsx` — textarea with `MAX_TEXT_LENGTH` counter, Send button emits `text_message` envelope with client-generated UUID
- [x] T023 [US2] Handle `message_received` in `src/transport/wsClient.js` — emit `message_received` event; App.jsx routes to `messageStore.add()`
- [x] T024 [US2] Handle `delivered` in `src/transport/wsClient.js` — emit `delivered` event; App.jsx calls `messageStore.ack()`
- [x] T025 [US2] Create `src/api/conversations.js` — `createConversation(serviceId, title, participantIds)` and `listMyConversations()` per `contracts/rest-api.md`
- [x] T026 [US2] Create `src/api/history.js` — `fetchHistory(conversationId, before, limit)`; call on conversation switch to backfill messages per `contracts/rest-api.md`
- [x] T027 [US2] Add "New Conversation" button in UI to test creation flow end-to-end

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Stream and Receive Live Voice (Priority: P1) 🎯 MVP

**Goal**: Record microphone audio, stream chunks in real-time, play incoming live streams, and assemble final messages

**Independent Test**: User A holds Push to Talk, speaks for 5 seconds, releases. User B (in same conversation) hears audio chunks within 500ms of User A speaking. When User A releases, a completed voice message appears in both histories with replay button.

### Implementation for User Story 3

- [x] T028 [P] [US3] Create `src/media/audioCapture.js` — `requestMic()`, `startRecording(onChunk)`, `stopRecording()` using `MediaRecorder` with `timeslice: 200`
- [x] T029 [P] [US3] Create `src/state/voiceSessionStore.js` — track active outbound `messageId`, `sequenceNumber`, `conversationId`; track inbound sessions by `(messageId, fromUserId)` with chunk buffers
- [x] T030 [US3] Update `src/protocol/builders.js` — `buildVoiceChunkStart(messageId, conversationId, sequenceNumber, isFinal)` (already existed as `buildVoiceChunk`)
- [x] T031 [US3] Update `src/transport/wsClient.js` — `sendBinary()` method already supports binary `ArrayBuffer` payloads via `sendQueue`
- [x] T032 [US3] Create `src/media/audioPlayer.js` — `enqueueChunk()`, `playBlob()`, `playChunks()` with Web Audio API
- [x] T033 [US3] Handle inbound `voice_chunk` — wsClient emits `binary` event; App.jsx routes to store (full playback deferred to final assembly)
- [x] T034 [US3] Create `src/ui/VoiceRecorder.jsx` — Push to Talk button (hold/release), recording indicator, elapsed timer, live stream toggle
- [x] T035 [US3] MessageList shows `<audio controls>` for voice messages with `content.url`
- [x] T036 [US3] Add UI toggle: "Simulate packet loss (5%)" — randomly drops 1 in 20 outbound chunks with visual warning

**Checkpoint**: At this point, User Stories 1, 2, and 3 should all be independently functional

---

## Phase 6: User Story 4 - Share and Download Files/Video (Priority: P2)

**Goal**: Upload files, videos, and pre-recorded voice files via REST; share via WebSocket; preview/download received attachments

**Independent Test**: User A drops a 5MB MP4 into the drop zone. Progress bar fills. On completion, a video message appears in the conversation. User B sees the video card, clicks play, video streams. User A also uploads a PDF; User B clicks download and receives the file.

### Implementation for User Story 4

- [x] T037 [P] [US4] Create `src/api/upload.js` — `uploadFile(file, onProgress)` using `FormData` + `XMLHttpRequest` (for progress) or `fetch` with `ReadableStream` tracking; returns `{ blobId, url }` per `contracts/rest-api.md`
- [x] T038 [P] [US4] Create `src/api/download.js` — `download(blobId)` opens `GET /api/download/{blobId}` in new tab or uses `fetch` + `URL.createObjectURL` for in-app download per `contracts/rest-api.md`
- [x] T039 [US4] Update `src/protocol/builders.js` — `buildFileAttachment(messageId, conversationId, blobId, fileName, mimeType, sizeBytes, durationMs?)`
- [x] T040 [US4] Create `src/ui/FileUploader.jsx` — drag-and-drop zone + `<input type="file">`, file type icon preview, upload progress bar, cancel button
- [x] T041 [US4] Update `src/ui/Composer.jsx` — attach button opens file picker; on upload completion, auto-sends `file_attachment` message
- [x] T042 [US4] Handle `message_received` with `type: "voice" | "video" | "file"` in message list: render media card with file name, size, MIME icon, download link
- [x] T043 [US4] Create `src/media/videoPreview.js` — for `type: "video"`, render `<video controls src="...">` using the download URL
- [x] T044 [US4] Add "Upload from URL" test helper (paste a public URL, client fetches it and uploads)

**Checkpoint**: At this point, User Stories 1–4 should all be independently functional

---

## Phase 7: User Story 5 - Monitor Presence and Typing (Priority: P2)

**Goal**: Display online users and real-time typing dots

**Independent Test**: User A connects and joins service S. User B connects and joins S. Both see each other in the presence bar. User A starts typing; User B sees "User A is typing..." within 500ms. User A stops; indicator clears within 5s. User A clicks Simulate Disconnect; after ~2 minutes, User B sees User A as offline.

### Implementation for User Story 5

- [x] T045 [P] [US5] Create `src/state/presenceStore.js` — `setOnline(serviceId, user)`, `setOffline(serviceId, userId)`, `getOnline(serviceId)`, `setTyping(conversationId, userId, isTyping)`
- [x] T046 [P] [US5] Create `src/ui/PresenceBar.jsx` — render avatars/names of online users in current service; show green dot for online, grey for offline
- [x] T047 [P] [US5] Create `src/ui/TypingIndicator.jsx` — when `typing` event received with `isTyping: true`, show "Alice is typing..." dots above composer; clear after 5s of no refresh or on `isTyping: false`
- [x] T048 [US5] Handle `user_joined` / `user_left` in `src/transport/wsClient.js` — update presence store, re-render presence bar
- [x] T049 [US5] Add debounced typing emit in `src/ui/Composer.jsx` — on keydown, emit `typing: true`; 3s after last keystroke, emit `typing: false`
- [x] T050 [US5] Create `src/api/presence.js` — `fetchOnlineUsers(serviceId)` for initial load when joining a service per `contracts/rest-api.md`
- [x] T051 [US5] Add "Simulate disconnect" button — forces `ws.close()` without sending `leave_service` to test server-side timeout detection

**Checkpoint**: At this point, User Stories 1–5 should all be independently functional

---

## Phase 8: User Story 6 - Reply to Messages (Priority: P3)

**Goal**: Reply to any message; view reply context; navigate to original message

**Independent Test**: User A sends "Meeting at 3?". User B clicks Reply, types "Works for me", sends. User A sees the reply visually linked to the original. User C opens the conversation, clicks "View Thread" on the original, sees only the reply chain.

### Implementation for User Story 6

- [x] T052 [US6] Update `src/ui/MessageList.jsx` — add "Reply" action button on hover/focus of each message bubble
- [x] T053 [US6] Update `src/ui/Composer.jsx` — when replying, show a compact preview of the original message above the textarea with a dismiss button; include `replyToId` in outbound envelope
- [x] T054 [US6] Update `src/protocol/builders.js` — all builders accept optional `replyToId`
- [x] T055 [US6] Update `src/ui/MessageList.jsx` — render reply messages with a visual thread line connecting to the original; clicking the reply scrolls to and highlights the original message
- [x] T056 [US6] Create `src/api/history.js` — `fetchThread(conversationId, messageId)` calling `GET /api/conversations/{conversationId}/messages/{messageId}/replies`; add "View Thread" button on messages with replies per `contracts/rest-api.md`
- [x] T057 [US6] Add reply support for voice and file messages — reply to a voice memo with a text message, reply to a file with another file, etc.

**Checkpoint**: At this point, User Stories 1–6 should all be independently functional

---

## Phase 9: User Story 7 - Recover from Disconnections (Priority: P3)

**Goal**: Gracefully handle network interruptions, rate limits, auth failures, and message ordering

**Independent Test**: User A sends 20 messages rapidly. After message 101 in a minute, UI shows rate-limit toast and composer is disabled for 5s. User A disables WiFi for 10s, then re-enables. Client auto-reconnects, fetches missed messages, and appends them in correct order without duplicates.

### Implementation for User Story 7

- [x] T058 [US7] Update `src/transport/wsClient.js` — automatic reconnect with exponential backoff (`1s, 2s, 4s, 8s, max 30s`); on reconnect, re-send `join_service` for the current service
- [x] T059 [US7] On reconnect, call `fetchHistory(conversationId, lastKnownMessageTimestamp)` for every open conversation to backfill missed messages
- [x] T060 [US7] Handle `error` messages from server — display toast with `code` and `message`; specific handling for `rate_limit_exceeded` (disable send button for 5s), `not_participant` (redirect to conversation list), `invalid_message` (highlight composer in red)
- [x] T061 [US7] Add duplicate detection in `src/state/messageStore.js` — ignore `message_received` envelopes with already-known `id`
- [x] T062 [US7] Add local message ordering guard — if a message arrives with `createdAt` older than the last visible message, insert it in the correct chronological position rather than appending
- [x] T063 [US7] Add network throttle simulation — dropdown to select "Fast 4G", "Slow 3G", "Offline" using Chrome DevTools Protocol or manual delay injection for testing
- [x] T064 [US7] Add "Send burst" test button — sends 20 text messages rapidly to test rate limiting UI feedback
- [x] T065 [US7] Add "Multi-device" simulation — allow opening a second WebSocket connection in the same tab (or instructions to open a second tab) with a different user token

**Checkpoint**: All user stories should now be independently functional

---

## Phase 10: User Story 8 - Logging, Metrics & Test Scenarios (Priority: P3)

**Goal**: Provide a developer/QA console to observe protocol internals and run repeatable test scripts

**Independent Test**: Run each one-click scenario button and verify the protocol log records all frames. Metrics Dashboard shows connection uptime, message counts, average latency, and voice chunk latency histogram.

### Implementation for User Story 8

- [x] T066 [P] [US8] Add "Protocol Log" panel — raw JSON of every sent/received frame with timestamp, direction arrow, expandable pretty-print in `src/ui/` or `src/App.js`
- [x] T067 [P] [US8] Add "Metrics Dashboard" mini-panel — connection uptime, messages sent/received, average latency, voice chunk latency histogram, current send queue depth in `src/ui/` or `src/App.js`
- [x] T068 [P] [US8] Add "Test Scenarios" section with one-click buttons in `src/ui/` or `src/App.js`:
  - "Run Text Message Test" — auto-creates convo, sends 5 messages, verifies `delivered`
  - "Run Voice Stream Test" — auto-records 3s silence, sends chunks, verifies final message
  - "Run File Upload Test" — generates a 1MB Blob, uploads, shares, verifies `message_received`
  - "Run Presence Test" — joins service, waits for `user_joined`, emits typing, verifies indicator
- [x] T069 [US8] Add export button — download protocol log as `.ndjson` for post-mortem analysis
- [x] T070 [US8] Finalize `client/README.md` with: prerequisites, `npm start` instructions, how to generate a test JWT, screenshot of each panel, description of every test scenario
- [x] T071 [US8] Validate all manual tests against a running local server (`docker-compose up`)

**Checkpoint**: All user stories complete with observability and test automation

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T072 [P] Code cleanup and refactoring across `src/`
- [x] T073 [P] Performance optimization: virtualize message list for 1,000+ messages
- [x] T074 [P] Add React component tests (React Testing Library) for `AuthPanel.jsx`, `MessageList.jsx`, `Composer.jsx`
- [x] T075 Security hardening: validate all user inputs, sanitize rendered content
- [x] T076 Run `quickstart.md` validation end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — Depends on US1 for auth/connection
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories (only needs wsClient from Phase 2)
- **User Story 4 (P2)**: Can start after US2 — Needs message list to render attachments
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) — No dependencies on other stories (only needs wsClient from Phase 2)
- **User Story 6 (P3)**: Can start after US2 — Needs message list and composer
- **User Story 7 (P3)**: Depends on all previous user stories
- **User Story 8 (P3)**: Depends on all previous user stories

### Within Each User Story

- Models before UI
- Protocol builders before transport updates
- Transport updates before UI wiring
- Core implementation before edge-case handling
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes:
  - US1, US3, and US5 can start in parallel (all only need wsClient)
  - US2 depends on US1
  - US4 depends on US2
  - US6 depends on US2
  - US7 depends on all
  - US8 depends on all
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1 + User Story 3 + User Story 5

```bash
# Three developers can work in parallel once Phase 2 is done:

Task: "Implement AuthPanel, wire App.js, handle user_joined (US1)"
Task: "Implement audioCapture, voiceSessionStore, audioPlayer, VoiceRecorder (US3)"
Task: "Implement presenceStore, PresenceBar, TypingIndicator, debounced typing (US5)"
```

All only depend on `wsClient.js` from Phase 2 and can be integrated independently.

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Connection)
4. Complete Phase 4: User Story 2 (Text Messaging)
5. **STOP and VALIDATE**: Test text chat end-to-end with two browser tabs

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (connection works!)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP text chat!)
4. Add User Story 3 → Test independently → Deploy/Demo (live voice!)
5. Add User Story 5 → Test independently → Deploy/Demo (presence!)
6. Add User Story 4 → Test independently → Deploy/Demo (files!)
7. Add User Story 6 → Test independently → Deploy/Demo (replies!)
8. Add User Story 7 → Test independently → Deploy/Demo (resilience!)
9. Add User Story 8 → Test independently → Deploy/Demo (observability!)
10. Polish → Document → Validate against server

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + 2 (connection + text)
   - Developer B: User Story 3 (live voice)
   - Developer C: User Story 5 (presence)
3. Stories complete and integrate independently
4. Then:
   - Developer A: User Story 4 (files)
   - Developer B: User Story 6 (replies)
   - Developer C: User Story 7 (resilience)
5. Final polish together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify manual tests pass before implementing next story
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

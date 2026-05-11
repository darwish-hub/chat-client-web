# Tasks: Web Client Realignment with ChatHub Server

**Input**: Design documents from `/specs/003-web-client-alignment/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are not included. Manual validation is specified per phase in plan.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/` at repository root
- Tests: `src/**/*.test.jsx` co-located with components
- Config: `src/config.js`
- Protocol: `src/protocol/`
- Transport: `src/transport/`
- API: `src/api/`
- State: `src/state/`
- Media: `src/media/`
- UI: `src/ui/`

---

## Phase 1: Setup (Config & Protocol Layer)

**Purpose**: Fix configuration and protocol foundations that ALL user stories depend on

- [x] T001 Fix `API_BASE` port from `5068` to `8080` and `WS_URL` port from `5068` to `8080` in `src/config.js`
- [x] T002 Add `TYPING_DEBOUNCE_MS`, `MAX_UPLOAD_BYTES`, `MAX_VOICE_CHUNK_BYTES`, `HEARTBEAT_TIMEOUT_MS` constants to `src/config.js`
- [x] T003 [P] Add `VOICE_CHUNK` to `SERVER_MESSAGE_TYPES` and `VOICE_MESSAGE` constant in `src/protocol/messageTypes.js`
- [x] T004 [P] Add `buildVoiceMessage({id, conversationId, blobId, durationMs, mimeType, replyToId?})` factory in `src/protocol/builders.js`
- [x] T005 Fix `parseMessageReceived` to unwrap `frame.envelope` and map `env.senderId`, `env.text`, `env.attachment`, `env.replyToId`, `env.createdAt` in `src/protocol/parsers.js`
- [x] T006 Fix `parseUserJoined` to map `frame.displayName` to `displayName` (not `userName`) and remove `fromUserId`/`fromUserName` aliases in `src/protocol/parsers.js`
- [x] T007 [P] Add `parseVoiceChunkInbound(frame)` parser for server→client `voice_chunk` text frames `{id, conversationId, sequenceNumber, isFinal, fromUserId}` in `src/protocol/parsers.js`
- [x] T008 [P] Ensure `parseDelivered` extracts only `messageId` (remove `conversationId` and `deliveredAt` if present) in `src/protocol/parsers.js`
- [x] T009 [P] Ensure `parseError` extracts optional `correlationId` field in `src/protocol/parsers.js`
- [x] T010 Export `validateServerFrame` from `src/protocol/parsers.js` so it can be imported and called in `src/transport/wsClient.js`

**Checkpoint**: Protocol layer aligned with server wire format. Connect to ChatHub server, send `join_service`, receive `user_joined` with `displayName`, send `text_message`, receive `message_received` with correctly unwrapped `envelope`. Verify in Protocol Log that field names match spec.

---

## Phase 2: Foundational (REST API & Transport — Blocks All Stories)

**Purpose**: Fix REST paths, response shapes, and WebSocket lifecycle. MUST complete before any user story can function correctly.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T011 [P] Fix download path from `/api/download/${blobId}` to `/api/upload/download/${blobId}` in `src/api/download.js`
- [x] T012 Update `fetchHistory` to parse and return `{conversationId, messages, hasMore}` shape in `src/api/history.js`
- [x] T013 Update `fetchThread` to parse and return `{originalMessage, replies}` shape in `src/api/history.js`
- [x] T014 Update `fetchOnlineUsers` to parse `{serviceId, onlineUsers: [{userId, displayName, lastSeen}]}` and return `onlineUsers` array in `src/api/presence.js`
- [x] T015 Add client-side validation `file.size <= MAX_UPLOAD_BYTES` before upload; reject with user-visible error if exceeded in `src/api/upload.js`
- [x] T016 Move `heartbeat.start()` from inside PING handler to `onopen` handler in `src/transport/wsClient.js` so monitoring begins at connection time
- [x] T017 Call `validateServerFrame(frame)` on every inbound text frame in `src/transport/wsClient.js`; if invalid, log to Protocol Panel and discard (do not disconnect)
- [x] T018 Add `voice_chunk` frame handler in `src/transport/wsClient.js` that routes to `voiceSessionStore.startInbound()`
- [x] T019 Route inbound binary frames to active voice session and `audioPlayer.enqueueChunk()` when a voice session is active in `src/transport/wsClient.js`
- [x] T020 Add error handlers for `service_not_found`, `invalid_reply`, `invalid_attachment`, `voice_processing_error`, `voice_assembly_error` in `src/transport/wsClient.js` `handleFrame` switch

**Checkpoint**: Foundation ready — REST calls return 2xx with correct response shapes, heartbeat starts at connection time, `voice_chunk` frames are routed, malformed frames are logged and discarded.

---

## Phase 3: User Story 1 & 2 — Fix Protocol & REST Alignment (Priority: P0) 🎯 MVP

**Goal**: Client can connect, authenticate, send/receive text messages, and use REST APIs with correct field names and shapes.

**Independent Test**: Connect to ChatHub server, authenticate, send a text message, receive a `delivered` confirmation, create a conversation, fetch history, upload and download a file — all with correct field shapes and paths.

### Implementation for User Story 1 & 2

- [x] T021 [US1] Update `handleMessageReceived` in `src/App.jsx` to use `msg.senderId` (not `msg.fromUserId`), `msg.text` (not `msg.content.text`), `msg.attachment` (not `msg.content`)
- [x] T022 [US1] Update `handleUserJoined` in `src/App.jsx` to use `frame.displayName` (not `frame.userName`)
- [x] T023 [US1] Update `fetchOnlineUsers` callback in `src/App.jsx` to unwrap `{serviceId, onlineUsers}` and iterate the `onlineUsers` array
- [x] T024 [US2] Fix `fetchThread` call in `src/ui/MessageList.jsx` to unwrap `{originalMessage, replies}` response shape
- [x] T025 [P] [US1] Replace all `msg.fromUserId` with `msg.senderId` in `src/ui/MessageList.jsx`
- [x] T026 [P] [US1] Replace all `msg.fromUserName` with `msg.displayName` or lookup from presence store in `src/ui/MessageList.jsx`
- [x] T027 [P] [US1] Replace `msg.content?.text` with `msg.text` and `msg.content?.blobId` etc. with `msg.attachment?.blobId` in `src/ui/MessageList.jsx`
- [x] T028 [P] [US1] Rename `userName` to `displayName` throughout `src/state/presenceStore.js`; update store shape to `{userId, displayName, lastSeen, isOnline, isTyping, typingConversationId}`
- [x] T029 [US1] Update `setOnline` in `src/state/presenceStore.js` to accept `{userId, displayName, lastSeen}` from events and REST responses
- [x] T030 [P] [US1] Replace `user.userName` with `user.displayName` and `user.status` with `user.isOnline` / `user.lastSeen` in `src/ui/PresenceBar.jsx`
- [x] T031 [US2] Change sort key from `updatedAt` to `lastMessageAt` in `src/state/conversationStore.js`
- [x] T032 [US2] Update `ack(messageId)` in `src/state/messageStore.js` to log a warning and discard if `messageId` is not found in the store (FR-023)

**Checkpoint**: End-to-end text messaging works with correct field names. REST history fetch returns correct shapes. Presence shows `displayName`. Message list renders `senderId`, flat `text`, `attachment` correctly. Delivered confirmations work for known message IDs and warn for unknown IDs.

---

## Phase 4: User Story 3 — Inbound Voice Streaming (Priority: P1)

**Goal**: Users can hear live voice chunks from other users in real-time and see completed voice messages.

**Independent Test**: User A holds Push to Talk and speaks. User B receives `voice_chunk` text frames + binary frames, and plays the audio chunks within 500ms through the audio player. When complete, both see the voice message with a replay button.

### Implementation for User Story 3

- [x] T033 [US3] Implement `enqueueChunk(sessionId, sequenceNumber, arrayBuffer)` using `AudioContext.decodeAudioData()` and `AudioBufferSourceNode.start()` scheduling in `src/media/audioPlayer.js`
- [x] T034 [US3] Manage chunk buffer keyed by session ID; track playback position; schedule next chunk based on `AudioContext.currentTime` in `src/media/audioPlayer.js`
- [x] T035 [US3] Clean up voice session on `isFinal: true` — flush remaining buffer, emit completion event for UI in `src/media/audioPlayer.js`
- [x] T036 [US3] Add 64KB chunk size validation in `src/media/audioCapture.js` — if chunk exceeds `MAX_VOICE_CHUNK_BYTES`, log warning and skip/truncate before sending
- [x] T037 [US3] Update `startInbound()` in `src/state/voiceSessionStore.js` to accept `conversationId` parameter from inbound `voice_chunk` frame
- [x] T038 [US3] Create `src/state/fileAttachmentStore.js` — `Map<blobId, FileAttachment>` with `add(file)`, `get(blobId)`, `remove(blobId)`, tracking state transitions `uploading → uploaded → shared`

**Checkpoint**: Bidirectional voice streaming works. User A speaks, User B hears audio within 500ms. Completed voice messages appear with replay button. File attachments tracked in `fileAttachmentStore`.

---

## Phase 5: User Story 4 — Error Handling & Validation (Priority: P1)

**Goal**: All server error codes produce visible UI feedback. File uploads are validated client-side. Input validation prevents protocol violations.

**Independent Test**: Trigger each error code (`service_not_found`, `invalid_reply`, `invalid_attachment`, `voice_processing_error`, `voice_assembly_error`) and verify appropriate UI feedback. Drop a file > 100MB and verify rejection before upload. Send a voice chunk > 64KB and verify it's skipped with a warning.

### Implementation for User Story 4

- [x] T039 [US4] Add `service_not_found` error handler: toast "Service not found" + return to service selector view in `src/App.jsx`
- [x] T040 [US4] Add `invalid_reply` error handler: toast error message + dismiss reply preview in Composer in `src/App.jsx`
- [x] T041 [US4] Add `invalid_attachment` error handler: toast error detail in `src/App.jsx`
- [x] T042 [US4] Add `voice_processing_error` error handler: warning toast + log to Protocol Panel in `src/App.jsx`
- [x] T043 [US4] Add `voice_assembly_error` error handler: warning toast + discard incomplete voice session from `voiceSessionStore` in `src/App.jsx`
- [x] T044 [US4] Implement token refresh flow in `src/ui/AuthPanel.jsx` — detect `invalid_token` error, attempt silent refresh via REST, fall back to login screen with "Session expired" notification
- [x] T045 [US4] Add 100MB client-side file size validation in `src/ui/FileUploader.jsx` with user-visible error toast before upload attempt
- [x] T046 [US4] Wire all new error handlers from `src/transport/wsClient.js` into `src/App.jsx` event handlers so errors emit appropriate UI actions

**Checkpoint**: All 9+ error codes produce visible UI feedback within 1 second. File uploads ≥ 100MB are rejected client-side. Typing events are debounced to ≤ 4/second.

---

## Phase 6: User Story 5 — Typing Debounce & Heartbeat Timing (Priority: P2)

**Goal**: Typing indicator enforces 300ms minimum interval. Heartbeat monitor starts at connection time.

**Independent Test**: Rapidly press keys and verify typing events are throttled to ≤ 4/second. Connect to a server that never sends PING and verify connection flagged suspicious within 30 seconds.

### Implementation for User Story 5

- [x] T047 [US5] Change typing debounce from `3000` to `300` (or import `TYPING_DEBOUNCE_MS` from `config.js`) in `src/ui/Composer.jsx`

**Checkpoint**: Typing events debounced to 300ms minimum interval. Heartbeat monitoring starts at connection time (already done in T016).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation alignment, and cleanup

- [x] T048 [P] Update `src/protocol/messageTypes.js` spec reference comment from `002-web-test-client` to `003-web-client-alignment`
- [x] T049 Run `quickstart.md` validation: start server, connect two browser tabs, verify text messaging, voice streaming, file upload/download, presence, typing, and error handling end-to-end
- [x] T050 Verify all FR-001 through FR-023 acceptance scenarios pass against a running ChatHub server
- [x] T051 Review Protocol Log output for correct field names in all frame types (join_service, text_message, message_received, delivered, voice_chunk, file_attachment, typing, error)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — BLOCKS all user stories
- **Phase 3 (US1 & US2)**: Depends on Phase 2 completion
- **Phase 4 (US3)**: Depends on Phase 2 completion (wsClient routing of voice_chunk); can proceed in parallel with Phase 3
- **Phase 5 (US4)**: Depends on Phase 2 and Phase 3 (needs working message display for error toasts)
- **Phase 6 (US5)**: Depends on Phase 2; T047 (typing debounce) can be done in parallel with Phase 3
- **Phase 7 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 & 2 (P0)**: Can start after Phase 2 — core protocol and REST alignment
- **User Story 3 (P1)**: Can start after Phase 2 — voice streaming is independent of text messaging UI fixes
- **User Story 4 (P1)**: Depends on Phase 2 and Phase 3 — needs working message display for error toasts
- **User Story 5 (P2)**: Can start after Phase 2 — typing debounce is independent

### Within Each Phase

- Config changes (T001-T002) before parser changes (T005-T010)
- Protocol fixes (T003-T010) before transport fixes (T016-T020)
- State store fixes (T028-T032) before UI component fixes (T021-T027, T030)
- Audio player implementation (T033-T035) before voice chunk routing (T018-T019) integration testing

### Parallel Opportunities

- T003, T004 can run in parallel (different files in same layer)
- T007, T008, T009 can run in parallel (different parser functions)
- T011, T014, T015 can run in parallel (different API files)
- T025, T026, T027 can run in parallel (different field fixes in same file, but independent sections)
- T033, T034, T035 can partially parallel (audioPlayer.js sequential implementation)
- T039-T043 can run in parallel (different error handlers, all in App.jsx but independent)

---

## Parallel Example: Phase 1 + 2

```bash
# After Phase 1 config setup:
Task T001: "Fix API_BASE and WS_URL port in src/config.js"
Task T002: "Add constants to src/config.js"

# After config is ready, these can run in parallel:
Task T003: "Add VOICE_CHUNK/VOICE_MESSAGE to src/protocol/messageTypes.js"
Task T004: "Add buildVoiceMessage in src/protocol/builders.js"

# After messageTypes are ready:
Tasks T005-T010: "Fix parsers (sequential within parsers.js)"
```

## Parallel Example: Phase 3

```bash
# These can run in parallel across different files:
Task T025: "Replace msg.fromUserId with msg.senderId in MessageList.jsx"
Task T026: "Replace msg.fromUserName with msg.displayName in MessageList.jsx"
Task T027: "Replace msg.content references with msg.text/msg.attachment in MessageList.jsx"
Task T028: "Rename userName to displayName in presenceStore.js"
Task T030: "Replace user.userName with user.displayName in PresenceBar.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 & 2 Only)

1. Complete Phase 1: Setup (config + protocol fixes)
2. Complete Phase 2: Foundational (REST + transport fixes)
3. Complete Phase 3: User Story 1 & 2 (UI + state alignment)
4. **STOP and VALIDATE**: Test text messaging end-to-end against ChatHub server
5. Deploy/demo if ready — core chat is functional

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 → Text messaging works end-to-end → **MVP**
3. Phase 4 → Voice streaming works bidirectionally
4. Phase 5 → All error codes handled, 100MB upload limit enforced
5. Phase 6 → Typing debounce calibrated
6. Phase 7 → Full validation complete

### Parallel Team Strategy

With multiple developers:
1. Team completes Phase 1 + 2 together (foundational)
2. Once foundational is done:
   - Developer A: Phase 3 (UI/state alignment — text messaging)
   - Developer B: Phase 4 (voice streaming)
3. After both complete: Phase 5 (error handling) + Phase 6 (typing) + Phase 7 (polish)

---

## Notes

- This is an alignment/bug-fix effort, not a new build — all tasks modify existing files
- T-suffix task IDs (A01, B01, etc.) in plan.md map to T-prefix task IDs here
- Phase 2 tasks (especially T016-T020) are the most critical bottleneck — wsClient.js changes affect the most components
- The `fileAttachmentStore.js` (T038) is the only new file; all other tasks modify existing files
- T010 (export validateServerFrame) must be done before T017 (call it in wsClient) — these are in different phases but have a direct dependency
# Feature Specification: Web Client Realignment with ChatHub Server

**Feature Branch**: `003-web-client-alignment`  
**Created**: 2026-05-11  
**Status**: Draft  
**Input**: Revisiting the web client implementation to align with the actual ChatHub server protocol and REST API, fixing all mismatches identified between the 002 spec, the current source code, and the server's actual wire format.

## Background

The 002-web-test-client spec contained several protocol and API assumptions that diverge from what the ChatHub server actually implements. After auditing the server code against the client code, the following categories of issues were found:

## Clarifications

### Session 2026-05-11

- Q: When the JWT token expires during an active WebSocket or REST session, what should the client do? → A: Attempt silent token refresh via a refresh-token endpoint; if refresh fails, fall back to login screen.
- Q: When `validateServerFrame()` rejects an inbound frame (malformed/missing required fields), what should the client do? → A: Log the validation failure in the protocol panel and discard the malformed frame; keep the connection alive.
- Q: When `delivered` arrives for a message ID not in the local message store, what should the client do? → A: Log the unknown `messageId` in the protocol panel as a warning and discard it.

### Category A — Protocol Field Mismatches (Breaks Communication)

| # | Issue | Current (Wrong) | Server Reality |
|---|---|---|---|
| A1 | `join_service` auth | Token sent in frame body | Token sent as `?token=` query param on WS URL |
| A2 | `join_service` fields | `{type, serviceId, token}` | `{type, serviceId}` (no token in frame) |
| A3 | `leave_service` fields | No fields per 002 spec | `{type, serviceId}` (serviceId is required) |
| A4 | `text_message` content shape | Nested `content: {text}` | Flat `text` field at top level |
| A5 | `voice_chunk` ID field name | `messageId` | `id` |
| A6 | `file_attachment` message type | Not in 002 spec | Full client→server type with `blobId`, `fileName`, `mimeType`, `sizeBytes`, `durationMs?`, `replyToId?` |
| A7 | `voice_message` message type | Not in 002 spec | Client→server type for pre-recorded voice with `blobId`, `durationMs`, `mimeType` |
| A8 | `message_received` format | Flat fields per 002 spec | Nested in `envelope` object |
| A9 | `user_joined` name field | `userName` | `displayName` |
| A10 | `delivered` fields | `{messageId, conversationId, deliveredAt}` | `{messageId}` only |
| A11 | `error` fields | `{code, message}` | `{code, message, correlationId}` |
| A12 | Server→client `voice_chunk` | Not in 002 spec | `{type, id, conversationId, sequenceNumber, isFinal, fromUserId}` |

### Category B — REST API Mismatches

| # | Issue | Current (Wrong) | Server Reality |
|---|---|---|---|
| B1 | Base URL port | `localhost:5068` | `localhost:8080` |
| B2 | Conversation paths | `/api/conversations/` (plural) | `/api/conversation/` (singular) |
| B3 | Message history response | Plain array `[{message}]` | `{conversationId, messages: [{message}], hasMore}` |
| B4 | Thread/replies response | Plain array `[{message}]` | `{originalMessage, replies: [{message}]}` |
| B5 | Health endpoints | `/health` and `/health/ready` | `/healthz` and `/readyz` |
| B6 | Download path | `/api/download/{blobId}` | `/api/upload/download/{blobId}` |
| B7 | Upload response | Status 201 | Status 200 |

### Category C — Missing Client Features

| # | Issue | Impact |
|---|---|---|
| C1 | Inbound voice streaming (receive+play) is non-functional | Cannot hear live voice from others |
| C2 | `audioPlayer.enqueueChunk()` is a stub | Live voice playback doesn't work |
| C3 | No 300ms minimum typing debounce | May trigger server rate-limits |
| C4 | No `service_not_found` error handling | No UI feedback for this error |
| C5 | No `invalid_reply` error handling | Reply to nonexistent message has no feedback |
| C6 | No `invalid_attachment` error handling | Bad file attachment sends have no feedback |
| C7 | No client-side 100MB upload limit validation | Large uploads may fail server-side |
| C8 | No client-side 64KB voice chunk size validation | Oversized chunks rejected silently |
| C9 | Heartbeat monitor only starts after first PING | No timeout detection if server never pings |
| C10 | `validateServerFrame()` defined but never called | No inbound frame sanitization |
| C11 | `fileAttachmentStore` from data model never created | File metadata only tracked in messages |

### Category D — Extraneous Client Features (Not in Server Protocol)

| # | Issue | Impact |
|---|---|---|
| D1 | `serviceId` sent in `text_message` | Server reads from connection context, extra field is ignored |
| D2 | `uploadFromUrl()` helper | Not in server spec, but harmless utility |

Note: D1 and D2 are harmless and do not need changes.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fix Protocol Alignment (Priority: P0)

As a developer, I need the web client to communicate with the ChatHub server using the correct wire format so that authentication, messaging, voice streaming, and file sharing all function end-to-end.

**Why this priority**: Without correct protocol alignment, no feature works at all. Every message sent or received would be malformed or rejected.

**Independent Test**: Connect to the running ChatHub server, authenticate, send a text message, receive a text message, and verify the `delivered` confirmation — all with correct field shapes.

**Acceptance Scenarios**:

1. **Given** the ChatHub server is running, **When** the client opens a WebSocket to `ws://localhost:8080/ws?token={jwt}`, **Then** the connection upgrades successfully and the client sends `join_service` with only `{type, serviceId}`.
2. **Given** an authenticated connection, **When** the client sends `{type: "text_message", id, conversationId, serviceId, text, replyToId?}`, **Then** the server delivers the message and responds with `{type: "delivered", messageId}`.
3. **Given** another user sends a message, **When** the client receives `{type: "message_received", envelope: {...}}`, **Then** the parser unwraps the `envelope` object and displays `senderId`, `type`, `text`, and `attachment` fields correctly.
4. **Given** a voice stream, **When** the client sends `{type: "voice_chunk", id, conversationId, sequenceNumber, isFinal}` followed by a binary frame, **Then** the server accepts the chunk (field name `id`, not `messageId`).

---

### User Story 2 - Fix REST API Paths and Responses (Priority: P0)

As a developer, I need all REST calls to use the correct server paths and parse the correct response shapes so that conversations, history, uploads, and downloads work.

**Why this priority**: Without correct REST paths, every HTTP call returns 404. This blocks all non-realtime features.

**Independent Test**: Create a conversation, fetch conversation list, fetch message history, upload a file, and download a file — all using correct paths and parsing correct responses.

**Acceptance Scenarios**:

1. **Given** a valid JWT, **When** the client calls `POST /api/conversation` with `{serviceId, title?, participantIds}`, **Then** a conversation is created and the response includes `{id, serviceId, participantIds, createdAt}`.
2. **Given** a conversation with messages, **When** the client calls `GET /api/conversation/{id}/messages?before=&limit=`, **Then** the response body is `{conversationId, messages: [...], hasMore}` and messages are rendered in correct chronological order.
3. **Given** a message with replies, **When** the client calls `GET /api/conversation/{id}/messages/{msgId}/replies`, **Then** the response is `{originalMessage, replies}` and the thread is displayed correctly.

---

### User Story 3 - Implement Inbound Voice Streaming (Priority: P1)

As a tester, I want to hear live voice chunks from other users in real-time so that I can validate the walkie-talkie feature end-to-end.

**Why this priority**: Receiving voice is half the voice feature. Sending works (outbound chunks are sent correctly), but receiving and playing is entirely missing.

**Independent Test**: User A holds Push to Talk and speaks. User B receives `voice_chunk` text frames + binary frames, and plays the audio chunks within 500ms through the audio player.

**Acceptance Scenarios**:

1. **Given** User A is streaming voice, **When** User B receives a `voice_chunk` text envelope `{type, id, conversationId, sequenceNumber, isFinal, fromUserId}`, **Then** `voiceSessionStore.startInbound()` is called and subsequent binary frames are routed to the session.
2. **Given** an inbound voice session, **When** binary audio frames arrive, **Then** `audioPlayer.enqueueChunk(messageId, sequenceNumber, arrayBuffer)` decodes and plays chunks in sequence order with minimal gap.
3. **Given** `isFinal: true` on an inbound voice chunk, **When** the last binary frame is processed, **Then** the completed voice message appears in the message list with a replay button.

---

### User Story 4 - Add Missing Error Handling and Validation (Priority: P1)

As a tester, I want the client to gracefully handle all server error codes and validate inputs before sending so that I can observe correct behavior under edge cases.

**Why this priority**: Missing error handling means the UI silently fails on `service_not_found`, `invalid_reply`, `invalid_attachment`, and `voice_processing_error`.

**Independent Test**: Trigger each error code and verify the UI shows appropriate feedback (toast, disabled input, conversation redirect, etc.).

**Acceptance Scenarios**:

1. **Given** the server sends `{type: "error", code: "service_not_found"}`, **When** the client receives it, **Then** a toast displays "Service not found" and the UI returns to the service selector.
2. **Given** the server sends `{type: "error", code: "invalid_reply", correlationId: "..."}`, **When** the client receives it, **Then** a toast displays the error and the reply preview is dismissed.
3. **Given** a file larger than 100MB, **When** the user drops it into the upload zone, **Then** the client rejects it before upload and shows a "File too large" toast.
4. **Given** a voice chunk exceeding 64KB, **When** the chunk is about to be sent, **Then** the client logs a warning and skips or truncates it.

---

### User Story 5 - Fix Typing Debounce and Heartbeat Timing (Priority: P2)

As a developer, I need the typing indicator to enforce a 300ms minimum interval between emitted events, and the heartbeat monitor to start at connection time so that protocol-compliant timing is maintained.

**Why this priority**: Without debounce, rapid keypresses may flood the server. Without initial heartbeat monitoring, a dead connection could go undetected.

**Independent Test**: Rapidly press and release keys and verify typing events are throttled. Connect to a server that never sends PING and verify the connection is flagged suspicious within 30 seconds.

**Acceptance Scenarios**:

1. **Given** the user types rapidly, **When** 5 keystrokes occur within 300ms, **Then** at most 2 `typing` events are sent to the server (300ms apart).
2. **Given** a WebSocket connection with no PING from the server, **When** 30 seconds elapse, **Then** the heartbeat monitor flags the connection as suspicious and triggers reconnect.

---

### Edge Cases

- What happens when a `voice_chunk` text frame arrives without a preceding binary frame correlation?
- What happens when `message_received` arrives with no `envelope` property (malformed)?
- What happens when the server sends `voice_processing_error` during an active voice session?
- What happens when `delivered` arrives for a message ID that doesn't exist in the store? → Log a warning in the protocol panel and discard the frame.
- What happens when the REST API returns `{hasMore: true}` and the user scrolls up?
- What happens when `createConversation` returns a conversation the user is already a participant in?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Client MUST establish WebSocket connection to `ws://localhost:8080/ws?token={jwt}` with JWT as a query parameter (NOT in the `join_service` frame body).
- **FR-002**: Client MUST send `join_service` frame with shape `{type: "join_service", serviceId: string}` (no `token` field).
- **FR-003**: Client MUST send `leave_service` frame with shape `{type: "leave_service", serviceId: string}`.
- **FR-004**: Client MUST send `text_message` with flat `text` field (NOT nested in `content`): `{type, id, conversationId, serviceId, text, replyToId?}`.
- **FR-005**: Client MUST send `voice_chunk` with field name `id` (NOT `messageId`): `{type, id, conversationId, sequenceNumber, isFinal}`.
- **FR-006**: Client MUST send `file_attachment` frames for sharing uploaded files: `{type: "file_attachment", id, conversationId, blobId, fileName, mimeType, sizeBytes, durationMs?, replyToId?}`.
- **FR-007**: Client MUST parse `message_received` by unwrapping the `envelope` sub-object to extract `id`, `conversationId`, `serviceId`, `senderId`, `type`, `text`, `attachment`, `replyToId`, `createdAt`.
- **FR-008**: Client MUST parse `user_joined` by mapping `displayName` to the user display name field.
- **FR-009**: Client MUST handle `delivered` with only `messageId` (no `conversationId` or `deliveredAt` in the frame).
- **FR-010**: Client MUST handle `error` frames with optional `correlationId` field.
- **FR-011**: Client MUST route inbound `voice_chunk` text frames and binary frames to `voiceSessionStore` and `audioPlayer`.
- **FR-012**: Client MUST implement `audioPlayer.enqueueChunk()` with real AudioContext decoding and AudioBufferSourceNode scheduling for gapless playback.
- **FR-013**: Client MUST emit `typing` events with a minimum 300ms debounce interval between consecutive events.
- **FR-014**: Client MUST start heartbeat monitoring at connection time (not only after first PING), flagging the connection as suspicious after 30 seconds with no PING.
- **FR-015**: Client MUST validate file size ≤ 100MB before upload and reject oversized files with a user-visible error.
- **FR-016**: Client MUST handle error codes: `rate_limit_exceeded`, `invalid_message`, `not_participant`, `invalid_token`, `service_not_found`, `invalid_reply`, `invalid_attachment`, `voice_processing_error`, `voice_assembly_error`.
- **FR-017**: Client MUST use REST paths: `POST /api/conversation`, `GET /api/conversation`, `GET /api/conversation/{id}/messages`, `GET /api/conversation/{id}/messages/{msgId}/replies`, `POST /api/upload/file`, `GET /api/upload/download/{blobId}`, `GET /api/services/{serviceId}/online`.
- **FR-018**: Client MUST parse REST responses in their correct shapes: message history returns `{conversationId, messages, hasMore}`, thread returns `{originalMessage, replies}`, upload returns `{blobId, fileName, mimeType, sizeBytes, durationMs?, url?}`.
- **FR-019**: Client MUST use API base URL `http://localhost:8080` and WebSocket URL `ws://localhost:8080/ws` as defaults (configurable via environment).
- **FR-020**: Client MUST call `validateServerFrame()` on every inbound text frame before processing.
- **FR-021**: Client MUST attempt silent token refresh via a refresh-token endpoint when the JWT expires during an active session; if refresh fails, the client MUST redirect the user to the login screen with a "Session expired" notification.
- **FR-022**: Client MUST log inbound frame validation failures in the protocol panel and discard the malformed frame without disconnecting the WebSocket.
- **FR-023**: Client MUST log a warning in the protocol panel when a `delivered` frame references a `messageId` not found in the local message store, and discard the frame without creating a phantom entry.

### Key Entities

- **MessageEnvelope**: The nested object inside `message_received` containing `id`, `conversationId`, `serviceId`, `senderId`, `type`, `text?`, `attachment?`, `replyToId?`, `createdAt`.
- **Attachment**: `{blobId, fileName, mimeType, sizeBytes, durationMs?}` — embedded in `message_received.envelope` and `file_attachment`.
- **VoiceChunkEnvelope**: `{type: "voice_chunk", id, conversationId, sequenceNumber, isFinal, fromUserId}` — immediately followed by a binary frame with raw audio bytes.
- **ConversationDocument**: `{id, serviceId, participantIds, title?, createdBy, createdAt, lastMessageAt?}` — returned by REST API.
- **MessageDto**: `{id, senderId, type, text?, attachment?, replyToId?, createdAt}` — returned in history and thread REST responses.
- **UploadResponse**: `{blobId, fileName, mimeType, sizeBytes, durationMs?, url?}` — returned by `POST /api/upload/file`.
- **OnlineUser**: `{userId, displayName, lastSeen}` — returned by `GET /api/services/{serviceId}/online`.
- **ErrorResponse**: `{error: {code, message, details?}}` — returned by REST API; WebSocket error: `{type: "error", code, message, correlationId?}`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All WebSocket messages use the correct field names and shapes as defined by the chat-hub server protocol, verified by observing the wire in the protocol log.
- **SC-002**: All REST calls return 2xx status codes (not 404) against a running ChatHub server.
- **SC-003**: A user can connect, authenticate, send a text message, and receive a `delivered` confirmation end-to-end.
- **SC-004**: Live voice streaming works bidirectionally: User A speaks, User B hears chunks within 500ms, and both see the completed voice message.
- **SC-005**: File upload → share → download works: upload returns a `blobId`, `file_attachment` is sent, remote client renders the file card, download works via `GET /api/upload/download/{blobId}`.
- **SC-006**: All server error codes produce visible UI feedback within 1 second.
- **SC-007**: File uploads ≥ 100MB are rejected client-side before the HTTP request is sent.
- **SC-008**: Typing events are debounced to ≤ 4 per second (300ms minimum interval).

## Assumptions

- The ChatHub server is running locally at `ws://localhost:8080/ws` and `http://localhost:8080`.
- The server uses singular REST paths (`/api/conversation/`, `/api/upload/`, `/api/services/`).
- The server wraps `message_received` payloads in an `envelope` sub-object.
- The server sends `displayName` (not `userName`) in `user_joined`.
- The server sends only `messageId` in `delivered` (not `conversationId` or `deliveredAt`).
- JWT tokens are passed as WebSocket query parameters, not in message bodies.
- The browser supports `WebSocket`, `fetch`, `MediaRecorder`, `getUserMedia`, and `AudioContext`.
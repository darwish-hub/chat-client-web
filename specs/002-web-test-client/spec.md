# Feature Specification: ChatHub Web Test Client

**Feature Branch**: `002-web-test-client`  
**Created**: 2026-05-10  
**Status**: Draft  
**Input**: User description: "want to implement the features specified in plan-client.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect and Authenticate (Priority: P1)

As a developer or QA engineer, I want to open the test client in a browser, paste a JWT token, and establish a persistent WebSocket connection so that I can begin testing the ChatHub service.

**Why this priority**: Without a working connection, no other feature can be validated. This is the foundational gate for all subsequent testing.

**Independent Test**: Can be fully tested by opening the client, pasting a token, clicking Connect, and observing the connection status turn green with `user_joined` confirmation in the Logs panel.

**Acceptance Scenarios**:

1. **Given** the ChatHub server is running at `ws://localhost:8080/ws`, **When** I paste a valid JWT and click Connect, **Then** the WebSocket upgrades successfully, the client receives `user_joined`, and heartbeat ping/pong keeps the connection alive.
2. **Given** an invalid or expired JWT, **When** I click Connect, **Then** the connection is rejected with a clear error message before the WebSocket upgrade completes.

---

### User Story 2 - Send and Receive Text Messages (Priority: P1)

As a tester, I want to create conversations and exchange text messages with delivery confirmation so that I can validate the core messaging pipeline end-to-end.

**Why this priority**: Text messaging is the primary value proposition of ChatHub. Validating send, delivery, and history recovery is essential before testing advanced features.

**Independent Test**: Can be fully tested by having two browser tabs connect, create/join a conversation, send messages, and verify both clients see the messages with delivery checkmarks.

**Acceptance Scenarios**:

1. **Given** two authenticated clients are connected, **When** User A creates a conversation and sends "Hello", **Then** User B sees the conversation, the message appears with sender name and timestamp, and a delivery checkmark renders upon `delivered`.
2. **Given** a client reconnects after being offline, **When** the conversation is opened, **Then** missed messages are fetched from the server via REST and inserted in correct chronological order without duplicates.

---

### User Story 3 - Stream and Receive Live Voice (Priority: P1)

As a tester, I want to hold a "Push to Talk" button to record and stream live voice chunks in real-time so that I can validate the walkie-talkie latency and binary frame protocol.

**Why this priority**: Live voice is a key differentiator for ChatHub. The binary WebSocket frame path and sub-500ms latency target require explicit validation.

**Independent Test**: Can be fully tested by having one client hold Push to Talk and speak while a remote client listens; audio chunks should play within 500ms.

**Acceptance Scenarios**:

1. **Given** microphone permission is granted, **When** User A holds Push to Talk for 5 seconds and releases, **Then** User B hears audio chunks within 500ms, and a completed voice message appears in both histories with a replay button.
2. **Given** the "Simulate packet loss" toggle is enabled, **When** voice chunks are streamed, **Then** 1 in 20 chunks are dropped client-side with a visual warning, but the server still assembles the final message.

---

### User Story 4 - Share and Download Files/Video (Priority: P2)

As a tester, I want to upload files and videos via drag-and-drop, share them in a conversation, and download received attachments so that I can validate the REST upload/download pipeline and media rendering.

**Why this priority**: File sharing extends ChatHub beyond text and voice. Testing upload progress, preview, and download ensures the blob storage integration works correctly.

**Independent Test**: Can be fully tested by dropping a file into the upload zone, observing progress, and having a remote client preview/download the file.

**Acceptance Scenarios**:

1. **Given** a 5MB MP4 file, **When** User A drops it into the drop zone, **Then** a progress bar fills, on completion a video message appears, and User B can click to play the video inline.
2. **Given** a PDF file is uploaded, **When** User B clicks the download link, **Then** the file is saved locally with correct name, size, and MIME type displayed.

---

### User Story 5 - Monitor Presence and Typing (Priority: P2)

As a tester, I want to see which users are online in the current service and observe real-time typing indicators so that I can validate presence state synchronization.

**Why this priority**: Presence and typing are real-time UX signals. Testing them validates the fan-out and event broadcast mechanisms of the server.

**Independent Test**: Can be fully tested by having two clients join the same service and observing the presence bar and typing dots.

**Acceptance Scenarios**:

1. **Given** Users A and B are connected and joined to service S, **When** they look at the presence bar, **Then** both see each other's names with an online indicator.
2. **Given** User A starts typing in a conversation, **When** 500ms passes, **Then** User B sees "User A is typing..." above the composer; when User A stops, the indicator clears within 5 seconds.

---

### User Story 6 - Reply to Messages (Priority: P3)

As a tester, I want to reply to any message and view reply threads so that I can validate the threading and reply context features.

**Why this priority**: Message threading improves conversation organization. It tests the `replyToId` field in the wire protocol and history API.

**Independent Test**: Can be fully tested by sending a message, clicking Reply, typing a response, and verifying the visual thread line and navigation.

**Acceptance Scenarios**:

1. **Given** a conversation with a message "Meeting at 3?", **When** User B clicks Reply and sends "Works for me", **Then** User A sees the reply visually linked to the original with a thread line.
2. **Given** a message has replies, **When** User C clicks "View Thread", **Then** only the reply chain is displayed, and clicking a reply scrolls to the original message.

---

### User Story 7 - Recover from Disconnections (Priority: P3)

As a tester, I want the client to automatically reconnect, backfill missed messages, and handle rate limits gracefully so that I can validate resilience and error handling.

**Why this priority**: Network resilience is critical for real-time systems. Testing reconnection, deduplication, and error responses ensures production readiness.

**Independent Test**: Can be fully tested by disconnecting WiFi, sending messages from another client, reconnecting, and verifying correct recovery.

**Acceptance Scenarios**:

1. **Given** User A sends 20 messages rapidly, **When** the rate limit is exceeded, **Then** a toast appears, the composer is disabled for 5 seconds, and input is re-enabled automatically.
2. **Given** User A disables WiFi for 10 seconds then re-enables it, **When** the client auto-reconnects with exponential backoff, **Then** missed messages are fetched and appended in correct order without duplicates.

---

### User Story 8 - Logging, Metrics & Manual Test Scenarios (Priority: P3)

As a developer or QA engineer, I want a built-in protocol log, metrics dashboard, and one-click test scenarios so that I can debug issues and run repeatable validation scripts.

**Why this priority**: Observability and reproducible tests reduce debugging time and provide confidence in server compliance.

**Independent Test**: Can be fully tested by running each one-click scenario button and verifying the protocol log records all frames.

**Acceptance Scenarios**:

1. **Given** the client is connected, **When** I click "Run Text Message Test", **Then** the client auto-creates a conversation, sends 5 messages, and verifies `delivered` for each.
2. **Given** messages have been sent and received, **When** I open the Metrics Dashboard, **Then** I see connection uptime, message counts, average latency, and voice chunk latency histogram.

---

### Edge Cases

- What happens when a voice chunk arrives out of sequence?
- How does the system handle a 100MB file upload exceeding server limits?
- What happens when a user tries to send a message to a conversation they are not a participant in?
- How does the client behave when the server returns an `invalid_message` error?
- What happens when two clients with the same JWT token connect simultaneously?
- How does the client handle a binary voice frame without a preceding text envelope?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Client MUST establish a persistent WebSocket connection using native `WebSocket` with a custom JSON wire format.
- **FR-002**: Client MUST authenticate via JWT token pasted into the UI and sent via `join_service` within 5 seconds of connection.
- **FR-003**: Client MUST send text messages with a client-generated UUID and display delivery confirmation.
- **FR-004**: Client MUST deliver text messages within 1 second under normal network conditions.
- **FR-005**: Client MUST stream live voice using binary WebSocket frames with sequence-ordered playback.
- **FR-006**: Client MUST assemble and store voice/video messages after streaming completes.
- **FR-007**: Client MUST upload and share files up to 100MB via REST with progress tracking.
- **FR-008**: Client MUST display file metadata (name, size, MIME type) for shared attachments.
- **FR-009**: Client MUST download received files via REST.
- **FR-010**: Client MUST display online/offline status of users in the current service.
- **FR-011**: Client MUST show real-time typing indicators with debounced emit and 5-second timeout.
- **FR-012**: Client MUST allow replying to any message and render reply threads with visual context.
- **FR-013**: Client MUST maintain chronological message ordering, including inserting older messages from history fetches.
- **FR-014**: Client MUST validate JWT before WebSocket upgrade and handle auth failures gracefully.
- **FR-015**: Client MUST deliver messages only to conversation participants.
- **FR-016**: Client MUST handle graceful interruptions with automatic reconnection and exponential backoff.
- **FR-017**: Client MUST retrieve missed messages after reconnection via REST history endpoint.

### Key Entities

- **Conversation**: A chat room with a unique ID, title, service ID, and participant list.
- **Message**: A chat envelope with ID, conversation ID, sender, type (text/voice/video/file), content, timestamp, delivery status, and optional replyToId.
- **User**: A participant identified by a unique user ID and display name, with online/typing state.
- **VoiceSession**: An active live voice stream tracking message ID, sequence numbers, conversation ID, and chunk buffers for inbound/outbound streams.
- **FileAttachment**: A shared file with blob ID, file name, MIME type, size, and optional duration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can connect within 3 seconds from clicking Connect to observing `user_joined`.
- **SC-002**: Text messages are delivered in under 1 second as measured by `delivered` timestamp minus send timestamp.
- **SC-003**: Voice stream latency is under 500ms as measured by chunk receive time minus chunk send time.
- **SC-004**: File uploads up to 100MB complete with progress bar and no client crash.
- **SC-005**: The system supports 10,000 concurrent connections (server-scoped; client can simulate multi-device with 2–3 tabs).
- **SC-006**: 100 messages per minute can be sent without triggering rate limiting.
- **SC-007**: 99.9% of sent messages receive a `delivered` confirmation within 1 second.
- **SC-008**: Missed messages are retrieved in under 2 seconds after reconnection.
- **SC-009**: Presence updates are visible to remote clients within 2 seconds of a user joining or leaving.
- **SC-010**: File downloads achieve 1MB/s for files under 50MB.

## Assumptions

- The ChatHub server is running locally at `ws://localhost:8080/ws` and `http://localhost:8080`.
- A valid JWT token is available (the client does not implement an auth server; tokens are pasted).
- The browser supports `WebSocket`, `fetch`, `MediaRecorder`, `getUserMedia`, and `AudioContext`.
- Microphone permission is granted when requested.
- The test user is already a participant in at least one conversation, or the client can create one via REST.
- The client is not a production consumer app but a testing and validation tool for developers and QA.

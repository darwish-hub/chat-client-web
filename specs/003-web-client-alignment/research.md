# Research: Web Client Realignment with ChatHub Server

**Date**: 2026-05-11
**Feature**: Web Client Realignment with ChatHub Server (003)
**Purpose**: Document technical decisions for fixing protocol, API, and feature mismatches between the existing web client source code and the actual ChatHub server implementation.

---

## Decision: Fix Protocol Field Names in-place (parsers, builders, messageTypes)

**Rationale**: The protocol layer (`src/protocol/`) is the source of truth for wire format. All field name mismatches (A1–A12) originate here or in consumers of parsed data. Fixing them at the protocol layer cascades correctly to state and UI layers, ensuring end-to-end alignment with the server.

**Alternatives considered**:
- Adapter pattern (keep old names internally, translate at boundary): Rejected — adds complexity and makes it harder to verify wire format correctness via protocol log.
- Fork and rewrite: Rejected — the existing code structure is sound; only the content needs correction.

---

## Decision: Unwrap `envelope` in `message_received` Parser

**Rationale**: The server wraps all message data inside an `envelope` sub-object in `message_received` frames. The parser must unwrap this to produce a flat `MessageEnvelope` object that the rest of the code consumes uniformly (from both WebSocket and REST sources).

**Alternatives considered**:
- Keep nested envelope throughout the codebase: Rejected — every consumer would need `.envelope.` access, creating inconsistency with history REST responses that are already flat.

---

## Decision: Rename `userName` → `displayName` Throughout

**Rationale**: The server sends `displayName` in `user_joined` events and in the presence REST API response. Using the canonical field name everywhere eliminates confusion and makes the protocol log directly interpretable.

**Alternatives considered**:
- Keep `userName` internally with a mapping at the parser: Rejected — creates a hidden translation layer that makes debugging harder for a test client.

---

## Decision: Use Flat `text` and `attachment` Fields on Messages

**Rationale**: The server sends `text` and `attachment` as top-level fields on the envelope, not nested in a `content` object. Flattening at parse time ensures consistency between WebSocket-sourced and REST-sourced messages.

**Alternatives considered**:
- Keep `content: { text, attachment }` internally: Rejected — adds an unnecessary nesting level and diverges from the data model.

---

## Decision: Start Heartbeat at Connection Time (Not After First PING)

**Rationale**: Per FR-014 and spec clarification, the heartbeat monitor must start immediately when the WebSocket opens. Otherwise, if the server never sends a PING (crashed or misconfigured), the client never detects the dead connection. Moving `heartbeat.start()` from inside the PING handler to the `onopen` handler fixes this.

**Alternatives considered**:
- Add a separate "startup timer" that only checks for first PING: Rejected — conflates two concerns; starting heartbeat immediately is simpler and matches the server's 15s PING_INTERVAL expectation.

---

## Decision: Implement `audioPlayer.enqueueChunk()` with AudioContext

**Rationale**: The spec (FR-012) requires real AudioContext decoding and AudioBufferSourceNode scheduling for gapless playback. The current stub just logs. Web Audio API is supported in all target browsers (Chrome 120+, Firefox 120+, Edge 120+, Safari 17+) per the constitution.

**Alternatives considered**:
- Use `<audio>` element with WebM blobs: Rejected — introduces latency (can't play partial chunks) and doesn't support sequencing.
- Use MediaSource Extensions (MSE): Rejected — more complex, designed for video streaming, not ideal for real-time voice chunk sequencing.

---

## Decision: Change Typing Debounce from 3000ms to 300ms

**Rationale**: The spec (FR-013, C3) requires a minimum 300ms interval between typing events. The current `Composer.jsx` uses 3000ms which would cause typing events to appear stale or not show at all. 300ms is the minimum to avoid server rate-limiting while still feeling responsive.

**Alternatives considered**:
- 500ms debounce: Rejected — the spec explicitly requires 300ms minimum, and a tighter debounce gives more responsive typing indicators.

---

## Decision: Change Config Port from 5068 to 8080

**Rationale**: Both the REST API and WebSocket server run on port 8080. Port 5068 was an incorrect assumption from the 002 spec. This is a single-line fix in `config.js`.

**Alternatives considered**:
- Make port configurable only (no default change): Rejected — the default must match the actual server.

---

## Decision: Correct REST Paths to Singular Form

**Rationale**: The server uses `/api/conversation/` (singular), not `/api/conversations/` (plural). Similarly, `/api/upload/download/` not `/api/download/`. Path corrections are localized to `src/api/` files.

**Alternatives considered**:
- Add path aliasing/redirects on the server: Rejected — this is a client fix; the server paths are the source of truth.

---

## Decision: Parse REST Response Wrappers (history, thread, presence)

**Rationale**: The server returns `{conversationId, messages, hasMore}` for history, `{originalMessage, replies}` for threads, and `{serviceId, onlineUsers}` for presence — not plain arrays. The `src/api/history.js` and `src/api/presence.js` must unwrap these shapes before returning data to consumers.

**Alternatives considered**:
- Return raw responses and let consumers destructure: Rejected — violates the constitution's layered architecture (API layer should abstract wire format).

---

## Decision: Handle All 9 WebSocket Error Codes

**Rationale**: The current code only handles `rate_limit_exceeded`, `not_participant`, and `invalid_message`. The spec (FR-016) requires handling all 9 codes: `invalid_token`, `rate_limit_exceeded`, `not_participant`, `invalid_message`, `service_not_found`, `invalid_reply`, `invalid_attachment`, `voice_processing_error`, `voice_assembly_error`, plus `server_error`.

**Alternatives considered**:
- Add generic fallback handler only: Rejected — several error codes require specific UI actions (redirect, dismiss reply, discard voice session).

---

## Decision: Implement Silent Token Refresh with Login Fallback

**Rationale**: Per spec clarification (FR-021), when the JWT expires during an active session, the client must attempt silent refresh via a refresh-token endpoint. If refresh fails, redirect to login. This balances UX continuity with security.

**Alternatives considered**:
- Immediately redirect to login on any auth error: Rejected — disruptive to testing workflow when tokens expire mid-session.
- Never redirect, keep retrying: Rejected — could cause infinite loops if token is permanently invalid.

---

## Decision: Log and Discard Malformed Frames (No Disconnect)

**Rationale**: Per spec clarification (FR-022), when `validateServerFrame()` rejects a frame, the client logs it in the protocol panel and discards it without disconnecting. This maximizes connection resilience for a test client.

**Alternatives considered**:
- Disconnect on malformed frame: Rejected — a single bad frame shouldn't kill an otherwise healthy connection.
- Silently ignore: Rejected — protocol log visibility is critical for a test client.

---

## Decision: Add `fileAttachmentStore` to State Layer

**Rationale**: The spec (C11, data model) defines `fileAttachmentStore: Map<blobId, FileAttachment>` for tracking file metadata before and after upload. The current code tracks this only inside message attachments, which means pre-upload state (progress, pending) is lost.

**Alternatives considered**:
- Track upload state in UI component only: Rejected — violates layered architecture (state belongs in `state/` layer).

---

## Decision: Add 64KB Voice Chunk Size Validation

**Rationale**: Per the WebSocket protocol contract and data model validation rules, each voice chunk must be < 64KB after encoding. Adding a size check in `audioCapture.js` before `ws.send()` prevents silent server rejections.

**Alternatives considered**:
- Let server reject oversized chunks: Rejected — wastes bandwidth and provides no client visibility.

---

## Decision: Correct Download Path from `/api/download/{blobId}` to `/api/upload/download/{blobId}`

**Rationale**: The actual server endpoint is `/api/upload/download/{blobId}`, not `/api/download/{blobId}`. This is a simple string change in `src/api/download.js`.

---

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| Should the parser maintain backward compatibility with the old field names? | No — use canonical server field names (`senderId`, `displayName`, flat `text`) throughout |
| Should `validateServerFrame()` be called before or after `parseTextFrame()`? | Before — validate the raw frame structure first, then parse |
| Should `voice_message` builder be added alongside `voice_chunk`? | Yes — `voice_message` is a separate message type (FR-006, A7) |
| Should typing debounce be per-keystroke or per-event? | Per-event — enforce minimum 300ms between `typing: true` events sent to server |
| How should the client handle `voice_processing_error` during an active voice session? | Show warning in UI, log in protocol panel, discard incomplete session (per error code table) |

---

**Status**: All unknowns resolved. Ready for Phase 1 design.
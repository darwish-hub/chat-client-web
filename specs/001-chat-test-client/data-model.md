# Data Model: ChatHub Web Test Client

**Date**: 2026-05-10  
**Feature**: ChatHub Web Test Client  
**Purpose**: Define the client-side data entities, their fields, relationships, and validation rules.

---

## Entity: Conversation

Represents a chat channel within a service.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `id` | string (UUID) | Unique identifier | Required, non-empty |
| `serviceId` | string | Parent service identifier | Required, non-empty |
| `title` | string | Display name of the conversation | Required, max 200 chars |
| `participantIds` | string[] | User IDs belonging to this conversation | Array of valid UUIDs |
| `createdAt` | ISO datetime | Creation timestamp | Required, valid date |
| `updatedAt` | ISO datetime | Last update timestamp | Required, valid date |

**Relationships**:
- One Conversation has many Messages (1:N)
- One Conversation belongs to one Service (N:1)

---

## Entity: Message

Represents a single unit of communication within a conversation.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `id` | string (UUID) | Unique message identifier | Required, non-empty |
| `conversationId` | string (UUID) | Parent conversation | Required, matches existing conversation |
| `fromUserId` | string (UUID) | Sender identifier | Required, non-empty |
| `fromUserName` | string | Display name of sender | Required, non-empty |
| `type` | enum | Message content type: `text`, `voice`, `video`, `file` | Required, one of allowed values |
| `content` | object | Payload varies by type (see below) | Required, structure depends on `type` |
| `replyToId` | string (UUID) | Optional reference to parent message | Must reference existing message if present |
| `createdAt` | ISO datetime | Server-assigned timestamp | Required, valid date |
| `deliveredAt` | ISO datetime | Client-observed delivery confirmation | Nullable |
| `status` | enum | `sending`, `delivered`, `error` | Required |

**Content Payloads by Type**:

- **text**: `{ text: string }` — max length per `config.MAX_TEXT_LENGTH`
- **voice**: `{ durationMs: number, blobId?: string }` — assembled after final chunk
- **video**: `{ blobId: string, fileName: string, mimeType: string, sizeBytes: number }`
- **file**: `{ blobId: string, fileName: string, mimeType: string, sizeBytes: number }`

**Relationships**:
- One Message belongs to one Conversation (N:1)
- One Message may reference one parent Message via `replyToId` (self-referencing 1:1)

---

## Entity: Presence

Represents the online/typing state of a user within a service.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `userId` | string (UUID) | User identifier | Required, non-empty |
| `userName` | string | Display name | Required, non-empty |
| `serviceId` | string | Service scope | Required, non-empty |
| `status` | enum | `online`, `offline` | Required |
| `isTyping` | boolean | Currently typing in any conversation? | Default `false` |
| `typingConversationId` | string (UUID) | Which conversation they are typing in | Nullable |
| `lastSeenAt` | ISO datetime | Last known activity | Nullable |

**State Transitions**:
- `user_joined` → `status: online`
- `user_left` → `status: offline`
- `typing` with `isTyping: true` → `isTyping: true`
- `typing` with `isTyping: false` (or 5s timeout) → `isTyping: false`

---

## Entity: VoiceSession

Tracks a live voice stream session (inbound or outbound).

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `messageId` | string (UUID) | Session identifier (same as future message ID) | Required, non-empty |
| `conversationId` | string (UUID) | Target conversation | Required |
| `direction` | enum | `outbound` (local mic) or `inbound` (remote user) | Required |
| `fromUserId` | string (UUID) | Sender (for inbound) or local user (for outbound) | Required |
| `sequenceNumber` | number | Current chunk index (0-based) | Non-negative integer |
| `chunks` | ArrayBuffer[] | Buffered audio chunks | Maintained in memory only |
| `isFinal` | boolean | Whether the final chunk has been sent/received | Default `false` |
| `startedAt` | number (epoch ms) | Session start time | Required |

**State Transitions**:
- `start` → `isFinal: false`, `sequenceNumber: 0`
- `chunk` → append to `chunks`, increment `sequenceNumber`
- `final` → `isFinal: true`, trigger assembly/playback

---

## Validation Rules Summary

1. **UUID format**: All identifiers must be valid UUID v4 strings.
2. **Timestamp ordering**: `createdAt` must be >= conversation `createdAt`; messages must sort chronologically within a conversation.
3. **Text length**: `content.text` must not exceed `MAX_TEXT_LENGTH` (configurable, default 2000).
4. **File size**: Uploaded files must not exceed 100MB.
5. **Chunk sequence**: Voice chunk `sequenceNumber` must be strictly monotonic within a session.
6. **Duplicate suppression**: Messages with duplicate `id` are silently ignored after first receipt.

---

**Storage Notes**: All entities above are held in-memory (`Map` or `Array`) only. No durable client-side persistence. On reconnect, Conversation and Message state are rebuilt from server history APIs.

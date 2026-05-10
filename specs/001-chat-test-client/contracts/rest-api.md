# REST API Contract

**Scope**: Client ↔ Server HTTP communication  
**Base URL**: `http://localhost:8080`  
**Format**: JSON request/response bodies; `multipart/form-data` for uploads  
**Authentication**: Bearer token via `Authorization: Bearer <JWT>` header

---

## Endpoints

### Conversations

#### `POST /api/conversations`

Create a new conversation.

**Request Body**:
```json
{
  "serviceId": "string",
  "title": "string",
  "participantIds": ["string"]
}
```

**Response 201**:
```json
{
  "id": "string",
  "serviceId": "string",
  "title": "string",
  "participantIds": ["string"],
  "createdAt": "2026-05-10T12:00:00Z"
}
```

**Errors**: `401` (invalid token), `403` (not authorized for service)

---

#### `GET /api/conversations`

List conversations the authenticated user participates in.

**Query Params**: `?serviceId=<string>` (optional filter)

**Response 200**:
```json
[
  {
    "id": "string",
    "serviceId": "string",
    "title": "string",
    "participantIds": ["string"],
    "createdAt": "2026-05-10T12:00:00Z",
    "updatedAt": "2026-05-10T12:00:00Z"
  }
]
```

---

### Messages / History

#### `GET /api/conversations/{conversationId}/messages`

Fetch message history for a conversation.

**Path Params**: `conversationId` (UUID)

**Query Params**:
- `before` (ISO datetime): Fetch messages before this timestamp
- `limit` (number, default 50, max 200): Number of messages to return

**Response 200**:
```json
[
  {
    "id": "string",
    "conversationId": "string",
    "fromUserId": "string",
    "fromUserName": "string",
    "type": "text | voice | video | file",
    "content": {},
    "replyToId": "string | null",
    "createdAt": "2026-05-10T12:00:00Z"
  }
]
```

**Errors**: `401`, `403` (not a participant), `404` (conversation not found)

---

#### `GET /api/conversations/{conversationId}/messages/{messageId}/replies`

Fetch reply thread for a specific message.

**Response 200**: Same schema as `/messages` endpoint.

---

### Uploads

#### `POST /api/upload/file`

Upload a file attachment.

**Request Body**: `multipart/form-data`
- `file`: Binary file data

**Response 201**:
```json
{
  "blobId": "string",
  "url": "string",
  "fileName": "string",
  "mimeType": "string",
  "sizeBytes": 12345
}
```

**Errors**: `401`, `413` (file too large), `415` (unsupported media type)

---

### Downloads

#### `GET /api/download/{blobId}`

Download a previously uploaded file.

**Response 200**: Binary file data with `Content-Type` and `Content-Disposition` headers.

**Errors**: `401`, `404` (blob not found), `403` (not authorized)

---

### Presence

#### `GET /api/services/{serviceId}/online`

Fetch currently online users in a service.

**Response 200**:
```json
[
  {
    "userId": "string",
    "userName": "string",
    "status": "online"
  }
]
```

**Errors**: `401`, `404` (service not found)

---

## Common Response Patterns

All error responses follow this structure:

```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

**Standard HTTP Status Codes**:
- `200` — Success
- `201` — Created
- `400` — Bad Request (validation failure)
- `401` — Unauthorized (invalid or missing JWT)
- `403` — Forbidden (not a participant / not authorized)
- `404` — Not Found
- `413` — Payload Too Large
- `415` — Unsupported Media Type
- `429` — Too Many Requests (rate limited)
- `500` — Internal Server Error

---

**Note**: This contract is the source of truth for all files under `js/api/`.

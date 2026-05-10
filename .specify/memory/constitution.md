<!--
SYNC IMPACT REPORT
Version Change: 1.0.0 → 1.1.0
Modified Principles:
  - Principle IV: Layered Client Architecture (updated UI layer to reflect React components and hooks)
Added Sections: None
Removed Sections: None
Templates Requiring Updates:
  - ✅ .specify/templates/plan-template.md (no constitution-specific references to update)
  - ✅ .specify/templates/spec-template.md (no constitution-specific references to update)
  - ✅ .specify/templates/tasks-template.md (no constitution-specific references to update)
  - ✅ plan-client.md (updated Technical Context and Constitution Check)
  - ✅ specs/001-chat-test-client/plan.md (updated Technical Context and Constitution Check)
  - ✅ specs/001-chat-test-client/research.md (updated technology decisions)
  - ✅ client/README.md (updated architecture description)
  - ✅ specs/001-chat-test-client/quickstart.md (updated build step guidance)
  - ✅ specs/001-chat-test-client/tasks.md (updated path conventions)
Follow-up TODOs: None
-->

# ChatHub Web Client (React) Constitution

## Core Principles

### I. WebSocket-First Real-time Communication

The client MUST use native `WebSocket` directly; no abstraction libraries such as SignalR are permitted. Handshake, heartbeat, binary frames, and reconnection logic MUST be implemented manually to mirror the server's native WebSocket behavior exactly. All real-time messaging, presence, and typing indicators MUST flow through the custom JSON wire format defined in `websocket-protocol.md`.

**Rationale**: The client is a test and validation tool; using native WebSocket ensures it exercises the exact server protocol without middleware interference.

### II. MongoDB Source of Truth (Client-Side History Recovery)

The client MUST NOT durably persist messages in `localStorage` or any other client-side store. On reconnect, the client MUST fetch missed messages via `GET /api/conversations/{id}/messages?before=...` before resuming real-time streaming. The server MongoDB instance is the sole source of truth for message history.

**Rationale**: Prevents data divergence between client and server; guarantees that test validation always reflects server state.

### III. NATS Core for Cross-Pod Fan-out (Transparent to Client)

The client MUST remain completely unaware of NATS. It MUST send and receive only standard WebSocket frames as defined by the wire protocol. Any cross-pod fan-out, load balancing, or service mesh behavior is strictly a server concern.

**Rationale**: Keeps the client protocol contract minimal and ensures it can validate any server topology without protocol changes.

### IV. Layered Client Architecture

Source code MUST be organized into distinct layers:

- `protocol/` — Wire format serialization, message builders, frame parsers
- `transport/` — WebSocket connection manager, heartbeat handler, reconnection logic
- `api/` — REST `fetch()` wrappers for upload, download, history
- `ui/` — React components, hooks, and JSX markup; DOM rendering and event handlers
- `state/` — In-memory stores for conversations, messages, presence, voice sessions

Each layer MAY only import from layers below it; circular dependencies are prohibited.

**Rationale**: Clear separation enables independent testing of protocol compliance, transport resilience, and UI behavior. React provides a declarative, component-based UI layer while preserving strict layering.

### V. Background Services for I/O Offloading

All outbound WebSocket sends MUST be serialized through an async queue (`MessageChannel` or equivalent) so that `ws.send()` is never called concurrently. MediaRecorder `dataavailable` events MUST be batched and fed through the same queue. This offloads I/O from the main UI thread and prevents frame interleaving.

**Rationale**: Simulates production-grade backpressure handling and ensures deterministic send ordering for test reproducibility.

## Technology Constraints & Performance

- **Language**: ES2022+ JavaScript / JSX; React 18+ with a build step (e.g., Vite, Create React App, or equivalent).
- **Markup/Styling**: JSX + CSS3 / CSS Modules / styled-components (React-based UI).
- **Media APIs**: Web Audio API, MediaRecorder API, `getUserMedia()`, `<audio>`/`<video>` elements.
- **Transport**: Native `WebSocket`, native `fetch()` for REST calls.
- **Storage**: `localStorage` permitted ONLY for JWT token and last connection settings; in-memory `Map` for transient message/conversation state.
- **Dependencies**: React and related ecosystem packages are permitted (e.g., `react`, `react-dom`, build tools). Avoid unnecessary UI abstraction libraries.
- **Target Browsers**: Chrome 120+, Firefox 120+, Edge 120+, Safari 17+.
- **Performance Goals**:
  - First paint < 1 second
  - Voice capture-to-send latency < 200 ms (client contribution)
  - Smooth message list rendering for 1,000+ messages (virtualization recommended)

## Development Workflow & Quality Gates

- Each implementation phase MUST pass its independent manual test before the next phase begins.
- Every server feature requirement (FR-001 through FR-017) MUST have a corresponding client test scenario.
- The Metrics Dashboard MUST be used to verify all client-side success criteria (CSC-001 through CSC-010).
- The Protocol Log panel MUST record every sent and received frame with timestamp and direction for post-mortem analysis.
- Complexity deviations MUST be documented in the Complexity Tracking table with justification.
- React component tests (e.g., React Testing Library) MUST accompany new UI components.

## Governance

This constitution supersedes all other development practices for the ChatHub Web Client (React).

- **Amendments**: Any change to principles, constraints, or workflow gates requires updating this document, propagating changes to `plan-client.md` and template files, and re-validating against the server spec.
- **Versioning**: Follows semantic versioning. MAJOR for backward-incompatible principle removals or redefinitions; MINOR for new principles or materially expanded guidance; PATCH for clarifications, wording, or typo fixes.
- **Compliance**: All implementation phases must demonstrate compliance with the Constitution Check gates before advancing. Complexity must be justified; unjustified complexity is rejected.
- **Documentation**: `AGENTS.md` and `README.md` must stay synchronized with this constitution.

**Version**: 1.1.0 | **Ratified**: 2026-05-10 | **Last Amended**: 2026-05-10

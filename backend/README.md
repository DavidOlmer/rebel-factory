# Rebel Factory Backend API

Express + TypeScript backend voor de Rebel AI Factory.

## Quick Start

```bash
# Install dependencies
pnpm install

# Development (hot reload)
pnpm dev

# Build
pnpm build

# Production
pnpm start

# Tests
pnpm test
```

## API Endpoints

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents` | List all agents |
| `GET` | `/api/agents/:id` | Get agent by ID |
| `POST` | `/api/agents` | Create new agent |
| `PUT` | `/api/agents/:id` | Update agent |
| `DELETE` | `/api/agents/:id` | Delete agent |
| `POST` | `/api/agents/:id/validate` | Validate agent template |

### Sprints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sprints` | List all sprints |
| `GET` | `/api/sprints?agentId=<uuid>` | List sprints for agent |
| `GET` | `/api/sprints/:id` | Get sprint by ID |
| `POST` | `/api/sprints` | Create new sprint |
| `PUT` | `/api/sprints/:id` | Update sprint |
| `DELETE` | `/api/sprints/:id` | Delete sprint |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |

## Request/Response Examples

### Create Agent

```bash
curl -X POST http://localhost:3300/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rebelclaw",
    "creature": "Wolf",
    "emoji": "🐺",
    "description": "A no-nonsense builder",
    "systemPrompt": "You are a helpful coding assistant",
    "skills": ["coding", "research"],
    "model": "claude-sonnet-4-20250514"
  }'
```

Response:
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Rebelclaw",
    "creature": "Wolf",
    "emoji": "🐺",
    "description": "A no-nonsense builder",
    "systemPrompt": "You are a helpful coding assistant",
    "skills": ["coding", "research"],
    "model": "claude-sonnet-4-20250514",
    "config": null,
    "createdAt": "2026-03-23T15:00:00.000Z",
    "updatedAt": "2026-03-23T15:00:00.000Z"
  }
}
```

### Validate Template

```bash
curl -X POST http://localhost:3300/api/agents/123e4567-e89b-12d3-a456-426614174000/validate
```

Response:
```json
{
  "data": {
    "valid": true,
    "errors": [],
    "warnings": []
  }
}
```

### Create Sprint

```bash
curl -X POST http://localhost:3300/api/sprints \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Sprint 1: Backend API",
    "description": "Build the core API",
    "tasks": [
      {"title": "Setup Express", "status": "done"},
      {"title": "Add routes", "status": "in_progress"}
    ]
  }'
```

## WebSocket

Connect to `ws://localhost:3300/ws` for real-time updates.

### Message Types

```typescript
interface WSMessage {
  type: 'agent_created' | 'agent_updated' | 'agent_deleted' | 'sprint_created' | 'sprint_updated';
  payload: unknown;
  timestamp: string;
}
```

Example:
```javascript
const ws = new WebSocket('ws://localhost:3300/ws');
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(`${msg.type}:`, msg.payload);
};
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3300` | Server port |
| `DB_HOST` | `127.0.0.1` | PostgreSQL host |
| `DB_PORT` | `54329` | PostgreSQL port |
| `DB_NAME` | `paperclip` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |

## Database Schema

### agents

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | VARCHAR(100) | Agent name |
| `description` | TEXT | Description |
| `creature` | VARCHAR(50) | Creature type |
| `emoji` | VARCHAR(10) | Agent emoji |
| `system_prompt` | TEXT | System prompt |
| `skills` | TEXT[] | Skill array |
| `model` | VARCHAR(100) | Model identifier |
| `config` | JSONB | Extra config |
| `created_at` | TIMESTAMPTZ | Created timestamp |
| `updated_at` | TIMESTAMPTZ | Updated timestamp |

### sprints

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `agent_id` | UUID | FK to agents |
| `title` | VARCHAR(200) | Sprint title |
| `description` | TEXT | Description |
| `status` | VARCHAR(20) | draft/active/completed/cancelled |
| `tasks` | JSONB | Task array |
| `created_at` | TIMESTAMPTZ | Created timestamp |
| `updated_at` | TIMESTAMPTZ | Updated timestamp |

## Architecture

```
src/
├── index.ts           # Entry point, Express + WebSocket setup
├── routes/
│   ├── agents.ts      # Agent CRUD endpoints
│   └── sprints.ts     # Sprint endpoints
├── services/
│   ├── agent.service.ts   # Agent business logic
│   └── sprint.service.ts  # Sprint business logic
├── db/
│   └── client.ts      # PostgreSQL connection pool
└── types/
    └── index.ts       # TypeScript types + Zod schemas
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "details": [...]  // Optional Zod validation errors
}
```

Status codes:
- `400` - Validation error
- `404` - Not found
- `500` - Server error

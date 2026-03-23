# Rebel AI Factory

> Agent Factory platform for Rebelgroup.com consultants

## Features

- 🏭 Create personal AI agents from templates
- 📋 Sprint workflow for development tasks
- ✅ Quality gates with automated reviews
- 📊 Usage analytics and monitoring
- 🔒 3-tier governance (Personal → Venture → Core)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REBEL AI FACTORY                          │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React)     │  Backend (Express)   │  Database    │
│  - Dashboard          │  - REST API          │  - PostgreSQL│
│  - Template Editor    │  - WebSocket         │  - Paperclip │
│  - Agent Manager      │  - Auth/SSO          │              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
npm install
npm run dev
```

## Project Structure

```
rebel-factory/
├── backend/           # Express API
│   ├── src/
│   │   ├── routes/    # API routes
│   │   ├── services/  # Business logic
│   │   └── db/        # Database
│   └── tests/
├── frontend/          # React app
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   └── tests/
└── shared/            # Shared types
```

## Development

See individual READMEs in backend/ and frontend/ folders.

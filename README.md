# 🏭 Rebel AI Factory

Enterprise-grade AI agent platform for Rebelgroup.com with Microsoft integration.

## Features

- **🔐 Microsoft SSO** - Azure AD / Entra ID authentication
- **📁 SharePoint Integration** - Document storage via Microsoft Graph
- **🏢 Multi-tenant** - Isolated ventures with cross-tenant sharing
- **👥 RBAC** - Role-based access control with Azure AD groups
- **📝 Audit Logging** - Comprehensive action tracking
- **🤖 Agent Management** - 3-tier governance (Personal → Venture → Core)

## Quick Start

```bash
# Clone
git clone https://github.com/DavidOlmer/rebel-factory.git
cd rebel-factory

# Setup environment
cp .env.example .env
# Edit .env with your Azure AD credentials

# Install & run
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## Azure AD Setup

1. Register an app in Azure Portal
2. Configure redirect URI: `http://localhost:3300/auth/callback`
3. Add API permissions:
   - `User.Read` (delegated)
   - `Sites.ReadWrite.All` (delegated, for SharePoint)
   - `Files.ReadWrite.All` (delegated, for SharePoint)
4. Create a client secret
5. Add values to `.env`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  Dashboard │ Agents │ Sprints │ Admin │ SharePoint Browser   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    Backend (Express)                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌───────────────┐  │
│  │  Auth   │  │ SharePoint│  │ Agents │  │    Audit      │  │
│  │ (MSAL)  │  │ (Graph)   │  │        │  │               │  │
│  └────┬────┘  └─────┬─────┘  └───┬────┘  └───────┬───────┘  │
│       │             │            │               │           │
│  ┌────▼─────────────▼────────────▼───────────────▼────────┐ │
│  │              Middleware (Auth, Tenant, RBAC)            │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                      PostgreSQL                              │
│  tenants │ agents │ issues │ audit_logs │ users             │
└─────────────────────────────────────────────────────────────┘
```

## Roles

| Role | Permissions |
|------|-------------|
| Admin | Full access, tenant management |
| Venture Lead | Manage venture agents, approve promotions |
| Consultant | Create personal agents, use shared agents |
| Viewer | Read-only access |

## API Endpoints

### Auth
- `GET /auth/login` - Redirect to Microsoft login
- `GET /auth/callback` - OAuth callback
- `GET /auth/logout` - Logout
- `GET /auth/me` - Current user info

### Agents
- `GET /api/agents` - List agents
- `POST /api/agents` - Create agent
- `GET /api/agents/:id` - Get agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent

### SharePoint
- `GET /api/sharepoint/sites` - List sites
- `GET /api/sharepoint/sites/:siteId/libraries` - List libraries
- `GET /api/sharepoint/files/*` - Browse/download files
- `POST /api/sharepoint/files/*` - Upload files

### Audit
- `GET /api/audit` - Query audit logs
- `GET /api/audit/export` - Export audit logs

## Environment Variables

See `.env.example` for all required variables.

## License

Proprietary - Rebelgroup.com

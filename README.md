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

---

## Enterprise Setup Guide

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Azure AD tenant with admin access
- SharePoint site (optional, for document integration)

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Click **New registration**
   - Name: `Rebel AI Factory`
   - Supported account types: `Accounts in this organizational directory only`
   - Redirect URI: `Web` → `http://localhost:3300/auth/callback`
3. Note the **Application (client) ID** and **Directory (tenant) ID**

### 2. Configure App Permissions

In your app registration:

1. Go to **API permissions** → Add a permission
2. Add Microsoft Graph permissions:
   
   | Permission | Type | Purpose |
   |------------|------|---------|
   | `User.Read` | Delegated | Read user profile |
   | `User.ReadBasic.All` | Delegated | Read org user list |
   | `Sites.ReadWrite.All` | Delegated | SharePoint access |
   | `Files.ReadWrite.All` | Delegated | OneDrive/SharePoint files |
   | `GroupMember.Read.All` | Delegated | Read group membership (for RBAC) |

3. Click **Grant admin consent** for your organization

### 3. Create Client Secret

1. Go to **Certificates & secrets** → New client secret
2. Description: `Rebel Factory Backend`
3. Expiration: 24 months (set calendar reminder!)
4. Copy the secret value immediately (shown only once)

### 4. Configure RBAC Groups (Optional)

Create Azure AD groups for role-based access:

```
rebel-factory-admins      → Admin role
rebel-factory-leads       → Venture Lead role  
rebel-factory-consultants → Consultant role
rebel-factory-viewers     → Viewer role
```

Add the group Object IDs to your config or database.

### 5. Database Setup

#### Local Development

```bash
# Create database
createdb rebel_factory

# Run schema (includes all tables, indexes, and extensions)
psql rebel_factory < backend/src/db/schema-v2.sql

# Seed with Rebelgroup templates
psql rebel_factory < backend/src/db/seed-templates.sql

# Seed with example prompts (optional)
psql rebel_factory < backend/src/db/seed-prompts.sql
```

#### Production Database (PostgreSQL 14+)

```bash
# 1. Connect to your production database
psql $DATABASE_URL

# 2. Run schema
\i backend/src/db/schema-v2.sql

# 3. Seed templates
\i backend/src/db/seed-templates.sql

# 4. Verify
SELECT COUNT(*) FROM agent_templates;  -- Should be 14
SELECT COUNT(*) FROM model_pricing;     -- Should be 3
```

#### Schema Overview

| Table | Purpose |
|-------|---------|
| `tenants` | Ventures/business units (multi-tenant isolation) |
| `users` | User accounts linked to Azure AD |
| `agent_templates` | Reusable agent blueprints |
| `agents` | Agent instances (personal/venture/core) |
| `prompts` | Prompt library with versioning |
| `agent_runs` | Run telemetry and quality tracking |
| `token_usage` | Token consumption per tenant/agent |
| `token_usage_monthly` | Aggregated usage for reporting |
| `approval_requests` | Agent promotion approval flows |
| `audit_logs` | Action audit trail |
| `model_pricing` | LLM cost calculation |
| `learning_insights` | Self-learning pattern detection |

#### Migrations

```bash
# Run TypeScript migrations (alternative to raw SQL)
cd backend
npm run migrate
```

### 6. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Server
NODE_ENV=production
PORT=3300

# Azure AD (from steps above)
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-secret-value
REDIRECT_URI=https://factory.rebelgroup.com/auth/callback

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/rebel_factory

# JWT (generate secure random string)
JWT_SECRET=openssl rand -base64 32
JWT_EXPIRES_IN=24h

# SharePoint (optional)
SHAREPOINT_SITE_URL=https://rebelgroup.sharepoint.com/sites/AI
SHAREPOINT_DRIVE_ID=

# Frontend
FRONTEND_URL=https://factory.rebelgroup.com
```

### 7. Production Deployment

```bash
# Build
cd backend && npm run build
cd frontend && npm run build

# Run with PM2
pm2 start backend/dist/index.js --name rebel-factory-api
pm2 serve frontend/dist 3400 --name rebel-factory-web
```

---

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

## Multi-Tenant Architecture

### Tenant Isolation

Each venture operates as an isolated tenant:

```typescript
// Request flow
Request → Auth → Tenant Resolution → RBAC Check → Handler → Audit Log
```

- **Tenant header**: `X-Tenant-ID` or derived from user's primary venture
- **Data isolation**: All queries filtered by `tenant_id`
- **Cross-tenant**: Explicit sharing via `agent_shares` table

### Tenant Types

| Type | Description |
|------|-------------|
| `venture` | Standard venture (Rebelhouse, RebelEd, etc.) |
| `core` | Rebelgroup core (shared agents) |
| `personal` | User sandbox (isolated experiments) |

## Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Full access, tenant management, user management, audit export |
| **Venture Lead** | Manage venture agents, approve promotions, view audit |
| **Consultant** | Create personal agents, use shared agents, view dashboards |
| **Viewer** | Read-only access to dashboards and approved agents |

### Permission Matrix

| Action | Admin | Lead | Consultant | Viewer |
|--------|-------|------|------------|--------|
| Create personal agent | ✅ | ✅ | ✅ | ❌ |
| Promote to venture | ✅ | ✅ | ❌ | ❌ |
| Promote to core | ✅ | ❌ | ❌ | ❌ |
| Manage tenants | ✅ | ❌ | ❌ | ❌ |
| Export audit logs | ✅ | ✅ | ❌ | ❌ |
| View SharePoint | ✅ | ✅ | ✅ | ✅ |
| Upload to SharePoint | ✅ | ✅ | ✅ | ❌ |

## API Endpoints

### Auth
- `GET /auth/login` - Redirect to Microsoft login
- `GET /auth/callback` - OAuth callback
- `GET /auth/logout` - Logout
- `GET /auth/me` - Current user info + permissions

### Agents
- `GET /api/agents` - List agents (filtered by tenant + permissions)
- `POST /api/agents` - Create agent
- `GET /api/agents/:id` - Get agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent
- `POST /api/agents/:id/promote` - Promote agent tier

### Tenants (Admin only)
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create tenant
- `GET /api/tenants/:id` - Get tenant details
- `PUT /api/tenants/:id` - Update tenant
- `GET /api/tenants/:id/users` - List tenant users

### SharePoint
- `GET /api/sharepoint/sites` - List accessible sites
- `GET /api/sharepoint/sites/:siteId/libraries` - List document libraries
- `GET /api/sharepoint/files/*` - Browse/download files
- `POST /api/sharepoint/files/*` - Upload files
- `DELETE /api/sharepoint/files/*` - Delete files

### Audit
- `GET /api/audit` - Query audit logs (with filters)
- `GET /api/audit/export` - Export audit logs (CSV/JSON)
- `GET /api/audit/stats` - Audit statistics

## Security Considerations

### Production Checklist

- [ ] Use HTTPS everywhere
- [ ] Set secure JWT_SECRET (32+ random bytes)
- [ ] Enable Azure AD conditional access
- [ ] Configure CORS to allow only your domain
- [ ] Set up rate limiting
- [ ] Enable audit log retention policy
- [ ] Monitor for suspicious activity
- [ ] Rotate client secrets before expiry

### Session Security

```typescript
// Cookies are httpOnly, secure, sameSite
res.cookie('token', jwt, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000 // 24h
});
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | `development` or `production` |
| `PORT` | No | Server port (default: 3300) |
| `AZURE_CLIENT_ID` | Yes | Azure AD app client ID |
| `AZURE_TENANT_ID` | Yes | Azure AD tenant ID |
| `AZURE_CLIENT_SECRET` | Yes | Azure AD client secret |
| `REDIRECT_URI` | No | OAuth callback URL |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_EXPIRES_IN` | No | Token expiration (default: 24h) |
| `SHAREPOINT_SITE_URL` | No | Default SharePoint site |
| `SHAREPOINT_DRIVE_ID` | No | Default document library |
| `FRONTEND_URL` | No | Frontend URL for CORS |

## Troubleshooting

### "AADSTS50011: Reply URL does not match"
- Ensure `REDIRECT_URI` matches exactly what's configured in Azure AD
- Check for trailing slashes

### "Insufficient privileges"
- Grant admin consent for API permissions in Azure Portal
- Verify user is member of appropriate AD groups

### "Tenant not found"
- Check `X-Tenant-ID` header is set
- Verify tenant exists in database
- Check user has access to requested tenant

## License

Proprietary - Rebelgroup.com © 2026

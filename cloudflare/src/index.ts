import type { Env } from "./types.js";

// Service imports
import * as authService from "./services/auth.service.js";
import * as tenantService from "./services/tenant.service.js";
import * as agentService from "./services/agent.service.js";
import * as auditService from "./services/audit.service.js";
import * as rbacService from "./services/rbac.service.js";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ name: "rebel-factory", status: "ok", platform: "cloudflare-workers" });
    }

    // API routing
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
      try {
        const response = await routeRequest(request, env, url);
        // Add CORS to all API responses
        const headers = new Headers(response.headers);
        for (const [key, value] of Object.entries(corsHeaders)) {
          headers.set(key, value);
        }
        return new Response(response.body, { status: response.status, headers });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return Response.json({ error: msg }, { status: 500 });
      }
    }

    // Static assets (frontend) handled by [assets] binding
    return new Response("Not found", { status: 404 });
  },
};

async function routeRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method;
  const path = url.pathname;

  // Auth routes (no auth required)
  if (path === "/auth/login") return Response.json({ message: "TODO: Azure AD OAuth redirect" });
  if (path === "/auth/callback") return Response.json({ message: "TODO: Token exchange" });
  if (path === "/auth/me") return Response.json({ message: "TODO: Current user" });

  // All API routes below require auth
  // TODO: Extract and validate JWT from Authorization header

  // Tenant routes
  if (path === "/api/tenants" && method === "GET") return Response.json({ message: "TODO: List tenants" });
  if (path === "/api/tenants" && method === "POST") return Response.json({ message: "TODO: Create tenant" });

  // Agent routes
  if (path === "/api/agents" && method === "GET") return Response.json({ message: "TODO: List agents" });
  if (path === "/api/agents" && method === "POST") return Response.json({ message: "TODO: Create agent" });
  if (path.match(/^\/api\/agents\/[^/]+$/) && method === "GET") return Response.json({ message: "TODO: Get agent" });
  if (path.match(/^\/api\/agents\/[^/]+$/) && method === "PUT") return Response.json({ message: "TODO: Update agent" });
  if (path.match(/^\/api\/agents\/[^/]+\/run$/) && method === "POST") return Response.json({ message: "TODO: Run agent" });

  // Audit routes
  if (path === "/api/audit" && method === "GET") return Response.json({ message: "TODO: Audit log" });

  // RBAC routes
  if (path === "/api/rbac/check" && method === "POST") return Response.json({ message: "TODO: Check permission" });

  // Dashboard
  if (path === "/api/dashboard") return Response.json({ message: "TODO: Dashboard data" });

  // Stats
  if (path === "/api/stats") return Response.json({ message: "TODO: Stats" });

  return Response.json({ error: "Route not found" }, { status: 404 });
}

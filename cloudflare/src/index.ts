import type { Env } from "./types.js";

import * as authService from "./services/auth.service.js";
import * as tenantService from "./services/tenant.service.js";
import * as agentService from "./services/agent.service.js";
import * as auditService from "./services/audit.service.js";
import * as rbacService from "./services/rbac.service.js";

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/health") {
      return Response.json({
        name: "rebel-factory",
        status: "ok",
        platform: "cloudflare-workers",
      });
    }

    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
      try {
        const response = await routeRequest(request, url);
        const headers = new Headers(response.headers);

        for (const [key, value] of Object.entries(corsHeaders)) {
          headers.set(key, value);
        }

        return new Response(response.body, { status: response.status, headers });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ error: message }, { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};

async function routeRequest(request: Request, url: URL): Promise<Response> {
  const method = request.method;
  const path = url.pathname;

  void authService;
  void tenantService;
  void agentService;
  void auditService;
  void rbacService;

  if (path === "/auth/login") return Response.json({ message: "TODO: Azure AD OAuth redirect" });
  if (path === "/auth/callback") return Response.json({ message: "TODO: Token exchange" });
  if (path === "/auth/me") return Response.json({ message: "TODO: Current user" });

  if (path === "/api/tenants" && method === "GET") return Response.json({ message: "TODO: List tenants" });
  if (path === "/api/tenants" && method === "POST") return Response.json({ message: "TODO: Create tenant" });

  if (path === "/api/agents" && method === "GET") return Response.json({ message: "TODO: List agents" });
  if (path === "/api/agents" && method === "POST") return Response.json({ message: "TODO: Create agent" });
  if (path.match(/^\/api\/agents\/[^/]+$/) && method === "GET") return Response.json({ message: "TODO: Get agent" });
  if (path.match(/^\/api\/agents\/[^/]+$/) && method === "PUT") return Response.json({ message: "TODO: Update agent" });
  if (path.match(/^\/api\/agents\/[^/]+\/run$/) && method === "POST") return Response.json({ message: "TODO: Run agent" });

  if (path === "/api/audit" && method === "GET") return Response.json({ message: "TODO: Audit log" });
  if (path === "/api/rbac/check" && method === "POST") return Response.json({ message: "TODO: Check permission" });
  if (path === "/api/dashboard") return Response.json({ message: "TODO: Dashboard data" });
  if (path === "/api/stats") return Response.json({ message: "TODO: Stats" });

  return Response.json({ error: "Route not found" }, { status: 404 });
}

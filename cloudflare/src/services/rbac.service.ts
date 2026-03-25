{
  "code": "// rbac.service.ts
import { RbacService } from './rbac.service';
import { D1Database } from '@cloudflare/workers-d1';

interface RoleAssignment {
  user_id: string;
  venture_id: string;
  role: string;
}

const PERMISSIONS_MATRIX = {
  admin: ['*'],
  lead: ['venture.manage', 'agent.create', 'agent.execute'],
  consultant: ['agent.create', 'agent.execute'],
  viewer: ['agent.view'],
};

export class RbacService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async checkPermission(userId: string, action: string, resource: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    for (const role of roles) {
      if (PERMISSIONS_MATRIX[role] && PERMISSIONS_MATRIX[role].includes('*')) {
        return true;
      }
      if (PERMISSIONS_MATRIX[role] && PERMISSIONS_MATRIX[role].includes(action)) {
        return true;
      }
    }
    return false;
  }

  async assignRole(userId: string, ventureId: string,
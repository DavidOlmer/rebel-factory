export enum Role {
  VIEWER = 'viewer',
  CONSULTANT = 'consultant',
  VENTURE_LEAD = 'venture_lead',
  ADMIN = 'admin',
}

export type Resource = 'agents' | 'sprints' | 'tenants' | 'users' | 'audit';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'promote' | 'manage';
export type Permission = `${Resource}:${Action}`;

export interface UserRole {
  userId: string;
  role: Role;
  tenantId: string;
  grantedBy?: string | null;
  grantedAt?: Date;
  expiresAt?: Date | null;
}

export interface PermissionCheck {
  allowed: boolean;
  role: Role;
  permission: Permission;
  reason: string;
}

export interface RBACContext {
  userId: string;
  role: Role;
  permissions: Permission[];
  tenantId: string;
  isAdmin: boolean;
  isVentureLead: boolean;
}

export const ROLE_HIERARCHY: Role[] = [
  Role.VIEWER,
  Role.CONSULTANT,
  Role.VENTURE_LEAD,
  Role.ADMIN,
];

export function getHighestRole(roles: Role[]): Role {
  const sorted = [...roles].sort(
    (left, right) => ROLE_HIERARCHY.indexOf(right) - ROLE_HIERARCHY.indexOf(left)
  );

  return sorted[0] ?? Role.VIEWER;
}

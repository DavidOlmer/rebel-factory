import { Permission, Role } from '../types/rbac';

export const PERMISSIONS: Record<Role, Permission[]> = {
  [Role.VIEWER]: ['agents:read', 'sprints:read', 'audit:read'],
  [Role.CONSULTANT]: [
    'agents:create',
    'agents:read',
    'agents:update',
    'sprints:create',
    'sprints:read',
    'sprints:update',
    'audit:read',
  ],
  [Role.VENTURE_LEAD]: [
    'agents:create',
    'agents:read',
    'agents:update',
    'agents:delete',
    'agents:promote',
    'sprints:create',
    'sprints:read',
    'sprints:update',
    'sprints:delete',
    'tenants:read',
    'users:read',
    'users:manage',
    'audit:read',
  ],
  [Role.ADMIN]: [
    'agents:create',
    'agents:read',
    'agents:update',
    'agents:delete',
    'agents:promote',
    'sprints:create',
    'sprints:read',
    'sprints:update',
    'sprints:delete',
    'tenants:create',
    'tenants:read',
    'tenants:update',
    'tenants:delete',
    'tenants:manage',
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'users:manage',
    'audit:read',
  ],
};

export const DEFAULT_ROLE = Role.VIEWER;

export const AZURE_GROUP_MAPPINGS: Array<{
  groupId: string;
  role: Role;
}> = [
  { groupId: 'AI-Factory-Admins', role: Role.ADMIN },
  { groupId: 'AI-Factory-Venture-Leads', role: Role.VENTURE_LEAD },
  { groupId: 'AI-Factory-Consultants', role: Role.CONSULTANT },
];

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

export function getPermissionsForRole(role: Role): Permission[] {
  return PERMISSIONS[role];
}

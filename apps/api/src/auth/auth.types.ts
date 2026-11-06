export interface AuthMembership {
  id: string;
  organizationId: string;
  branchId: string | null;
  roleCode: string;
  roleName: string;
  permissions: string[];
}

export interface AuthContext {
  userId: string;
  email: string;
  displayName: string;
  sessionId: string;
  memberships: AuthMembership[];
}

export interface AuthorizationScope {
  organizationId: string;
  branchIds: string[] | null;
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service.js';
import { AppConfig } from '../config.js';
import { hasOrganizationScope, hasValidMutationOrigin, hashSessionToken, readSessionToken, SESSION_IDLE_MS, SESSION_REFRESH_MS, setSessionCookie } from './auth-security.js';
import { IS_PUBLIC_ROUTE, REQUIRE_SAME_ORIGIN, REQUIRED_PERMISSION } from './auth.decorators.js';
import type { AuthContext, AuthorizationScope } from './auth.types.js';

interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
  authorizationScope?: AuthorizationScope;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse();
    const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    const sameOriginRequired = this.reflector.getAllAndOverride<boolean>(REQUIRE_SAME_ORIGIN, [context.getHandler(), context.getClass()]);

    if (isUnsafeMethod && (sameOriginRequired || !isPublic)) {
      if (!hasValidMutationOrigin(request, this.config.corsOrigins)) {
        throw new ForbiddenException({ code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed.' });
      }
    }
    if (isPublic) return true;

    const token = readSessionToken(request, this.config.nodeEnv === 'production');
    if (!token) throw new UnauthorizedException();

    const now = new Date();
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: {
        user: {
          include: {
            memberships: {
              where: { isActive: true },
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || !session.user.isActive || session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      throw new UnauthorizedException();
    }

    const maxIdleExpiry = new Date(Math.min(now.getTime() + SESSION_IDLE_MS, session.absoluteExpiresAt.getTime()));
    const shouldRefresh = session.expiresAt.getTime() - now.getTime() < SESSION_IDLE_MS - SESSION_REFRESH_MS;
    response.setHeader('Cache-Control', 'private, no-store');
    if (shouldRefresh) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { expiresAt: maxIdleExpiry, lastSeenAt: now },
      });
      setSessionCookie(response, token, this.config.nodeEnv === 'production', Math.max(0, Math.floor((maxIdleExpiry.getTime() - now.getTime()) / 1000)));
    }

    request.auth = {
      userId: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      sessionId: session.id,
      memberships: session.user.memberships.map((membership) => ({
        id: membership.id,
        organizationId: membership.organizationId,
        branchId: membership.branchId,
        roleCode: membership.role.code,
        roleName: membership.role.name,
        permissions: membership.role.permissions.map((item) => item.permission.code),
      })),
    };
    return true;
  }

}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, [context.getHandler(), context.getClass()]);
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;
    if (!auth) throw new UnauthorizedException();

    const organizationParam = request.params.organizationId;
    const branchParam = request.params.branchId;
    const organizationId = Array.isArray(organizationParam) ? organizationParam[0] : organizationParam;
    const branchId = Array.isArray(branchParam) ? branchParam[0] : branchParam;
    if (!organizationId) throw new ForbiddenException({ code: 'ORGANIZATION_SCOPE_REQUIRED', message: 'An organization scope is required.' });
    const memberships = auth.memberships.filter((membership) => membership.organizationId === organizationId);
    const authorized = memberships.filter((membership) => membership.permissions.includes('*') || membership.permissions.includes(permission));
    if (!hasOrganizationScope(auth.memberships, organizationId, branchId, permission)) {
      const permissionGranted = authorized.length > 0;
      throw new ForbiddenException({
        code: permissionGranted ? 'SCOPE_DENIED' : 'PERMISSION_DENIED',
        message: permissionGranted ? 'The requested resource is outside your access scope.' : 'The requested action is not permitted.',
      });
    }

    if (branchId) {
      request.authorizationScope = { organizationId, branchIds: [branchId] };
      return true;
    }

    const organizationWide = authorized.some((membership) => membership.branchId === null);
    request.authorizationScope = {
      organizationId,
      branchIds: organizationWide ? null : [...new Set(authorized.map((membership) => membership.branchId).filter((id): id is string => id !== null))],
    };
    return true;
  }
}

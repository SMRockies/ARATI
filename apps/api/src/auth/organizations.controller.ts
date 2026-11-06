import {
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service.js';
import { CreateOrganizationUserDto } from './auth.dto.js';
import { RequirePermission } from './auth.decorators.js';
import type { AuthContext, AuthorizationScope } from './auth.types.js';

interface ScopedRequest extends Request {
  auth?: AuthContext;
  authorizationScope?: AuthorizationScope;
}

@Controller('api/v1/organizations')
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() request: ScopedRequest) {
    const organizationIds = [...new Set(request.auth!.memberships.map(({ organizationId }) => organizationId))];
    if (organizationIds.length === 0) return { items: [] };

    const organizations = await this.prisma.organization.findMany({
      where: { id: { in: organizationIds } },
      select: { id: true, code: true, name: true, timezone: true },
      orderBy: { code: 'asc' },
    });
    return { items: organizations };
  }

  @Get(':organizationId/branches')
  @RequirePermission('branch.read')
  async branches(@Param('organizationId') organizationId: string, @Req() request: ScopedRequest) {
    const scope = request.authorizationScope!;
    const branches = await this.prisma.branch.findMany({
      where: {
        organizationId,
        ...(scope.branchIds === null ? {} : { id: { in: scope.branchIds } }),
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    return { items: branches };
  }

  @Get(':organizationId/users')
  @RequirePermission('user.read')
  async users(@Param('organizationId') organizationId: string, @Req() request: ScopedRequest) {
    const scope = request.authorizationScope!;
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(scope.branchIds === null ? {} : { branchId: { in: scope.branchIds } }),
      },
      select: {
        id: true,
        branchId: true,
        branch: { select: { id: true, code: true, name: true } },
        role: { select: { code: true, name: true } },
        user: { select: { id: true, email: true, displayName: true, isActive: true } },
      },
      orderBy: [{ user: { email: 'asc' } }, { branch: { code: 'asc' } }],
    });
    return { items: memberships };
  }

  @Post(':organizationId/users')
  @RequirePermission('user.create')
  async createUser(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateOrganizationUserDto,
    @Req() request: ScopedRequest,
  ) {
    const auth = request.auth!;
    const scope = request.authorizationScope!;
    const email = body.email.trim().toLowerCase();
    const callerMemberships = auth.memberships.filter((membership) => membership.organizationId === organizationId);
    const callerIsOrganizationAdmin = callerMemberships.some((membership) => membership.branchId === null);

    if (body.branchId) {
      if (scope.branchIds !== null && !scope.branchIds.includes(body.branchId)) {
        throw new ForbiddenException({ code: 'SCOPE_DENIED', message: 'You cannot assign a user outside your branch scope.' });
      }
      const branch = await this.prisma.branch.findFirst({ where: { id: body.branchId, organizationId }, select: { id: true } });
      if (!branch) throw new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch was not found in this organization.' });
    } else if (!callerIsOrganizationAdmin) {
      throw new ForbiddenException({ code: 'SCOPE_DENIED', message: 'Branch-scoped administrators must assign a branch.' });
    }

    const role = await this.prisma.role.findUnique({
      where: { code: body.roleCode },
      include: { permissions: { select: { permissionCode: true } } },
    });
    if (!role) throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role was not found.' });

    const roleGrantMemberships = callerMemberships.filter((membership) =>
      body.branchId
        ? membership.branchId === null || membership.branchId === body.branchId
        : membership.branchId === null,
    );
    const grantedPermissions = new Set(roleGrantMemberships.flatMap(({ permissions }) => permissions));
    const rolePermissions = role.permissions.map(({ permissionCode }) => permissionCode);
    if (!grantedPermissions.has('*') && rolePermissions.some((permission) => !grantedPermissions.has(permission))) {
      throw new ForbiddenException({ code: 'ROLE_ESCALATION_DENIED', message: 'You cannot assign a role with permissions you do not hold.' });
    }

    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: {
            email,
            passwordHash,
            displayName: body.displayName.trim(),
            memberships: {
              create: { organizationId, branchId: body.branchId ?? null, roleId: role.id },
            },
          },
          select: { id: true, email: true, displayName: true, isActive: true },
        });
        await transaction.auditEvent.create({
          data: {
            userId: auth.userId,
            organizationId,
            action: 'identity.user.created',
            metadata: { createdUserId: createdUser.id, roleCode: role.code, branchId: body.branchId ?? null },
          },
        });
        return createdUser;
      });
      return { user, membership: { organizationId, branchId: body.branchId ?? null, roleCode: role.code } };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'USER_ALREADY_EXISTS', message: 'A user with that email already exists.' });
      }
      throw error;
    }
  }
}

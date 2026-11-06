import {
  Controller,
  Get,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma.service.js';
import { AppConfig } from '../config.js';
import { RequireSameOrigin, Public } from './auth.decorators.js';
import { AuthLoginRateLimitGuard } from './auth.rate-limit.js';
import { LoginDto } from './auth.dto.js';
import {
  createSessionToken,
  hashSessionToken,
  MAX_FAILED_LOGINS,
  LOGIN_LOCK_MS,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  setSessionCookie,
} from './auth-security.js';
import type { AuthContext } from './auth.types.js';

const dummyPasswordHash = argon2.hash('arati-invalid-login-password');

interface RequestWithAuth extends Request {
  auth?: AuthContext;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @RequireSameOrigin()
  @UseGuards(AuthLoginRateLimitGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const email = body.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const now = new Date();

    if (user?.lockedUntil && user.lockedUntil > now) {
      await this.prisma.auditEvent.create({
        data: { userId: user.id, action: 'auth.login.failed', metadata: { email, reason: 'account_locked' } },
      });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Unable to log in with those credentials.' });
    }

    const passwordHash = user?.passwordHash ?? await dummyPasswordHash;
    const passwordMatches = await argon2.verify(passwordHash, body.password).catch(() => false);

    if (!user || !user.isActive || !passwordMatches) {
      if (user) await this.recordFailedLogin(user.id, email);
      else await this.prisma.auditEvent.create({ data: { action: 'auth.login.failed', metadata: { email } } });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Unable to log in with those credentials.' });
    }

    const token = createSessionToken();
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
    const expiresAt = new Date(Math.min(now.getTime() + SESSION_IDLE_MS, absoluteExpiresAt.getTime()));
    const session = await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
      const createdSession = await transaction.authSession.create({
        data: {
          tokenHash: hashSessionToken(token),
          userId: user.id,
          expiresAt,
          absoluteExpiresAt,
          lastSeenAt: now,
        },
      });
      await transaction.auditEvent.create({
        data: { userId: user.id, action: 'auth.login.succeeded' },
      });
      return createdSession;
    });

    setSessionCookie(response, token, this.config.nodeEnv === 'production', Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000));
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      sessionExpiresAt: session.expiresAt.toISOString(),
    };
  }

  @Get('me')
  me(@Req() request: RequestWithAuth) {
    const auth = request.auth!;
    return {
      user: { id: auth.userId, email: auth.email, displayName: auth.displayName },
      memberships: auth.memberships,
    };
  }

  @RequireSameOrigin()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const auth = request.auth!;
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { id: auth.sessionId, userId: auth.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditEvent.create({ data: { userId: auth.userId, action: 'auth.logout' } }),
    ]);
    setSessionCookie(response, undefined, this.config.nodeEnv === 'production');
  }

  private async recordFailedLogin(userId: string, email: string): Promise<void> {
    const now = new Date();
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    await this.prisma.$transaction([
      ...(updated.failedLoginCount >= MAX_FAILED_LOGINS
        ? [this.prisma.user.update({ where: { id: userId }, data: { lockedUntil: new Date(now.getTime() + LOGIN_LOCK_MS) } })]
        : []),
      this.prisma.auditEvent.create({
        data: { userId, action: 'auth.login.failed', metadata: { email, failedLoginCount: updated.failedLoginCount } },
      }),
    ]);
  }
}

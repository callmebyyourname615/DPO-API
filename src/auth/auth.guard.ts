import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';

const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, hex] = stored.split(':');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hex || '')) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return timingSafeEqual(actual, expected);
}
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const match = /^Bearer ([^ ]+)$/.exec(request.headers.authorization || '');
    if (!match) throw new UnauthorizedException();
    let sub: string;
    let version: number;
    try { const payload = await this.jwt.verifyAsync<{ sub: string; version?: number }>(match[1]); sub = payload.sub; version = payload.version ?? 0; if (!Number.isSafeInteger(version) || version < 0) throw new Error('Invalid token version'); }
    catch { throw new UnauthorizedException(); }
    const record = await this.prisma.user.findUnique({ where: { id: sub }, select: { id: true, email: true, name: true, role: true, active: true, tokenVersion: true } });
    if (!record?.active || record.tokenVersion !== version) throw new UnauthorizedException();
    const { tokenVersion: _tokenVersion, ...user } = record;
    const roles = this.reflector.getAllAndOverride<UserRole[]>('roles', [context.getHandler(), context.getClass()]) ?? ['admin', 'editor', 'viewer'];
    if (!roles.includes(user.role)) throw new ForbiddenException();
    request.user = user;
    return true;
  }
}

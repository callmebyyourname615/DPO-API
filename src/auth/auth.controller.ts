import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard, verifyPassword } from './auth.guard';
class LoginDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MaxLength(128) password: string;
}
@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  @Post('login') @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user || !user.active || !await verifyPassword(dto.password, user.passwordHash)) throw new UnauthorizedException('Invalid credentials');
    const accessToken = await this.jwt.signAsync({ sub: user.id, version: user.tokenVersion });
    return { accessToken, tokenType: 'Bearer', expiresIn: 3600, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }
  @Get('me') @UseGuards(AdminGuard)
  me(@Req() request: any) { return request.user; }
}

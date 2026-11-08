import { Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AdminGuard, hashPassword, Roles } from '../auth/auth.guard';
import { CreateUserDto, UpdateUserDto } from '../common/dto';
import { PrismaService } from '../prisma/prisma.service';

const fields = { id: true, email: true, name: true, role: true, active: true, createdAt: true, updatedAt: true } as const;
@Controller('admin/users')
@UseGuards(AdminGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() list() { return this.prisma.user.findMany({ select: fields, orderBy: { createdAt: 'desc' } }); }
  @Post() async create(@Body() dto: CreateUserDto) {
    try { return await this.prisma.user.create({ data: { email: dto.email.trim().toLowerCase(), name: dto.name.trim(), role: dto.role as UserRole, passwordHash: await hashPassword(dto.password) }, select: fields }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Email already exists'); throw error; }
  }
  @Patch(':id') async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() request: any) {
    if (id === request.user.id && (dto.active === false || (dto.role && dto.role !== 'admin'))) throw new ConflictException('Cannot disable or demote your own account');
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.role !== undefined) data.role = dto.role as UserRole;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.password !== undefined) data.passwordHash = await hashPassword(dto.password);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72517334)`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('User not found');
      if (user.role === 'admin' && user.active && (dto.active === false || (dto.role && dto.role !== 'admin')) && await tx.user.count({ where: { role: 'admin', active: true } }) <= 1) throw new ConflictException('At least one active admin is required');
      return tx.user.update({ where: { id }, data, select: fields });
    });
  }
}

import 'dotenv/config';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import request = require('supertest');
import { UsersController } from '../src/users/users.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthController } from '../src/auth/auth.controller';
import { AdminGuard, hashPassword, verifyPassword } from '../src/auth/auth.guard';

describe('account deletion in an isolated PostgreSQL schema',()=>{
  const schema=`user_delete_test_${randomUUID().replace(/-/g,'')}`;
  let root:PrismaClient,prisma:PrismaClient,app:INestApplication,jwt:JwtService;
  let next=0;
  const create=(role:'admin'|'viewer'|'editor'='viewer',active=true)=>prisma.user.create({data:{email:`user-${++next}@example.test`,name:'Test account',passwordHash:'test-only-not-a-login-hash',role,active}});
  const auth=(id:string)=>`Bearer ${jwt.sign({sub:id})}`;
  beforeAll(async()=>{
    root=new PrismaClient();await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const url=new URL(process.env.DATABASE_URL!);url.searchParams.set('schema',schema);
    prisma=new PrismaClient({datasourceUrl:url.toString()});
    await prisma.$executeRawUnsafe('CREATE TYPE "UserRole" AS ENUM (\'admin\',\'editor\',\'viewer\')');
    await prisma.$executeRawUnsafe('CREATE TABLE "User" (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,"passwordHash" TEXT NOT NULL,role "UserRole" NOT NULL DEFAULT \'viewer\',active BOOLEAN NOT NULL DEFAULT true,"tokenVersion" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL)');
    const module=await Test.createTestingModule({imports:[JwtModule.register({secret:'test-only-user-delete-secret-at-least-32-characters'})],controllers:[AuthController,UsersController],providers:[{provide:PrismaService,useValue:prisma},AdminGuard]}).compile();
    app=module.createNestApplication();app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));await app.init();jwt=app.get(JwtService);
  });
  beforeEach(async()=>{await prisma.user.deleteMany();});
  afterAll(async()=>{await app?.close();await prisma?.$disconnect();if(root){await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await root.$disconnect();}});
  it('requires authentication and an admin role',async()=>{
    const admin=await create('admin'),viewer=await create(),editor=await create('editor');
    const path=`/api/admin/users/${admin.id}`;
    await request(app.getHttpServer()).delete(path).expect(401);
    await request(app.getHttpServer()).delete(path).set('Authorization',auth(viewer.id)).expect(403);
    await request(app.getHttpServer()).delete(path).set('Authorization',auth(editor.id)).expect(403);
    expect(await prisma.user.count()).toBe(3);
  });
  it('deletes the selected account and immediately rejects its existing token',async()=>{
    const admin=await create('admin'),viewer=await create();const token=auth(viewer.id);
    const response=await request(app.getHttpServer()).delete(`/api/admin/users/${viewer.id}`).set('Authorization',auth(admin.id)).expect(204);
    expect(response.text).toBe('');expect(await prisma.user.findUnique({where:{id:viewer.id}})).toBeNull();
    await request(app.getHttpServer()).get('/api/admin/users').set('Authorization',token).expect(401);
    await request(app.getHttpServer()).delete(`/api/admin/users/${viewer.id}`).set('Authorization',auth(admin.id)).expect(404);
    expect(await prisma.user.findUnique({where:{id:admin.id}})).not.toBeNull();
  });
  it('rejects self-deletion and preserves the final active admin',async()=>{
    const admin=await create('admin');
    await request(app.getHttpServer()).delete(`/api/admin/users/${admin.id}`).set('Authorization',auth(admin.id)).expect(409);
    expect(await prisma.user.count({where:{role:'admin',active:true}})).toBe(1);
  });
  it('allows deleting inactive admins and other admins while preserving an active admin',async()=>{
    const admin=await create('admin'),other=await create('admin'),inactive=await create('admin',false);
    await request(app.getHttpServer()).delete(`/api/admin/users/${other.id}`).set('Authorization',auth(admin.id)).expect(204);
    await request(app.getHttpServer()).delete(`/api/admin/users/${inactive.id}`).set('Authorization',auth(admin.id)).expect(204);
    expect(await prisma.user.count({where:{role:'admin',active:true}})).toBe(1);
  });
  it('serializes competing admin deletions and preserves one active admin',async()=>{
    const first=await create('admin'),second=await create('admin');
    const responses=await Promise.all([
      request(app.getHttpServer()).delete(`/api/admin/users/${second.id}`).set('Authorization',auth(first.id)),
      request(app.getHttpServer()).delete(`/api/admin/users/${first.id}`).set('Authorization',auth(second.id)),
    ]);
    expect(responses.filter(response=>response.status===204)).toHaveLength(1);
    expect(responses.filter(response=>response.status===401)).toHaveLength(1);
    expect(await prisma.user.count({where:{role:'admin',active:true}})).toBe(1);
  });
  it('rechecks revoked authority inside the deletion transaction',async()=>{
    const actor=await create('viewer'),target=await create();
    const controller=new UsersController(prisma as any);
    await expect(controller.remove(target.id,{user:{id:actor.id}})).rejects.toThrow('Forbidden');
    await prisma.user.update({where:{id:actor.id},data:{role:'admin',active:false}});
    await expect(controller.remove(target.id,{user:{id:actor.id}})).rejects.toThrow('Unauthorized');
    expect(await prisma.user.findUnique({where:{id:target.id}})).not.toBeNull();
  });
  it('resets passwords without returning credentials, and revokes previous tokens',async()=>{
    const admin=await create('admin'),viewer=await create();
    const oldPassword='old-test-password-123',newPassword='new123';
    await prisma.user.update({where:{id:viewer.id},data:{passwordHash:await hashPassword(oldPassword)}});
    const before=await request(app.getHttpServer()).post('/api/auth/login').send({email:viewer.email,password:oldPassword}).expect(201);
    const result=await request(app.getHttpServer()).patch(`/api/admin/users/${viewer.id}`).set('Authorization',auth(admin.id)).send({password:newPassword}).expect(200);
    expect(result.body).not.toHaveProperty('password');expect(result.body).not.toHaveProperty('passwordHash');expect(result.body).not.toHaveProperty('tokenVersion');
    const stored=(await prisma.user.findUnique({where:{id:viewer.id}}))!;
    expect(stored.tokenVersion).toBe(1);expect(await verifyPassword(newPassword,stored.passwordHash)).toBe(true);expect(await verifyPassword(oldPassword,stored.passwordHash)).toBe(false);
    await request(app.getHttpServer()).post('/api/auth/login').send({email:viewer.email,password:oldPassword}).expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization',`Bearer ${before.body.accessToken}`).expect(401);
    const after=await request(app.getHttpServer()).post('/api/auth/login').send({email:viewer.email,password:newPassword}).expect(201);
    const me=await request(app.getHttpServer()).get('/api/auth/me').set('Authorization',`Bearer ${after.body.accessToken}`).expect(200);
    expect(me.body.id).toBe(viewer.id);expect(me.body).not.toHaveProperty('tokenVersion');
  });
  it('rejects invalid reset passwords and requests from non-admin users',async()=>{
    const admin=await create('admin'),viewer=await create();const path=`/api/admin/users/${viewer.id}`;
    for(const password of ['short','x'.repeat(129),null,123])await request(app.getHttpServer()).patch(path).set('Authorization',auth(admin.id)).send({password}).expect(400);
    await request(app.getHttpServer()).patch(path).send({password:'new-test-password-456'}).expect(401);
    await request(app.getHttpServer()).patch(path).set('Authorization',auth(viewer.id)).send({password:'new-test-password-456'}).expect(403);
    expect((await prisma.user.findUnique({where:{id:viewer.id}}))!.tokenVersion).toBe(0);
  });
  it('allows self reset and requires a fresh login afterward',async()=>{
    const admin=await create('admin'),token=auth(admin.id);
    await request(app.getHttpServer()).patch(`/api/admin/users/${admin.id}`).set('Authorization',token).send({password:'new-own-password-123'}).expect(200);
    await request(app.getHttpServer()).get('/api/admin/users').set('Authorization',token).expect(401);
    const login=await request(app.getHttpServer()).post('/api/auth/login').send({email:admin.email,password:'new-own-password-123'}).expect(201);
    await request(app.getHttpServer()).get('/api/admin/users').set('Authorization',`Bearer ${login.body.accessToken}`).expect(200);
  });

  it('creates an account with a six-character password',async()=>{
    const admin=await create('admin');
    const response=await request(app.getHttpServer()).post('/api/admin/users').set('Authorization',auth(admin.id)).send({email:'six-char@example.test',name:'Six character password',role:'viewer',password:'six123'}).expect(201);
    expect(response.body).not.toHaveProperty('passwordHash');
    await request(app.getHttpServer()).post('/api/auth/login').send({email:'six-char@example.test',password:'six123'}).expect(201);
    await request(app.getHttpServer()).post('/api/admin/users').set('Authorization',auth(admin.id)).send({email:'short@example.test',name:'Too short',role:'viewer',password:'five5'}).expect(400);
  });

});

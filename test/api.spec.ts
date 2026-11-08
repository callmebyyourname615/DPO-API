import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/auth/auth.guard';

describe('DPO API integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let viewerToken: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword('test-only-password-123');
    await prisma.user.createMany({ data: [
      { email: 'admin@example.test', name: 'Admin', role: 'admin', passwordHash },
      { email: 'viewer@example.test', name: 'Viewer', role: 'viewer', passwordHash },
    ] });
    adminToken = (await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'admin@example.test', password: 'test-only-password-123' }).expect(201)).body.accessToken;
    viewerToken = (await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'viewer@example.test', password: 'test-only-password-123' }).expect(201)).body.accessToken;
  });
  afterAll(async () => { if (app) await app.close(); });
  it('protects admin and checks current role', async () => {
    await request(app.getHttpServer()).get('/api/admin/inquiries').expect(401);
    await request(app.getHttpServer()).post('/api/admin/faqs').set('Authorization', `Bearer ${viewerToken}`).send({question:'Test',answer:'Test'}).expect(403);
    await request(app.getHttpServer()).get('/api/admin/faqs').set('Authorization', `Bearer ${viewerToken}`).expect(200);
  });
  it('validates login and rejects invalid credentials', async () => {
    await request(app.getHttpServer()).post('/api/auth/login').send({email:'admin@example.test',password:'wrong'}).expect(401);
    await request(app.getHttpServer()).post('/api/auth/login').send({email:'bad',password:'x'}).expect(400);
  });
  it('keeps draft and scheduled news out of public endpoints and search', async () => {
    const auth = `Bearer ${adminToken}`;
    const draft = await request(app.getHttpServer()).post('/api/admin/news').set('Authorization',auth).send({title:'Draft secret',slug:'draft-test',category:'news',content:'private draft',status:'draft'}).expect(201);
    await request(app.getHttpServer()).get('/api/news/draft-test').expect(404);
    expect((await request(app.getHttpServer()).get('/api/search?q=Draft').expect(200)).body.news).toHaveLength(0);
    await request(app.getHttpServer()).post('/api/admin/news').set('Authorization',auth).send({title:'Duplicate',slug:'draft-test',category:'news',content:'x'}).expect(409);
    await request(app.getHttpServer()).patch(`/api/admin/news/${draft.body.id}`).set('Authorization',auth).send({...draft.body,status:'published',publishedAt:'2099-01-01T00:00:00.000Z'}).expect(200);
    await request(app.getHttpServer()).get('/api/news/draft-test').expect(404);
    await request(app.getHttpServer()).patch(`/api/admin/news/${draft.body.id}`).set('Authorization',auth).send({publishedAt:null}).expect(200);
    await request(app.getHttpServer()).get('/api/news/draft-test').expect(200);
    expect((await request(app.getHttpServer()).get('/api/news?category=news&limit=1').expect(200)).body.total).toBe(1);
  });
  it('rejects unknown fields and invalid filters', async () => {
    await request(app.getHttpServer()).post('/api/admin/faqs').set('Authorization', `Bearer ${adminToken}`).send({question:'x',answer:'y',unexpected:true}).expect(400);
    await request(app.getHttpServer()).get('/api/news?limit=0').expect(400);
    await request(app.getHttpServer()).get('/api/news?category=invalid').expect(400);
  });
  it('accepts public inquiries with safe fields and prevents public reads', async () => {
    await request(app.getHttpServer()).post('/api/inquiries').send({name:'Example',email:'person@example.test',subject:'Question',message:'Hello',source:'contact',status:'resolved'}).expect(400);
    const created = await request(app.getHttpServer()).post('/api/inquiries').send({name:'Example',email:'person@example.test',message:'Hello'}).expect(201);
    expect(created.body).not.toHaveProperty('email');
    await request(app.getHttpServer()).get('/api/inquiries').expect(404);
    const stored = await request(app.getHttpServer()).get(`/api/admin/inquiries/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(stored.body.status).toBe('new');
    await request(app.getHttpServer()).patch(`/api/admin/inquiries/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({message:'changed'}).expect(400);
  });
  it('enforces upload restrictions and returns uploaded media', async () => {
    const auth = `Bearer ${adminToken}`;
    await request(app.getHttpServer()).post('/api/admin/media/upload').set('Authorization',auth).attach('file',Buffer.from('fake'),{filename:'bad.png',contentType:'image/png'}).expect(400);
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
    const up = await request(app.getHttpServer()).post('/api/admin/media/upload').set('Authorization',auth).attach('file',png,{filename:'sample.png',contentType:'image/png'}).expect(201);
    const response = await request(app.getHttpServer()).get(`/api/media/${up.body.id}/content`).expect(200);
    expect(response.headers['content-type']).toMatch(/image\/png/);
    await request(app.getHttpServer()).delete(`/api/admin/media/${up.body.id}`).set('Authorization',auth).expect(204);
    await request(app.getHttpServer()).get(`/api/media/${up.body.id}/content`).expect(404);
  });
  it('updates singleton records and computes statistics', async () => {
    const auth = `Bearer ${adminToken}`;
    const initial = await request(app.getHttpServer()).get('/api/admin/site-settings').set('Authorization',auth).expect(200);
    await request(app.getHttpServer()).patch('/api/admin/site-settings').set('Authorization',auth).send({...initial.body,phone:'1524'}).expect(200);
    expect((await request(app.getHttpServer()).get('/api/site-settings').expect(200)).body.phone).toBe('1524');
    const stats = await request(app.getHttpServer()).get('/api/admin/stats').set('Authorization',auth).expect(200);
    expect(stats.body.inquiriesNew).toBe(1);
  });
  it('protects user management and never exposes password hashes', async () => {
    const auth = `Bearer ${adminToken}`;
    await request(app.getHttpServer()).get('/api/admin/users').set('Authorization', `Bearer ${viewerToken}`).expect(403);
    const users = await request(app.getHttpServer()).get('/api/admin/users').set('Authorization',auth).expect(200);
    expect(users.body[0]).not.toHaveProperty('passwordHash');
    const admin = users.body.find((u: any) => u.email === 'admin@example.test');
    await request(app.getHttpServer()).patch(`/api/admin/users/${admin.id}`).set('Authorization',auth).send({active:false}).expect(409);
  });
});

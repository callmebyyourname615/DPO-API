import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/auth/auth.guard';

describe('endpoint coverage', () => {
  let app: INestApplication;
  let token: string;
  const suffix = Date.now().toString();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    const prisma = app.get(PrismaService);
    const email = `coverage-${suffix}@example.test`;
    await prisma.user.create({ data: { email, name: 'Coverage', role: 'admin', passwordHash: await hashPassword('coverage-password-123') } });
    token = (await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'coverage-password-123' }).expect(201)).body.accessToken;
  });
  afterAll(async () => { if (app) await app.close(); });
  it('covers public content, admin CRUD, singleton, authentication and users', async () => {
    const server = app.getHttpServer();
    const auth = `Bearer ${token}`;
    await request(server).get('/api/health').expect(200);
    await request(server).get('/api/auth/me').set('Authorization', auth).expect(200);
    const resources = [
      { path: 'news', payload: { title: 'Coverage article', slug: `coverage-${suffix}`, category: 'international', content: 'searchable-content-coverage', status: 'published' } },
      { path: 'documents', payload: { title: 'Coverage document', category: 'fsnp', status: 'published' } },
      { path: 'faqs', payload: { question: 'Coverage question', answer: 'Coverage answer', status: 'published' } },
      { path: 'partners', payload: { name: 'Coverage partner', url: 'https://example.org', status: 'published' } },
      { path: 'pages', payload: { title: 'Coverage page', slug: `coverage-${suffix}`, content: 'searchable-content-coverage', status: 'published' } },
      { path: 'home/banners', payload: { title: 'Coverage banner', status: 'published' } },
    ];
    const ids: { path: string; id: string }[] = [];
    for (const { path, payload } of resources) {
      const base = `/api/admin/${path}`;
      const created = await request(server).post(base).set('Authorization', auth).send(payload).expect(201);
      ids.push({ path, id: created.body.id });
      await request(server).get(base).set('Authorization', auth).expect(200);
      await request(server).get(`${base}/${created.body.id}`).set('Authorization', auth).expect(200);
      await request(server).patch(`${base}/${created.body.id}`).set('Authorization', auth).send({ status: 'published' }).expect(200);
    }
    for (const path of ['/api/news?category=international&page=1&limit=1', `/api/news/coverage-${suffix}`, '/api/documents?q=Coverage&category=fsnp', '/api/faqs', '/api/partners', '/api/home', `/api/pages/coverage-${suffix}`, '/api/site-settings']) await request(server).get(path).expect(200);
    const search = await request(server).get('/api/search?q=searchable-content-coverage').expect(200);
    expect(search.body.news.some((n: any) => n.slug === `coverage-${suffix}`)).toBe(true);
    expect(search.body.pages.some((p: any) => p.slug === `coverage-${suffix}`)).toBe(true);
    const inquiry = await request(server).post('/api/inquiries').send({ name: 'Coverage', email: 'coverage@example.test', message: 'Test', source: 'faq' }).expect(201);
    await request(server).get('/api/admin/inquiries').set('Authorization', auth).expect(200);
    await request(server).get(`/api/admin/inquiries/${inquiry.body.id}`).set('Authorization', auth).expect(200);
    await request(server).patch(`/api/admin/inquiries/${inquiry.body.id}`).set('Authorization', auth).send({status: 'resolved'}).expect(200);
    for (const path of ['home/intro', 'site-settings']) {
      await request(server).get(`/api/admin/${path}`).set('Authorization', auth).expect(200);
      await request(server).patch(`/api/admin/${path}`).set('Authorization', auth).send(path === 'home/intro' ? {title:'Coverage intro'} : {phone:'123'}).expect(200);
    }
    await request(server).get('/api/admin/stats').set('Authorization', auth).expect(200);
    await request(server).get(`/api/admin/news/slug-check?slug=coverage-${suffix}`).set('Authorization', auth).expect(200);
    await request(server).get('/api/admin/media').set('Authorization', auth).expect(200);
    const user = await request(server).post('/api/admin/users').set('Authorization', auth).send({email:`user-${suffix}@example.test`,name:'Test',role:'viewer',password:'coverage-password-123'}).expect(201);
    await request(server).get('/api/admin/users').set('Authorization', auth).expect(200);
    await request(server).patch(`/api/admin/users/${user.body.id}`).set('Authorization', auth).send({active:false}).expect(200);
    for (const { path, id } of ids) await request(server).delete(`/api/admin/${path}/${id}`).set('Authorization', auth).expect(204);
  });
});

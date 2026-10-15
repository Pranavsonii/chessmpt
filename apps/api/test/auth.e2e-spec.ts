import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { AUTH_COOKIE } from '../src/auth/auth.cookie';
import type { AuthUser } from '../src/auth/auth.types';
import { CurrentUser, Roles } from '../src/auth/decorators';
import type { ApiFailure } from '../src/common/api-response';

// Test-only routes to exercise the global guards through real HTTP.
@Controller('guarded')
class GuardedController {
  @Get('any')
  any(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Roles('coach')
  @Get('coach')
  coachOnly() {
    return 'coach area';
  }

  @Roles('student')
  @Get('student')
  studentOnly() {
    return 'student area';
  }
}

describe('Auth guards (e2e, no database needed)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const cookieFor = (role: 'coach' | 'student') =>
    `${AUTH_COOKIE}=${jwt.sign({ sub: `${role}-id`, role })}`;
  const errorCode = (res: request.Response) =>
    (res.body as ApiFailure).error.code;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [GuardedController],
    }).compile();
    app = moduleFixture.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('public routes work without a cookie', async () => {
    await http().get('/api/v1/health').expect(200);
  });

  it('401 NOT_AUTHENTICATED without a cookie', async () => {
    const res = await http().get('/api/v1/guarded/any').expect(401);
    expect(errorCode(res)).toBe('NOT_AUTHENTICATED');
  });

  it('401 INVALID_SESSION with a garbage cookie', async () => {
    const res = await http()
      .get('/api/v1/guarded/any')
      .set('Cookie', `${AUTH_COOKIE}=garbage`)
      .expect(401);
    expect(errorCode(res)).toBe('INVALID_SESSION');
  });

  it('a valid cookie attaches the user', async () => {
    const res = await http()
      .get('/api/v1/guarded/any')
      .set('Cookie', cookieFor('student'))
      .expect(200);
    expect(res.body).toEqual({
      success: true,
      data: { id: 'student-id', role: 'student' },
    });
  });

  it('403 FORBIDDEN_ROLE: student on a coach-only route', async () => {
    const res = await http()
      .get('/api/v1/guarded/coach')
      .set('Cookie', cookieFor('student'))
      .expect(403);
    expect(errorCode(res)).toBe('FORBIDDEN_ROLE');
  });

  it('403 FORBIDDEN_ROLE: coach on a student-only route (and vice versa)', async () => {
    await http()
      .get('/api/v1/guarded/student')
      .set('Cookie', cookieFor('coach'))
      .expect(403);
  });

  it('roles match → 200', async () => {
    await http()
      .get('/api/v1/guarded/coach')
      .set('Cookie', cookieFor('coach'))
      .expect(200);
    await http()
      .get('/api/v1/guarded/student')
      .set('Cookie', cookieFor('student'))
      .expect(200);
  });

  it('/me requires login', async () => {
    await http().get('/api/v1/me').expect(401);
  });

  it('login validates input before touching the DB (400)', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '1' })
      .expect(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });

  it('logout clears the cookie (204)', async () => {
    const res = await http().post('/api/v1/auth/logout').expect(204);
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toContain(`${AUTH_COOKIE}=;`);
    expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  INestApplication,
  Post,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsInt, IsString, Min, MinLength } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Public } from '../src/auth/decorators';
import { configureApp } from '../src/app.setup';
import { ApiFailure, withMeta } from '../src/common/api-response';
import { FieldError } from '../src/common/pipes/validation.pipe';

// Test-only DTO + controller to exercise the global pipe, interceptor and filter.
class EchoDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsInt()
  @Min(1)
  count: number;
}

@Public() // these routes test the envelope, not auth
@Controller('e2e')
class E2eController {
  @Post('echo')
  echo(@Body() dto: EchoDto) {
    return dto;
  }

  @Get('list')
  list() {
    return withMeta([1, 2], { total: 2 });
  }

  @Get('conflict')
  conflict() {
    throw new ConflictException({
      code: 'ALREADY_JOINED',
      message: 'Already joined',
    });
  }

  @Get('boom')
  boom() {
    throw new Error('database password is hunter2');
  }

  @Post('nothing')
  @HttpCode(204)
  nothing() {
    return;
  }
}

describe('API backbone (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [E2eController],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns the success envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(res.body).toMatchObject({ success: true, data: { status: 'ok' } });
  });

  it('unversioned path is not found, in the error envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(404);
    const body = res.body as ApiFailure;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('valid body passes and is transformed', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e/echo')
      .send({ name: 'Magnus', count: 2 })
      .expect(201);
    expect(res.body).toEqual({
      success: true,
      data: { name: 'Magnus', count: 2 },
    });
  });

  it('invalid body -> 400 VALIDATION_ERROR with field details', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e/echo')
      .send({ name: 'ab', count: 0 })
      .expect(400);
    const body = res.body as ApiFailure;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    const fields = (body.error.details as FieldError[]).map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'count']));
  });

  it('unknown fields are rejected (no mass-assignment)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e/echo')
      .send({ name: 'Magnus', count: 1, role: 'coach' })
      .expect(400);
    expect((res.body as ApiFailure).error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'role' })]),
    );
  });

  it('meta is passed through', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/e2e/list')
      .expect(200);
    expect(res.body).toEqual({
      success: true,
      data: [1, 2],
      meta: { total: 2 },
    });
  });

  it('custom error codes are preserved', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/e2e/conflict')
      .expect(409);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'ALREADY_JOINED', message: 'Already joined' },
    });
  });

  it('unknown errors become a generic 500 without leaking details', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/e2e/boom')
      .expect(500);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });

  it('204 has no body', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e/nothing')
      .expect(204);
    expect(res.text).toBe('');
  });
});

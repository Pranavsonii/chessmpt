import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter.toErrorBody', () => {
  it('uses the default code for a plain message', () => {
    expect(
      AllExceptionsFilter.toErrorBody(
        new NotFoundException('Tournament not found'),
      ),
    ).toEqual({
      status: 404,
      error: { code: 'NOT_FOUND', message: 'Tournament not found' },
    });
  });

  it('keeps a custom code and details', () => {
    const ex = new ConflictException({
      code: 'TOURNAMENT_NOT_OPEN',
      message: 'Tournament is not open',
      details: { status: 'draft' },
    });
    expect(AllExceptionsFilter.toErrorBody(ex)).toEqual({
      status: 409,
      error: {
        code: 'TOURNAMENT_NOT_OPEN',
        message: 'Tournament is not open',
        details: { status: 'draft' },
      },
    });
  });

  it('handles a bare exception with no message', () => {
    const { status, error } = AllExceptionsFilter.toErrorBody(
      new ForbiddenException(),
    );
    expect(status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('joins Nest array messages', () => {
    const ex = new BadRequestException(['a must be a string', 'b is required']);
    expect(AllExceptionsFilter.toErrorBody(ex).error.message).toBe(
      'a must be a string, b is required',
    );
  });

  it('hides unknown errors behind a generic 500', () => {
    expect(
      AllExceptionsFilter.toErrorBody(new Error('secret stack info')),
    ).toEqual({
      status: 500,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });
});

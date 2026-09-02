import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { authenticate, blacklistToken } from '../auth';
import * as dbMod from '../../db/connection';

vi.mock('../../db/connection', () => ({
  query: vi.fn(),
}));

const mockedQuery = dbMod.query as unknown as ReturnType<typeof vi.fn>;

interface MockReq {
  method: string;
  url: string;
  headers: Record<string, string>;
  ip?: string;
  connection?: { remoteAddress?: string };
  user?: unknown;
}

const buildReq = (overrides: Partial<MockReq> = {}): MockReq => ({
  method: 'GET',
  url: '/protected',
  headers: {},
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
  ...overrides,
});

const buildRes = () => {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; },
  };
  return res;
};

const buildNext = () => {
  const fn = vi.fn();
  return fn;
};

const sign = (payload: object, secret = process.env.JWT_SECRET!) =>
  jwt.sign(payload, secret, { expiresIn: '1h' });

describe('authenticate middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'aegis-super-secret-jwt-key-change-in-production-2024';
    vi.clearAllMocks();
  });

  it('rejects when no Authorization header is sent', async () => {
    const req = buildReq();
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('No token provided');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when header does not start with Bearer', async () => {
    const req = buildReq({ headers: { authorization: 'Basic abc' } });
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects literal "null" string token (frontend bug regression)', async () => {
    const req = buildReq({ headers: { authorization: 'Bearer null' } });
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid token');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects malformed tokens', async () => {
    const req = buildReq({ headers: { authorization: 'Bearer not.a.real.jwt' } });
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects valid JWT for unknown user', async () => {
    mockedQuery.mockResolvedValueOnce([]);
    const token = sign({ userId: 'ghost' });
    const req = buildReq({ headers: { authorization: `Bearer ${token}` } });
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('User not found');
  });

  it('rejects soft-deleted accounts', async () => {
    mockedQuery.mockResolvedValueOnce([{
      id: 'u1', email: 'x@y.z', full_name: 'X', phone_number: null,
      platform_role: 'client', org_role: 'member', organization_id: 'o1',
      email_verified: 1, mfa_enabled: 0, deleted_at: '2026-01-01',
      created_at: new Date(), updated_at: new Date(), last_activity: new Date(),
    }]);
    const token = sign({ userId: 'u1' });
    const req = buildReq({ headers: { authorization: `Bearer ${token}` } });
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Account has been deleted');
  });

  it('rejects blacklisted tokens', async () => {
    const token = sign({ userId: 'u1' });
    blacklistToken(token);
    const req = buildReq({ headers: { authorization: `Bearer ${token}` } });
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Token has been revoked');
  });

  it('accepts a valid JWT for an active user, attaches user, and updates last_activity', async () => {
    mockedQuery.mockResolvedValueOnce([{
      id: 'u-active', email: 'active@y.z', full_name: 'A', phone_number: null,
      platform_role: 'client', org_role: 'member', organization_id: 'o1',
      email_verified: 1, mfa_enabled: 0, deleted_at: null,
      created_at: new Date(), updated_at: new Date(), last_activity: new Date(),
    }]);
    mockedQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const token = sign({ userId: 'u-active' });
    const req = buildReq({ headers: { authorization: `Bearer ${token}` } });
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect((req as any).user).toMatchObject({ id: 'u-active', email: 'active@y.z' });
    expect(mockedQuery).toHaveBeenCalledWith('UPDATE users SET last_activity = NOW() WHERE id = ?', ['u-active']);
  });

  it('accepts a valid JWT even when last_activity is older than 30 min (regression)', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    mockedQuery.mockResolvedValueOnce([{
      id: 'u-stale', email: 'stale@y.z', full_name: 'S', phone_number: null,
      platform_role: 'client', org_role: 'member', organization_id: 'o1',
      email_verified: 1, mfa_enabled: 0, deleted_at: null,
      created_at: new Date(), updated_at: new Date(), last_activity: threeHoursAgo,
    }]);
    mockedQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const token = sign({ userId: 'u-stale' });
    const req = buildReq({ headers: { authorization: `Bearer ${token}` } });
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('skips inactivity check for rememberMe tokens', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    mockedQuery.mockResolvedValueOnce([{
      id: 'u1', email: 'x@y.z', full_name: 'X', phone_number: null,
      platform_role: 'client', org_role: 'member', organization_id: 'o1',
      email_verified: 1, mfa_enabled: 0, deleted_at: null,
      created_at: new Date(), updated_at: new Date(), last_activity: threeHoursAgo,
    }]);
    mockedQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const token = sign({ userId: 'u1', rememberMe: true });
    const req = buildReq({ headers: { authorization: `Bearer ${token}` } });
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('skips last_activity UPDATE for MFA-pending tokens', async () => {
    mockedQuery.mockResolvedValueOnce([{
      id: 'u1', email: 'x@y.z', full_name: 'X', phone_number: null,
      platform_role: 'client', org_role: 'member', organization_id: 'o1',
      email_verified: 1, mfa_enabled: 0, deleted_at: null,
      created_at: new Date(), updated_at: new Date(), last_activity: new Date(),
    }]);

    const token = sign({ userId: 'u1', mfaPending: true });
    const req = buildReq({ headers: { authorization: `Bearer ${token}` } });
    const res = buildRes();
    const next = buildNext();
    await authenticate(req as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    const updateCalls = mockedQuery.mock.calls.filter((c: any) => String(c[0]).startsWith('UPDATE'));
    expect(updateCalls).toHaveLength(0);
  });
});

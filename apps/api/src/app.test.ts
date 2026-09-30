import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { Config } from './config.js';

const testConfig: Config = {
  port: 8080,
  supabaseUrl: 'https://test.supabase.co',
  supabaseServiceRoleKey: 'test-service-role-key',
  webOrigin: 'http://localhost:3000',
};

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(createApp(testConfig)).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('unknown routes', () => {
  it('returns a structured 404', async () => {
    const res = await request(createApp(testConfig)).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

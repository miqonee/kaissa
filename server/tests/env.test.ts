import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe('Authentication configuration', () => {
  it.each(['', 'dev-secret', 'change-me-to-a-long-random-string', 'replace-with-your-own-random-secret-at-least-32-characters'])('refuses unsafe production secret %j', async secret => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('JWT_SECRET', secret); vi.resetModules();
    await expect(import('../src/env.js')).rejects.toThrow('JWT_SECRET');
  });
  it('uses a fresh development key instead of a known fallback', async () => {
    vi.stubEnv('NODE_ENV','development');vi.stubEnv('JWT_SECRET','');vi.resetModules();
    const first=(await import('../src/env.js')).env.jwtSecret;vi.resetModules();
    const second=(await import('../src/env.js')).env.jwtSecret;
    expect(first.length).toBeGreaterThanOrEqual(32);expect(second).not.toBe(first);
  });
  it('accepts only explicit positive administrator IDs, not names', async () => {
    vi.stubEnv('ADMIN_USER_IDS','1,2,bad,-3,0');vi.stubEnv('ADMIN_USERNAMES','admin,ADMIN');vi.resetModules();
    expect((await import('../src/env.js')).env.adminUserIds).toEqual([1,2]);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../src/api/rest.js';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('REST failure presentation',()=>{
  it('keeps status when proxy returns HTML',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>',{status:502})));await expect(api.get('/api/lobbies')).rejects.toMatchObject({status:502});});
  it('does not expose a JSON parse exception to the user',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>',{status:502})));await expect(api.get('/api/lobbies')).rejects.toThrow('временно недоступен');});
  it('bounds an unresponsive request',async()=>{vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn((_url,opts)=>new Promise((_resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('aborted'))))));const pending=api.get('/api/lobbies');const check=expect(pending).rejects.toBeInstanceOf(ApiError);await vi.advanceTimersByTimeAsync(15000);await check;});
});

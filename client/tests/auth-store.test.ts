import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiError, api } from '../src/api/rest.js';
import { useAuthStore } from '../src/stores/auth.js';
vi.mock('../src/api/socket',()=>({resetSocket:vi.fn()}));
vi.mock('../src/utils/analytics',()=>({trackGoal:vi.fn()}));
const user = {id:1,username:'alice',rating:1200,wins:0,losses:0,draws:0,createdAt:'',isAdmin:false};
beforeEach(()=>{vi.restoreAllMocks();setActivePinia(createPinia());});
describe('Session resilience',()=>{
  it('retains identity when the network/server is unavailable',async()=>{const auth=useAuthStore();auth.user=user;vi.spyOn(api,'get').mockRejectedValue(new ApiError('offline',503));expect(await auth.check()).toBe(false);expect(auth.user?.id).toBe(1);});
  it('clears an expired session only on 401',async()=>{const auth=useAuthStore();auth.user=user;vi.spyOn(api,'get').mockRejectedValue(new ApiError('unauthorized',401));expect(await auth.check()).toBe(true);expect(auth.user).toBeNull();});
  it('does not overwrite a successful login with a stale session response',async()=>{const auth=useAuthStore();let reject!:(e:Error)=>void;vi.spyOn(api,'get').mockImplementation(()=>new Promise((_resolve,r)=>{reject=r;}));vi.spyOn(api,'post').mockResolvedValue({user});const check=auth.check();await auth.login('alice','test-password');reject(new ApiError('old session',401));await check;expect(auth.user?.id).toBe(1);});
  it('does not create a new guest when session validation failed',async()=>{const auth=useAuthStore();vi.spyOn(api,'get').mockRejectedValue(new ApiError('offline'));const post=vi.spyOn(api,'post');vi.stubGlobal('navigator',{});try{await expect(auth.ensureGuest()).rejects.toThrow('сессию');expect(post).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();}});
});

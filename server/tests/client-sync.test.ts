import { describe, it, expect } from 'vitest';
import type { GameState } from 'shared';
import { applyEndUpdate, applyMoveUpdate } from '../../client/src/game/sync.js';
function state(): GameState { return {gameId:1,mode:'team',status:'active',result:'*',reason:null,timeControl:{kind:'clock',baseMin:3,incSec:0},participants:[
  {userId:1,username:'one',team:1,color:'w',boardIndex:0,moveSlot:0,ratingBefore:1200,ratingAfter:null},
  {userId:2,username:'two',team:1,color:'w',boardIndex:0,moveSlot:1,ratingBefore:1200,ratingAfter:null},
],fens:['start'],turns:['b'],turnUserIds:[3],turnSlots:{w:0,b:0},pockets:null,moveNumber:1,clocks:[[3000,5000]],clocksActive:['b'],startedAt:0}; }
describe('Client move and result synchronization',()=>{
  it('uses the updated partner slot on the same move',()=>{const s=state();applyMoveUpdate(s,{gameId:1,boardIndex:0,ply:2,userId:3,from:'e7',to:'e5',fenAfter:'position w - - 0 2',clocksAfter:[3000,5000],turnSlots:{w:1,b:1}});expect(s.turnUserIds).toEqual([2]);});
  it('prefers server-owned next player including game over',()=>{const s=state();applyMoveUpdate(s,{gameId:1,boardIndex:0,ply:2,userId:3,from:'e7',to:'e5',fenAfter:'position w - - 0 2',clocksAfter:null,turnUserIds:[0]});expect(s.turnUserIds).toEqual([0]);});
  it('shows cancellation as abandoned and stops clocks and interaction',()=>{const s=state();applyEndUpdate(s,{gameId:1,result:'*',reason:'abandoned',participants:s.participants});expect(s.status).toBe('abandoned');expect(s.clocksActive).toEqual([null]);expect(s.turnUserIds).toEqual([0]);});
  it('does not apply another game’s result',()=>{const s=state();applyEndUpdate(s,{gameId:2,result:'1-0',reason:'checkmate',participants:[]});expect(s.status).toBe('active');});
});

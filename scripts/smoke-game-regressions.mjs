// Local disposable database only. Exercises all game modes after multiplayer changes.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
const base=process.env.KAISSA_TEST_BASE_URL??'';
const url=new URL(process.env.DATABASE_URL??'http://invalid');
assert(['127.0.0.1','localhost'].includes(url.hostname)&&/test/.test(url.pathname));
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base));assert(process.env.JWT_SECRET);
const db=new PrismaClient();const allSockets=[];const prefix=`qa_${Date.now()}`;
const cookie=u=>`kaissa_token=${jwt.sign({uid:u.id,username:u.username,sv:u.sessionVersion},process.env.JWT_SECRET,{expiresIn:'1h'})}`;
async function api(path,body,token){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Cookie:token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
function event(socket,name,predicate=()=>true,timeout=10000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(name,fn);reject(new Error(`Timeout: ${name}`));},timeout);function fn(data){if(predicate(data)){clearTimeout(timer);socket.off(name,fn);resolve(data);}}socket.on(name,fn);});}
async function connect(token){const s=io(base,{autoConnect:false,transports:['websocket'],extraHeaders:token?{Cookie:token}:{},reconnection:false});allSockets.push(s);const ready=event(s,'connect');s.connect();await ready;return s;}
const ack=(s,name,...args)=>s.timeout(5000).emitWithAck(name,...args);
try {
  const users=await Promise.all([1,2,3,4,5].map(i=>db.user.create({data:{username:`${prefix}_${i}`,passwordHash:null}})));
  for(const mode of ['team','bughouse','crazyhouse','crazyhouse-team']){
    const count=mode==='crazyhouse'?2:4;
    const players=users.slice(0,count);
    const sockets=await Promise.all(players.map(u=>connect(cookie(u))));
    const room=await api('/api/lobbies',{name:`QA ${mode}`,mode,timeControl:{kind:'none',baseMin:0,incSec:0},private:true,teamMode:'manual'},cookie(players[0]));assert.equal(room.status,201);
    for(let i=0;i<count;i++){
      assert.equal((await ack(sockets[i],'lobby:join',room.body.code)).ok,true);
      const selected=event(sockets[i],'lobby:state',s=>s.players.find(p=>p.userId===players[i].id)?.teamChoice===(i<count/2?1:2));
      sockets[i].emit('lobby:set-team',i<count/2?1:2);await selected;
      if(i>0){const ready=event(sockets[i],'lobby:state',s=>s.players.find(p=>p.userId===players[i].id)?.ready);sockets[i].emit('lobby:ready',true);await ready;}
    }
    const starting=event(sockets[0],'lobby:started');assert.equal((await ack(sockets[0],'lobby:start')).ok,true);const {gameId}=await starting;
    const watched=event(sockets[0],'game:state',s=>s.gameId===gameId);sockets[0].emit('game:watch',gameId);let state=await watched;
    assert.equal(state.participants.length,count);assert.equal(state.ratingKind,'rated');
    assert.equal((await api(`/api/games/${gameId}/rematch`,{},cookie(players[0]))).status,409,'No rematch before finish');
    const byId=new Map(players.map((u,i)=>[u.id,sockets[i]]));
    async function move(boardIndex,from,to,dropPiece){const uid=state.turnUserIds[boardIndex];const socket=byId.get(uid);assert(socket,`Missing current player ${uid}`);const next=event(sockets[0],'game:state',s=>s.gameId===gameId&&s.moveNumber>state.moveNumber);const update=event(sockets[0],'game:move',m=>m.gameId===gameId);const r=await ack(socket,'game:move',{gameId,boardIndex,from,to,...(dropPiece?{dropPiece}:{})});assert.equal(r.ok,true,r.error);const mv=await update;assert(mv.fenAfter);assert(mv.turnUserIds);state=await next;assert.deepEqual(mv.turnUserIds,state.turnUserIds);assert.deepEqual(mv.turnSlots,state.turnSlots);return uid;}
    const white=await move(0,'e2','e4');const black=await move(0,'d7','d5');const nextWhite=state.turnUserIds[0];
    if(mode==='team'||mode==='crazyhouse-team')assert.notEqual(nextWhite,white,'Partners alternate');else assert.equal(nextWhite,white);
    const rejected=await ack(byId.get(black),'game:move',{gameId,boardIndex:0,from:'d5',to:'d4'});assert.equal(rejected.ok,false,'Wrong player cannot move');
    await move(0,'e4','d5');
    if(mode==='crazyhouse'||mode==='crazyhouse-team'){
      const p=state.participants.findIndex(p=>p.userId===nextWhite);assert.equal(state.pockets[p].p,1);
      await move(0,'d8','d5');await move(0,'-','e4','p');
      assert.equal(state.pockets[p].p,0);
    } else if(mode==='bughouse'){
      const partner=state.participants.find(p=>p.team===1&&p.boardIndex===1);const index=state.participants.indexOf(partner);assert.equal(state.pockets[index].p,1);
      await move(1,'e2','e4');await move(1,'-','e6','p');assert.equal(state.pockets[index].p,0);
    }
    // Spectators must never be auto-seated or redirected by rematch notifications.
    const viewer=await connect(cookie(users[4]));const viewed=event(viewer,'game:state',s=>s.gameId===gameId);viewer.emit('game:watch',gameId);await viewed;
    let viewerRematches=0;viewer.on('game:rematch',()=>viewerRematches++);
    const ended=event(sockets[0],'game:end',s=>s.gameId===gameId);sockets[0].emit('game:resign',gameId);const result=await ended;assert.equal(result.status,'finished');
    const invited=event(sockets[1],'game:rematch',s=>s.gameId===gameId);
    const rematch=await api(`/api/games/${gameId}/rematch`,{},cookie(players[0]));assert.equal(rematch.status,200);await invited;
    const spectatorBarrier=event(viewer,'game:state',s=>s.gameId===gameId);viewer.emit('game:watch',gameId);await spectatorBarrier;assert.equal(viewerRematches,0);
    const archive=await api(`/api/games/${gameId}`);assert.equal(archive.body.game.status,'finished');assert(archive.body.moves.length>=3);
    for(const s of [...sockets,viewer])s.disconnect();
    console.log(`OK: ${mode}: ready/start, turns, illegal move rejection, reserves, result, replay data, participant-only rematch (game ${gameId})`);
  }
  const visitor=await connect();const unavailable=event(visitor,'game:unavailable');visitor.emit('game:watch',2147483000);assert.equal((await unavailable).gameId,2147483000);
  console.log('OK: nonexistent games return an explicit unavailable event');
} finally {for(const s of allSockets)s.disconnect();await db.$disconnect();}

'use strict';
// Tiny WebSocket matchmaking/relay server for 2-player host-authoritative Card Clash.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {WebSocket, WebSocketServer} = require('ws');

const PORT = Number(process.env.PORT || 3000);
const HTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 150;
const LIMIT_BYTES = 140000;
const send = (ws, data) => {
  if (ws?.readyState === WebSocket.OPEN && ws.bufferedAmount < 512000)
    ws.send(JSON.stringify(data));
};
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html' || req.url?.startsWith('/?')) {
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-cache',
      'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self' 'unsafe-inline' blob: data:; connect-src 'self' ws: wss:"});
    return res.end(HTML);
  }
  if (req.url === '/healthz') {
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({status:'ok', rooms:rooms.size}));
  }
  if (req.url === '/favicon.ico') {res.writeHead(204); return res.end();}
  res.writeHead(404); res.end('Not found');
});
const wss = new WebSocketServer({server, path:'/ws', maxPayload:LIMIT_BYTES, perMessageDeflate: {threshold:1024}});

function code() {
  let s;
  do {s = Array.from({length:6}, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');}
  while (rooms.has(s));
  return s;
}
function removeRoom(ws, informSelf = false) {
  const room = rooms.get(ws.room);
  if (!room) {delete ws.room; delete ws.role; return;}
  rooms.delete(ws.room);
  for (const peer of [room.host, room.guest]) {
    if (!peer) continue;
    delete peer.room; delete peer.role;
    if (peer !== ws) send(peer, {type:'peer_left', message:'The other player disconnected or left the game.'});
  }
  if (informSelf) send(ws, {type:'left'});
}
function cleanInput(i) {
  if (!i || typeof i !== 'object') return null;
  if (typeof i.aim !== 'number' || !Number.isFinite(i.aim)) return null;
  return {l:!!i.l,r:!!i.r,j:!!i.j,b:!!i.b,f:!!i.f,
    aim:Math.max(-Math.PI,Math.min(Math.PI,i.aim))};
}
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.lastState = 0;
  ws.lastInput = 0;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (buf) => {
    let m;
    try {m = JSON.parse(buf.toString());} catch {return;}
    if (!m || typeof m.type !== 'string') return;
    if (m.type === 'leave') return removeRoom(ws,true);
    if (m.type === 'create') {
      if (ws.room) return send(ws,{type:'error',message:'Leave your current room first.'});
      if (rooms.size >= MAX_ROOMS) return send(ws,{type:'error',message:'All free rooms are busy. Try again later.'});
      const c = code(); rooms.set(c,{host:ws,guest:null,started:false});
      ws.room=c; ws.role='host';
      return send(ws,{type:'created',code:c,seat:0});
    }
    if (m.type === 'join') {
      if (ws.room) return send(ws,{type:'error',message:'Leave your current room first.'});
      const c = String(m.code||'').toUpperCase().trim();
      const room = rooms.get(c);
      if (!room) return send(ws,{type:'error',message:'Room not found. Check the 6-character code.'});
      if (room.guest || room.started) return send(ws,{type:'error',message:'This room is full or already started.'});
      room.guest=ws; ws.room=c; ws.role='guest';
      send(ws,{type:'joined',code:c,seat:1});
      return send(room.host,{type:'peer_ready'});
    }
    if (!ws.room) return;
    const room = rooms.get(ws.room);
    if (!room) return;
    if (m.type === 'start' && ws===room.host && room.guest && !room.started) {
      room.started=true;
      send(room.host,{type:'started'});
      return send(room.guest,{type:'started'});
    }
    if (!room.started) return;
    if (m.type==='input' && ws===room.guest) {
      const now=Date.now();
      if (now-ws.lastInput<12) return;
      const input=cleanInput(m.input);
      if (input) {ws.lastInput=now;send(room.host,{type:'input',input});}
    }
    if (m.type==='pick' && ws===room.guest && Number.isInteger(m.index) && m.index>=0 && m.index<5)
      return send(room.host,{type:'pick',index:m.index});
    if (m.type==='snapshot' && ws===room.host && m.state && typeof m.state==='object') {
      const now=Date.now();
      if (now-ws.lastState<25) return;
      ws.lastState=now;
      send(room.guest,{type:'snapshot',state:m.state});
    }
  });
  ws.on('close',()=>removeRoom(ws));
  ws.on('error',()=>removeRoom(ws));
});
const heartbeat=setInterval(()=>{
  for (const ws of wss.clients) {
    if (!ws.isAlive) {ws.terminate();continue;}
    ws.isAlive=false; ws.ping();
  }
},30000);
server.listen(PORT,'0.0.0.0',()=>console.log(`Card Clash multiplayer: http://localhost:${PORT}`));
function stop(){clearInterval(heartbeat);wss.close();server.close();}
process.on('SIGTERM',stop);
process.on('SIGINT',stop);

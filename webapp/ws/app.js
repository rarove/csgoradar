import { WebSocketServer } from "ws";
import http from "http";
console.log("web_server started")
const port = process.env.PORT || 22006;
const server = http.createServer((req,res)=>{
  if(req.url==="/" || req.url==="/healthz"){ res.writeHead(200,{"Content-Type":"text/plain"}); res.end("cs2_webradar ws ok - connect to /cs2_webradar"); return; }
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({ server, path: "/cs2_webradar", perMessageDeflate: false, maxPayload: 1<<20 });
function heartbeat(){ this.isAlive = true; }
wss.on("connection", (ws, req) => {
  const addr = (req.socket.remoteAddress||"").replace("::ffff:",""); 
  ws.isAlive = true; ws.on("pong", heartbeat);
  console.info(`${addr} connected`);
  ws.on("message", (msg) => {
    wss.clients.forEach((c) => {
      if (c !== ws && c.readyState === 1) { try{ c.send(msg, {binary:false}); }catch{} }
    });
  });
  ws.on("close", () => console.info(`${addr} disconnected`));
  ws.on("error", (e) => console.error(addr, e.message));
});
const interval = setInterval(()=>{ wss.clients.forEach(ws=>{ if(ws.isAlive===false){ try{ ws.terminate(); }catch{} return; } ws.isAlive=false; try{ ws.ping(); }catch{} }); }, 30000);
wss.on("close", ()=> clearInterval(interval));
server.listen(port, ()=> console.info(`listening on port '${port}'`));

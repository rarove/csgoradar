import { WebSocketServer } from "ws";
import http from "http";

console.log("web_server started")

const port = process.env.PORT || 22006;
const server = http.createServer((req,res)=>{
  if(req.url==="/"){ res.writeHead(200,{"Content-Type":"text/plain"}); res.end("cs2_webradar ws ok - connect to /cs2_webradar"); return; }
});
const web_socket_server = new WebSocketServer(
{
    server: server, path: "/cs2_webradar"
});

web_socket_server.on("connection", (web_socket, request) => {
    const client_address = request.socket.remoteAddress.replace("::ffff:", "");
    console.info(`${client_address} connected`);

    web_socket.on("message", (message) => {
        web_socket_server.clients.forEach((client) => {
            client.send(message);
        });
    });

    web_socket.on("close", () => {
        console.info(`${client_address} disconnected \n`);
    });

    web_socket.on("error", (error) => {
        console.error(error);
    });
});

server.listen(port);
console.info(`listening on port '${port}'`);
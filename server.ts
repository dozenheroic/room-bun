import { serve } from "bun";
import type { ServerWebSocket } from "bun";
import { join } from "path";

type Status = "Онлайн" | "Занят" | "Отошёл";

interface User {
  ws: ServerWebSocket;
  name: string;
  status: Status;
  room: string;
}

const rooms: Record<string, User[]> = {};

serve({
  port: 3000,
  fetch(req, server) {
    if (server.upgrade(req)) return;

    const url = new URL(req.url);

    // index.html
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file("./public/index.html"));
    }

    // отдаём статические файлы из public
    try {
      return new Response(Bun.file(join("./public", url.pathname)));
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  },
  websocket: {
    open(ws: ServerWebSocket) {
      (ws as any).user = null;
    },

    message(ws: ServerWebSocket, message: string | ArrayBuffer | Buffer<ArrayBuffer>) {
      const data = JSON.parse(
        typeof message === "string" ? message : new TextDecoder().decode(message)
      );

      if (data.type === "joinRoom") {
        const { room, name } = data as { room: string; name: string };
        if (!rooms[room]) rooms[room] = [];

        if (rooms[room].length >= 10) {
          ws.send(JSON.stringify({ type: "error", message: "Комната переполнена (максимум 10 участников)" }));
          return;
        }

        const user: User = { ws, name, status: "Онлайн", room };
        (ws as any).user = user;
        rooms[room].push(user);

        broadcast(room, {
          type: "notification",
          message: `${name} вошёл в комнату`,
          users: getUsers(room)
        });
      }

      if (data.type === "leaveRoom") leave(ws);

      if (data.type === "changeStatus") {
        const user = (ws as any).user as User | null;
        if (!user) return;
        user.status = data.status as Status;
        broadcast(user.room, { type: "userList", users: getUsers(user.room) });
      }

      if (data.type === "roomMessage") {
        const user = (ws as any).user as User | null;
        if (!user) return;
        broadcast(user.room, { type: "message", from: user.name, text: data.text });
      }

      if (data.type === "typing") {
        const user = (ws as any).user as User | null;
        if (!user) return;
        broadcast(user.room, { type: "typing", name: user.name }, ws);
      }
    },

    close(ws: ServerWebSocket) {
      leave(ws);
    }
  }
});

function leave(ws: ServerWebSocket) {
  const user = (ws as any).user as User | null;
  if (!user) return;

  rooms[user.room] = rooms[user.room]?.filter(u => u !== user) || [];

  broadcast(user.room, {
    type: "notification",
    message: `${user.name} вышел из комнаты`,
    users: getUsers(user.room)
  });
}

function broadcast(room: string, data: any, except?: ServerWebSocket) {
  rooms[room]?.forEach(client => {
    if (client.ws !== except) client.ws.send(JSON.stringify(data));
  });
}

function getUsers(room: string) {
  return rooms[room]?.map(u => ({ name: u.name, status: u.status })) || [];
}

console.log("сервер запущен http://localhost:3000");

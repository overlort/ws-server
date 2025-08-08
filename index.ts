import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { LobbyManager } from './lobbyManager';

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const lobbyManager = new LobbyManager(io);

io.on('connection', (socket) => {
  lobbyManager.handleConnection(socket);
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Socket.IO сервер запущен на http://localhost:${PORT}`);
});

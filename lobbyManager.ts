import { Server, Socket } from 'socket.io';
import { TicTacToeGame } from './games/ticTacToe';

type Player = {
  name: string;
  ready: boolean;
};

type Lobby = {
  creatorId: string;
  players: Map<string, Player>;
  gameHandler?: TicTacToeGame;
};

export class LobbyManager {
  private lobbies = new Map<string, Lobby>();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  public handleConnection(socket: Socket) {
    let currentLobbyId: string | null = null;

    socket.on('joinLobby', ({ lobbyId, playerName }: { lobbyId: string; playerName: string }) => {
      currentLobbyId = lobbyId;

      if (!this.lobbies.has(lobbyId)) {
        this.lobbies.set(lobbyId, {
          creatorId: socket.id,
          players: new Map(),
        });
        console.log(`Создано новое лобби ${lobbyId} с создателем ${socket.id}`);
      }

      const lobby = this.lobbies.get(lobbyId)!;
      lobby.players.set(socket.id, { name: playerName, ready: false });
      socket.join(lobbyId);

      this.emitPlayersUpdate(lobbyId);

      if (lobby.gameHandler) {
        // Если игра уже началась, можно отправить состояние игроку
        socket.emit('gameStarted', {
          board: lobby.gameHandler['gameState'].board,
          currentTurn: lobby.gameHandler['gameState'].currentTurn,
          winner: lobby.gameHandler['gameState'].winner,
        });
      }
    });

    socket.on('setReady', (ready: boolean) => {
      if (!currentLobbyId) return;
      const lobby = this.lobbies.get(currentLobbyId);
      if (!lobby) return;

      const player = lobby.players.get(socket.id);
      if (player) {
        player.ready = ready;
        this.emitPlayersUpdate(currentLobbyId);
      }
    });

    socket.on('startGame', () => {
      if (!currentLobbyId) return;
      const lobby = this.lobbies.get(currentLobbyId);
      if (!lobby) return;

      if (socket.id !== lobby.creatorId) {
        socket.emit('errorMessage', 'Только создатель может начать игру');
        return;
      }

      if (lobby.gameHandler) {
        socket.emit('errorMessage', 'Игра уже запущена');
        return;
      }

      try {
        lobby.gameHandler = new TicTacToeGame(this.io, currentLobbyId, lobby.players);
        lobby.gameHandler.startGame();
      } catch (error) {
        socket.emit('errorMessage', (error as Error).message);
      }
    });

    socket.on('makeMove', (data) => {
      if (!currentLobbyId) return;
      const lobby = this.lobbies.get(currentLobbyId);
      if (!lobby || !lobby.gameHandler) return;

      lobby.gameHandler.handleMove(socket, data);
    });

    socket.on('disconnect', () => {
      if (!currentLobbyId) return;
      const lobby = this.lobbies.get(currentLobbyId);
      if (!lobby) return;

      lobby.players.delete(socket.id);
      socket.leave(currentLobbyId);

      if (socket.id === lobby.creatorId) {
        const newCreatorId = lobby.players.keys().next().value;
        if (newCreatorId) {
          lobby.creatorId = newCreatorId;
          console.log(`Создатель лобби ${currentLobbyId} сменился на ${newCreatorId}`);
        }
      }

      this.emitPlayersUpdate(currentLobbyId);

      if (lobby.players.size === 0) {
        if (lobby.gameHandler) {
          lobby.gameHandler.cleanup();
        }
        this.lobbies.delete(currentLobbyId);
        console.log(`Лобби ${currentLobbyId} удалено, т.к. игроков нет`);
      }
    });
  }

  private emitPlayersUpdate(lobbyId: string) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;

    this.io.to(lobbyId).emit('playersUpdate', {
      creatorId: lobby.creatorId,
      players: Array.from(lobby.players.entries()).map(([id, p]) => ({
        id,
        name: p.name,
        ready: p.ready,
      })),
    });
  }
}

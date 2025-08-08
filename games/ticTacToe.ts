import { Server, Socket } from 'socket.io';

type PlayerSymbol = 'X' | 'O';
type Cell = PlayerSymbol | null;

type Player = {
  name: string;
  ready: boolean;
};

type GameState = {
  board: Cell[];
  currentTurn: PlayerSymbol;
  players: Map<string, PlayerSymbol>;
  winner: PlayerSymbol | 'Draw' | null;
  isActive: boolean;
};

export class TicTacToeGame {
  private io: Server;
  private lobbyId: string;
  private players: Map<string, PlayerSymbol>;
  private gameState: GameState;

  constructor(io: Server, lobbyId: string, playersMap: Map<string, Player>) {
    this.io = io;
    this.lobbyId = lobbyId;
    this.players = new Map();
    this.gameState = {
      board: Array(9).fill(null),
      currentTurn: 'X',
      players: new Map(),
      winner: null,
      isActive: false,
    };

    const entries = Array.from(playersMap.entries());
    if (entries.length >= 2) {
      this.players.set(entries[0][0], 'X');
      this.players.set(entries[1][0], 'O');
    } else {
      // Если игроков меньше двух — игра не стартует
      throw new Error('Недостаточно игроков для начала игры');
    }

    this.gameState.players = this.players;
  }

  startGame() {
    this.gameState.isActive = true;
    this.gameState.board = Array(9).fill(null);
    this.gameState.currentTurn = 'X';
    this.gameState.winner = null;
    for (const [socketId, symbol] of this.players.entries()) {
      console.log(`Отправляем gameStarted игроку ${socketId} с символом ${symbol}`);
      this.io.to(socketId).emit('gameStarted', {
        board: this.gameState.board,
        currentTurn: this.gameState.currentTurn,
        yourSymbol: symbol,
      });
    }
  }

  handleMove(socket: Socket, data: { index: number }) {
    if (!this.gameState.isActive) return;
    const playerSymbol = this.players.get(socket.id);
    if (!playerSymbol) return;

    if (this.gameState.winner) return;

    if (this.gameState.currentTurn !== playerSymbol) return;

    const idx = data.index;
    if (idx < 0 || idx >= 9) return;

    if (this.gameState.board[idx] !== null) return;

    this.gameState.board[idx] = playerSymbol;

    const winner = this.checkWinner();
    if (winner) {
      this.gameState.winner = winner;
      this.gameState.isActive = false;
    } else if (this.gameState.board.every((cell) => cell !== null)) {
      this.gameState.winner = 'Draw';
      this.gameState.isActive = false;
    } else {
      this.gameState.currentTurn = this.gameState.currentTurn === 'X' ? 'O' : 'X';
    }

    this.io.to(this.lobbyId).emit('gameUpdate', {
      board: this.gameState.board,
      currentTurn: this.gameState.currentTurn,
      winner: this.gameState.winner,
    });
  }

  cleanup() {}

  private checkWinner(): PlayerSymbol | null {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // горизонтали
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // вертикали
      [0, 4, 8], [2, 4, 6], // диагонали
    ];

    for (const [a, b, c] of lines) {
      if (
        this.gameState.board[a] &&
        this.gameState.board[a] === this.gameState.board[b] &&
        this.gameState.board[b] === this.gameState.board[c]
      ) {
        return this.gameState.board[a];
      }
    }
    return null;
  }
}

import { WebSocketServer } from 'ws';
import { Server } from 'http';

interface GameState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  type: string;
  color: string;
  energy?: number;
  maxEnergy?: number;
  isGlowing?: boolean;
  chargingRate?: number;
  isLandmark?: boolean;
  pulsePhase?: number;
  orbitAngle?: number;
  orbitSpeed?: number;
  orbitRadius?: number;
  orbitCenter?: { x: number; y: number };
  isOrbiting?: boolean;
  orbitingTarget?: string;
  absorptionProgress?: number;
  lastMovementTime?: number;
  aiTarget?: string;
  aiState?: "hunting" | "fleeing" | "exploring" | "charging";
}

interface Player {
  id: string;
  ws: WebSocket;
  gameState: GameState;
}

class GameServer {
  private wss: WebSocketServer;
  private players: Map<string, Player> = new Map();
  private gameObjects: GameState[] = [];
  private lastUpdateTime: number = Date.now();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      const playerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize player
      const player: Player = {
        id: playerId,
        ws,
        gameState: {
          id: playerId,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          mass: 8,
          radius: 6,
          type: 'player',
          color: `hsl(${Math.random() * 360}, 70%, 60%)`,
          energy: 80,
          maxEnergy: 120
        }
      };

      this.players.set(playerId, player);
      this.gameObjects.push(player.gameState);

      // Send initial game state to new player
      ws.send(JSON.stringify({
        type: 'init',
        playerId,
        gameState: {
          players: Array.from(this.players.values()).map(p => p.gameState),
          objects: this.gameObjects
        }
      }));

      // Broadcast new player to all other players
      this.broadcast({
        type: 'playerJoined',
        player: player.gameState
      }, playerId);

      // Handle player updates
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handlePlayerMessage(playerId, data);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      // Handle player disconnection
      ws.on('close', () => {
        this.handlePlayerDisconnect(playerId);
      });
    });

    // Start game loop
    setInterval(() => this.gameLoop(), 1000 / 60);
  }

  private handlePlayerMessage(playerId: string, data: any) {
    const player = this.players.get(playerId);
    if (!player) return;

    switch (data.type) {
      case 'update':
        // Update player state
        Object.assign(player.gameState, data.state);
        break;
      case 'action':
        // Handle player actions (e.g., gravity pull)
        this.handlePlayerAction(playerId, data.action);
        break;
    }
  }

  private handlePlayerAction(playerId: string, action: any) {
    const player = this.players.get(playerId);
    if (!player) return;

    switch (action.type) {
      case 'gravityPull':
        // Handle gravity pull action
        this.handleGravityPull(player, action);
        break;
    }
  }

  private handleGravityPull(player: Player, action: any) {
    // Implement gravity pull logic here
    // This should affect nearby game objects
  }

  private handlePlayerDisconnect(playerId: string) {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      this.gameObjects = this.gameObjects.filter(obj => obj.id !== playerId);
      
      // Broadcast player left
      this.broadcast({
        type: 'playerLeft',
        playerId
      });
    }
  }

  private gameLoop() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    // Update game state
    this.updateGameState(deltaTime);

    // Broadcast game state to all players
    this.broadcast({
      type: 'gameState',
      state: {
        players: Array.from(this.players.values()).map(p => p.gameState),
        objects: this.gameObjects
      }
    });
  }

  private updateGameState(deltaTime: number) {
    // Update player positions and physics
    this.players.forEach(player => {
      // Apply basic physics
      player.gameState.x += player.gameState.vx * deltaTime;
      player.gameState.y += player.gameState.vy * deltaTime;

      // Apply friction
      player.gameState.vx *= 0.998;
      player.gameState.vy *= 0.998;
    });

    // Update other game objects
    this.gameObjects.forEach(obj => {
      if (obj.type !== 'player') {
        // Update AI and other objects
        obj.x += obj.vx * deltaTime;
        obj.y += obj.vy * deltaTime;
        obj.vx *= 0.998;
        obj.vy *= 0.998;
      }
    });
  }

  private broadcast(message: any, excludePlayerId?: string) {
    const messageStr = JSON.stringify(message);
    this.players.forEach(player => {
      if (player.id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(messageStr);
      }
    });
  }
}

export default GameServer; 
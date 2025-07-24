import { writable, type Writable } from 'svelte/store';
import { gameStore } from '../stores/gameStore';

export interface WebSocketMessage {
  type: string;
  data: any;
  sessionId?: string;
  gameId?: string;
}

export interface GameActionData {
  actionType: string;
  actionData: any;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private gameId: string | null = null;
  private playerName: string | null = null;

  // Connection state store
  public connectionState: Writable<'disconnected' | 'connecting' | 'connected' | 'error'> = writable('disconnected');
  public lastError: Writable<string | null> = writable(null);

  connect(serverUrl: string = 'ws://localhost:8001'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectionState.set('connecting');
      this.lastError.set(null);

      try {
        this.ws = new WebSocket(serverUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.connectionState.set('connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.connectionState.set('disconnected');
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.connectionState.set('error');
          this.lastError.set('Connection error');
          reject(error);
        };

      } catch (error) {
        this.connectionState.set('error');
        this.lastError.set('Failed to create WebSocket connection');
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState.set('disconnected');
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (this.gameId && this.playerName) {
          this.connect().then(() => {
            // Re-join game after reconnection
            this.joinGame(this.gameId!, this.playerName!);
          }).catch(console.error);
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      this.lastError.set('Max reconnection attempts reached');
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      console.log('Received message:', message);

      switch (message.type) {
        case 'connection_established':
          console.log('Connection established with session:', message.data.sessionId);
          break;

        case 'game_joined':
          this.gameId = message.data.gameId;
          gameStore.setGameState(message.data.gameState);
          gameStore.setGameId(message.data.gameId);
          break;

        case 'game_state_update':
          if (message.data.changes) {
            gameStore.applyChanges(message.data.changes);
          }
          if (message.data.gameState) {
            gameStore.setGameState(message.data.gameState);
          }
          break;

        case 'game_action_result':
          this.handleActionResult(message.data);
          break;

        case 'player_joined':
          gameStore.addNotification({
            type: 'info',
            message: `${message.data.playerName} joined the game`,
            timestamp: Date.now()
          });
          break;

        case 'player_left':
          gameStore.addNotification({
            type: 'info', 
            message: `${message.data.playerName} left the game`,
            timestamp: Date.now()
          });
          break;

        case 'chat_message':
          gameStore.addChatMessage(message.data);
          break;

        case 'time_update':
          gameStore.updateGameTime(message.data.gameTime);
          break;

        case 'error':
          console.error('Server error:', message.data.message);
          this.lastError.set(message.data.message);
          gameStore.addNotification({
            type: 'error',
            message: message.data.message,
            timestamp: Date.now()
          });
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  private handleActionResult(result: any): void {
    if (result.success) {
      gameStore.addNotification({
        type: 'success',
        message: result.message || 'Action completed successfully',
        timestamp: Date.now()
      });

      // Apply any changes from the action
      if (result.changes) {
        gameStore.applyChanges(result.changes);
      }
    } else {
      gameStore.addNotification({
        type: 'error',
        message: result.message || 'Action failed',
        timestamp: Date.now()
      });
    }
  }

  joinGame(gameId: string, playerName: string): void {
    this.gameId = gameId;
    this.playerName = playerName;
    
    this.sendMessage({
      type: 'join_game',
      data: {
        gameId,
        playerName
      }
    });
  }

  leaveGame(): void {
    this.sendMessage({
      type: 'leave_game',
      data: {}
    });
    
    this.gameId = null;
    this.playerName = null;
    gameStore.reset();
  }

  sendGameAction(actionType: string, actionData: any): void {
    this.sendMessage({
      type: 'game_action',
      data: {
        actionType,
        actionData
      }
    });
  }

  sendChatMessage(message: string, messageType: string = 'public'): void {
    this.sendMessage({
      type: 'chat_message',
      data: {
        message,
        messageType
      }
    });
  }

  // Specific game actions
  buildStructure(planetId: string, buildingType: string, quantity: number = 1): void {
    this.sendGameAction('build_structure', {
      planetId,
      buildingType,
      quantity
    });
  }

  sendFleet(fromPlanetId: string, toPlanetId: string, ships: any, orders: string): void {
    this.sendGameAction('send_fleet', {
      fromPlanetId,
      toPlanetId,
      ships,
      orders
    });
  }

  setResearchAllocation(researchType: string, allocation: number): void {
    this.sendGameAction('research_upgrade', {
      researchType,
      allocation
    });
  }

  managePlanet(planetId: string, action: string, parameters: any): void {
    this.sendGameAction('planet_management', {
      planetId,
      action,
      parameters
    });
  }

  private sendMessage(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
      this.lastError.set('Not connected to server');
    }
  }

  ping(): void {
    this.sendMessage({
      type: 'ping',
      data: {}
    });
  }

  getConnectionState() {
    return this.connectionState;
  }

  getLastError() {
    return this.lastError;
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
/**
 * WebSocket Message Types - Shared between client and server
 * Based on the original Astriarch architecture from app.js
 */

import { ServerGameOptions, GameSpeed } from '../model';
import { GameCommand, ClientEvent } from '../engine/GameCommands';

export enum MESSAGE_TYPE {
  // Connection & System
  NOOP = 'NOOP',
  PING = 'PING',
  PONG = 'PONG',
  ERROR = 'ERROR',

  // Game Management
  CREATE_GAME = 'CREATE_GAME',
  JOIN_GAME = 'JOIN_GAME',
  LIST_GAMES = 'LIST_GAMES',
  GAME_LIST_UPDATED = 'GAME_LIST_UPDATED',
  START_GAME = 'START_GAME',
  RESUME_GAME = 'RESUME_GAME',
  CHANGE_GAME_OPTIONS = 'CHANGE_GAME_OPTIONS',
  CHANGE_PLAYER_NAME = 'CHANGE_PLAYER_NAME',

  // Game Actions (Legacy - being migrated to GAME_COMMAND)
  SYNC_STATE = 'SYNC_STATE', // Request full state sync (used only for desync recovery)
  ADVANCE_GAME_TIME = 'ADVANCE_GAME_TIME', // Request time advancement (periodic, host only)
  SEND_SHIPS = 'SEND_SHIPS',
  UPDATE_PLANET_OPTIONS = 'UPDATE_PLANET_OPTIONS',
  UPDATE_PLANET_BUILD_QUEUE = 'UPDATE_PLANET_BUILD_QUEUE',
  SET_WAYPOINT = 'SET_WAYPOINT',
  CLEAR_WAYPOINT = 'CLEAR_WAYPOINT',

  // New Command/Event Architecture
  GAME_COMMAND = 'GAME_COMMAND', // Client -> Server: Player command
  CLIENT_EVENT = 'CLIENT_EVENT', // Server -> Client: State change event

  // Research & Trading
  ADJUST_RESEARCH_PERCENT = 'ADJUST_RESEARCH_PERCENT',
  SUBMIT_RESEARCH_ITEM = 'SUBMIT_RESEARCH_ITEM',
  CANCEL_RESEARCH_ITEM = 'CANCEL_RESEARCH_ITEM',
  SUBMIT_TRADE = 'SUBMIT_TRADE',
  CANCEL_TRADE = 'CANCEL_TRADE',

  // Chat & Communication
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  CHAT_ROOM_SESSIONS_UPDATED = 'CHAT_ROOM_SESSIONS_UPDATED',

  // Game State
  GAME_STATE_UPDATE = 'GAME_STATE_UPDATE',
  EVENT_NOTIFICATIONS = 'EVENT_NOTIFICATIONS',
  GAME_OVER = 'GAME_OVER',
  GAME_PAUSED = 'GAME_PAUSED',
  GAME_RESUMED = 'GAME_RESUMED',
  GAME_SPEED_ADJUSTMENT = 'GAME_SPEED_ADJUSTMENT',
  PLAYER_DISCONNECTED = 'PLAYER_DISCONNECTED',
  PLAYER_RECONNECTED = 'PLAYER_RECONNECTED',

  // Player Actions
  EXIT_RESIGN = 'EXIT_RESIGN',
  LOGOUT = 'LOGOUT',
  PLAYER_ELIMINATED = 'PLAYER_ELIMINATED',
}

export enum ERROR_TYPE {
  INVALID_GAME_OPTIONS = 'INVALID_GAME_OPTIONS',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_ACTION = 'INVALID_ACTION',
}

export enum CHAT_MESSAGE_TYPE {
  TEXT_MESSAGE = 'TEXT_MESSAGE',
  PLAYER_ENTER = 'PLAYER_ENTER',
  PLAYER_LEAVE = 'PLAYER_LEAVE',
  SYSTEM_MESSAGE = 'SYSTEM_MESSAGE',
}

// =============================================
// PAYLOAD TYPE DEFINITIONS
// =============================================

// Game data interfaces
export interface IGame {
  _id: string;
  name: string;
  players: IPlayer[];
  hostPlayerName?: string; // Optional to maintain compatibility
  gameOptions?: ServerGameOptions;
  status: 'waiting' | 'in_progress' | 'completed';
  createdAt: Date;
  lastActivity: Date;
}

export interface IPlayer {
  position: number;
  name: string;
  connected?: boolean;
}

// Payload interfaces for each message type
export interface INoopPayload {
  counter?: number;
  message?: string;
}

export interface IPingPayload {
  timestamp?: number;
}

export interface IPongPayload {
  timestamp?: number;
}

export interface IErrorPayload {
  error: string;
  message?: string;
  errorType?: ERROR_TYPE;
}

// Game Management Payloads
export interface ICreateGameRequestPayload {
  name: string;
  playerName: string;
  gameOptions: ServerGameOptions;
}

export interface ICreateGameResponsePayload {
  gameId: string;
  gameName?: string;
}

export interface IJoinGameRequestPayload {
  gameId: string;
  playerName: string;
}

export interface IJoinGameResponsePayload {
  success: boolean;
  gameId?: string;
  error?: string;
}

export type IListGamesRequestPayload = Record<string, never>;

export interface IListGamesResponsePayload {
  games: IGame[];
}

export interface IStartGameRequestPayload {
  gameId: string;
  gameOptions?: ServerGameOptions;
}

export interface IStartGameResponsePayload {
  success: boolean;
  gameState?: unknown;
  error?: string;
}

export interface IChangeGameOptionsPayload {
  gameId: string;
  gameOptions: ServerGameOptions;
  playerName?: string;
}

export interface IChangePlayerNamePayload {
  gameId: string;
  playerName: string;
}

export interface IGameSpeedAdjustmentPayload {
  newSpeed: GameSpeed;
  playerId?: string; // Optional: track who requested the change
}

export interface IGameStateUpdatePayload {
  gameState?: unknown;
  changes?: unknown;
  clientGameModel?: unknown;
  currentCycle?: number;
  stateChecksum?: string; // SHA256 hash for desync detection (calculated by backend)
}

export interface IEventNotificationsPayload {
  events: {
    playerId: string;
    type: number; // EventNotificationType
    message: string;
    planet?: unknown; // PlanetData
    data?: unknown; // PlanetaryConflictData
  }[];
}

export interface IGameOverPayload {
  winningPlayer?: {
    id: string;
    name: string;
    position: number;
  } | null;
  playerWon: boolean;
  score: number;
  endOfTurnMessages?: {
    playerId: string;
    type: number; // EventNotificationType
    message: string;
    planet?: unknown; // PlanetData
    data?: unknown; // PlanetaryConflictData
  }[];
  gameData?: unknown; // ClientModelData for final game state
  allHumansDestroyed?: boolean;
}

export interface IChatMessagePayload {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  messageType?: CHAT_MESSAGE_TYPE;
}

export interface IPlayerEliminatedPayload {
  playerName: string;
  playerId: string;
  gameId: string;
  reason: 'resigned' | 'destroyed';
}

// =============================================
// COMMAND/EVENT ARCHITECTURE
// =============================================

export interface IGameCommandPayload {
  command: GameCommand;
}

export interface IClientEventPayload {
  events: ClientEvent[];
  stateChecksum: string; // SHA256 hash for desync detection
  currentCycle: number; // Game cycle when events occurred
}

// =============================================
// GENERIC MESSAGE INTERFACE AND BASE CLASS
// =============================================

export interface IMessage<T = Record<string, unknown>> {
  type: MESSAGE_TYPE;
  payload: T;
  sessionId?: string;
  gameId?: string;
  timestamp?: Date;
}

export class Message<T = Record<string, unknown>> implements IMessage<T> {
  public type: MESSAGE_TYPE;
  public payload: T;
  public sessionId?: string;
  public gameId?: string;
  public timestamp: Date;

  constructor(type: MESSAGE_TYPE, payload: T, sessionId?: string, gameId?: string) {
    this.type = type;
    this.payload = payload;
    this.sessionId = sessionId;
    this.gameId = gameId;
    this.timestamp = new Date();
  }
}

// =============================================
// TYPED MESSAGE CLASSES
// =============================================

// System Messages
export class NoopMessage extends Message<INoopPayload> {
  constructor(payload: INoopPayload, sessionId?: string) {
    super(MESSAGE_TYPE.NOOP, payload, sessionId);
  }
}

export class PingMessage extends Message<IPingPayload> {
  constructor(payload: IPingPayload = {}, sessionId?: string) {
    super(MESSAGE_TYPE.PING, payload, sessionId);
  }
}

export class PongMessage extends Message<IPongPayload> {
  constructor(payload: IPongPayload = {}, sessionId?: string) {
    super(MESSAGE_TYPE.PONG, payload, sessionId);
  }
}

export class ErrorMessage extends Message<IErrorPayload> {
  constructor(payload: IErrorPayload, sessionId?: string) {
    super(MESSAGE_TYPE.ERROR, payload, sessionId);
  }
}

// Game Management Messages - Client to Server
export class CreateGameRequestMessage extends Message<ICreateGameRequestPayload> {
  constructor(payload: ICreateGameRequestPayload, sessionId?: string) {
    super(MESSAGE_TYPE.CREATE_GAME, payload, sessionId);
  }
}

export class JoinGameRequestMessage extends Message<IJoinGameRequestPayload> {
  constructor(payload: IJoinGameRequestPayload, sessionId?: string) {
    super(MESSAGE_TYPE.JOIN_GAME, payload, sessionId);
  }
}

export class ListGamesRequestMessage extends Message<IListGamesRequestPayload> {
  constructor(sessionId?: string) {
    super(MESSAGE_TYPE.LIST_GAMES, {} as IListGamesRequestPayload, sessionId);
  }
}

export class StartGameRequestMessage extends Message<IStartGameRequestPayload> {
  constructor(payload: IStartGameRequestPayload, sessionId?: string) {
    super(MESSAGE_TYPE.START_GAME, payload, sessionId);
  }
}

// Game Management Messages - Server to Client
export class CreateGameResponseMessage extends Message<ICreateGameResponsePayload> {
  constructor(payload: ICreateGameResponsePayload, sessionId?: string) {
    super(MESSAGE_TYPE.CREATE_GAME, payload, sessionId);
  }
}

export class JoinGameResponseMessage extends Message<IJoinGameResponsePayload> {
  constructor(payload: IJoinGameResponsePayload, sessionId?: string) {
    super(MESSAGE_TYPE.JOIN_GAME, payload, sessionId);
  }
}

export class ListGamesResponseMessage extends Message<IListGamesResponsePayload> {
  constructor(payload: IListGamesResponsePayload, sessionId?: string) {
    super(MESSAGE_TYPE.LIST_GAMES, payload, sessionId);
  }
}

export class StartGameResponseMessage extends Message<IStartGameResponsePayload> {
  constructor(payload: IStartGameResponsePayload, sessionId?: string) {
    super(MESSAGE_TYPE.START_GAME, payload, sessionId);
  }
}

export class GameStateUpdateMessage extends Message<IGameStateUpdatePayload> {
  constructor(payload: IGameStateUpdatePayload, sessionId?: string) {
    super(MESSAGE_TYPE.GAME_STATE_UPDATE, payload, sessionId);
  }
}

export class ChatMessage extends Message<IChatMessagePayload> {
  constructor(payload: IChatMessagePayload, sessionId?: string) {
    super(MESSAGE_TYPE.CHAT_MESSAGE, payload, sessionId);
  }
}

export class GameSpeedAdjustmentMessage extends Message<IGameSpeedAdjustmentPayload> {
  constructor(payload: IGameSpeedAdjustmentPayload, sessionId?: string, gameId?: string) {
    super(MESSAGE_TYPE.GAME_SPEED_ADJUSTMENT, payload, sessionId, gameId);
  }
}

// =============================================
// TYPE GUARDS FOR RUNTIME TYPE CHECKING
// =============================================

export function isCreateGameRequest(message: IMessage<unknown>): message is Message<ICreateGameRequestPayload> {
  return (
    message.type === MESSAGE_TYPE.CREATE_GAME &&
    typeof message.payload === 'object' &&
    message.payload !== null &&
    'name' in message.payload &&
    'playerName' in message.payload
  );
}

export function isCreateGameResponse(message: IMessage<unknown>): message is Message<ICreateGameResponsePayload> {
  return (
    message.type === MESSAGE_TYPE.CREATE_GAME &&
    typeof message.payload === 'object' &&
    message.payload !== null &&
    'gameId' in message.payload
  );
}

export function isJoinGameRequest(message: IMessage<unknown>): message is Message<IJoinGameRequestPayload> {
  return (
    message.type === MESSAGE_TYPE.JOIN_GAME &&
    typeof message.payload === 'object' &&
    message.payload !== null &&
    'gameId' in message.payload &&
    'playerName' in message.payload
  );
}

export function isJoinGameResponse(message: IMessage<unknown>): message is Message<IJoinGameResponsePayload> {
  return message.type === MESSAGE_TYPE.JOIN_GAME && typeof message.payload === 'object' && message.payload !== null;
}

export function isListGamesResponse(message: IMessage<unknown>): message is Message<IListGamesResponsePayload> {
  return (
    (message.type === MESSAGE_TYPE.LIST_GAMES || message.type === MESSAGE_TYPE.GAME_LIST_UPDATED) &&
    typeof message.payload === 'object' &&
    message.payload !== null &&
    'games' in message.payload
  );
}

export function isStartGameRequest(message: IMessage<unknown>): message is Message<IStartGameRequestPayload> {
  return message.type === MESSAGE_TYPE.START_GAME;
}

export function isStartGameResponse(message: IMessage<unknown>): message is Message<IStartGameResponsePayload> {
  return (
    message.type === MESSAGE_TYPE.START_GAME &&
    typeof message.payload === 'object' &&
    message.payload !== null &&
    'success' in message.payload
  );
}

export function isGameStateUpdate(message: IMessage<unknown>): message is Message<IGameStateUpdatePayload> {
  return message.type === MESSAGE_TYPE.GAME_STATE_UPDATE;
}

export function isChatMessage(message: IMessage<unknown>): message is Message<IChatMessagePayload> {
  return (
    message.type === MESSAGE_TYPE.CHAT_MESSAGE &&
    typeof message.payload === 'object' &&
    message.payload !== null &&
    'message' in message.payload
  );
}

export function isErrorMessage(message: IMessage<unknown>): message is Message<IErrorPayload> {
  return (
    message.type === MESSAGE_TYPE.ERROR &&
    typeof message.payload === 'object' &&
    message.payload !== null &&
    'error' in message.payload
  );
}

export function isGameSpeedAdjustment(message: IMessage<unknown>): message is Message<IGameSpeedAdjustmentPayload> {
  return (
    message.type === MESSAGE_TYPE.GAME_SPEED_ADJUSTMENT &&
    typeof message.payload === 'object' &&
    message.payload !== null &&
    'newSpeed' in message.payload
  );
}

export function getMessageTypeName(type: MESSAGE_TYPE): string {
  return MESSAGE_TYPE[type] || 'UNKNOWN';
}

/**
 * Helper function to get message type numeric values for compatibility
 * with the original app.js numeric message system
 */
export function getMessageTypeNumeric(type: MESSAGE_TYPE): number {
  const typeMap: Record<MESSAGE_TYPE, number> = {
    [MESSAGE_TYPE.NOOP]: 0,
    [MESSAGE_TYPE.PING]: 1,
    [MESSAGE_TYPE.PONG]: 2,
    [MESSAGE_TYPE.LIST_GAMES]: 10,
    [MESSAGE_TYPE.CREATE_GAME]: 11,
    [MESSAGE_TYPE.JOIN_GAME]: 12,
    [MESSAGE_TYPE.START_GAME]: 13,
    [MESSAGE_TYPE.RESUME_GAME]: 14,
    [MESSAGE_TYPE.CHANGE_GAME_OPTIONS]: 15,
    [MESSAGE_TYPE.CHANGE_PLAYER_NAME]: 16,
    [MESSAGE_TYPE.SYNC_STATE]: 20,
    [MESSAGE_TYPE.ADVANCE_GAME_TIME]: 19,
    [MESSAGE_TYPE.SEND_SHIPS]: 21,
    //[MESSAGE_TYPE.UPDATE_PLANET_START]: 22,
    [MESSAGE_TYPE.UPDATE_PLANET_OPTIONS]: 23,
    [MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE]: 24,
    [MESSAGE_TYPE.SET_WAYPOINT]: 25,
    [MESSAGE_TYPE.CLEAR_WAYPOINT]: 26,
    [MESSAGE_TYPE.ADJUST_RESEARCH_PERCENT]: 27,
    [MESSAGE_TYPE.SUBMIT_RESEARCH_ITEM]: 28,
    [MESSAGE_TYPE.CANCEL_RESEARCH_ITEM]: 29,
    [MESSAGE_TYPE.SUBMIT_TRADE]: 30,
    [MESSAGE_TYPE.CANCEL_TRADE]: 31,
    [MESSAGE_TYPE.CHAT_MESSAGE]: 40,
    [MESSAGE_TYPE.EXIT_RESIGN]: 50,
    [MESSAGE_TYPE.LOGOUT]: 51,
    [MESSAGE_TYPE.ERROR]: 60,
    [MESSAGE_TYPE.GAME_LIST_UPDATED]: 61,
    [MESSAGE_TYPE.GAME_STATE_UPDATE]: 62,
    [MESSAGE_TYPE.EVENT_NOTIFICATIONS]: 63,
    [MESSAGE_TYPE.GAME_OVER]: 64,
    [MESSAGE_TYPE.GAME_PAUSED]: 65,
    [MESSAGE_TYPE.GAME_RESUMED]: 66,
    [MESSAGE_TYPE.GAME_SPEED_ADJUSTMENT]: 67,
    [MESSAGE_TYPE.PLAYER_DISCONNECTED]: 68,
    [MESSAGE_TYPE.PLAYER_RECONNECTED]: 69,
    [MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED]: 70,
    [MESSAGE_TYPE.PLAYER_ELIMINATED]: 71,
    [MESSAGE_TYPE.GAME_COMMAND]: 80,
    [MESSAGE_TYPE.CLIENT_EVENT]: 81,
  };

  return typeMap[type] ?? -1;
}

/**
 * Convert numeric message type back to enum (for compatibility)
 */
export function getMessageTypeFromNumeric(typeNum: number): MESSAGE_TYPE | null {
  const reverseMap: Record<number, MESSAGE_TYPE> = {
    0: MESSAGE_TYPE.NOOP,
    1: MESSAGE_TYPE.PING,
    2: MESSAGE_TYPE.PONG,
    10: MESSAGE_TYPE.LIST_GAMES,
    11: MESSAGE_TYPE.CREATE_GAME,
    12: MESSAGE_TYPE.JOIN_GAME,
    13: MESSAGE_TYPE.START_GAME,
    14: MESSAGE_TYPE.RESUME_GAME,
    15: MESSAGE_TYPE.CHANGE_GAME_OPTIONS,
    16: MESSAGE_TYPE.CHANGE_PLAYER_NAME,
    20: MESSAGE_TYPE.SYNC_STATE,
    21: MESSAGE_TYPE.SEND_SHIPS,
    //22: MESSAGE_TYPE.UPDATE_PLANET_START,
    23: MESSAGE_TYPE.UPDATE_PLANET_OPTIONS,
    24: MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE,
    25: MESSAGE_TYPE.CLEAR_WAYPOINT,
    26: MESSAGE_TYPE.ADJUST_RESEARCH_PERCENT,
    27: MESSAGE_TYPE.SUBMIT_RESEARCH_ITEM,
    28: MESSAGE_TYPE.CANCEL_RESEARCH_ITEM,
    29: MESSAGE_TYPE.SUBMIT_TRADE,
    30: MESSAGE_TYPE.CANCEL_TRADE,
    40: MESSAGE_TYPE.CHAT_MESSAGE,
    50: MESSAGE_TYPE.EXIT_RESIGN,
    51: MESSAGE_TYPE.LOGOUT,
    60: MESSAGE_TYPE.ERROR,
    61: MESSAGE_TYPE.GAME_LIST_UPDATED,
    62: MESSAGE_TYPE.GAME_STATE_UPDATE,
    63: MESSAGE_TYPE.EVENT_NOTIFICATIONS,
    64: MESSAGE_TYPE.GAME_OVER,
    65: MESSAGE_TYPE.GAME_PAUSED,
    66: MESSAGE_TYPE.GAME_RESUMED,
    67: MESSAGE_TYPE.GAME_SPEED_ADJUSTMENT,
    68: MESSAGE_TYPE.PLAYER_DISCONNECTED,
    69: MESSAGE_TYPE.PLAYER_RECONNECTED,
    70: MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED,
    71: MESSAGE_TYPE.PLAYER_ELIMINATED,
  };

  return reverseMap[typeNum] ?? null;
}

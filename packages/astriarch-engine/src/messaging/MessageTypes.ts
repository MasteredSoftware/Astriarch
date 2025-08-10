/**
 * WebSocket Message Types - Shared between client and server
 * Based on the original Astriarch architecture from app.js
 */

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

  // Game Actions
  END_TURN = 'END_TURN',
  SEND_SHIPS = 'SEND_SHIPS',
  UPDATE_PLANET_START = 'UPDATE_PLANET_START',
  UPDATE_PLANET_OPTIONS = 'UPDATE_PLANET_OPTIONS',
  UPDATE_PLANET_BUILD_QUEUE = 'UPDATE_PLANET_BUILD_QUEUE',
  CLEAR_WAYPOINT = 'CLEAR_WAYPOINT',

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
  GAME_OVER = 'GAME_OVER',

  // Player Actions
  EXIT_RESIGN = 'EXIT_RESIGN',
  LOGOUT = 'LOGOUT',
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
  gameOptions?: IGameOptions;
  status: 'waiting' | 'in_progress' | 'completed';
  createdAt: Date;
  lastActivity: Date;
}

export interface IPlayer {
  sessionId: string;
  position: number;
  Id: string;
  name: string;
  connected?: boolean;
}

export interface IOpponentOption {
  name: string;
  type: number; // -2: Closed, -1: Open, 0: Human, 1: Easy Computer, 2: Normal Computer, 3: Hard Computer, 4: Expert Computer
}

export interface IGameOptions {
  name?: string;
  mainPlayerName?: string;
  systemsToGenerate: number; // Number of systems (2-4 players)
  planetsPerSystem: number; // 4-8 planets per system
  galaxySize: number; // 1: Tiny, 2: Small, 3: Medium, 4: Large
  distributePlanetsEvenly: boolean;
  quickStart: boolean;
  turnTimeLimitSeconds: number; // 0: None, 30, 60, 120, 180, 300
  opponentOptions: IOpponentOption[];
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
  gameOptions: IGameOptions;
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
  gameOptions?: IGameOptions;
}

export interface IStartGameResponsePayload {
  success: boolean;
  gameState?: unknown;
  error?: string;
}

export interface IChangeGameOptionsPayload {
  gameId: string;
  gameOptions: IGameOptions;
  playerName?: string;
}

export interface IGameStateUpdatePayload {
  gameState?: unknown;
  changes?: unknown;
}

export interface IChatMessagePayload {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  messageType?: CHAT_MESSAGE_TYPE;
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
  return (
    message.type === MESSAGE_TYPE.JOIN_GAME &&
    typeof message.payload === 'object' &&
    message.payload !== null &&
    'success' in message.payload
  );
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
    [MESSAGE_TYPE.END_TURN]: 20,
    [MESSAGE_TYPE.SEND_SHIPS]: 21,
    [MESSAGE_TYPE.UPDATE_PLANET_START]: 22,
    [MESSAGE_TYPE.UPDATE_PLANET_OPTIONS]: 23,
    [MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE]: 24,
    [MESSAGE_TYPE.CLEAR_WAYPOINT]: 25,
    [MESSAGE_TYPE.ADJUST_RESEARCH_PERCENT]: 26,
    [MESSAGE_TYPE.SUBMIT_RESEARCH_ITEM]: 27,
    [MESSAGE_TYPE.CANCEL_RESEARCH_ITEM]: 28,
    [MESSAGE_TYPE.SUBMIT_TRADE]: 29,
    [MESSAGE_TYPE.CANCEL_TRADE]: 30,
    [MESSAGE_TYPE.CHAT_MESSAGE]: 40,
    [MESSAGE_TYPE.EXIT_RESIGN]: 50,
    [MESSAGE_TYPE.LOGOUT]: 51,
    [MESSAGE_TYPE.ERROR]: 60,
    [MESSAGE_TYPE.GAME_LIST_UPDATED]: 61,
    [MESSAGE_TYPE.GAME_STATE_UPDATE]: 62,
    [MESSAGE_TYPE.GAME_OVER]: 63,
    [MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED]: 64,
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
    20: MESSAGE_TYPE.END_TURN,
    21: MESSAGE_TYPE.SEND_SHIPS,
    22: MESSAGE_TYPE.UPDATE_PLANET_START,
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
    63: MESSAGE_TYPE.GAME_OVER,
    64: MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED,
  };

  return reverseMap[typeNum] ?? null;
}

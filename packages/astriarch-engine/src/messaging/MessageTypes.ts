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
  LOGOUT = 'LOGOUT'
}

export enum ERROR_TYPE {
  INVALID_GAME_OPTIONS = 'INVALID_GAME_OPTIONS',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_ACTION = 'INVALID_ACTION'
}

export enum CHAT_MESSAGE_TYPE {
  TEXT_MESSAGE = 'TEXT_MESSAGE',
  PLAYER_ENTER = 'PLAYER_ENTER',
  PLAYER_LEAVE = 'PLAYER_LEAVE',
  SYSTEM_MESSAGE = 'SYSTEM_MESSAGE'
}

export interface IMessage {
  type: MESSAGE_TYPE;
  payload: Record<string, unknown>;
  sessionId?: string;
  gameId?: string;
  timestamp?: Date;
}

export class Message implements IMessage {
  public type: MESSAGE_TYPE;
  public payload: Record<string, unknown>;
  public sessionId?: string;
  public gameId?: string;
  public timestamp: Date;

  constructor(type: MESSAGE_TYPE, payload: Record<string, unknown> = {}, sessionId?: string, gameId?: string) {
    this.type = type;
    this.payload = payload;
    this.sessionId = sessionId;
    this.gameId = gameId;
    this.timestamp = new Date();
  }
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
    [MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED]: 64
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
    64: MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED
  };
  
  return reverseMap[typeNum] ?? null;
}

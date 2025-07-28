/**
 * WebSocket Message Types - Based on the original Astriarch architecture
 * This matches the message system from the old app.js
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
  payload: any;
  sessionId?: string;
  gameId?: string;
  timestamp?: Date;
}

export class Message implements IMessage {
  public type: MESSAGE_TYPE;
  public payload: any;
  public sessionId?: string;
  public gameId?: string;
  public timestamp: Date;

  constructor(type: MESSAGE_TYPE, payload: any = {}, sessionId?: string, gameId?: string) {
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

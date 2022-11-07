var Astriarch = Astriarch || require("./astriarch_base");

Astriarch.Shared = {
  MESSAGE_TYPE: {
    ERROR: -1,
    NOOP: 0,
    PING: 1,
    CHAT_ROOM_SESSIONS_UPDATED: 2, //client bound message
    LOGOUT: 3,
    LIST_GAMES: 4, //client and server bound message
    GAME_LIST_UPDATED: 5, //after a new game is created or updated, update lobby game list
    CHANGE_GAME_OPTIONS: 6, //client and server bound message
    CHANGE_PLAYER_NAME: 7, //client and server bound message
    CREATE_GAME: 8,
    JOIN_GAME: 9,
    RESUME_GAME: 10,
    START_GAME: 11,
    END_TURN: 12,
    UPDATE_PLANET_START: 13,
    UPDATE_PLANET_OPTIONS: 14,
    UPDATE_PLANET_BUILD_QUEUE: 15,
    SEND_SHIPS: 16,
    CLEAR_WAYPOINT: 17,
    GAME_OVER: 18,
    SUBMIT_TRADE: 19,
    CANCEL_TRADE: 20,
    ADJUST_RESEARCH_PERCENT: 21,
    SUBMIT_RESEARCH_ITEM: 22,
    CANCEL_RESEARCH_ITEM: 23,
    CHAT_MESSAGE: 24, //client and server bound message
    EXIT_RESIGN: 25
  },

  ERROR_TYPE: {
    UNKNOWN: 0,
    INVALID_GAME_OPTIONS: 1
  },

  PLANET_BUILD_QUEUE_ACTION_TYPE: {
    ADD_IMPROVEMENT: 1,
    ADD_STARSHIP: 2,
    REMOVE: 3,
    MOVEUP: 4,
    MOVEDOWN: 5,
    DEMOLISH_IMPROVEMENT: 6
  },

  CHAT_MESSAGE_TYPE: {
    TEXT_MESSAGE: 1,
    PLAYER_ENTER: 2,
    PLAYER_EXIT: 3,
    PLAYER_DISCONNECT: 4
  },

  Message: function(type, payload) {
    this.type = type || 0;
    this.payload = payload || {};
  },

  messageIdToTypeName: null,

  GetMessageType: function(type) {
    if (!Astriarch.Shared.messageIdToTypeName) {
      Astriarch.Shared.messageIdToTypeName = {};
      for (var mtName in Astriarch.Shared.MESSAGE_TYPE) {
        Astriarch.Shared.messageIdToTypeName[Astriarch.Shared.MESSAGE_TYPE[mtName]] = mtName;
      }
    }
    return Astriarch.Shared.messageIdToTypeName[type];
  }
};

var Astriarch = Astriarch || require('./astriarch_base');

Astriarch.Shared = {

	MESSAGE_TYPE: {
		"ERROR":-1,
		"NOOP":0,
		"PING":1,
		"JOIN_CHAT_ROOM":2, //client and server bound message
		"LOGOUT":3,
		"LIST_GAMES":4, //client and server bound message
		"GAME_LIST_UPDATED":5, //after a new game is created or updated, update lobby game list
		"CHANGE_GAME_OPTIONS":6, //client and server bound message
		"CHANGE_PLAYER_NAME":7, //client and server bound message
		"CREATE_GAME":8,
		"JOIN_GAME":9,
		"RESUME_GAME":10,
		"START_GAME":11,
		"END_TURN":12,
		"UPDATE_PLANET_START":13,
		"UPDATE_PLANET_FINISH":14,
		"UPDATE_PLANET_BUILD_QUEUE":15,
		"SEND_SHIPS":16,
		"GAME_OVER":17,
		"SUBMIT_TRADE":18,
		"CANCEL_TRADE":19,
		"TEXT_MESSAGE":20 //client and server bound message

	},

	ERROR_TYPE: {
		"UNKNOWN":0,
		"INVALID_GAME_OPTIONS": 1
	},

	PLANET_BUILD_QUEUE_ACTION_TYPE: {
		"ADD_IMPROVEMENT": 1,
		"ADD_STARSHIP":2,
		"REMOVE":3,
		"MOVEUP":4,
		"MOVEDOWN":5,
		"DEMOLISH_IMPROVEMENT": 6
	},

	Message: function(type, payload){
		this.type = type || 0;
		this.payload = payload || {};
	}
};


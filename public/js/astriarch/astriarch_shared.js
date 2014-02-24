var Astriarch = Astriarch || require('./astriarch_base');

Astriarch.Shared = {

	MESSAGE_TYPE: {
		"ERROR":-1,
		"NOOP":0,
		"PING":1,
		"JOIN_CHAT_ROOM":2, //client and server bound message
		"LOGOUT":3,
		"LIST_GAMES":4, //client and server bound message
		"CHANGE_GAME_OPTIONS":5, //client and server bound message
		"CHANGE_PLAYER_NAME":6, //client and server bound message
		"CREATE_GAME":7,
		"JOIN_GAME":8,
		"RESUME_GAME":9,
		"START_GAME":10,
		"END_TURN":11,
		"UPDATE_PLANET_START":12,
		"UPDATE_PLANET_FINISH":13,
		"UPDATE_PLANET_BUILD_QUEUE":14,
		"SEND_SHIPS":15,
		"GAME_OVER":16,
		"TEXT_MESSAGE":17 //client and server bound message
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


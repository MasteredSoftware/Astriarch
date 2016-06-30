var gameController = require("./controllers/game_controller");

var Astriarch = require("./public/js/astriarch/astriarch_loader");

var wss = null;
var init = function(wssInstance){

	wss = wssInstance;
};
exports.init = init;

var wsSend = function(ws, message, callback){
	callback = callback || function(err){if(err){console.error("Problem in wsSend:", err);}};
	console.debug("wsSend Message: ", message);
	ws.send(JSON.stringify(message), callback);
};
exports.wsSend = wsSend;

var sendChatRoomSessionListUpdates = function(ws, sessionId, chatRoomWithSessions){
	if(!chatRoomWithSessions){
		return;
	}
	var cleanSessions = [], session = null;//This doesn't include other player session ids for security
	for(var s = 0; s < chatRoomWithSessions.sessions.length; s++){
		session = chatRoomWithSessions.sessions[s];
		cleanSessions.push({playerName:session.playerName, playerNumber: session.playerNumber, dateJoined: session.dateJoined});
	}
	var messageForPlayers = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED,{sessions:cleanSessions});
	for(var s = 0; s < chatRoomWithSessions.sessions.length; s++){
		session = chatRoomWithSessions.sessions[s];
		if(!ws || session.sessionId != sessionId){
			wss.broadcastToSession(session.sessionId, messageForPlayers);
		} else {
			wsSend(ws, messageForPlayers);
		}
	}
};
exports.sendChatRoomSessionListUpdates = sendChatRoomSessionListUpdates;

var addMessageToChatRoomAndBroadcastToOtherMembers = function(gameId, chatLogMessage, sessionId){
	gameController.AddMessageToChatRoom(gameId, chatLogMessage, function(err, doc){
		//broadcast to all other sessions in the chat room
		var messageForPlayers = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.CHAT_MESSAGE,{messageType: chatLogMessage.messageType, text: chatLogMessage.text, sentByPlayerName: chatLogMessage.sentByPlayerName, sentByPlayerNumber: chatLogMessage.sentByPlayerNumber, dateSent:new Date().getTime()});
		for(var s = 0; s < doc.sessions.length; s++){
			var session = doc.sessions[s];
			if(session.sessionId != sessionId){
				wss.broadcastToSession(session.sessionId, messageForPlayers);
			}
		}
	});
};
exports.addMessageToChatRoomAndBroadcastToOtherMembers = addMessageToChatRoomAndBroadcastToOtherMembers;

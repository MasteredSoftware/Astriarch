Astriarch.CommControl = {
	chatLog: null,
	chatRoomInfo: null,
	inputTextBox: null,
	playerName: null,
	playerNumber: null,
	init: function(){
		this.chatLog = $("#chatLog");
		this.chatRoomInfo = $("#chatRoomInfo");
		this.inputTextBox = $("#chatInputTextBox");
		this.inputTextBox.keyup(function (e) {
			if (e.keyCode == 13) {
				Astriarch.CommControl.sendTextMessage();
			}
		});

		var playerNameTextBox = $("#chatPlayerNameTextBox");
		playerNameTextBox.val(Astriarch.LocalStorageInterface.Prefs.playerName);
		playerNameTextBox.keyup(function (e) {
			if (e.keyCode == 13) {
				var playerName = playerNameTextBox.val();
				Astriarch.LocalStorageInterface.Prefs.playerName = playerName;
				Astriarch.LocalStorageInterface.savePrefs();
				Astriarch.CommControl.joinChatRoom(playerName, null);
			}
		});
		$("#chatLogChoosePlayerNameArea").show();
	},

	enableChatGUI: function(){
		$("#chatLogChoosePlayerNameArea").hide();
		$("#chatArea").show();
	},

	sendTextMessage: function(){
		var text = this.inputTextBox.val();
		if(text && text.trim()){
			this.inputTextBox.val("");
			var message = {text: text, sentByPlayerName: this.playerName, sentByPlayerNumber: this.playerNumber};
			Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.TEXT_MESSAGE, payload:message});
			this.appendMessages([message]);
		}
	},

	joinChatRoom: function(playerName, playerNumber){
		//the user is joining the lobby or moving from the lobby to the game room, refresh his/her chat log and tell the server
		this.playerName = playerName;
		this.playerNumber = playerNumber;
		Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.JOIN_CHAT_ROOM, payload:{playerName:playerName, playerNumber:playerNumber}});
		this.chatLog.html("");
		Astriarch.CommControl.enableChatGUI();
	},

	refreshPlayerList: function(sessions){
		var html = "";
		for(var i = 0; i < sessions.length; i++){
			var session = sessions[i];
			var sessionClass = session.playerNumber ? "messagePlayer" + session.playerNumber : "messagePlayerLobby";
			html += "<div class=\"" + sessionClass + "\">" + session.playerName + "</div>";
		}
		this.chatRoomInfo.html(html);
	},

	appendMessages: function(messages){
		var html = "";
		for(var i = 0; i < messages.length; i++){
			var message = messages[i];
			var messageFromClass = message.sentByPlayerNumber ? "messagePlayer" + message.sentByPlayerNumber : "messagePlayerLobby";
			html += "<div class=\"chatLogMessage\"><span class=\"" + messageFromClass + "\">" + message.sentByPlayerName + ": </span>" + message.text + "</div>";
		}
		this.chatLog.append(html);
		this.chatLog.animate({scrollTop:this.chatLog[0].scrollHeight}, 1000);
	}
};
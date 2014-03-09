Astriarch.CommControl = {
	chatLog: null,
	chatRoomInfo: null,
	inputTextBox: null,
	playerName: null,
	playerNumber: null,
	playerSessions: null,
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

	setPlayerSessions: function(sessions){
		Astriarch.CommControl.playerSessions = sessions;
		Astriarch.CommControl.refreshPlayerList();
	},

	refreshPlayerList: function(){
		var html = "";

		if(Astriarch.GameId && Astriarch.ClientGameModel && Astriarch.ClientGameModel.ClientPlayers){
			//we are in a game and we should base the player list on the client game model players
			for(var i = 0; i < Astriarch.ClientGameModel.ClientPlayers.length; i++){
				var player = Astriarch.ClientGameModel.ClientPlayers[i];
				var sessionClass = "messagePlayer" + (i + 1);
				var points = player.Points != null ? " (" + Math.floor(player.Points) + ")" : "";
				html += "<div class=\"" + sessionClass + "\">" + player.Name + points + "</div>";
			}
		} else {
			for(var i = 0; i < Astriarch.CommControl.playerSessions.length; i++){
				var session = Astriarch.CommControl.playerSessions[i];
				var sessionClass = session.playerNumber ? "messagePlayer" + session.playerNumber : "messagePlayerLobby";
				html += "<div class=\"" + sessionClass + "\">" + session.playerName + "</div>";
			}
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
Astriarch.CommControl = {
	chatLog: null,
	chatRoomInfo: null,
	inputTextBox: null,
	playerNameTextBox: null,
	chatLogPlayerNameDiv: null,

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

		this.playerNameTextBox = $("#chatPlayerNameTextBox");
		this.playerNameTextBox.keyup(function (e) {
			if (e.keyCode == 13) {
				Astriarch.CommControl.submitPlayerNameChange();
			}
		});
		this.playerNameTextBox.change(function () {
			Astriarch.CommControl.submitPlayerNameChange();
		});


		this.chatLogPlayerNameDiv = $("#chatLogPlayerName");
		this.chatLogPlayerNameDiv.text(Astriarch.LocalStorageInterface.Prefs.playerName);
		this.chatLogPlayerNameDiv.click(function(e){
			//Only let them change their name from here when they are in the lobby
			//TODO: make this more secure
			if(!Astriarch.CommControl.playerNumber){
				Astriarch.CommControl.playerNameTextBox.val(Astriarch.LocalStorageInterface.Prefs.playerName);

				Astriarch.CommControl.chatLogPlayerNameDiv.hide();
				Astriarch.CommControl.playerNameTextBox.show();
				Astriarch.CommControl.playerNameTextBox.select();
			}
		});

		Astriarch.CommControl.joinChatRoom(Astriarch.LocalStorageInterface.Prefs.playerName, null);
		$("#chatArea").show();
	},

	submitPlayerNameChange: function(){
		Astriarch.CommControl.playerName = Astriarch.CommControl.playerNameTextBox.val();
		Astriarch.LocalStorageInterface.Prefs.playerName = Astriarch.CommControl.playerName;
		Astriarch.LocalStorageInterface.savePrefs();
		Astriarch.CommControl.joinChatRoom(Astriarch.CommControl.playerName, Astriarch.CommControl.playerNumber);
		Astriarch.CommControl.chatLogPlayerNameDiv.text(Astriarch.CommControl.playerName);
		Astriarch.CommControl.playerNameTextBox.hide();
		Astriarch.CommControl.chatLogPlayerNameDiv.show();
	},

	sendTextMessage: function(){
		var text = this.inputTextBox.val();
		if(text && text.trim()){
			this.inputTextBox.val("");
			var message = {messageType: Astriarch.Shared.CHAT_MESSAGE_TYPE.TEXT_MESSAGE, text: text, sentByPlayerName: this.playerName, sentByPlayerNumber: this.playerNumber, dateSent:new Date().getTime()};
			Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.CHAT_MESSAGE, payload:message});
			this.appendMessages([message]);
		}
	},

	joinChatRoom: function(playerName, playerNumber){
		//the user is joining the lobby or moving from the lobby to the game room, refresh his/her chat log and tell the server
		this.playerName = playerName;
		this.playerNumber = playerNumber;
		Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.CHAT_MESSAGE, payload:{messageType: Astriarch.Shared.CHAT_MESSAGE_TYPE.PLAYER_ENTER, sentByPlayerName:playerName, sentByPlayerNumber:playerNumber}});
		this.chatLog.html("");
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
				var sessionClass = "messagePlayer" + player.Id;
				if(player.Type != Astriarch.Player.PlayerType.Human || player.CurrentTurnEnded) {
					sessionClass += " sessionTurnEnded";
				} else if(player.Destroyed) {
					sessionClass += " sessionDestroyed";
				} else {
					sessionClass += " sessionNormal";
				}
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
			var messageDateString = new Date(message.dateSent).toLocaleTimeString('en-US', { hour12: false }) + " ";
			var messageFromClass = message.sentByPlayerNumber ? "messagePlayer" + message.sentByPlayerNumber : "messagePlayerLobby";
			if(message.messageType == Astriarch.Shared.CHAT_MESSAGE_TYPE.TEXT_MESSAGE){
				html += "<div class=\"chatLogMessage\"><span class=\"messageTime\">" + messageDateString + "</span><span class=\"" + messageFromClass + "\">" + message.sentByPlayerName + ": </span>" + message.text + "</div>";
			} else {
				var text = (message.messageType == Astriarch.Shared.CHAT_MESSAGE_TYPE.PLAYER_ENTER ? " Arrived" : (message.messageType == Astriarch.Shared.CHAT_MESSAGE_TYPE.PLAYER_DISCONNECT ? " Disconnected" : " Left"));
				html += "<div class=\"chatLogMessage\"><span class=\"messageTime\">" + messageDateString + "</span><span class=\"messageSystem\">" + message.sentByPlayerName + text + "</span></div>";
			}

		}
		this.chatLog.append(html);
		this.chatLog.animate({scrollTop:this.chatLog[0].scrollHeight}, 1000);
	}
};
Astriarch.NewGameControl = {
	GameCreator: true, //if the player created the game
	init: function(){
		$("#PlayerNameTextBox").change(function(){
			var payload = {playerName:$( this ).val()};
			Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.CHANGE_PLAYER_NAME, payload:payload});
		});

		$('select#NumberOfSystemsComboBox').selectmenu({style:'popup', width:55, change:function(e, object){Astriarch.NewGameControl.UpdateStartupOptionsBasedOnOpponentCount();Astriarch.NewGameControl.changedGameOptions();}});
		$('select#PlanetsPerSystemComboBox').selectmenu({style:'popup', width:55, change: function(e, object){Astriarch.NewGameControl.changedGameOptions();} });

		this.buildPlayerComboBoxes();


		$("#StartGameOptionsOkButton").button();
		$("#StartGameOptionsOkButton").click(
			function() {
				Astriarch.NewGameControl.SetupNewGame();
			}
		);
	},

	buildPlayerComboBoxes: function(gameOptions){
		var closedOption = '<option value="-2">Closed</option>';
		var openOption = '<option value="-1" selected="">Open</option>';
		var humanOption = '<option value="0" disabled="disabled">Human</option>';
		var computerOptions = '<option value="1">Easy Computer</option><option value="2">Normal Computer</option><option value="3">Hard Computer</option><option value="4">Expert Computer</option>';
		$("#Player2OptionsBox").html('<select id="Player2ComboBox">' + openOption + ((gameOptions && gameOptions.opponentOptions[0].type == 0) ? humanOption : "") + computerOptions  +'</select>');
		$("#Player3OptionsBox").html('<select id="Player3ComboBox">' + closedOption + openOption + ((gameOptions && gameOptions.opponentOptions[1].type == 0) ? humanOption : "") + computerOptions  +'</select>');
		$("#Player4OptionsBox").html('<select id="Player4ComboBox">' + closedOption + openOption + ((gameOptions && gameOptions.opponentOptions[2].type == 0) ? humanOption : "") + computerOptions  +'</select>');

		//jquery ui selectmenu
		//from https://github.com/fnagel/jquery-ui
		//also here: http://jquerystyle.com/2009/08/24/jquery-ui-selectmenu
		$('select#Player2ComboBox').selectmenu({style:'popup',width:150, change: function(e, object){Astriarch.NewGameControl.changedGameOptions();} });
		$('select#Player3ComboBox').selectmenu({style:'popup',width:150, change: function(e, object){Astriarch.NewGameControl.changedGameOptions();} });
		$('select#Player4ComboBox').selectmenu({style:'popup',width:150, change: function(e, object){Astriarch.NewGameControl.changedGameOptions();} });
	},

	UpdateStartupOptionsBasedOnOpponentCount: function() {
		var numberOfOpponents = Number($('select#NumberOfSystemsComboBox').selectmenu("value"));
		$('.Player3Panel').hide();
		$('.Player4Panel').hide();

		if (numberOfOpponents >= 3) {
			$('.Player3Panel').show();
		} else {
			$('select#Player3ComboBox').selectmenu("value","-2");
		}
		if (numberOfOpponents >= 4){
			$('.Player4Panel').show();
		} else {
			$('select#Player4ComboBox').selectmenu("value","-2");
		}
	},

	joinGame: function(message){
		Astriarch.NewGameControl.GameCreator = false;

		$('select#NumberOfSystemsComboBox').parent().html('<span id="NumberOfSystemsValue"></span>');
		$('select#PlanetsPerSystemComboBox').parent().html('<span id="PlanetsPerSystemValue"></span>');

		$('select#Player2ComboBox').parent().html('<span id="Player2NamePanel"></span>');
		$('select#Player3ComboBox').parent().html('<span id="Player3NamePanel"></span>');
		$('select#Player4ComboBox').parent().html('<span id="Player4NamePanel"></span>');
		$("#StartGameOptionsOkButton").remove();

		Astriarch.NewGameControl.OnGameOptionsChanged(message);
	},

	changedGameOptions: function() {
		var gameOptions = this.getSelectedGameOptions();

		Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.CHANGE_GAME_OPTIONS, payload:{gameOptions: gameOptions}});
	},

	OnGameOptionsChanged: function(message){
		var gameOptions = message.payload.gameOptions;
		//refresh view with new game options
		if(!Astriarch.NewGameControl.GameCreator){
			$("#NumberOfSystemsValue").text(gameOptions.systemsToGenerate);
			$("#PlanetsPerSystemValue").text(gameOptions.planetsPerSystem);

			$("#Player1NamePanel").text(gameOptions.mainPlayerName);
			$("#Player2NamePanel").text(this.opponentOptionToFriendlyString(gameOptions.opponentOptions[0]));
			$("#Player3NamePanel").text(this.opponentOptionToFriendlyString(gameOptions.opponentOptions[1]));
			$("#Player4NamePanel").text(this.opponentOptionToFriendlyString(gameOptions.opponentOptions[2]));
		} else {
			Astriarch.NewGameControl.buildPlayerComboBoxes(gameOptions);
			//we get this message for player name changes and joins also
			for(var i = 0; i < gameOptions.opponentOptions.length; i++){
				var opponent = gameOptions.opponentOptions[i];
				if(opponent.type == 0){
					var selectId = 'select#Player' + (i + 2) + 'ComboBox';
					$(selectId).selectmenu("value","0");
					$('#Player' + (i + 2) + 'OptionsBox').hide();
					$('#Player' + (i + 2) + 'NamePanel').text(opponent.name);
					//TODO: Add Kick button for GameCreator
				}
			}
		}

	},

	opponentOptionToFriendlyString: function(opponentOption){
		var friendlyString = "";
		switch(opponentOption.type){
			case -2:
				friendlyString = "Closed";
				break;
			case -1:
				friendlyString = "Open";
				break;
			case 0:
				friendlyString = "Player name: " + opponentOption.name;
				break;
			case 1:
				friendlyString = "Easy Computer";
				break;
			case 2:
				friendlyString = "Normal Computer";
				break;
			case 3:
				friendlyString = "Hard Computer";
				break;
			case 4:
				friendlyString = "Expert Computer";
				break;
		}
		return friendlyString;
	},

	getSelectedGameOptions: function(){
		var opponentOptions = [];
		var playerName = $('#PlayerNameTextBox').val();
		if(playerName == null || $.trim(playerName) == "")
			playerName = "Player1";

		//NOTE: difficulty Combobox values correspond to Astriarch.Player.PlayerType 'enum' values (with -1 meaning closed)
		opponentOptions.push({name: $("#Player2NamePanel").text(), type: Number($('select#Player2ComboBox').selectmenu("value"))});
		opponentOptions.push({name: $("#Player3NamePanel").text(), type: Number($('select#Player3ComboBox').selectmenu("value"))});
		opponentOptions.push({name: $("#Player4NamePanel").text(), type: Number($('select#Player4ComboBox').selectmenu("value"))});

		var systemsToGenerate = Number($('select#NumberOfSystemsComboBox').selectmenu("value"));
		//NOTE: systems to generate combobox values correspond to Astriarch.Model.PlanetsPerSystemOption 'enum' values
		var planetsPerSystem = Number($('select#PlanetsPerSystemComboBox').selectmenu("value"));


		var gameOptions = {"mainPlayerName":playerName, "opponentOptions": opponentOptions, "systemsToGenerate":systemsToGenerate, "planetsPerSystem":planetsPerSystem};
		return gameOptions;
	},

	SetupNewGame: function() {

		//get selected game options
		var gameOptions = this.getSelectedGameOptions();

		var playerCount = 1;
		for(var i in gameOptions.opponentOptions){
			if(gameOptions.opponentOptions[i].type >= 0){
				playerCount++;
			}
		}

		AstriarchExtern.OnGameStart({'Players':playerCount, 'PlanetsPerSystem':gameOptions.planetsPerSystem, 'Systems':gameOptions.systemsToGenerate});
		Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.START_GAME, payload:gameOptions});
	},

	OnGameStartMessageResponse: function(message) {

		$('#startGameOptionsContainer').hide();

		Astriarch.GameController.ResetView(message.payload);
	}
};

//provides the glue between the html controls, Astriarch.View and the Game Model

Astriarch.GameController = {
	planetaryConflictMessages: [],
	turnTimerTimeoutId: null,
	gameOver: false
};


Astriarch.GameController.ResetView = function(serializableClientModel) {
	$('#TurnDisplay,#OverallPlayerStatusGrid,#SelectedItemStatus,#SelectedItemPopulationPanel,#SelectedItemImprovementSlotsPanel,#SelectedItemPopulationAssignmentsPanel,#SelectedItemBuiltImprovementsGrid,#SelectedItemPlanetaryFleetGrid,#SelectedItemStatusDetails,#BottomStatusGrid,#TurnSummaryItemsListBox,#ButtonPanel').show();
	$('#PlanetViewButton,#SendShipsButton,#NextTurnButton,#ButtonOpenTradingCenter,#ButtonOpenResearch').show();

	var gameGrid = new Astriarch.Grid(621.0, 480.0, serializableClientModel.Options);//TODO: externalize later
	Astriarch.ClientGameModel = Astriarch.ClientModelInterface.GetClientModelFromSerializableClientModel(serializableClientModel, gameGrid);

	Astriarch.GameController.RefreshTurnDisplay();

	Astriarch.GameController.SetupViewFromGameModel();

	Astriarch.CommControl.refreshPlayerList();
};

Astriarch.GameController.SetupViewFromGameModel = function() {

	Astriarch.View.ClearPlanetsAndFleets();
	
	Astriarch.View.audioInterface.BeginGame();

	Astriarch.View.TurnSummaryItemsListBox.clear();

	//add hexes to canvas
	for(var h in Astriarch.ClientGameModel.GameGrid.Hexes){
		//add to canvas layer
		Astriarch.View.CanvasPlayfieldLayer.addChild(Astriarch.ClientGameModel.GameGrid.Hexes[h]);
	}

	//add quadrants to canvas
	for(var q in Astriarch.ClientGameModel.GameGrid.Quadrants){
		//add to canvas layer
		Astriarch.View.CanvasPlayfieldLayer.addChild(new Astriarch.Grid.DrawnRect(Astriarch.ClientGameModel.GameGrid.Quadrants[q]));
	}
	
	//add drawn planets to canvas
	for (var i in Astriarch.ClientGameModel.ClientPlanets) {
		var cp = Astriarch.ClientGameModel.ClientPlanets[i];
		var dp = new Astriarch.DrawnPlanet(cp);
		Astriarch.View.DrawnPlanets[cp.Id] = dp;
		Astriarch.View.CanvasPlayfieldLayer.addChild(dp);
	}
	Astriarch.View.updateCanvasForPlayer();
	
	//select our home planet
	Astriarch.View.selectPlanet(Astriarch.ClientGameModel.getClientPlanetById(Astriarch.ClientGameModel.MainPlayer.HomePlanetId));
	
	Astriarch.View.updatePlayerStatusPanel();
};

Astriarch.GameController.NextTurn = function() {
	Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.END_TURN, payload:{}});
};

Astriarch.GameController.HideControlsForTurnStart = function(){
	//hide other controls as well in case they are open
	Astriarch.PlanetView.Close();
	Astriarch.SendShipsControl.Close();
	Astriarch.TradingControl.Close();
	Astriarch.PlanetaryConflictControl.Close();
};

Astriarch.GameController.OnEndTurnMessageResponse = function(message) {
	//message will know if we need to wait for other players to finish their turns
	if(message.payload.allPlayersFinished){
		$("#NextTurnButton").button('enable');
		Astriarch.GameController.HideControlsForTurnStart();

		Astriarch.View.audioInterface.StartTurn();

		Astriarch.GameController.OnStartTurn(message);
	} else if (message.payload.clientPlayers) {
		Astriarch.View.audioInterface.EndTurn();

		//update session list to reflect which player(s) we're waiting on
		Astriarch.ClientGameModel.ClientPlayers = message.payload.clientPlayers.map(function(sp) {
			return Astriarch.ClientModelInterface.GetClientPlayerFromSerializableClientPlayer(sp);
		});
		Astriarch.CommControl.refreshPlayerList();

		//it has been observed that sometimes a player clicks the end turn button but then the server still thinks he/she hasn't ended their turn
		//  if we find the main player hasn't ended the turn at this point, let's re-enable the next turn button
		Astriarch.ClientGameModel.ClientPlayers.forEach(function(cp) {
			if(cp.Id == Astriarch.ClientGameModel.MainPlayer.Id && !cp.CurrentTurnEnded) {
				$("#NextTurnButton").button('enable');
			}
		});

	}
};

Astriarch.GameController.OnPlayerDestroyed = function(/*ClientPlayer)*/ clientPlayer) {
	var a = new Astriarch.Alert(clientPlayer.Name + " Destroyed", "Player: <span style=\"color:"+clientPlayer.Color.toString()+"\">" + clientPlayer.Name + "</span> destroyed.");
};

//payload = {"winningSerializablePlayer": winningSerializablePlayer, "playerWon": playerWon, "score":score};
Astriarch.GameController.OnGameOverMessageResponse = function(message) {
	Astriarch.GameController.gameOver = true;

	Astriarch.View.audioInterface.EndGame();

	Astriarch.GameController.HideControlsForTurnStart();

	Astriarch.GameController.UpdateUIForEndTurnMessage(message);

	$('#PlanetViewButton,#SendShipsButton,#NextTurnButton,#ButtonOpenTradingCenter,#ButtonOpenResearch').hide();

	Astriarch.GameOverControl.show(message.payload.winningSerializablePlayer, message.payload.playerWon, message.payload.score);
};

Astriarch.GameController.OnExitResignMessageResponse = function(message) {
	//Ensure they've ended their turn
	Astriarch.View.NextTurn();
};

Astriarch.GameController.RefreshTurnDisplay = function(){
	var year = Astriarch.ClientGameModel.Turn.Number + 3000;
	$('#TurnDisplay').text("Turn " + Astriarch.ClientGameModel.Turn.Number + ", Year " + year);

	var turnTimer = $('#TurnTimer');
	if(Astriarch.ClientGameModel.GameOptions.TurnTimeLimitSeconds && !Astriarch.GameController.gameOver) {
		turnTimer.show();

		turnTimer.stop(true).animate({ width: '100%' }, 500, "linear", function(){
			turnTimer.animate({ width: '0px' }, Astriarch.ClientGameModel.GameOptions.TurnTimeLimitSeconds * 1000, "linear");
			//I had problems with this not clearing out correctly in the view, so I'm calling it here too
			Astriarch.GameController.ClearTurnTimer();
			Astriarch.GameController.turnTimerTimeoutId = setTimeout(function(){Astriarch.View.NextTurn();}, Astriarch.ClientGameModel.GameOptions.TurnTimeLimitSeconds * 1000);
		});
	} else {
		turnTimer.hide();
	}
};

Astriarch.GameController.ClearTurnTimer = function() {
	if(Astriarch.GameController.turnTimerTimeoutId){
		clearTimeout(Astriarch.GameController.turnTimerTimeoutId);
	}
};

Astriarch.GameController.OnStartTurn = function(message) {

	if(message.payload.destroyedClientPlayers){
		for(var i in message.payload.destroyedClientPlayers){
			Astriarch.GameController.OnPlayerDestroyed(message.payload.destroyedClientPlayers[i]);
		}
	}

	Astriarch.GameController.UpdateUIForEndTurnMessage(message);

	Astriarch.GameController.processNextEndOfTurnPlanetaryConflictMessage();
	
};

Astriarch.GameController.UpdateUIForEndTurnMessage = function(message){

	Astriarch.ClientGameModel = Astriarch.ClientModelInterface.GetClientModelFromSerializableClientModel(message.payload.gameData, Astriarch.ClientGameModel.GameGrid);

	Astriarch.GameController.RefreshTurnDisplay();

	//update the players points show in the player list
	Astriarch.CommControl.refreshPlayerList();

	var serializableEndOfTurnMessages = message.payload.endOfTurnMessages;
	var endOfTurnMessages = [];

	for(var s in serializableEndOfTurnMessages) {
		endOfTurnMessages.push(Astriarch.ClientModelInterface.GetTurnEventMessageFromSerializableTurnEventMessage(serializableEndOfTurnMessages[s], Astriarch.ClientGameModel.GameGrid));
	}

	//gather our planetary conflict messages
	Astriarch.GameController.planetaryConflictMessages = [];
	//if we have the option enabled to show the planetary conflict dialog window at end of turn
	if (Astriarch.PlayerGameOptions.ShowPlanetaryConflictPopups)
	{
		for (var i in endOfTurnMessages)
		{
			var tem = endOfTurnMessages[i];//TurnEventMessage
			if (tem.Type == Astriarch.TurnEventMessage.TurnEventMessageType.AttackingFleetLost ||
				tem.Type == Astriarch.TurnEventMessage.TurnEventMessageType.DefendedAgainstAttackingFleet ||
				tem.Type == Astriarch.TurnEventMessage.TurnEventMessageType.PlanetCaptured ||
				tem.Type == Astriarch.TurnEventMessage.TurnEventMessageType.PlanetLost)
			{
				if (tem.Data != null)//just to make sure
					Astriarch.GameController.planetaryConflictMessages.push(tem);
			}
		}
	}

	Astriarch.View.updatePlayerStatusPanel();

	Astriarch.View.updateSelectedItemPanelForPlanet();

	Astriarch.View.updateCanvasForPlayer();

	Astriarch.View.TurnSummaryItemsListBox.clear();
	if (endOfTurnMessages.length > 0)
	{
		/*
		 ResourcesAutoSpent = 0,
		 PopulationGrowth = 1,
		 ImprovementBuilt = 2,
		 ShipBuilt= 3,
		 BuildQueueEmpty = 4,
		 PopulationStarvation = 5,
		 FoodShortageRiots = 6,
		 PlanetLostDueToStarvation = 7,//this is bad but you probably know it's bad
		 DefendedAgainstAttackingFleet = 8,
		 AttackingFleetLost = 9,
		 PlanetCaptured = 10,
		 PlanetLost = 11
		 */
		var listBoxItems = [];
		for (var i in endOfTurnMessages)
		{
			var tem = endOfTurnMessages[i];//TurnEventMessage
			var tsmlbi = new Astriarch.GameController.TurnSummaryMessageListBoxItem(tem);
			switch (tsmlbi.EventMessage.Type)
			{
				case Astriarch.TurnEventMessage.TurnEventMessageType.ResourcesAutoSpent:
				case Astriarch.TurnEventMessage.TurnEventMessageType.PopulationGrowth:
					tsmlbi.Foreground = "blue";
					break;
				case Astriarch.TurnEventMessage.TurnEventMessageType.DefendedAgainstAttackingFleet:
					tsmlbi.Foreground = "purple";
					break;
				case Astriarch.TurnEventMessage.TurnEventMessageType.BuildQueueEmpty:
					tsmlbi.Foreground = "grey";
					break;
				case Astriarch.TurnEventMessage.TurnEventMessageType.CitizensProtesting:
				case Astriarch.TurnEventMessage.TurnEventMessageType.InsufficientFood:
					tsmlbi.Foreground = "yellow";
					break;
				case Astriarch.TurnEventMessage.TurnEventMessageType.PlanetCaptured:
				case Astriarch.TurnEventMessage.TurnEventMessageType.AttackingFleetLost:
					tsmlbi.Foreground = "orange";
					break;
				case Astriarch.TurnEventMessage.TurnEventMessageType.PlanetLost:
				case Astriarch.TurnEventMessage.TurnEventMessageType.PopulationStarvation:
				case Astriarch.TurnEventMessage.TurnEventMessageType.PlanetLostDueToStarvation:
				case Astriarch.TurnEventMessage.TurnEventMessageType.FoodShortageRiots:
					tsmlbi.Foreground = "red";
					break;
				default:
					tsmlbi.Foreground = "green";
					break;
			}
			listBoxItems.push(tsmlbi);
		}
		Astriarch.View.TurnSummaryItemsListBox.addItems(listBoxItems);

	}

	//check for tutorial goals
	var homePlanet = Astriarch.ClientGameModel.MainPlayer.GetPlanetIfOwnedByPlayer(Astriarch.ClientGameModel.MainPlayer.HomePlanetId);
	if(homePlanet && window.tour.enabled){
		var factoryCount = homePlanet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length;
		var colonyCount = homePlanet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Colony].length;
		var spacePlatformCount = homePlanet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform].length;
		if((factoryCount == 1 && window.tour.step == 48) ||
			(factoryCount == 2 && window.tour.step == 49) ||
			(factoryCount == 3 && window.tour.step == 50) ||
			(colonyCount == 1 && window.tour.step == 51) ||
			(spacePlatformCount == 1 && window.tour.step == 68)){
			window.tour.jqElm.joyride('resume');
		}

		var scoutCount = homePlanet.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Scout].length;
		if(scoutCount > 0 && window.tour.step == 54){
			window.tour.jqElm.joyride('resume');
		}

		if(Astriarch.CountObjectKeys(Astriarch.ClientGameModel.MainPlayer.KnownClientPlanets) >= 4 && window.tour.step == 63){
			window.tour.jqElm.joyride('resume');
		}

		if(Astriarch.CountObjectKeys(Astriarch.ClientGameModel.MainPlayer.OwnedPlanets) >= 4 && window.tour.step == 66){
			window.tour.jqElm.joyride('resume');
		}

	}
};

Astriarch.GameController.processNextEndOfTurnPlanetaryConflictMessage = function() {
	var i = Astriarch.GameController.planetaryConflictMessages.length - 1;
	if(i >= 0)
	{
		var tem = Astriarch.GameController.planetaryConflictMessages[i];//TurnEventMessage
		Astriarch.GameController.planetaryConflictMessages.splice(i, 1);
		if (Astriarch.PlayerGameOptions.ShowPlanetaryConflictPopups)
			Astriarch.GameController.popupPlanetaryConflictControl(tem);
	}
};

Astriarch.GameController.popupPlanetaryConflictControl = function(/*TurnEventMessage*/ tem) {

	Astriarch.PlanetaryConflictControl.show(tem);
};

Astriarch.GameController.GameOverControlClosed = function() {
	
	//show playfield after game over
	//TODO: figure out how to show the entire playfield
	//Astriarch.GameModel.ShowUnexploredPlanetsAndEnemyPlayerStats = true;
	
	Astriarch.View.updateCanvasForPlayer();
	Astriarch.View.updateSelectedItemPanelForPlanet();

	$('#MainMenuButtonGameOver').show();
};

/**
 * A TurnSummaryMessageListBoxItem is one of the items shown at the end of the turn
 * @constructor
 */
Astriarch.GameController.TurnSummaryMessageListBoxItem = JSListBox.Item.extend({
	/**
	 * initializes the TurnSummaryMessageListBoxItem
	 * @this {Astriarch.GameController.TurnSummaryMessageListBoxItem}
	 */
	init: function(/* TurnEventMessage */ tem) {
		this.value = tem.Message; //what is shown in the item
		this.Foreground = null;
		this.EventMessage = tem;
	},
	
	/**
	 * renders the TurnSummaryMessageListBoxItem
	 * @this {Astriarch.GameController.TurnSummaryMessageListBoxItem}
	 * @return {string}
	 */
	render: function() {
		return '<a href="#" style="color:' + this.Foreground + '">' + this.value + '</a>'; //this allows paiting to be overridden in classes which extend JSListBox.Item
	},
	
	/**
	 * fires the TurnSummaryMessageListBoxItem click event
	 * @this {Astriarch.GameController.TurnSummaryMessageListBoxItem}
	 */
	onClick: function() {
		if(this.EventMessage != null && this.EventMessage.Planet != null)
		{
			Astriarch.View.selectPlanet(this.EventMessage.Planet);
		}
	},
	
	/**
	 * fires the TurnSummaryMessageListBoxItem double click event
	 * @this {Astriarch.GameController.TurnSummaryMessageListBoxItem}
	 */
	onDblClick: function() {
		//popup the conflict dialog for list items relating to a conflict
		//TurnSummaryMessageListBoxItem tsmlbi = (TurnSummaryMessageListBoxItem)TurnSummaryItemsListBox.SelectedItem;
		if(!this.EventMessage)
			return;
		if (this.EventMessage.Type == Astriarch.TurnEventMessage.TurnEventMessageType.AttackingFleetLost ||
			this.EventMessage.Type == Astriarch.TurnEventMessage.TurnEventMessageType.DefendedAgainstAttackingFleet ||
			this.EventMessage.Type == Astriarch.TurnEventMessage.TurnEventMessageType.PlanetCaptured ||
			this.EventMessage.Type == Astriarch.TurnEventMessage.TurnEventMessageType.PlanetLost)
		{
			Astriarch.GameController.popupPlanetaryConflictControl(this.EventMessage);
		}
		
	}
});

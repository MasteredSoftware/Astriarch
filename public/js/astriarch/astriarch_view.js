Astriarch.View = {jCanvasDraw:null,
				  audioInterface:null,
				  audioMouseInTimer:null,
				  audioMouseOutTimer:null,
				  CanvasBackground:null,
				  ContextBackground:null,
				  CanvasPlayfieldLayer:null,
				  CanvasFleetsLayer:null,
				  BackgroundImages:[],
				  BackgroundImagesLoaded:0,
				  BACKGROUND_COUNT:7,
				  BACKGROUND_DARKNESS:30,
				  DrawnPlanets:{},
				  DrawnFleets:[],
				  Colors:["white","yellow","orange","blue","green","red","purple"],
				  ColorsRGBA: {"white":null ,"yellow":null ,"orange":null ,"blue":null ,"green":null ,"red":null ,"purple":null},
				  sendingShipsTo:false,
				  sendShipsFromHex: null,
				  TurnSummaryItemsListBox:null
				};
				  


Astriarch.View.PageLoadInit = function(serverConfig){

	Astriarch.View.SetupGraphicalDOMElements();

	Astriarch.View.jCanvasDraw = new jCanvas({'containerSelector':'#canvasContainer',
								'canvasNotSupportedCallback':Astriarch.View.CanvasNotSupported,
								'layers':[
									{'name':'canvasAstriarchBackground', x:0, y:0, width:800, height:600,'zIndex':1, 'backgroundColor':'black'},
									{'name':'canvasAstriarchPlayfield', x:177, y:21, width:615, height:480,'zIndex':2, 'clickCallback':Astriarch.View.PlayfieldClicked, 'dblclickCallback':Astriarch.View.PlayfieldDoubleClicked, 'mouseHitSelector':'#canvasMouseHitDetector'},
									{'name':'canvasAstriarchFleets', x:177, y:21, width:615, height:480,'zIndex':3, 'clickCallback':Astriarch.View.FleetsClicked, 'mouseHitSelector':'#canvasMouseHitDetector'}
								]
							});
	//if the canvas isn't supported by the browser, don't do anything else
	if(Astriarch.View.jCanvasDraw['canvasSupported']) {
		var backgroundLayer = Astriarch.View.jCanvasDraw.getLayer('canvasAstriarchBackground');
		Astriarch.View.CanvasBackground = backgroundLayer.canvas;
		Astriarch.View.ContextBackground = backgroundLayer.ctx;
		
		Astriarch.View.CanvasPlayfieldLayer = Astriarch.View.jCanvasDraw.getLayer('canvasAstriarchPlayfield');
		Astriarch.View.CanvasFleetsLayer = Astriarch.View.jCanvasDraw.getLayer('canvasAstriarchFleets');
		
		//setup double-click handler for the playfield
		Astriarch.View.CanvasPlayfieldLayer.canvas.dblclick(function() {});
		
		//todo: maybe the load background images could be done in new html5 (background) thread?
		setTimeout(function() { Astriarch.View.loadBackgroundImages(); }, 10);//give the browser a bit to render everything before loading and drawing
		
		Astriarch.View.ContextBackground.globalAlpha = 1.0;
		
		setInterval(function() { Astriarch.View.jCanvasDraw.draw() }, 50);
		
		//initialize standard and player colors, move this later
		Astriarch.View.ColorsRGBA["white"] = new Astriarch.Util.ColorRGBA(255, 255, 255, 255);//#ffffff
		Astriarch.View.ColorsRGBA["yellow"] = new Astriarch.Util.ColorRGBA(255, 255, 0, 255);//#ffff00
		Astriarch.View.ColorsRGBA["orange"] = new Astriarch.Util.ColorRGBA(255, 165, 0, 255);//#ffa500
		Astriarch.View.ColorsRGBA["blue"] = new Astriarch.Util.ColorRGBA(0, 0, 255, 255);//#0000ff
		Astriarch.View.ColorsRGBA["green"] = new Astriarch.Util.ColorRGBA(0, 128, 0, 255);//#008000
		Astriarch.View.ColorsRGBA["red"] = new Astriarch.Util.ColorRGBA(255, 0, 0, 255);//#ff0000
		Astriarch.View.ColorsRGBA["purple"] = new Astriarch.Util.ColorRGBA(128, 0, 128, 255);//#800080
		
		Astriarch.View.audioInterface = new AudioInterface();

		Astriarch.PlayerGameOptions = new Astriarch.Player.PlayerGameOptions();

		//setup websocket communication
		Astriarch.server_comm.init(serverConfig.port);
		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.NOOP, function(message){console.log("NOOP: ", message)});
		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.LIST_GAMES, Astriarch.LobbyControl.refreshGameList);

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.CHANGE_GAME_OPTIONS, function(message){Astriarch.NewGameControl.OnGameOptionsChanged(message)});
		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.JOIN_GAME, function(message){Astriarch.LobbyControl.OnGameJoinMessageResponse(message)});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.CREATE_GAME, function(message){Astriarch.LobbyControl.OnGameCreateMessageResponse(message)});
		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.RESUME_GAME, function(message){Astriarch.LobbyControl.OnGameResumeMessageResponse(message)});
		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.START_GAME, function(message){Astriarch.NewGameControl.OnGameStartMessageResponse(message)});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.END_TURN, function(message){Astriarch.GameController.OnEndTurnMessageResponse(message)});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.GAME_OVER, function(message){Astriarch.GameController.OnGameOverMessageResponse(message)});

		Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.LIST_GAMES, payload:{}});
	}
};

Astriarch.View.CanvasNotSupported = function() {
	$('#startGameOptionsContainer').hide();
	$('#canvasContainer').html('<p style="color:white">Astriarch HTML 5 version not supported by your browser.  You can play with the silverlight plugin by clicking <a href="silverlight.html">here</a>. In 5 seconds you will be taken to the silverlight version automatically.</p>');
	setTimeout(function() { window.location = "silverlight.html" }, 5000);
};

Astriarch.View.ClearPlanetsAndFleets = function() {
	Astriarch.View.DrawnPlanets = {};
	Astriarch.View.DrawnFleets = [];
	Astriarch.View.CanvasPlayfieldLayer.children = [];
	Astriarch.View.CanvasFleetsLayer.children = [];
	
	Astriarch.View.CanvasPlayfieldLayer.needsDisplay = true;
	Astriarch.View.CanvasFleetsLayer.needsDisplay = true;
};

Astriarch.View.ShowNewGameOptions = function() {
	$('#startGameOptionsContainer').show();
	//also hide everything but the starfield so if we just finished a game those controls aren't still shown
	Astriarch.View.ClearPlanetsAndFleets();
	$('#TurnDisplay,#OverallPlayerStatusGrid,#SelectedItemStatus,#SelectedItemPopulationPanel,#SelectedItemImprovementSlotsPanel,#SelectedItemPopulationAssignmentsPanel,#SelectedItemBuiltImprovementsGrid,#SelectedItemPlanetaryFleetGrid,#SelectedItemStatusDetails,#BottomStatusGrid,#TurnSummaryItemsListBox,#ButtonPanel').hide();
	$('#PlanetViewButton,#SendShipsButton,#NextTurnButton').hide();
};

Astriarch.View.SetupGraphicalDOMElements = function() {

	Astriarch.LobbyControl.init();

	Astriarch.NewGameControl.init();

	Astriarch.View.TurnSummaryItemsListBox = new JSListBox({'containerSelector':'TurnSummaryItemsListBox', 'stylemap':{'border':'none','background':'none'}});
	
	$( "#PlanetViewButton, #SendShipsButton, #NextTurnButton, #CancelSendButton, #MainMenuButtonGameOver").button();
								
	$('#CancelSendButton').hide();
	$('#MainMenuButtonGameOver').hide();
	
	
	$("#SystemMasterVersion").text("v" + Astriarch.Version);
	$("#SystemMasterVersion").attr("Title", "Astriarch - Ruler of the Stars, Version: " + Astriarch.Version + "\r\nCopyright 2010 Mastered Software\r\nMusic by Resonant");
	
	//setup dialogs
	Astriarch.PlanetView.init();
	Astriarch.SendShipsControl.init();
	Astriarch.PlanetaryConflictControl.init();
	Astriarch.GameOverControl.init();
	Astriarch.EndTurnControl.init();
	
	$( "#PlanetViewButton" ).click(
		function() {
			Astriarch.View.ShowPlanetView();
		}
	);
	
	$( "#SendShipsButton" ).click(
		function() {
			Astriarch.View.StartSendShips();
		}
	);
	
	$( "#NextTurnButton" ).click(function() {
			$("#NextTurnButton").button('disable');
			Astriarch.GameController.NextTurn();
		}
	);
	
	$( "#CancelSendButton" ).click(function() {
			Astriarch.View.CancelSendShips();
		}
	);
	
	$( "#MainMenuButtonGameOver" ).click(function() {
			Astriarch.View.ShowMainMenu();
		}
	);
	
	$("#MainMenuButton").button({ icons: {primary:'MainMenuButton'}, text: false });
	
	$( "#MainMenuButton" ).click(function() {
			Astriarch.View.ShowMainMenu();
		}
	);
	
	$("#MainMenuIcon").mouseenter(function() { Astriarch.View.mainMenuIconMouseEnter(); });
	$("#MainMenuButton").mouseleave(function() { Astriarch.View.mainMenuButtonMouseLeave(); });
	
	$("#SpeakerIcon").mouseenter(function() { Astriarch.View.speakerIconMouseEnter(); });
	$("#ButtonSpeakerToggleMute").mouseleave(function() { Astriarch.View.muteButtonMouseLeave(); });
	
	$("#SliderVolume").mouseenter(function() { Astriarch.View.volumeSliderMouseEnter(); });
	$("#SliderVolume").mouseleave(function() { Astriarch.View.volumeSliderMouseLeave(); });
	
	$("#ButtonSpeakerToggleMute").button({ icons: {primary:'SpeakerImgOn'}, text: false });
		
	$( "#ButtonSpeakerToggleMute" ).click(
		function() {
			Astriarch.View.toggleAudioMute();
		}
	);
	
	$("#SliderVolume").slider({value:1, step:0.1, min:0, max:1, orientation: 'vertical', slide: Astriarch.View.volumeSliderValueChanged});
};

Astriarch.View.ShowMainMenu = function() {
	Astriarch.View.audioInterface.StartMenu();
			
	$('#MainMenuButtonGameOver').hide();
	$('#MainMenuButton').hide();
	
	//show the main menu
	$('#mainMenu').show();
};

Astriarch.View.ShowPlanetView = function() {
	var cp = Astriarch.ClientGameModel.GameGrid.SelectedHex.ClientPlanetContainedInHex;//ClientPlanet
	var p = Astriarch.ClientGameModel.MainPlayer.GetPlanetIfOwnedByPlayer(cp);
	Astriarch.PlanetView.show(p);
};

Astriarch.View.StartSendShips = function() {
	Astriarch.View.sendingShipsTo = true;
	$('#SendShipsStatus').text(" Select Planet to Send Ships to. ");
	$('#CancelSendButton').show();
	Astriarch.View.sendShipsFromHex = Astriarch.ClientGameModel.GameGrid.SelectedHex;
};

Astriarch.View.CancelSendShips = function() {
	$('#SendShipsStatus').text("");
	$('#CancelSendButton').hide();
	
	Astriarch.View.sendingShipsTo = false;
};

Astriarch.View.SendShipsDialogWindowClosed = function(dialogResult) {

	if (dialogResult == true)
	{
		//check to make sure a fleet was created and then add the appropriate controls to our canvas
		if (Astriarch.SendShipsControl.CreatedFleet != null)
		{
			//update the canvas so we hide the fleets if there are no more ships in the planetary fleet
			if (Astriarch.SendShipsControl.pSource.PlanetaryFleet.GetPlanetaryFleetMobileStarshipCount() == 0)
			{
				var dp = Astriarch.View.DrawnPlanets[Astriarch.SendShipsControl.pSource.Id];//DrawnPlanet
				dp.UpdatePlanetDrawingForPlayer(Astriarch.ClientGameModel.MainPlayer);
			}
		}
	}
	
	Astriarch.View.selectPlanet(Astriarch.SendShipsControl.pSource);//reselect the source planet even if they hit ok
};

Astriarch.View.PlayfieldClicked = function(pos) {
	var point = new Astriarch.Point(pos.x, pos.y);
	var hClicked = Astriarch.ClientGameModel.GameGrid.GetHexAt(point);//Hexagon

	if (hClicked != null && hClicked.ClientPlanetContainedInHex != null)
	{
		Astriarch.ClientGameModel.GameGrid.SelectHex(hClicked);
		Astriarch.View.updateSelectedItemPanelForPlanet();
		
		if (Astriarch.View.sendingShipsTo)//TODO: this could be cleaner, at least make it change the cursor so you know your sending ships
		{
			if (Astriarch.View.sendShipsFromHex != Astriarch.ClientGameModel.GameGrid.SelectedHex)
			{
				var distance = Astriarch.ClientGameModel.GameGrid.GetHexDistance(Astriarch.View.sendShipsFromHex, Astriarch.ClientGameModel.GameGrid.SelectedHex);

				//show select ships to send dialog
				var cp1 = Astriarch.View.sendShipsFromHex.ClientPlanetContainedInHex;
				var p1 = Astriarch.ClientGameModel.MainPlayer.GetPlanetIfOwnedByPlayer(cp1);
				var p2 = Astriarch.ClientGameModel.GameGrid.SelectedHex.ClientPlanetContainedInHex;

				Astriarch.SendShipsControl.show(p1, p2, distance);
				
				//TODO: add close handling on the send ships control
			}
			//alert("The hexes are " + distance + " spaces away.");
			Astriarch.View.CancelSendShips();
		}
	
	}
	
	return true;
};

Astriarch.View.PlayfieldDoubleClicked = function(pos) {
	//for double click on hexes
	var point = new Astriarch.Point(pos.x, pos.y);
	var hClicked = Astriarch.ClientGameModel.GameGrid.GetHexAt(point);//Hexagon

	if (hClicked != null && hClicked.ClientPlanetContainedInHex != null) {
		var p = Astriarch.ClientGameModel.MainPlayer.GetPlanetIfOwnedByPlayer(hClicked.ClientPlanetContainedInHex);
		if (p) {
			//fire off planet view
			Astriarch.View.ShowPlanetView();
		}
	}

	return true;
};

Astriarch.View.FleetsClicked = function(pos) {
	//console.log('FleetsClicked ('+ pos.x +','+ pos.y +')');
	//alert('FleetsClicked ('+ pos.x +','+ pos.y +')');
	return true;
};

Astriarch.View.selectPlanet = function(/*Planet*/ p) {
	Astriarch.ClientGameModel.GameGrid.SelectHex(p.BoundingHex);
	Astriarch.View.updateSelectedItemPanelForPlanet();
};

Astriarch.View.updatePlayerStatusPanel = function() {
	var mainPlayer = Astriarch.ClientGameModel.MainPlayer;
	if (mainPlayer !== null)//this should never happen
	{
		$('#OverallPlayerStatusGrid').css({"visibility":"visible"});
		
		var totalPopulation = mainPlayer.GetTotalPopulation();

		$('#TextBlockPopulationAmount').text(totalPopulation);

		var totalResourceProduction = mainPlayer.GetTotalResourceProductionPerTurn();

		var totalFoodAmount = mainPlayer.TotalFoodAmount();
		var foodDiffPerTurn = totalResourceProduction.food - totalPopulation;
		var foodDiffPositiveIndicator = "";
		if (foodDiffPerTurn >= 0)
			foodDiffPositiveIndicator = "+";

		var foodAmountColor = "green";
		if (foodDiffPerTurn < 0)
		{
			if (foodDiffPerTurn + totalFoodAmount < totalPopulation) {
				foodAmountColor = "red";
			} else {//we're not going to starve
				foodAmountColor = "yellow";
			}
		} else if(foodDiffPerTurn + totalFoodAmount < totalPopulation) {
			foodAmountColor = "orange";//we're still gaining food but we'll still starve
		}

		$('#TextBlockFoodAmount').css("color", foodAmountColor);
		$('#TextBlockFoodAmount').text(totalFoodAmount + " " + foodDiffPositiveIndicator + foodDiffPerTurn);

		$('#TextBlockGoldAmount').text(mainPlayer.Resources.GoldAmount);
		$('#TextBlockOreAmount').text(mainPlayer.TotalOreAmount() + " +" + totalResourceProduction.ore);
		$('#TextBlockIridiumAmount').text(mainPlayer.TotalIridiumAmount() + " +" + totalResourceProduction.iridium);
	}
};

Astriarch.View.updateSelectedItemPanelForPlanet = function() {
	$('#PlanetViewButton').button('disable');
	$('#SendShipsButton').button('disable');

	var sb = "";

	if (Astriarch.ClientGameModel.GameGrid.SelectedHex != null)
	{
		var cp = Astriarch.ClientGameModel.GameGrid.SelectedHex.ClientPlanetContainedInHex;//Planet
		var mainPlayer = Astriarch.ClientGameModel.MainPlayer;
		sb += "--- Planet " + cp.Name + " ---<br />";

		$('#SelectedItemBuiltImprovementsGrid').css({"visibility":"hidden"});
		$('#SelectedItemPlanetaryFleetGrid').css({"visibility":"hidden"});
		$('#SelectedItemPopulationPanel').css({"visibility":"hidden"});
		$('#SelectedItemPopulationAssignmentsPanel').css({"visibility":"hidden"});
		$('#SelectedItemImprovementSlotsPanel').css({"visibility":"hidden"});
		$('#SelectedItemStatusDetails').css({"visibility":"hidden"});

		var planetTypeIfKnownByPlayer = mainPlayer.PlanetTypeIfKnownByPlayer(cp);

		if (!planetTypeIfKnownByPlayer)//this planet is unexplored
		{
			sb += "Unexplored";
		}
		else//the main player has explored it
		{
			var lastKnownFleet = null;//LastKnownFleet
			var lastKnownOwner = null;//ClientPlayer
			if (mainPlayer.LastKnownPlanetFleetStrength[cp.Id])
			{
				lastKnownFleet = mainPlayer.LastKnownPlanetFleetStrength[cp.Id];
				lastKnownOwner = lastKnownFleet.LastKnownOwner;
			}
				
			sb += Astriarch.GameTools.PlanetTypeToFriendlyName(planetTypeIfKnownByPlayer) + "<br />";

			var p = mainPlayer.GetPlanetIfOwnedByPlayer(cp);
			//TODO: make work with Astriarch.ClientGameModel.ShowUnexploredPlanetsAndEnemyPlayerStats option at the end of game
			if (p) {
				//show details for owned planets
				var owner = (p.Type == Astriarch.Planet.PlanetType.AsteroidBelt) ? "None" : "Natives";
				if (p.Owner != null)
					owner = p.Owner.Name;
				sb += owner + "<br />";
				
				$('#SelectedItemBuiltImprovementsGrid').css({"visibility":"visible"});
				$('#SelectedItemPlanetaryFleetGrid').css({"visibility":"visible"});
				$('#SelectedItemPopulationPanel').css({"visibility":"visible"});
				$('#SelectedItemPopulationAssignmentsPanel').css({"visibility":"visible"});
				$('#SelectedItemImprovementSlotsPanel').css({"visibility":"visible"});
				$('#SelectedItemStatusDetails').css({"visibility":"visible"});

				Astriarch.View.updateSelectedItemPopulationPanel(p.Population.length, p.MaxPopulation());

				var farmCount = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Farm].length;
				var mineCount = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Mine].length;
				var colonyCount = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Colony].length;
				var factoryCount = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length;
				var spacePlatformCount = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform].length;

				var builtImprovementsCount = farmCount + mineCount + factoryCount + colonyCount;

				Astriarch.View.updateSelectedItemImprovementSlotsPanel(builtImprovementsCount, p.MaxImprovements);

				var pop = new Astriarch.Planet.PopulationAssignments();
				p.CountPopulationWorkerTypes(pop);

				Astriarch.View.updateSelectedItemPopulationAssignmentsPanel(pop.Farmers, pop.Miners, pop.Workers);

				$('#TextBlockFarmCount').text(farmCount);
				$('#TextBlockMineCount').text(mineCount);
				$('#TextBlockFactoryCount').text(factoryCount);
				$('#TextBlockColonyCount').text(colonyCount);
				$('#TextBlockSpacePlatformCount').text(spacePlatformCount);
				
				var scoutCount = p.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Scout].length;
				var destroyerCount = p.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length;
				var cruiserCount = p.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length;
				var battleshipCount = p.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship].length;

				$('#TextBlockDefenderCount').text(p.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.SystemDefense].length);
				$('#TextBlockScoutCount').text(scoutCount);
				$('#TextBlockDestroyerCount').text(destroyerCount);
				$('#TextBlockCruiserCount').text(cruiserCount);
				$('#TextBlockBattleshipCount').text(battleshipCount);

				if (p.Owner == mainPlayer)//make sure we can't modify planets even while debugging TODO: hack for now will have to change for multi-player
				{
					$('#PlanetViewButton').button('enable');
					
					if (scoutCount != 0 || destroyerCount != 0 || cruiserCount != 0 || battleshipCount != 0)
						$('#SendShipsButton').button('enable');
				}

				//populate SelectedItemStatusDetails panel
				var sisdText = "";

				sisdText += "<br />--- Stockpile ---<br />";
				sisdText += "Food: " + (p.Resources.FoodAmount + p.Resources.FoodRemainder) + "<br />";
				sisdText += "Ore: " + (p.Resources.OreAmount + p.Resources.OreRemainder) + "<br />";
				sisdText += "Iridium: " + (p.Resources.IridiumAmount + p.Resources.IridiumRemainder) + "<br />";

				sisdText += "<br />--- Per Turn ---<br />";
				sisdText += "Production: " + (p.ResourcesPerTurn.ProductionAmountPerTurn + p.ResourcesPerTurn.RemainderProductionPerTurn) + "<br />";
				sisdText += "Food: " + (p.ResourcesPerTurn.FoodAmountPerTurn + p.ResourcesPerTurn.RemainderFoodPerTurn) + "<br />";
				sisdText += "Ore: " + (p.ResourcesPerTurn.OreAmountPerTurn + p.ResourcesPerTurn.RemainderOrePerTurn) + "<br />";
				sisdText += "Iridium: " + (p.ResourcesPerTurn.IridiumAmountPerTurn + p.ResourcesPerTurn.RemainderIridiumPerTurn) + "<br />";

				sisdText += "<br />--- Per Worker ---<br />";
				sisdText += "Production: " + p.ResourcesPerTurn.GetExactProductionAmountPerWorkerPerTurn()+ "<br />";
				sisdText += "Food: " + p.ResourcesPerTurn.GetExactFoodAmountPerWorkerPerTurn()+ "<br />";
				sisdText += "Ore: " + p.ResourcesPerTurn.GetExactOreAmountPerWorkerPerTurn()+ "<br />";
				sisdText += "Iridium: " + p.ResourcesPerTurn.GetExactIridiumAmountPerWorkerPerTurn()+ "<br />";

				$("#SelectedItemStatusDetails").html(sisdText);

			}//if owned by main player
			else if (lastKnownFleet != null)
			{
				sb += Astriarch.GameTools.PlanetOwnerToFriendlyName(planetTypeIfKnownByPlayer, lastKnownOwner) + "<br />";

				var lastKnownPlanetFleet = lastKnownFleet.Fleet;//Fleet
				var turnSinceExplored = Astriarch.ClientGameModel.Turn.Number - lastKnownFleet.TurnLastExplored;
				var turnString = turnSinceExplored == 0 ? "Explored this turn." : (turnSinceExplored == 1 ? "Explored last turn." : "As of " + turnSinceExplored + " turns ago.");

				sb += "--- Known Fleet ---<br />";
				sb += turnString + "<br />";
				if (lastKnownPlanetFleet.HasSpacePlatform)
					sb += "1 Space Platform<br />";
				else
					sb += "No Space Platform<br />";
				
				$('#TextBlockDefenderCount').text(lastKnownPlanetFleet.StarShips[Astriarch.Fleet.StarShipType.SystemDefense].length);
				$('#TextBlockScoutCount').text(lastKnownPlanetFleet.StarShips[Astriarch.Fleet.StarShipType.Scout].length);
				$('#TextBlockDestroyerCount').text(lastKnownPlanetFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length);
				$('#TextBlockCruiserCount').text(lastKnownPlanetFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length);
				$('#TextBlockBattleshipCount').text(lastKnownPlanetFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship].length);
				
				$('#SelectedItemPlanetaryFleetGrid').css({"visibility":"visible"});
			}
		}

	}
	$('#SelectedItemStatus').html(sb);
};

Astriarch.View.updateSelectedItemPopulationPanel = function(populationCount, maxPopulation) {
	$('#SelectedItemPopulationPanel').attr("Title", "Planet Population: " + populationCount + " / " + maxPopulation);
            
	//clear out the appropriate ones
	for (var i = maxPopulation + 1; i <= 16; i++)
	{
		$("#PopulationImage" + i).css("background-image", '');
	}

	for (var i = 1; i <= maxPopulation; i++)
	{
		if (i <= populationCount)
			$("#PopulationImage" + i).css("background-image", 'url(img/PopulationSmallFilled.png)');
		else
			$("#PopulationImage" + i).css("background-image", 'url(img/PopulationSmallEmpty.png)');
	}
};

Astriarch.View.updateSelectedItemImprovementSlotsPanel = function(improvementCount, maxImprovements) {
	$('#SelectedItemImprovementSlotsPanel').attr("Title", "Planetary Improvements: " + improvementCount + " / " + maxImprovements);

	//clear out the appropriate ones
	for (var i = maxImprovements + 1; i <= 9; i++)
	{
		$("#PlanetaryImprovementSlotsImage" + i).css("background-image", '');
	}

	for (var i = 1; i <= maxImprovements; i++)
	{
		if (i <= improvementCount)
			$("#PlanetaryImprovementSlotsImage" + i).css("background-image", 'url(img/PlanetaryImprovementSlotFilled.png)');
		else
			$("#PlanetaryImprovementSlotsImage" + i).css("background-image", 'url(img/PlanetaryImprovementSlotEmpty.png)');
	}
};

Astriarch.View.updateSelectedItemPopulationAssignmentsPanel = function() {
	var farmerString = farmers == 1 ? " Farmer, " : " Farmers, ";
	var minerString = miners == 1 ? " Miner, " : " Miners, ";
	var workerString = workers == 1 ? " Workers" : " Workers";
	var tooltip = farmers + farmerString + miners + minerString + workers + workerString;
	$('#SelectedItemPopulationAssignmentsPanel').attr("Title", tooltip);

	//clear out the appropriate ones
	for (var i = farmers + miners + workers + 1; i <= 16; i++)
	{
		$("#PopulationAssignmentImage" + i).css("background-image", '');
	}

	for (var i = 1; i <= farmers; i++)
	{
		$("#PopulationAssignmentImage" + i).css("background-image", 'url(img/Farmer.png)');
	}

	for (var i = farmers + 1; i <= farmers + miners; i++)
	{
		$("#PopulationAssignmentImage" + i).css("background-image", 'url(img/Miner.png)');
	}

	for (var i = farmers + miners + 1; i <= farmers + miners + workers; i++)
	{
		$("#PopulationAssignmentImage" + i).css("background-image", 'url(img/Builder.png)');
	}
};

Astriarch.View.updateCanvasForPlayer = function() {
	var mainPlayer = Astriarch.ClientGameModel.MainPlayer;

	for (var i in Astriarch.View.DrawnPlanets)
	{
		Astriarch.View.DrawnPlanets[i].UpdatePlanetDrawingForPlayer(mainPlayer);
	}
	Astriarch.View.CanvasPlayfieldLayer.needsDisplay = true;

	//clear fleets and remake drawn fleets from fleets in transit (if this causes flickering perhaps we should instead update existing drawn fleets?)
	Astriarch.View.DrawnFleets = [];
	Astriarch.View.CanvasFleetsLayer.children = [];
	for(var i in mainPlayer.FleetsInTransit){
		mainPlayer.FleetsInTransit[i].CreateDrawnFleet();
	}

	for (var pi in mainPlayer.OwnedPlanets){
		var p = mainPlayer.OwnedPlanets[pi];
		for (var i in p.OutgoingFleets){
			p.OutgoingFleets[i].CreateDrawnFleet();
		}
	}

	Astriarch.View.CanvasFleetsLayer.needsDisplay = true;
};

Astriarch.View.loadBackgroundImages = function() {
	
	for(var i = 0; i < Astriarch.View.BACKGROUND_COUNT; i++)
	{
		var image = new Image();
		image.onload = function() {
			//backgroundImageLoaded
			Astriarch.View.BackgroundImagesLoaded++;
			if(Astriarch.View.BackgroundImagesLoaded >= Astriarch.View.BACKGROUND_COUNT)
			{
				Astriarch.View.allBackgroundImagesLoaded();
			}
		};
		image.src = "img/backgrounds/" + i + ".jpg";
		Astriarch.View.BackgroundImages.push(image);
	}
};

Astriarch.View.allBackgroundImagesLoaded = function() {
	var largeStars = Astriarch.View.populateStars();
	Astriarch.View.populateBackgroundImages();
	Astriarch.View.paintLargeStars(largeStars);
	Astriarch.View.drawBorder();
	
	//we have finished all the time consuming drawing and loading, hide spinner and show main interface
	$('#loadingSpinner').hide();
	$('#mainMenu').show();//finally show the main menu after everything else is loaded.
};

Astriarch.View.populateBackgroundImages = function() {
	var RECT_WIDTH = 80.0;
    var RECT_HEIGHT = 60.0;
	
	var chanceTable = {};
	for(var i = 0; i < Astriarch.View.BACKGROUND_COUNT; i++)
	{
		chanceTable[i] = 100;
	}

	var rows = Math.floor(Astriarch.View.CanvasBackground[0].height / RECT_HEIGHT);
	var cols = Math.floor(Astriarch.View.CanvasBackground[0].width / RECT_WIDTH);

	for(var row = 0; row < rows; row += 2)
	{
		for(var col = 0; col < cols; col+=2)
		{
			if (Astriarch.NextRandom(0, 2) == 0)
			{
				var offsetY = Astriarch.NextRandom(0, Math.floor(RECT_HEIGHT));
				var offsetX = Astriarch.NextRandom(0, Math.floor(RECT_WIDTH));
				var imageIndex = Astriarch.View.pickRandomTile(chanceTable);
				
				//set image opacity
				Astriarch.View.ContextBackground.globalAlpha = Astriarch.NextRandom(70 - Astriarch.View.BACKGROUND_DARKNESS, 101 - Astriarch.View.BACKGROUND_DARKNESS) / 100.0;
				
				Astriarch.View.ContextBackground.drawImage(Astriarch.View.BackgroundImages[imageIndex], (col * RECT_WIDTH) + offsetX, (row * RECT_HEIGHT) + offsetY);
			}
		}
	}

};

Astriarch.View.pickRandomTile = function(chanceTable) {
	
	var chanceSum = 1;
	for(var i in chanceTable)
		chanceSum += chanceTable[i];

	var pickedNumber = Astriarch.NextRandom(0, chanceSum);

	var currRangeLow = 0;

	var imageIndex = 0;
	for (var index in chanceTable)
	{
		var thisChance = chanceTable[index];
		if (pickedNumber < (thisChance + currRangeLow))
		{
			imageIndex = index;
			chanceTable[index] = Math.floor(thisChance / 2.0);
			break;
		}
		currRangeLow += thisChance;
	}

	return imageIndex;
};

/**
 * Star is used to paint the background starfield
 * @constructor
 */
Astriarch.View.Star = function(x, y, opacity) {
	this.X = x;
	this.Y = y;
	this.Opacity = opacity;
};

Astriarch.View.populateStars = function() {

	var size = 40.0;
	var rows = Math.floor(Astriarch.View.CanvasBackground[0].height / size);
	var cols = Math.floor(Astriarch.View.CanvasBackground[0].width / size);
	
	var smallStars = [];//array of small star objects: {'X':0, 'Y':0, 'Opacity':100} to paint at the end
	var largeStars = [];//array of large star objects: {'X':0, 'Y':0} to return to paint later

	for (var row = 0; row < rows; row++)
	{
		for (var col = 0; col < cols; col++)
		{
			var starCount = Astriarch.NextRandom(0, 20);
			for (var starNum = 0; starNum < starCount; starNum++)
			{

				var offsetY = Astriarch.NextRandom(0, size);
				var offsetX = Astriarch.NextRandom(0, size);

				var starSize = 1.0;
				if (starNum >= 6 || starNum % 2 == 0)//prefer small white stars
				{
				
					var opacity = Astriarch.NextRandom(40 - Astriarch.View.BACKGROUND_DARKNESS, 101 - Astriarch.View.BACKGROUND_DARKNESS) / 140.0;
					opacity = Math.floor(opacity * 255);
					smallStars.push(new Astriarch.View.Star((col * size) + offsetX, (row * size) + offsetY, opacity));
					//smallStars.push({'X':(col * size) + offsetX, 'Y':(row * size) + offsetY, 'Opacity':opacity});
					/*
					Astriarch.View.ContextBackground.beginPath();
					Astriarch.View.ContextBackground.arc((col * size) + offsetX, (row * size) + offsetY, starSize, 0, Math.PI*2, false);
					Astriarch.View.ContextBackground.closePath();
					Astriarch.View.ContextBackground.fillStyle = "rgba(255, 255, 255, "+ opacity +")";
					Astriarch.View.ContextBackground.fill();
					*/
					
				}
				else
				{
					largeStars.push(new Astriarch.View.Star((col * size) + offsetX, (row * size) + offsetY, null));
					//largeStars.push({'X':(col * size) + offsetX, 'Y':(row * size) + offsetY});
				}//not a small white star
			}//foreach star in starcount
		}//foreach column
	}//foreach row

	var backgroundImg = Astriarch.View.ContextBackground.createImageData(Astriarch.View.CanvasBackground[0].width, Astriarch.View.CanvasBackground[0].height);
				
	//paint small white stars
	for(var i = 0; i < smallStars.length; i++)
	{
		//find the pixel data in the array corresponding to the star locaion
		var star = smallStars[i];
		var dataStart = (star.X + star.Y * Astriarch.View.CanvasBackground[0].width) * 4;
		backgroundImg.data[dataStart    ] = 255;
		backgroundImg.data[dataStart + 1] = 255;
		backgroundImg.data[dataStart + 2] = 255;
		backgroundImg.data[dataStart + 3] = star.Opacity;
	}
	Astriarch.View.ContextBackground.putImageData(backgroundImg, 0, 0);
	
	return largeStars;
};//Astriarch.View.populateStars

Astriarch.View.paintLargeStars = function(largeStars) {
	for(var i = 0; i < largeStars.length; i++)
	{
		var star = largeStars[i];
		var pointAndRadius = 0.5;
		var starSize = Astriarch.NextRandom(1, 6);
		var halfStarSize = starSize/2;
		
		// set up gradient
		var radialGradient = Astriarch.View.ContextBackground.createRadialGradient(
			star.X, star.Y, 0,
			star.X, star.Y, halfStarSize);

		var colorIndex = Astriarch.NextRandom(0, Astriarch.View.Colors.length);

		radialGradient.addColorStop(0, 'white');
		radialGradient.addColorStop(0.5, Astriarch.View.Colors[colorIndex]);
		radialGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

		//set gradient opacity
		Astriarch.View.ContextBackground.globalAlpha = Astriarch.NextRandom(50 - Astriarch.View.BACKGROUND_DARKNESS, 101 - Astriarch.View.BACKGROUND_DARKNESS) / 100.0;
		
		// draw gradient
		Astriarch.View.ContextBackground.fillStyle = radialGradient;
		Astriarch.View.ContextBackground.fillRect(star.X - halfStarSize, star.Y - halfStarSize, starSize, starSize);
	}
};


Astriarch.View.drawBorder = function() {

	Astriarch.View.ContextBackground.globalAlpha = 1;
	/*
	Astriarch.View.ContextBackground.shadowOffsetX = 1;
	Astriarch.View.ContextBackground.shadowOffsetY = 1;
	Astriarch.View.ContextBackground.shadowBlur    = 1;
	Astriarch.View.ContextBackground.shadowColor   = 'rgba(0, 50, 0, 255)';
	*/
	Astriarch.View.ContextBackground.lineWidth   = 2;
	Astriarch.View.ContextBackground.strokeStyle = 'rgba(0, 128, 0, 255)';
	Astriarch.View.ContextBackground.strokeRect(0, 0, 800, 600);
};

Astriarch.View.mainMenuIconMouseEnter = function() {
	$("#MainMenuIcon").hide();
	$("#MainMenuButton").show();
};

Astriarch.View.mainMenuButtonMouseLeave = function() {
	$("#MainMenuButton").hide();
	$("#MainMenuIcon").show();
};
	
Astriarch.View.speakerIconMouseEnter = function() {
	$("#SpeakerIcon").hide();
	$("#ButtonSpeakerToggleMute").show();
	
	clearTimeout(Astriarch.View.audioMouseOutTimer);
	Astriarch.View.audioMouseInTimer = setTimeout(Astriarch.View.audioMouseInTimerTick, 200);
};

Astriarch.View.muteButtonMouseLeave = function() {
	$("#ButtonSpeakerToggleMute").hide();
	$("#SpeakerIcon").show();
	
	Astriarch.View.audioMouseOutTimer = setTimeout(Astriarch.View.audioMouseOutTimerTick, 200);
};

Astriarch.View.volumeSliderMouseEnter = function() {
	clearTimeout(Astriarch.View.audioMouseOutTimer);
};

Astriarch.View.volumeSliderMouseLeave = function() {
	Astriarch.View.audioMouseOutTimer = setTimeout(Astriarch.View.audioMouseOutTimerTick, 200);
};

Astriarch.View.audioMouseInTimerTick = function() {
	$("#SliderVolume").show();
	
};

Astriarch.View.audioMouseOutTimerTick = function() {
	$("#SliderVolume").hide();
	clearTimeout(Astriarch.View.audioMouseInTimer);
};

Astriarch.View.toggleAudioMute = function() {

	Astriarch.View.audioInterface.toggleMute();
	
	if(Astriarch.View.audioInterface.muted) {
		$("#SpeakerIcon").css("background-image", 'url("img/ico_speaker_off.png")');
		$("#ButtonSpeakerToggleMute > .ui-icon").removeClass("SpeakerImgOn").addClass("SpeakerImgOff");
	} else {
		$("#SpeakerIcon").css("background-image", 'url("img/ico_speaker_on.png")');
		$("#ButtonSpeakerToggleMute > .ui-icon").removeClass("SpeakerImgOff").addClass("SpeakerImgOn");
	}
	
};

Astriarch.View.volumeSliderValueChanged = function(event, ui) {
	Astriarch.View.audioInterface.setVolume(ui.value);
};
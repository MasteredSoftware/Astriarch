Astriarch.View = {
					jCanvasDraw:null,
					audioInterface:null,
				  	audioMouseInTimer:null,
				  	audioMouseOutTimer:null,
				  	CanvasBackground:null,
				  	ContextBackground:null,
				  	CanvasPlayfieldLayer:null,
				  	CanvasFleetsLayer:null,
				  	BackgroundSpriteSheetImage:null,
				  	BACKGROUND_COUNT:7,
				  	BACKGROUND_DARKNESS:30,
				  	DrawnPlanets:{},
				  	DrawnFleets:[],
				  	Colors:["white","yellow","orange","blue","green","red","purple"],
				  	ColorsRGBA: {"white":null ,"yellow":null ,"orange":null ,"blue":null ,"green":null ,"red":null ,"purple":null},
				  	sendingShipsTo:false,
				  	sendShipsFromHex: null,
				  	TurnSummaryItemsListBox:null,
				  	SpriteSheetInfo: {
						filename:null,
						planetAsteroidY:null,
						planetDeadY:null,
						planetClass1Y:null,
						planetClass2Y:null,
						starshipDefenderY:null,
						starshipScoutY:null,
						starshipDestroyerY:null,
						starshipCruiserY:null,
						starshipBattleshipY:null
					},
					ImageCanvasStarships: {
						defender: null,
						scout: null,
						destroyer: null,
						cruiser: null,
						battleship: null
					},
					hotkeyElementsByScreen: {} //this allows us to disable hotkeys on the main screen when a dialog pops up and vise-versa
				};
				  


Astriarch.View.PageLoadInit = function(serverConfig){

	Astriarch.View.SetupGraphicalDOMElements();

	Astriarch.View.jCanvasDraw = new jCanvas({'containerSelector':'#canvasContainer',
								'canvasNotSupportedCallback':Astriarch.View.CanvasNotSupported,
								'layers':[
									{'name':'canvasAstriarchBackground', x:0, y:0, width:800, height:600,'zIndex':1, 'backgroundColor':'black'},
									{'name':'canvasAstriarchPlayfield', x:177, y:21, width:621, height:480,'zIndex':2, 'clickCallback':Astriarch.View.PlayfieldClicked, 'dblclickCallback':Astriarch.View.PlayfieldDoubleClicked, 'mouseHitSelector':'#canvasMouseHitDetector'},
									{'name':'canvasAstriarchFleets', x:177, y:21, width:621, height:480,'zIndex':3, 'clickCallback':Astriarch.View.FleetsClicked, 'mouseHitSelector':'#canvasMouseHitDetector'}
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
		setTimeout(function() { Astriarch.View.loadBackgroundSpriteSheetImage(); }, 10);//give the browser a bit to render everything before loading and drawing
		
		Astriarch.View.ContextBackground.globalAlpha = 1.0;
		
		setInterval(function() { Astriarch.View.jCanvasDraw.draw() }, 50);
		
		Astriarch.View.audioInterface = new AudioInterface(true);//if you have a slow connection maybe we should disable music downloads?

		Astriarch.PlayerGameOptions = new Astriarch.Player.PlayerGameOptions();

		//setup websocket communication
		Astriarch.server_comm.init(serverConfig);

		//register message type listeners
		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.ERROR, function(message){
			var text = message.payload;
			if(typeof(message.payload) != "string"){
				text = JSON.stringify(message.payload);
			}
			new Astriarch.Alert("Error", "<span style=\"color:red\">" + text + "</span>");
		});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.NOOP, function(message){console.log("NOOP: ", message)});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED, function(message){Astriarch.CommControl.setPlayerSessions(message.payload.sessions)});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.LIST_GAMES, Astriarch.LobbyControl.refreshGameList);
		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.GAME_LIST_UPDATED, Astriarch.LobbyControl.updateGameList);


		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.CHANGE_GAME_OPTIONS, function(message){Astriarch.NewGameControl.OnGameOptionsChanged(message)});
		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.JOIN_GAME, function(message){Astriarch.LobbyControl.OnGameJoinMessageResponse(message)});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.CREATE_GAME, function(message){Astriarch.LobbyControl.OnGameCreateMessageResponse(message)});
		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.RESUME_GAME, function(message){Astriarch.LobbyControl.OnGameResumeMessageResponse(message)});
		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.START_GAME, function(message){Astriarch.NewGameControl.OnGameStartMessageResponse(message)});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.END_TURN, function(message){Astriarch.GameController.OnEndTurnMessageResponse(message)});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.GAME_OVER, function(message){Astriarch.GameController.OnGameOverMessageResponse(message)});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.CHAT_MESSAGE, function(message){Astriarch.CommControl.appendMessages([message.payload])});

		Astriarch.server_comm.register(Astriarch.Shared.MESSAGE_TYPE.EXIT_RESIGN, function(message){Astriarch.GameController.OnExitResignMessageResponse(message)});

		Astriarch.CommControl.init();

		Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.LIST_GAMES, payload:{}});

		Astriarch.View.RegisterHotkeys();
		Astriarch.View.BindHotkeys();
	}
};

Astriarch.View.GetUnderlinedHtmlForHotkey = function(text, hotkeyAttr) {
	var index = text.indexOf(hotkeyAttr);
	if(index != -1) {
		return text.substring(0, index) + '<u class="hotkeyChar">' + hotkeyAttr + '</u>' + text.substring(index + 1);
	} else {
		return text;
	}
};

Astriarch.View.RegisterClickTargetToHotkey = function(clickTarget, hotkeyAttr, screenId, hotkeyFn) {
	screenId = screenId || "gameControls";
	hotkeyFn = hotkeyFn || function(hotkeyElm) {
		hotkeyElm.click();
	};
	//register this hotkey in hotkeyElementsByScreen
	var screenIdSel = "#" + screenId;
	Astriarch.View.hotkeyElementsByScreen[screenIdSel] = Astriarch.View.hotkeyElementsByScreen[screenIdSel] || {};
	Astriarch.View.hotkeyElementsByScreen[screenIdSel][hotkeyAttr.toLowerCase()] = {elm: clickTarget, fn:hotkeyFn};
};

Astriarch.View.RegisterHotkeys = function() {

	var getClickTargetTextElm = function(clickTarget) {
		return clickTarget.find(".ui-button-text, .ui-corner-all, .hotkeyText").first();
	};

	var underlineClickTargetWithHotkey = function(clickTarget, hotkeyAttr) {
		//style the dom element text with an underline at the first found character corresponding to the hotkey
		var textElm = getClickTargetTextElm(clickTarget);
		var text = textElm.text();
		textElm.html(Astriarch.View.GetUnderlinedHtmlForHotkey(text, hotkeyAttr));
	};

	//find elements with data-hotkey property
	$("[data-hotkey]").each(function() {
		var clickTarget = $(this);
		var hotkeyAttr = clickTarget.attr("data-hotkey");
		underlineClickTargetWithHotkey(clickTarget, hotkeyAttr);

		var screenElm = clickTarget.parents(".screen").first();
		Astriarch.View.RegisterClickTargetToHotkey(clickTarget, hotkeyAttr, screenElm.attr("id"));
	});

	//set hotkeys and style dialog ok/cancel buttons
	$(".ui-dialog-buttonpane").each(function() {
		//get sibling .screen for registration
		var screenElm = $(this).siblings(".screen").first();
		$(this).find(".ui-dialog-buttonset > .ui-button").each(function() {
			var clickTarget = $(this);
			var text = getClickTargetTextElm(clickTarget).text();

			var hotkeyAttr = "C";
			if(text == "Ok") {
				clickTarget.attr("autofocus", true);
				hotkeyAttr = "O";
			}
			underlineClickTargetWithHotkey(clickTarget, hotkeyAttr);

			Astriarch.View.RegisterClickTargetToHotkey(clickTarget, hotkeyAttr, screenElm.attr("id"));
		});
	});

	var selectHomePlanet = function() {Astriarch.View.selectPlanet(Astriarch.ClientGameModel.getClientPlanetById(Astriarch.ClientGameModel.MainPlayer.HomePlanetId));};
	var selectNextPlanet = function() {Astriarch.View.cycleSelectedPlanet(1)};
	var selectPreviousPlanet = function() {Astriarch.View.cycleSelectedPlanet(-1)};
	var finishSendShips = function() {Astriarch.View.FinishSendShips();};

	//setup non-click hotkeys
	var nonClickHotkeys = {
		'h': selectHomePlanet,
		'right': selectNextPlanet,
		'n': selectNextPlanet,
		'left': selectPreviousPlanet,
		'p': selectPreviousPlanet,
		'space': finishSendShips
	};
	Object.keys(nonClickHotkeys).forEach(function(hotkey){
		Astriarch.View.RegisterClickTargetToHotkey(null, hotkey, null, nonClickHotkeys[hotkey]);
	});

};

Astriarch.View.BindHotkeys = function(screenId) {
	Mousetrap.reset();
	screenId = screenId || "#gameControls";
	var hotkeyElements = Astriarch.View.hotkeyElementsByScreen[screenId] || {};
	Object.keys(hotkeyElements).forEach(function(hotkey) {
		var hotkeyElm = hotkeyElements[hotkey].elm;
		var hotkeyFn = hotkeyElements[hotkey].fn;
		Mousetrap.bind(hotkey, function() {
			hotkeyFn(hotkeyElm);
		});
	});
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
	Astriarch.NewGameControl.show();
	//also hide everything but the starfield so if we just finished a game those controls aren't still shown
	Astriarch.View.ClearGameBackgroundControls();
};

Astriarch.View.ClearGameBackgroundControls = function() {
	Astriarch.View.ClearPlanetsAndFleets();
	$('#TurnDisplay,#OverallPlayerStatusGrid,#SelectedItemStatus,#SelectedItemPopulationPanel,#SelectedItemImprovementSlotsPanel,#SelectedItemPopulationAssignmentsPanel,#SelectedItemBuiltImprovementsGrid,#SelectedItemPlanetaryFleetGrid,#SelectedItemStatusDetails,#BottomStatusGrid,#TurnSummaryItemsListBox,#ButtonPanel').hide();
	$('#PlanetViewButton,#SendShipsButton,#NextTurnButton,#ButtonOpenTradingCenter').hide();
};

Astriarch.View.SetupGraphicalDOMElements = function() {

	//initialize standard and player colors
	Astriarch.View.ColorsRGBA["white"] = new Astriarch.Util.ColorRGBA(255, 255, 255, 255);//#ffffff
	Astriarch.View.ColorsRGBA["yellow"] = new Astriarch.Util.ColorRGBA(255, 255, 0, 255);//#ffff00
	Astriarch.View.ColorsRGBA["orange"] = new Astriarch.Util.ColorRGBA(255, 165, 0, 255);//#ffa500
	Astriarch.View.ColorsRGBA["blue"] = new Astriarch.Util.ColorRGBA(0, 0, 255, 255);//#0000ff
	Astriarch.View.ColorsRGBA["green"] = new Astriarch.Util.ColorRGBA(0, 128, 0, 255);//#008000
	Astriarch.View.ColorsRGBA["red"] = new Astriarch.Util.ColorRGBA(255, 0, 0, 255);//#ff0000
	Astriarch.View.ColorsRGBA["purple"] = new Astriarch.Util.ColorRGBA(128, 0, 128, 255);//#800080

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
	Astriarch.TradingControl.init();
	Astriarch.ExitConfirmControl.init();
	
	$( "#PlanetViewButton" ).click(
		function() {
			if(window.tour.enabled && (window.tour.step == 15 || window.tour.step == 27 || window.tour.step == 32 || window.tour.step == 43 || window.tour.step == 53)){
				window.tour.jqElm.joyride('nextTip');
			}
			Astriarch.View.ShowPlanetView();
		}
	);
	
	$( "#SendShipsButton" ).click(
		function() {
			if(window.tour.enabled && (window.tour.step == 55)){
				window.tour.jqElm.joyride('nextTip');
			}
			Astriarch.View.StartSendShips();
		}
	);
	
	$( "#NextTurnButton" ).click(function() {
			if(window.tour.enabled && (window.tour.step == 22 || window.tour.step == 24 || window.tour.step == 26 || window.tour.step == 28  || window.tour.step == 31 || window.tour.step == 35 || window.tour.step == 40 || window.tour.step == 42 || window.tour.step == 47)){
				window.tour.jqElm.joyride('nextTip');
			}
			Astriarch.View.NextTurn();
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
	
	$("#MainMenuButton").button({ icons: {primary:'icon-16x16-main-menu'}, text: false });
	
	$( "#MainMenuButton" ).click(function() {
			//TODO: show confirm dialog to ask if they want to resign
			Astriarch.ExitConfirmControl.show();
		}
	);
	
	$("#MainMenuIcon").mouseenter(function() { Astriarch.View.mainMenuIconMouseEnter(); });
	$("#MainMenuButton").mouseleave(function() { Astriarch.View.mainMenuButtonMouseLeave(); });
	
	$("#SpeakerIcon").mouseenter(function() { Astriarch.View.speakerIconMouseEnter(); });
	$("#ButtonSpeakerToggleMute").mouseleave(function() { Astriarch.View.muteButtonMouseLeave(); });
	
	$("#SliderVolume").mouseenter(function() { Astriarch.View.volumeSliderMouseEnter(); });
	$("#SliderVolume").mouseleave(function() { Astriarch.View.volumeSliderMouseLeave(); });
	
	$("#ButtonSpeakerToggleMute").button({ icons: {primary:'icon-16x16-speaker-on'}, text: false });

	$( "#ButtonSpeakerToggleMute" ).click(
		function() {
			Astriarch.View.toggleAudioMute();
		}
	);

	$("#ButtonOpenTradingCenter").button({ icons: {primary:'icon-16x16-trading'}, text: false });

	$( "#ButtonOpenTradingCenter" ).click(
		function() {
			if(window.tour.enabled && (window.tour.step == 36)){
				window.tour.jqElm.joyride('nextTip');
			}

			Astriarch.View.openTradingCenter();
		}
	);


	
	$("#SliderVolume").slider({value:1, step:0.1, min:0, max:1, orientation: 'vertical', slide: Astriarch.View.volumeSliderValueChanged});

	//parse out css rules from spritesheets
	var getPropertyValueFromCssClass = function(cssClassName, cssPropertyName){
		var $dummy = $('<div class="'+cssClassName+'"></div>').hide().appendTo("body");
		var propertyValue = $dummy.css(cssPropertyName);
		if(cssPropertyName == "background-image"){
			// strip url("...")
			propertyValue = propertyValue.replace(/"/g,"").replace(/url\(|\)$/ig, "");
		} else if(cssPropertyName == "background-position"){
			// propertyValue = "0px -384px";
			propertyValue = parseFloat(propertyValue.split(' ')[1].replace(/[^0-9-]/g, ''));
		}

		$dummy.remove();
		return propertyValue;
	};

	Astriarch.View.SpriteSheetInfo.filename = getPropertyValueFromCssClass("icon-32x32-sprite", "background-image");
	Astriarch.View.SpriteSheetInfo.planetAsteroidY = -1 * getPropertyValueFromCssClass("icon-32x32-PlanetAsteroid", "background-position");
	Astriarch.View.SpriteSheetInfo.planetDeadY = -1 * getPropertyValueFromCssClass("icon-32x32-PlanetDead", "background-position");
	Astriarch.View.SpriteSheetInfo.planetClass1Y = -1 * getPropertyValueFromCssClass("icon-32x32-PlanetClass1", "background-position");
	Astriarch.View.SpriteSheetInfo.planetClass2Y = -1 * getPropertyValueFromCssClass("icon-32x32-PlanetClass2", "background-position");
	Astriarch.View.SpriteSheetInfo.starshipDefenderY = -1 * getPropertyValueFromCssClass("icon-32x32-DefenderLarge", "background-position");
	Astriarch.View.SpriteSheetInfo.starshipScoutY = -1 * getPropertyValueFromCssClass("icon-32x32-ScoutLarge", "background-position");
	Astriarch.View.SpriteSheetInfo.starshipDestroyerY = -1 * getPropertyValueFromCssClass("icon-32x32-DestroyerLarge", "background-position");
	Astriarch.View.SpriteSheetInfo.starshipCruiserY = -1 * getPropertyValueFromCssClass("icon-32x32-CruiserLarge", "background-position");
	Astriarch.View.SpriteSheetInfo.starshipBattleshipY = -1 * getPropertyValueFromCssClass("icon-32x32-BattleshipLarge", "background-position");

	var shipColorRgbaArray = [Astriarch.View.ColorsRGBA["green"], Astriarch.View.ColorsRGBA["yellow"], Astriarch.View.ColorsRGBA["orange"], Astriarch.View.ColorsRGBA["red"]];
	Astriarch.View.ImageCanvasStarships.defender = new Astriarch.View.StarshipCanvas("#CanvasDefenderLarge", Astriarch.View.SpriteSheetInfo.filename, 32, 32, shipColorRgbaArray, Astriarch.View.SpriteSheetInfo.starshipDefenderY);
	Astriarch.View.ImageCanvasStarships.scout = new Astriarch.View.StarshipCanvas("#CanvasScoutLarge", Astriarch.View.SpriteSheetInfo.filename, 32, 32, shipColorRgbaArray, Astriarch.View.SpriteSheetInfo.starshipScoutY);
	Astriarch.View.ImageCanvasStarships.destroyer = new Astriarch.View.StarshipCanvas("#CanvasDestroyerLarge", Astriarch.View.SpriteSheetInfo.filename, 32, 32, shipColorRgbaArray, Astriarch.View.SpriteSheetInfo.starshipDestroyerY);
	Astriarch.View.ImageCanvasStarships.cruiser = new Astriarch.View.StarshipCanvas("#CanvasCruiserLarge", Astriarch.View.SpriteSheetInfo.filename, 32, 32, shipColorRgbaArray, Astriarch.View.SpriteSheetInfo.starshipCruiserY);
	Astriarch.View.ImageCanvasStarships.battleship = new Astriarch.View.StarshipCanvas("#CanvasBattleshipLarge", Astriarch.View.SpriteSheetInfo.filename, 32, 32, shipColorRgbaArray, Astriarch.View.SpriteSheetInfo.starshipBattleshipY);

};

Astriarch.View.NextTurn = function() {
	Astriarch.GameController.ClearTurnTimer();
	$("#NextTurnButton").button('disable');
	Astriarch.GameController.NextTurn();
};

Astriarch.View.ShowMainMenu = function() {
	Astriarch.GameId = null;

	Astriarch.View.audioInterface.StartMenu();

	Astriarch.GameController.ClearTurnTimer();

	//clear out the lobby control, once we get the response back from the LIST_GAMES message, it will populate
	Astriarch.LobbyControl.refreshGameList({});
			
	$('#MainMenuButtonGameOver').hide();
	$('#MainMenuButton').hide();
	
	//show the main menu
	$('#mainMenu').show();

	Astriarch.View.ClearGameBackgroundControls();

	//join the game lobby chat room
	Astriarch.CommControl.joinChatRoom(Astriarch.LocalStorageInterface.Prefs.playerName, null);

	Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.LIST_GAMES, payload:{}});
};

Astriarch.View.ShowPlanetView = function() {
	var cp = Astriarch.ClientGameModel.GameGrid.SelectedHex.ClientPlanetContainedInHex;//ClientPlanet
	var p = Astriarch.ClientGameModel.MainPlayer.GetPlanetIfOwnedByPlayer(cp.Id);
	Astriarch.PlanetView.show(p);
};

Astriarch.View.StartSendShips = function() {
	Astriarch.View.sendingShipsTo = true;
	$('#SendShipsStatus').text(" Select Planet to Send Ships to. ");
	$('#CancelSendButton').show();
	Astriarch.View.sendShipsFromHex = Astriarch.ClientGameModel.GameGrid.SelectedHex;
};

Astriarch.View.FinishSendShips = function() {
	//TODO: this could be cleaner, at least make it change the cursor so you know your sending ships
	if (Astriarch.View.sendingShipsTo) {
		if (Astriarch.View.sendShipsFromHex != Astriarch.ClientGameModel.GameGrid.SelectedHex) {
			var distance = Astriarch.ClientGameModel.GameGrid.GetHexDistance(Astriarch.View.sendShipsFromHex, Astriarch.ClientGameModel.GameGrid.SelectedHex);

			//show select ships to send dialog
			var cp1 = Astriarch.View.sendShipsFromHex.ClientPlanetContainedInHex;
			var p1 = Astriarch.ClientGameModel.MainPlayer.GetPlanetIfOwnedByPlayer(cp1.Id);
			var p2 = Astriarch.ClientGameModel.GameGrid.SelectedHex.ClientPlanetContainedInHex;

			Astriarch.SendShipsControl.show(p1, p2, distance);
		}
		//alert("The hexes are " + distance + " spaces away.");
		Astriarch.View.CancelSendShips();
	}
};

Astriarch.View.CancelSendShips = function() {
	$('#SendShipsStatus').text("");
	$('#CancelSendButton').hide();
	
	Astriarch.View.sendingShipsTo = false;
};

Astriarch.View.PlanetViewDialogWindowClosed = function() {
	Astriarch.View.updateSelectedItemPanelForPlanet();
	Astriarch.View.updatePlayerStatusPanel();//for total food per turn indicator and build queue updates
	var dp = Astriarch.View.DrawnPlanets[Astriarch.PlanetView.planetMain.Id];
	dp.UpdatePlanetDrawingForPlayer(Astriarch.ClientGameModel);
	Astriarch.View.CanvasPlayfieldLayer.needsDisplay = true;
};

Astriarch.View.SendShipsDialogWindowClosed = function(dialogResult) {

	if (dialogResult == true) {
		//check to make sure a fleet was created and then add the appropriate controls to our canvas
		if (Astriarch.SendShipsControl.CreatedFleet != null) {
			//update the canvas so we update the planetary fleet indicators
			var dp = Astriarch.View.DrawnPlanets[Astriarch.SendShipsControl.pSource.Id];//DrawnPlanet
			dp.UpdatePlanetDrawingForPlayer(Astriarch.ClientGameModel);
		}
	}
	
	Astriarch.View.selectPlanet(Astriarch.SendShipsControl.pSource);//reselect the source planet even if they hit ok
};

Astriarch.View.PlayfieldClicked = function(pos) {
	var point = new Astriarch.Point(pos.x, pos.y);
	var hClicked = Astriarch.ClientGameModel.GameGrid.GetHexAt(point);//Hexagon

	if (hClicked != null && hClicked.ClientPlanetContainedInHex != null) {
		Astriarch.ClientGameModel.GameGrid.SelectHex(hClicked);
		Astriarch.View.updateSelectedItemPanelForPlanet();

		Astriarch.View.FinishSendShips();
	}
	
	return true;
};

Astriarch.View.PlayfieldDoubleClicked = function(pos) {
	//for double click on hexes
	var point = new Astriarch.Point(pos.x, pos.y);
	var hClicked = Astriarch.ClientGameModel.GameGrid.GetHexAt(point);//Hexagon

	if (hClicked != null && hClicked.ClientPlanetContainedInHex != null) {
		var p = Astriarch.ClientGameModel.MainPlayer.GetPlanetIfOwnedByPlayer(hClicked.ClientPlanetContainedInHex.Id);
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

Astriarch.View.cycleSelectedPlanet = function(direction) {
	var cp = Astriarch.ClientGameModel.GameGrid.SelectedHex.ClientPlanetContainedInHex;//ClientPlanet
	var mainPlayer = Astriarch.ClientGameModel.MainPlayer;
	//var ownedPlanetIds = Object.keys(mainPlayer.OwnedPlanets);
	var planetsToCycle = Astriarch.ClientGameModel.ClientPlanets.concat([]);
	//sort planets to prefer owned planets first, then known planets, then sort by id
	planetsToCycle.sort(function(a, b){
		if(a.Id in mainPlayer.OwnedPlanets) {
			return -1;
		} else if(b.Id in mainPlayer.OwnedPlanets) {
			return 1;
		}

		if(a.Id in mainPlayer.KnownClientPlanets) {
			return -1;
		} else if(b.Id in mainPlayer.KnownClientPlanets) {
			return 1;
		}

		if(a.Id < b.Id) {
			return -1;
		} else if(a.Id > b.Id) {
			return 1;
		} else {
			return 0;
		}
	});

	if(planetsToCycle <= 1) {
		return;
	}
	var currentIndex = -1;
	planetsToCycle.forEach(function(p, index) {
		if(p.Id == cp.Id) {
			currentIndex = index;
		}
	});
	if(currentIndex == -1) {
		return;
	}
	currentIndex += direction;
	if(currentIndex < 0) {
		currentIndex = planetsToCycle.length - 1;
	} else if(currentIndex >= planetsToCycle.length) {
		currentIndex = 0;
	}
	var planet = planetsToCycle[currentIndex];
	if(planet) {
		Astriarch.View.selectPlanet(planet);
	}
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
		$('#TextBlockPopulationAmount').prop("title", "Total Population: " + totalPopulation);

		var totalResourceProduction = mainPlayer.GetTotalResourceProductionPerTurn();

		var totalFoodAmount = mainPlayer.TotalFoodAmount() + totalResourceProduction.food;
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
		} else if(totalFoodAmount < totalPopulation || foodDiffPerTurn + totalFoodAmount < totalPopulation) {
			foodAmountColor = "orange";//we're still gaining food but we'll still starve
		}

		$('#TextBlockFoodAmount').css("color", foodAmountColor);
		$('#TextBlockFoodAmount').text(Math.floor(totalFoodAmount) + " " + foodDiffPositiveIndicator + foodDiffPerTurn);
		$('#TextBlockFoodAmount').prop("title", "Food Amount: " + mainPlayer.TotalFoodAmount() + " +" + totalResourceProduction.food + " -" + totalPopulation);

		$('#TextBlockGoldAmount').text(Math.floor(mainPlayer.Resources.GoldAmount));
		$('#TextBlockGoldAmount').prop("title", "Gold Amount: " + mainPlayer.Resources.GoldAmount);

		var oreAmount = mainPlayer.TotalOreAmount();
		var decimalPlaces = oreAmount >= 100 ? 0 : oreAmount >= 10 ? 1 : 2;
		$('#TextBlockOreAmount').text(Math.floor(oreAmount) + " +" + totalResourceProduction.ore.toFixed(decimalPlaces));
		$('#TextBlockOreAmount').prop("title", "Ore Amount: " + mainPlayer.TotalOreAmount() + " +" + totalResourceProduction.ore);

		var iridiumAmount = mainPlayer.TotalIridiumAmount();
		decimalPlaces = iridiumAmount >= 100 ? 0 : iridiumAmount >= 10 ? 1 : 2;
		$('#TextBlockIridiumAmount').text(Math.floor(iridiumAmount) + " +" + totalResourceProduction.iridium.toFixed(decimalPlaces));
		$('#TextBlockIridiumAmount').prop("title", "Iridium Amount: " + mainPlayer.TotalIridiumAmount() + " +" + totalResourceProduction.iridium);
	}
};

Astriarch.View.updateSelectedItemPanelForPlanet = function() {
	$('#PlanetViewButton').button('disable');
	$('#SendShipsButton').button('disable');
	$('#ButtonOpenTradingCenter').button('disable');

	var sb = "";

	if (Astriarch.ClientGameModel.GameGrid.SelectedHex != null)
	{
		var cp = Astriarch.ClientGameModel.GameGrid.SelectedHex.ClientPlanetContainedInHex;//ClientPlanet
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

			//Planet Type
			sb += Astriarch.GameTools.PlanetTypeToFriendlyName(planetTypeIfKnownByPlayer) + "<br />";

			var p = mainPlayer.GetPlanetIfOwnedByPlayer(cp.Id);
			//TODO: make work with Astriarch.ClientGameModel.ShowUnexploredPlanetsAndEnemyPlayerStats option at the end of game
			if (p) {
				//show details for owned planets
				var owner = (p.Type == Astriarch.Planet.PlanetType.AsteroidBelt) ? "None" : "Natives";
				if (p.Owner != null)
					owner = p.Owner.Name;
				sb += owner + "<br />";

				//Producing Status
				var ppi = p.GetNextProductionItemFromBuildQueue();//PlanetProductionItem
				var queuedItemText = "None";
				var queuedItemClass = "qi-default";

				if(ppi) {
					if (ppi instanceof Astriarch.Planet.PlanetImprovement) {
						queuedItemClass = "qi-planetImprovement";
					} else if (ppi instanceof Astriarch.Planet.StarShipInProduction) { //it's a ship
						queuedItemClass = "qi-starShipInProduction";
					} else if(ppi instanceof Astriarch.Planet.PlanetImprovementToDestroy) { //it is a destroy improvement request
						queuedItemClass = "qi-planetImprovementToDestroy";
					}
					queuedItemText = ppi.ToString() + " (" + ppi.TurnsToComplete + ")";
				}
				sb +=  "<span class='" + queuedItemClass + "'>" + queuedItemText + "</span>";

				$('#SelectedItemBuiltImprovementsGrid').css({"visibility":"visible"});
				$('#SelectedItemPlanetaryFleetGrid').css({"visibility":"visible"});
				$('#SelectedItemPopulationPanel').css({"visibility":"visible"});
				$('#SelectedItemPopulationAssignmentsPanel').css({"visibility":"visible"});
				$('#SelectedItemImprovementSlotsPanel').css({"visibility":"visible"});
				$('#SelectedItemStatusDetails').css({"visibility":"visible"});

				Astriarch.View.updateSelectedItemPopulationPanel(p.Population, p.MaxPopulation());

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

				//adjust canvas drawing based on damage of ships
				var details = Astriarch.Fleet.Static.getStrengthDetailsForShips(p.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.SystemDefense]);
				Astriarch.View.ImageCanvasStarships.defender.drawShip(Astriarch.View.ColorsRGBA[details.color], details.percentDamageText);
				$(Astriarch.View.ImageCanvasStarships.defender.canvasSelector).prop("title", "Defenders" + (details.maxStrength ? ": " + details.damageText : ""));

				details = Astriarch.Fleet.Static.getStrengthDetailsForShips(p.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Scout]);
				Astriarch.View.ImageCanvasStarships.scout.drawShip(Astriarch.View.ColorsRGBA[details.color], details.percentDamageText);
				$(Astriarch.View.ImageCanvasStarships.scout.canvasSelector).prop("title", "Scouts" + (details.maxStrength ? ": " + details.damageText : ""));

				details = Astriarch.Fleet.Static.getStrengthDetailsForShips(p.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer]);
				Astriarch.View.ImageCanvasStarships.destroyer.drawShip(Astriarch.View.ColorsRGBA[details.color], details.percentDamageText);
				$(Astriarch.View.ImageCanvasStarships.destroyer.canvasSelector).prop("title", "Destroyers" + (details.maxStrength ? ": " + details.damageText : ""));

				details = Astriarch.Fleet.Static.getStrengthDetailsForShips(p.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser]);
				Astriarch.View.ImageCanvasStarships.cruiser.drawShip(Astriarch.View.ColorsRGBA[details.color], details.percentDamageText);
				$(Astriarch.View.ImageCanvasStarships.cruiser.canvasSelector).prop("title", "Cruisers" + (details.maxStrength ? ": " + details.damageText : ""));

				details = Astriarch.Fleet.Static.getStrengthDetailsForShips(p.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship]);
				Astriarch.View.ImageCanvasStarships.battleship.drawShip(Astriarch.View.ColorsRGBA[details.color], details.percentDamageText);
				$(Astriarch.View.ImageCanvasStarships.battleship.canvasSelector).prop("title", "Battleships" + (details.maxStrength ? ": " + details.damageText : ""));

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
					
					if (scoutCount != 0 || destroyerCount != 0 || cruiserCount != 0 || battleshipCount != 0) {
						$('#SendShipsButton').button('enable');
					}

					$('#ButtonOpenTradingCenter').button('enable');
				}

				//populate SelectedItemStatusDetails panel
				var sisdText = "";

				sisdText += "<br />--- Stockpile ---<br />";
				sisdText += "Production: " + p.RemainderProduction + "<br />";
				sisdText += "Food: " + p.Resources.FoodAmount + "<br />";
				sisdText += "Ore: " + p.Resources.OreAmount + "<br />";
				sisdText += "Iridium: " + p.Resources.IridiumAmount + "<br />";

				sisdText += "<br />--- Per Turn ---<br />";
				sisdText += "Production: " + p.ResourcesPerTurn.ProductionAmountPerTurn + "<br />";
				sisdText += "Food: " + p.ResourcesPerTurn.FoodAmountPerTurn + "<br />";
				sisdText += "Ore: " + p.ResourcesPerTurn.OreAmountPerTurn + "<br />";
				sisdText += "Iridium: " + p.ResourcesPerTurn.IridiumAmountPerTurn + "<br />";

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

				//adjust canvas drawing based on last known enemy fleet
				var details = Astriarch.Fleet.Static.getStrengthDetailsForShips(lastKnownPlanetFleet.StarShips[Astriarch.Fleet.StarShipType.SystemDefense]);
				Astriarch.View.ImageCanvasStarships.defender.drawShip(Astriarch.View.ColorsRGBA["green"], "");
				$(Astriarch.View.ImageCanvasStarships.defender.canvasSelector).prop("title", "Defenders" + (details.maxStrength ? ": " + details.damageText : ""));

				details = Astriarch.Fleet.Static.getStrengthDetailsForShips(lastKnownPlanetFleet.StarShips[Astriarch.Fleet.StarShipType.Scout]);
				Astriarch.View.ImageCanvasStarships.scout.drawShip(Astriarch.View.ColorsRGBA["green"], "");
				$(Astriarch.View.ImageCanvasStarships.scout.canvasSelector).prop("title", "Scouts" + (details.maxStrength ? ": " + details.damageText : ""));

				details = Astriarch.Fleet.Static.getStrengthDetailsForShips(lastKnownPlanetFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer]);
				Astriarch.View.ImageCanvasStarships.destroyer.drawShip(Astriarch.View.ColorsRGBA["green"], "");
				$(Astriarch.View.ImageCanvasStarships.destroyer.canvasSelector).prop("title", "Destroyers" + (details.maxStrength ? ": " + details.damageText : ""));

				details = Astriarch.Fleet.Static.getStrengthDetailsForShips(lastKnownPlanetFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser]);
				Astriarch.View.ImageCanvasStarships.cruiser.drawShip(Astriarch.View.ColorsRGBA["green"], "");
				$(Astriarch.View.ImageCanvasStarships.cruiser.canvasSelector).prop("title", "Cruisers" + (details.maxStrength ? ": " + details.damageText : ""));

				details = Astriarch.Fleet.Static.getStrengthDetailsForShips(lastKnownPlanetFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship]);
				Astriarch.View.ImageCanvasStarships.battleship.drawShip(Astriarch.View.ColorsRGBA["green"], "");
				$(Astriarch.View.ImageCanvasStarships.battleship.canvasSelector).prop("title", "Battleships" + (details.maxStrength ? ": " + details.damageText : ""));
				
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

Astriarch.View.updateSelectedItemPopulationPanel = function(population, maxPopulation) {
    var element = null;
	//clear out the appropriate ones
	for (var i = maxPopulation + 1; i <= 16; i++) {
        element = $("#PopulationImage" + i);
		element.attr("class","popImg");
        element.prop('title',"Planet Population: " + population.length + " / " + maxPopulation)
	}

	for (var i = 1; i <= maxPopulation; i++) {
        element = $("#PopulationImage" + i);
		if (i <= population.length){
			//check protest level of citizen, over 50% should show red, 0% show green, otherwise orange
			var citizen = population[i - 1];
			if(citizen.ProtestLevel == 0){
				element.attr("class","icon-10x16-PopulationSmallFilled");
				element.prop('title',"Planet Population: " + population.length + " / " + maxPopulation)
			} else if(citizen.ProtestLevel > 0.5){
				element.attr("class","icon-10x16-PopulationSmallFilled_red");
				element.prop("title", "Citizens Protesting at " + (Math.round(100 * citizen.ProtestLevel)) + "%");
			} else {
				element.attr("class","icon-10x16-PopulationSmallFilled_orange");
				element.prop("title", "Citizens Protesting at " + (Math.round(100 * citizen.ProtestLevel)) + "%");
			}

		}
		else {
			element.attr("class","icon-10x16-PopulationSmallEmpty");
            element.prop('title',"Planet Population: " + population.length + " / " + maxPopulation)
		}
	}
};

Astriarch.View.updateSelectedItemImprovementSlotsPanel = function(improvementCount, maxImprovements) {
	$('#SelectedItemImprovementSlotsPanel').attr("Title", "Planetary Improvements: " + improvementCount + " / " + maxImprovements);

	//clear out the appropriate ones
	for (var i = 1; i <= 9; i++)
	{
		$("#PlanetaryImprovementSlotsImage" + i).attr("class","impImg");
	}

	for (var i = 1; i <= maxImprovements; i++)
	{
		if (i <= improvementCount)
			$("#PlanetaryImprovementSlotsImage" + i).addClass("icon-16x16-PlanetaryImprovementSlotFilled");
		else
			$("#PlanetaryImprovementSlotsImage" + i).addClass("icon-16x16-PlanetaryImprovementSlotEmpty");
	}
};

Astriarch.View.updateSelectedItemPopulationAssignmentsPanel = function() {
	var farmerString = farmers == 1 ? " Farmer, " : " Farmers, ";
	var minerString = miners == 1 ? " Miner, " : " Miners, ";
	var workerString = workers == 1 ? " Builder" : " Builders";
	var tooltip = farmers + farmerString + miners + minerString + workers + workerString;
	$('#SelectedItemPopulationAssignmentsPanel').attr("Title", tooltip);

	//clear out the appropriate ones
	for (var i = 1; i <= 16; i++)
	{
		$("#PopulationAssignmentImage" + i).attr("class","asnImg");
	}

	for (var i = 1; i <= farmers; i++)
	{
		$("#PopulationAssignmentImage" + i).addClass("icon-10x16-Farmer");
	}

	for (var i = farmers + 1; i <= farmers + miners; i++)
	{
		$("#PopulationAssignmentImage" + i).addClass("icon-10x16-Miner");
	}

	for (var i = farmers + miners + 1; i <= farmers + miners + workers; i++)
	{
		$("#PopulationAssignmentImage" + i).addClass("icon-10x16-Builder");
	}
};

Astriarch.View.updateCanvasForPlayer = function() {
	var mainPlayer = Astriarch.ClientGameModel.MainPlayer;

	for (var i in Astriarch.View.DrawnPlanets)
	{
		Astriarch.View.DrawnPlanets[i].UpdatePlanetDrawingForPlayer(Astriarch.ClientGameModel);
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

Astriarch.View.loadBackgroundSpriteSheetImage = function() {

	var image = new Image();
	image.onload = function() {
		Astriarch.View.backgroundSpriteSheetImageLoaded();
	};
	image.src = "img/background-sprites.jpg";
	Astriarch.View.BackgroundSpriteSheetImage = image;
};

Astriarch.View.backgroundSpriteSheetImageLoaded = function() {
	var largeStars = Astriarch.View.populateStars();
	Astriarch.View.populateBackgroundImages();
	Astriarch.View.paintLargeStars(largeStars);
	Astriarch.View.drawBorder();
	
	//we have finished all the time consuming drawing and loading, hide spinner and show main interface
	$('#loadingSpinner').hide();
	$('#mainMenu').show();//finally show the main menu after everything else is loaded.

	var preStepCallback = function(index) { window.tour.enabled = true; window.tour.step = index; };
	var postStepCallback = function(index, tip){ };
	var preTutorialCallback = function(index, tip, elm){ };
	var postTutorialCallback = function(){ window.tour.enabled = false;};

	var jrTour = $("#joyRideTipContent").joyride({
		'scroll': false,
		'autoStart': true,
		'nextButton': false,
		'localStorage': true,
		'localStorageKey': 'seentutorial',
		'preStepCallback': preStepCallback,
		'postStepCallback': postStepCallback,
		'preRideCallback': preTutorialCallback,
		'postRideCallback': postTutorialCallback,
		pauseAfter:[27, 32, 43, 48, 49, 50, 51, 53, 54, 56, 59, 63, 66, 68]
	});
	window.tour.jqElm = $(jrTour);
};

Astriarch.View.populateBackgroundImages = function() {
	var RECT_WIDTH = 80.0;
    var RECT_HEIGHT = 60.0;
	
	var chanceTable = {};
	for(var i = 0; i < Astriarch.View.BACKGROUND_COUNT; i++) {
		chanceTable[i] = 100;
	}

	var rows = Math.floor(Astriarch.View.CanvasBackground[0].height / RECT_HEIGHT);
	var cols = Math.floor(Astriarch.View.CanvasBackground[0].width / RECT_WIDTH);

	for(var row = 0; row < rows; row += 2) {
		for(var col = 0; col < cols; col+=2) {
			if (Astriarch.NextRandom(0, 2) == 0) {
				var offsetY = Astriarch.NextRandom(0, Math.floor(RECT_HEIGHT));
				var offsetX = Astriarch.NextRandom(0, Math.floor(RECT_WIDTH));
				var imageIndex = Astriarch.View.pickRandomTile(chanceTable);
				
				//set image opacity
				Astriarch.View.ContextBackground.globalAlpha = Astriarch.NextRandom(70 - Astriarch.View.BACKGROUND_DARKNESS, 101 - Astriarch.View.BACKGROUND_DARKNESS) / 100.0;
				//use spritesheet co-ordinates:
				Astriarch.View.ContextBackground.drawImage(Astriarch.View.BackgroundSpriteSheetImage, 0, imageIndex * RECT_HEIGHT, RECT_WIDTH, RECT_HEIGHT, (col * RECT_WIDTH) + offsetX, (row * RECT_HEIGHT) + offsetY, RECT_WIDTH, RECT_HEIGHT);
			}
		}
	}

};

Astriarch.View.pickRandomTile = function(chanceTable) {
	
	var chanceSum = 1;
	for(var i in chanceTable) {
		chanceSum += chanceTable[i];
	}

	var pickedNumber = Astriarch.NextRandom(0, chanceSum);

	var currRangeLow = 0;

	var imageIndex = 0;
	for (var index in chanceTable) {
		var thisChance = chanceTable[index];
		if (pickedNumber < (thisChance + currRangeLow))	{
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
		$("#SpeakerIcon").removeClass("icon-16x16-speaker-on").addClass("icon-16x16-speaker-off");
		$("#ButtonSpeakerToggleMute > .ui-icon").removeClass("icon-16x16-speaker-on").addClass("icon-16x16-speaker-off");
	} else {
		$("#SpeakerIcon").removeClass("icon-16x16-speaker-off").addClass("icon-16x16-speaker-on");
		$("#ButtonSpeakerToggleMute > .ui-icon").removeClass("icon-16x16-speaker-off").addClass("icon-16x16-speaker-on");
	}
	
};

Astriarch.View.volumeSliderValueChanged = function(event, ui) {
	Astriarch.View.audioInterface.setVolume(ui.value);
};

Astriarch.View.openTradingCenter = function() {
	var cp = Astriarch.ClientGameModel.GameGrid.SelectedHex.ClientPlanetContainedInHex;//ClientPlanet
	var p = Astriarch.ClientGameModel.MainPlayer.GetPlanetIfOwnedByPlayer(cp.Id);
	if(p){
		Astriarch.TradingControl.show(p);
	}
};

/**
 * ImageCanvas represents a canvas that will draw an image with different colors
 * @constructor
 */
Astriarch.View.ImageCanvas = Class.extend({
	init: function(canvasSelector, imgFilename, width, height, colorRgbaArray, offsetY) {
		this.canvasSelector = canvasSelector;
		this.imgFilename = imgFilename;
		this.width = width;
		this.height = height;
		this.colorRgbaArray = colorRgbaArray || [];
		this.offsetY = offsetY || 0;//this is the offset for the image in the Spritesheet

		this.imageDataDefault = null;
		this.imageDataByColorRGBA = {};//indexed by ColorRGBA.toString(), value is image data []

		this.canvas = $(canvasSelector);
		this.ctx = this.canvas[0].getContext("2d");

		var self = this;

		var image = new Image();
		image.onload = function() {
			var uInt8ClampedArrayToArray = function(data) {
				var arr = [];
				for(var i in data) {
					arr.push(data[i]);
				}
				return arr;
			};
			self.ctx.drawImage(image, 0, offsetY, width, height, 0, 0, width, height);
			self.imageDataDefault = uInt8ClampedArrayToArray(self.ctx.getImageData(0, 0 , width, height).data);
			for(var i = 0; i < colorRgbaArray.length; i++) {
				var color = colorRgbaArray[i];
				self.imageDataByColorRGBA[color.toString()] = Astriarch.Util.ChangeImageColor(self.imageDataDefault, color);
			}
		};
		image.src = imgFilename;
	},

	draw: function(color) {
		this.ctx.clearRect(0, 0, this.canvas[0].width, this.canvas[0].height);

		var imageData = color ? this.imageDataByColorRGBA[color.toString()] : this.imageDataDefault;
		var canvasImgData = this.ctx.createImageData(this.width, this.height);
		for(var i in imageData) {
			canvasImgData.data[i] = imageData[i];
		}
		this.ctx.putImageData(canvasImgData, 0, 0);
	}
});

Astriarch.View.StarshipCanvas = Astriarch.View.ImageCanvas.extend({
	init: function (canvasSelector, imgFilename, width, height, colorRgbaArray, offsetY) {
		this._super(canvasSelector, imgFilename, width, height, colorRgbaArray, offsetY);//invoke base class constructor
	},

	drawShip: function(color, text) {
		this.draw(color);

		this.ctx.textAlign = "center";
		this.ctx.textBaseline = 'middle';
		this.ctx.fillStyle = color.toString();
		this.ctx.font = "bold 7pt Trebuchet MS,Tahoma,Verdana,Arial,sans-serif";
		this.ctx.fillText(text, this.width/2, this.canvas[0].height - 4);
	}
});

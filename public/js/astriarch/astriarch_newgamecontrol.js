Astriarch.NewGameControl = {
  GameCreator: true, //if the player created the game
  StarfieldCanvas: null,
  StarfieldCanvasContext: null,
  StarfieldCanvasSize: { w: 200, h: 170 },
  init: function() {
    this.StarfieldCanvas = document.getElementById("newGameControlStarfieldCanvas");
    this.StarfieldCanvasContext = this.StarfieldCanvas.getContext("2d");

    $("#GameNameTextBox").val(Astriarch.LocalStorageInterface.Prefs.gameName);
    $("#GameNameTextBox").change(function() {
      var name = $("#GameNameTextBox").val();
      Astriarch.LocalStorageInterface.Prefs.gameName = name;
      Astriarch.LocalStorageInterface.savePrefs();
      Astriarch.NewGameControl.changedGameOptions();
    });

    $("#PlayerNameTextBox").change(function() {
      var playerName = $(this).val();
      //also update the chat log area and local storage
      Astriarch.CommControl.setPlayerNameDivAndLocalStorageToNewName(playerName);
      var payload = { playerName: playerName };
      Astriarch.server_comm.sendMessage({ type: Astriarch.Shared.MESSAGE_TYPE.CHANGE_PLAYER_NAME, payload: payload });
    });

    $("select#NumberOfSystemsComboBox").selectmenu({
      width: 55,
      change: function(e, object) {
        Astriarch.NewGameControl.UpdateStartupOptionsBasedOnOpponentCount();
        Astriarch.NewGameControl.changedGameOptions();
      }
    });
    Astriarch.NewGameControl.buildPlanetsPerSystemComboBox(
      Astriarch.Model.PlanetsPerSystemOption.FOUR,
      Astriarch.Model.GalaxySizeOption.LARGE
    );

    $("select#GalaxySizeComboBox").selectmenu({
      width: 120,
      change: function(e, object) {
        Astriarch.NewGameControl.changedGalaxySize();
      }
    });

    $("input#DistributePlanetsEvenlyCheckBox").change(function() {
      Astriarch.NewGameControl.changedGameOptions();
    });

    $("input#QuickStartCheckBox").change(function() {
      Astriarch.NewGameControl.changedGameOptions();
    });

    $("select#TurnTimeLimitComboBox").selectmenu({
      width: 120,
      change: function(e, object) {
        Astriarch.NewGameControl.changedGameOptions();
      }
    });

    this.buildPlayerComboBoxes();

    $("#StartGameOptionsOkButton").button();
    $("#StartGameOptionsOkButton").click(function() {
      if (window.tour.enabled) {
        window.tour.jqElm.joyride("nextTip");
      }
      Astriarch.NewGameControl.SetupNewGame();
    });

    //Display the canvas representation
    var gameOptions = this.getSelectedGameOptions();
    this.drawGameOptionsRepresentationOnCanvas(gameOptions);
  },

  show: function() {
    $("#PlayerNameTextBox").val(Astriarch.LocalStorageInterface.Prefs.playerName);

    $("#startGameOptionsContainer").show();
  },

  buildPlayerComboBoxes: function(gameOptions) {
    var closedOption = '<option value="-2">Closed</option>';
    var openOption = '<option value="-1" selected="">Open</option>';
    var humanOption = '<option value="0" disabled="disabled">Human</option>';
    var computerOptions =
      '<option value="1">Easy Computer</option><option value="2">Normal Computer</option><option value="3">Hard Computer</option><option value="4">Expert Computer</option>';
    $("#Player2OptionsBox").html(
      '<select id="Player2ComboBox">' +
        openOption +
        (gameOptions && gameOptions.opponentOptions[0].type == 0 ? humanOption : "") +
        computerOptions +
        "</select>"
    );
    $("#Player3OptionsBox").html(
      '<select id="Player3ComboBox">' +
        closedOption +
        openOption +
        (gameOptions && gameOptions.opponentOptions[1].type == 0 ? humanOption : "") +
        computerOptions +
        "</select>"
    );
    $("#Player4OptionsBox").html(
      '<select id="Player4ComboBox">' +
        closedOption +
        openOption +
        (gameOptions && gameOptions.opponentOptions[2].type == 0 ? humanOption : "") +
        computerOptions +
        "</select>"
    );

    //jquery ui selectmenu
    //from https://github.com/fnagel/jquery-ui
    //also here: http://jquerystyle.com/2009/08/24/jquery-ui-selectmenu
    $("select#Player2ComboBox").selectmenu({
      width: 150,
      change: function(e, object) {
        Astriarch.NewGameControl.changedGameOptions();
      }
    });
    $("select#Player3ComboBox").selectmenu({
      width: 150,
      change: function(e, object) {
        Astriarch.NewGameControl.changedGameOptions();
      }
    });
    $("select#Player4ComboBox").selectmenu({
      width: 150,
      change: function(e, object) {
        Astriarch.NewGameControl.changedGameOptions();
      }
    });
  },

  buildPlanetsPerSystemComboBox: function(selectedPlanetsPerSystem, selectedGalaxySize) {
    selectedPlanetsPerSystem = selectedPlanetsPerSystem || Number($("select#PlanetsPerSystemComboBox").val());
    selectedGalaxySize = selectedGalaxySize || Number($("select#GalaxySizeComboBox").val());

    //rebuild planets per system dropdown, if SMALL then we shouldn't have > 6 an option
    var planetsPerSystemComboBoxOptions = "";
    for (var i = 4; i <= Astriarch.Model.PlanetsPerSystemOption.EIGHT; i++) {
      if (
        selectedGalaxySize == Astriarch.Model.GalaxySizeOption.SMALL &&
        i > Astriarch.Model.PlanetsPerSystemOption.SIX
      ) {
        break;
      }
      var selected = selectedPlanetsPerSystem == i ? ' selected="true"' : "";
      planetsPerSystemComboBoxOptions += '<option value="' + i + '"' + selected + ">" + i + "</option>";
    }
    $("#PlanetsPerSystemOptionsBox").html(
      '<select id="PlanetsPerSystemComboBox">' + planetsPerSystemComboBoxOptions + "</select>"
    );
    $("select#PlanetsPerSystemComboBox").selectmenu({
      width: 55,
      change: function(e, object) {
        Astriarch.NewGameControl.changedGameOptions();
      }
    });
  },

  UpdateStartupOptionsBasedOnOpponentCount: function() {
    var numberOfOpponents = Number($("select#NumberOfSystemsComboBox").val());
    $(".Player3Panel").hide();
    $(".Player4Panel").hide();

    if (numberOfOpponents >= 3) {
      $(".Player3Panel").show();
    } else {
      $("select#Player3ComboBox")
        .val("-2")
        .selectmenu("refresh");
    }
    if (numberOfOpponents >= 4) {
      $(".Player4Panel").show();
    } else {
      $("select#Player4ComboBox")
        .val("-2")
        .selectmenu("refresh");
    }
  },

  newGame: function(message) {
    //join the chat room for this game
    Astriarch.CommControl.joinChatRoom(Astriarch.LocalStorageInterface.Prefs.playerName, 1);

    if (message) {
      //this happens when the game creator re-joins, we have to refresh the controls to the saved game options
      Astriarch.NewGameControl.OnGameOptionsChanged(message);
    }
  },

  joinGame: function(message) {
    Astriarch.NewGameControl.GameCreator = false;

    $("#GameNameTextBox")
      .parent()
      .html('<span id="GameNameValue"></span>');

    $("select#NumberOfSystemsComboBox")
      .parent()
      .html('<span id="NumberOfSystemsValue"></span>');
    $("select#PlanetsPerSystemComboBox")
      .parent()
      .html('<span id="PlanetsPerSystemValue"></span>');

    $("select#GalaxySizeComboBox")
      .parent()
      .html('<span id="GalaxySizeValue"></span>');

    $("input#DistributePlanetsEvenlyCheckBox")
      .parent()
      .html('<span id="DistributePlanetsEvenlyValue"></span>');
    $("input#QuickStartCheckBox")
      .parent()
      .html('<span id="QuickStartValue"></span>');
    $("select#TurnTimeLimitComboBox")
      .parent()
      .html('<span id="TurnTimeLimitValue"></span>');

    $("select#Player2ComboBox")
      .parent()
      .html('<span id="Player2NamePanel"></span>');
    $("select#Player3ComboBox")
      .parent()
      .html('<span id="Player3NamePanel"></span>');
    $("select#Player4ComboBox")
      .parent()
      .html('<span id="Player4NamePanel"></span>');
    $("#StartGameOptionsOkButton").remove();

    Astriarch.NewGameControl.OnGameOptionsChanged(message);

    //join the chat room for this game
    Astriarch.CommControl.joinChatRoom(
      Astriarch.LocalStorageInterface.Prefs.playerName,
      message.payload.playerPosition + 1
    );
  },

  changedGalaxySize: function() {
    Astriarch.NewGameControl.buildPlanetsPerSystemComboBox();

    Astriarch.NewGameControl.changedGameOptions();
  },

  changedGameOptions: function() {
    var gameOptions = this.getSelectedGameOptions();
    var name = $("#GameNameTextBox").val();
    this.drawGameOptionsRepresentationOnCanvas(gameOptions);

    Astriarch.server_comm.sendMessage({
      type: Astriarch.Shared.MESSAGE_TYPE.CHANGE_GAME_OPTIONS,
      payload: { gameOptions: gameOptions, name: name }
    });

    if (
      window.tour.enabled &&
      ((gameOptions.systemsToGenerate == 2 && window.tour.step == 3) ||
        (gameOptions.opponentOptions[0].type == 1 && window.tour.step == 4))
    ) {
      window.tour.jqElm.joyride("nextTip");
    }
  },

  OnGameOptionsChanged: function(message) {
    var gameOptions = message.payload.gameOptions;
    this.drawGameOptionsRepresentationOnCanvas(gameOptions);

    //refresh view with new game options
    if (!Astriarch.NewGameControl.GameCreator) {
      $("#GameNameValue").text(message.payload.name);

      $("#NumberOfSystemsValue").text(gameOptions.systemsToGenerate);
      $("#PlanetsPerSystemValue").text(gameOptions.planetsPerSystem);

      $("#GalaxySizeValue").text(
        gameOptions.galaxySize == Astriarch.Model.GalaxySizeOption.LARGE
          ? "Large"
          : gameOptions.galaxySize == Astriarch.Model.GalaxySizeOption.MEDIUM
            ? "Medium"
            : "Small"
      );

      $("#DistributePlanetsEvenlyValue").text("Distribute Planets Evenly: " + gameOptions.distributePlanetsEvenly);
      $("#QuickStartValue").text("Quick Start: " + gameOptions.quickStart);

      var turnTimeLimitMinutes = gameOptions.turnTimeLimitSeconds / 60;
      $("#TurnTimeLimitValue").text(
        "Turn Time Limit: " +
          (turnTimeLimitMinutes == 0
            ? "None"
            : turnTimeLimitMinutes < 1
              ? gameOptions.turnTimeLimitSeconds + " Seconds"
              : turnTimeLimitMinutes == 1
                ? "1 Minute"
                : turnTimeLimitMinutes + " Minutes")
      );

      $("#Player1NamePanel").text(gameOptions.mainPlayerName);
      $("#Player2NamePanel").text(Astriarch.GameTools.OpponentOptionToFriendlyString(gameOptions.opponentOptions[0]));
      $("#Player3NamePanel").text(Astriarch.GameTools.OpponentOptionToFriendlyString(gameOptions.opponentOptions[1]));
      $("#Player4NamePanel").text(Astriarch.GameTools.OpponentOptionToFriendlyString(gameOptions.opponentOptions[2]));
    } else {
      $("#GameNameTextBox").val(message.payload.name);

      $("select#NumberOfSystemsComboBox")
        .val(gameOptions.systemsToGenerate)
        .selectmenu("refresh");
      Astriarch.NewGameControl.buildPlanetsPerSystemComboBox(
        gameOptions.planetsPerSystem,
        gameOptions.systemsToGenerate
      );

      $("select#GalaxySizeComboBox")
        .val(gameOptions.galaxySize)
        .selectmenu("refresh");

      $("input#DistributePlanetsEvenlyCheckBox").prop("checked", gameOptions.distributePlanetsEvenly);
      $("input#QuickStartCheckBox").prop("checked", gameOptions.distributePlanetsEvenly);

      $("select#TurnTimeLimitComboBox")
        .val(gameOptions.turnTimeLimitSeconds)
        .selectmenu("refresh");

      Astriarch.NewGameControl.UpdateStartupOptionsBasedOnOpponentCount();
      Astriarch.NewGameControl.buildPlayerComboBoxes(gameOptions);
      //we get this message for player name changes and joins also
      for (var i = 0; i < gameOptions.opponentOptions.length; i++) {
        var opponent = gameOptions.opponentOptions[i];
        var selectId = "select#Player" + (i + 2) + "ComboBox";
        $(selectId)
          .val(opponent.type)
          .selectmenu("refresh");
        if (opponent.type == 0) {
          $("#Player" + (i + 2) + "OptionsBox").hide();
          $("#Player" + (i + 2) + "NamePanel").text(opponent.name);
          //TODO: Add Kick button for GameCreator
        }
      }
    }
    var playerSessions = [{ playerName: gameOptions.mainPlayerName, playerNumber: 1, dateJoined: new Date() }];
    for (var i = 0; i < gameOptions.opponentOptions.length; i++) {
      if (gameOptions.opponentOptions[i].type >= 0) {
        playerSessions.push({
          playerName: gameOptions.opponentOptions[i].name,
          playerNumber: i + 2,
          dateJoined: new Date()
        });
      }
    }

    Astriarch.CommControl.setPlayerSessions(playerSessions);
  },

  getSelectedGameOptions: function() {
    var opponentOptions = [];
    var playerName = $("#PlayerNameTextBox").val();
    if (playerName == null || $.trim(playerName) == "") playerName = "Player";

    //NOTE: difficulty Combobox values correspond to Astriarch.Player.PlayerType 'enum' values (with -1 meaning closed)
    opponentOptions.push({ name: $("#Player2NamePanel").text(), type: Number($("select#Player2ComboBox").val()) });
    opponentOptions.push({ name: $("#Player3NamePanel").text(), type: Number($("select#Player3ComboBox").val()) });
    opponentOptions.push({ name: $("#Player4NamePanel").text(), type: Number($("select#Player4ComboBox").val()) });

    var systemsToGenerate = Number($("select#NumberOfSystemsComboBox").val());
    //NOTE: systems to generate combobox values correspond to Astriarch.Model.PlanetsPerSystemOption 'enum' values
    var planetsPerSystem = Number($("select#PlanetsPerSystemComboBox").val());

    var galaxySize = Number($("select#GalaxySizeComboBox").val());

    var distributePlanetsEvenly = true;
    if (!$("#DistributePlanetsEvenlyCheckBox").attr("checked")) {
      distributePlanetsEvenly = false;
    }

    var quickStart = false;
    if ($("#QuickStartCheckBox").attr("checked")) {
      quickStart = true;
    }

    var turnTimeLimitSeconds = Number($("select#TurnTimeLimitComboBox").val());

    var gameOptions = {
      mainPlayerName: playerName,
      opponentOptions: opponentOptions,
      systemsToGenerate: systemsToGenerate,
      planetsPerSystem: planetsPerSystem,
      galaxySize: galaxySize,
      distributePlanetsEvenly: distributePlanetsEvenly,
      quickStart: quickStart,
      turnTimeLimitSeconds: turnTimeLimitSeconds
    };
    return gameOptions;
  },

  SetupNewGame: function() {
    //get selected game options
    var gameOptions = this.getSelectedGameOptions();

    var playerCount = 1;
    for (var i in gameOptions.opponentOptions) {
      if (gameOptions.opponentOptions[i].type >= 0) {
        playerCount++;
      }
    }

    AstriarchExtern.OnGameStart({
      Players: playerCount,
      PlanetsPerSystem: gameOptions.planetsPerSystem,
      Systems: gameOptions.systemsToGenerate
    });
    Astriarch.server_comm.sendMessage({ type: Astriarch.Shared.MESSAGE_TYPE.START_GAME, payload: gameOptions });
  },

  OnGameStartMessageResponse: function(message) {
    Astriarch.GameController.gameOver = false;

    $("#startGameOptionsContainer").hide();

    Astriarch.GameController.ResetView(message.payload);
  },

  drawGameOptionsRepresentationOnCanvas: function(gameOptions) {
    var width = this.StarfieldCanvasSize.w;
    var halfWidth = width / 2;
    var height = this.StarfieldCanvasSize.h;
    var halfHeight = height / 2;
    this.StarfieldCanvasContext.clearRect(0, 0, width, height);

    for (var i = 0; i < gameOptions.systemsToGenerate; i++) {
      var x = 0;
      var y = 0;
      if ((gameOptions.systemsToGenerate == 2 && i == 1) || (gameOptions.systemsToGenerate == 4 && i == 2)) {
        x = halfWidth;
        y = halfHeight;
      } else if ((gameOptions.systemsToGenerate == 3 || gameOptions.systemsToGenerate == 4) && i == 1) {
        x = halfWidth;
      } else if (gameOptions.systemsToGenerate == 3 && i == 2) {
        x = width / 4;
        y = halfHeight;
      } else if (gameOptions.systemsToGenerate == 4 && i == 3) {
        y = halfHeight;
      }

      // set up gradient
      var radialGradient = this.StarfieldCanvasContext.createRadialGradient(
        x + halfWidth / 2,
        y + halfHeight / 2,
        0,
        x + halfWidth / 2,
        y + halfHeight / 2,
        this.StarfieldCanvasSize.h / 4
      );

      var color = Astriarch.View.Colors[0]; //white
      if (i == 0 || gameOptions.opponentOptions[i - 1].type >= 0) {
        color = Astriarch.Model.PlayerColors[i];
      }

      radialGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      radialGradient.addColorStop(0.9, color);
      radialGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      // draw gradient
      this.StarfieldCanvasContext.fillStyle = radialGradient;
      this.StarfieldCanvasContext.fillRect(x, y, halfWidth, halfHeight);
    }
  }
};

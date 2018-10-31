Astriarch.LobbyControl = {
  GamesAvailableListBox: null,
  init: function() {
    $("#NewSkirmishGameButton").button();
    $("#NewSkirmishGameButton").click(function() {
      if (window.tour.enabled) {
        window.tour.jqElm.joyride("nextTip");
      }

      //Send a create game message
      //every time the game name is changed we save it to local storage so we can use it next time?
      Astriarch.server_comm.sendMessage({
        type: Astriarch.Shared.MESSAGE_TYPE.CREATE_GAME,
        payload: {
          name: Astriarch.LocalStorageInterface.Prefs.gameName,
          playerName: Astriarch.LocalStorageInterface.Prefs.playerName
        }
      });
    });

    this.GamesAvailableListBox = new JSListBox({
      containerSelector: "GamesAvailableListBox",
      stylemap: { border: "none", background: "none" }
    });

    $("#GameSelectedPanel").hide();

    $("#JoinGameButton").button();
    $("#JoinGameButton").button("disable");
    $("#JoinGameButton").click(function() {
      var selectedGameLBI = Astriarch.LobbyControl.GamesAvailableListBox.SelectedItem;
      if (selectedGameLBI) {
        Astriarch.GameId = selectedGameLBI.GameInfo["_id"];
        if (selectedGameLBI.GameInfo.started) {
          //Send a resume game message
          Astriarch.server_comm.sendMessage({ type: Astriarch.Shared.MESSAGE_TYPE.RESUME_GAME });
        } else {
          //Send a join game message
          Astriarch.server_comm.sendMessage({
            type: Astriarch.Shared.MESSAGE_TYPE.JOIN_GAME,
            payload: { playerName: Astriarch.LocalStorageInterface.Prefs.playerName }
          });
        }
      }
    });
  },

  OnGameResumeMessageResponse: function(message) {
    Astriarch.CommControl.joinChatRoom(
      Astriarch.LocalStorageInterface.Prefs.playerName,
      message.payload.playerPosition + 1
    );

    $("#mainMenu").hide();

    Astriarch.GameController.ResetView(message.payload.gameData);
  },

  OnGameJoinMessageResponse: function(message) {
    Astriarch.GameId = message.payload["_id"];
    if (message.payload["playerPosition"]) {
      Astriarch.NewGameControl.joinGame(message);
    } else {
      //this was the game creator re-joining
      Astriarch.NewGameControl.newGame(message);
    }

    $("#mainMenu").hide();

    Astriarch.View.ShowNewGameOptions();
  },

  OnGameCreateMessageResponse: function(message) {
    Astriarch.GameId = message.payload;
    Astriarch.NewGameControl.newGame();

    $("#mainMenu").hide();
    Astriarch.View.ShowNewGameOptions();
  },

  refreshGameList: function(message) {
    Astriarch.LobbyControl.GamesAvailableListBox.clear();
    var listBoxItems = [];

    if (message.payload && message.payload.length) {
      for (var i in message.payload) {
        var galbi = new Astriarch.LobbyControl.GamesAvailableListBoxItem(message.payload[i]);
        listBoxItems.push(galbi);
      }
    }

    Astriarch.LobbyControl.GamesAvailableListBox.addItems(listBoxItems);
  },

  updateGameList: function(message) {
    var itemFound = false;
    for (var i = 0; i < Astriarch.LobbyControl.GamesAvailableListBox.items.length; i++) {
      var item = Astriarch.LobbyControl.GamesAvailableListBox.items[i];
      if (item.GameInfo["_id"] == message.payload["_id"]) {
        item.GameInfo = message.payload;
        item.value = message.payload.name;
        Astriarch.LobbyControl.GamesAvailableListBox.refresh();
        itemFound = true;
        break;
      }
    }
    if (!itemFound) {
      Astriarch.LobbyControl.GamesAvailableListBox.addItem(
        new Astriarch.LobbyControl.GamesAvailableListBoxItem(message.payload)
      );
    }
  },

  GamesAvailableSelectionChanged: function() {
    if (Astriarch.LobbyControl.GamesAvailableListBox.SelectedItem) {
      $("#JoinGameButton").button("enable");
      $("#GameSelectedPanel").show();

      //refresh Selected Game Details:
      var gameInfo = Astriarch.LobbyControl.GamesAvailableListBox.SelectedItem.GameInfo;
      var gameOptions = gameInfo.gameOptions;

      $("#GameSelectedName").text(gameInfo.name);
      $("#GameSelectedHostName").text("Host: " + gameOptions.mainPlayerName);
      $("#GameSelectedPlayerSummary").text(gameInfo.players.length + "/" + gameOptions.systemsToGenerate + " Players");
      $("#GameSelectedPlayer2Details").text(
        Astriarch.LobbyControl.GetOpponentSummaryText(gameOptions.opponentOptions[0])
      );
      $("#GameSelectedPlayer3Details").text(
        Astriarch.LobbyControl.GetOpponentSummaryText(gameOptions.opponentOptions[1])
      );
      $("#GameSelectedPlayer4Details").text(
        Astriarch.LobbyControl.GetOpponentSummaryText(gameOptions.opponentOptions[2])
      );
      $("#GameSelectedNumberOfSystems").text(gameOptions.systemsToGenerate + " Systems");
      $("#GameSelectedPlanetsPerSystem").text(gameOptions.planetsPerSystem + " Planets per System");
      $("#GameSelectedDateCreated").text("Created At: " + new Date(gameInfo.dateCreated).toLocaleString());
      $("#GameSelectedDateLastPlayed").text("Last Played: " + new Date(gameInfo.dateLastPlayed).toLocaleString());

      //$("#GameSelectedDetails").text(JSON.stringify(Astriarch.LobbyControl.GamesAvailableListBox.SelectedItem.GameInfo));
      if (gameInfo.started) {
        $("#JoinGameButton").button("option", "label", "Resume Game");
      } else {
        $("#JoinGameButton").button("option", "label", "Join Game");
      }
    } else {
      $("#GameSelectedPanel").hide();
      $("#JoinGameButton").button("disable");
    }
  },

  GetOpponentSummaryText: function(opponentOption) {
    var playerType = Astriarch.GameTools.OpponentOptionToFriendlyString(opponentOption);
    return playerType;
  }
};

/**
 * A GamesAvailableListBoxItem is one of the items shown in the lobby of current games
 * @constructor
 */
Astriarch.LobbyControl.GamesAvailableListBoxItem = JSListBox.Item.extend({
  /**
   * initializes the GamesAvailableListBoxItem
   * @this {Astriarch.GameController.GamesAvailableListBoxItem}
   */
  init: function(/* GameInfo */ gameInfo) {
    this.value = gameInfo.name; //what is shown in the item
    this.Foreground = null;
    this.GameInfo = gameInfo;
  },

  /**
   * renders the GamesAvailableListBoxItem
   * @this {Astriarch.GameController.GamesAvailableListBoxItem}
   * @return {string}
   */
  render: function() {
    return '<a href="#" style="color:' + this.Foreground + '">' + this.value + "</a>"; //this allows painting to be overridden in classes which extend JSListBox.Item
  },

  /**
   * fires the GamesAvailableListBoxItem click event
   * @this {Astriarch.GameController.GamesAvailableListBoxItem}
   */
  onClick: function() {
    Astriarch.LobbyControl.GamesAvailableSelectionChanged();
  },

  /**
   * fires the GamesAvailableListBoxItem double click event
   * @this {Astriarch.GameController.GamesAvailableListBoxItem}
   */
  onDblClick: function() {}
});

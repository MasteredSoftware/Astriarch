var Astriarch = Astriarch || {};

Astriarch.server_comm = {
  ws: null,
  registeredListeners: {}, //key is messagetype, value is array of callbacks
  messageQueue: [],
  pingFreq: 30000,
  pingInterval: null,
  reconnecting: false,

  init: function(serverConfig) {
    var self = this;
    this.pingFreq = serverConfig.ping_freq || 30000;
    var host = window.document.location.host.replace(/:.*/, "");
    var portString = !serverConfig.port ? "" : ":" + serverConfig.port;
    // https://github.com/joewalnes/reconnecting-websocket
    this.ws = new ReconnectingWebSocket((serverConfig.ws_protocol || "ws") + "://" + host + portString, null, {
      debug: true
    });
    this.ws.onmessage = this.receivedMessage;
    this.ws.onclose = function(e) {
      console.log("onclose:", e, arguments);
      // ReconnectingWebSocket will try to reconnect automatically...
      self.reconnecting = true;
      $("#loadingSpinner").show();
      // TODO: show some sort of error if we eventually give up
      // new Astriarch.Alert(
      //   "Connection Lost",
      //   '<span style="color:red">Communication with the server was interrupted, please refresh the browser and reconnect to your game to continue playing.</span>'
      // );
    };
    this.ws.onerror = function(e) {
      console.log("onerror:", e, arguments);
      new Astriarch.Alert(
        "Server Connection Error",
        '<span style="color:red">An error was detected when connecting to the server.</span>'
      );
    };
    this.ws.onopen = function(e) {
      console.log("onopen:", e, arguments);
      if (self.reconnecting) {
        $("#loadingSpinner").hide();
        if (!Astriarch.GameId) {
          Astriarch.View.ShowMainMenu();
        } else if (Astriarch.GameStarted) {
          self.sendMessage({ type: Astriarch.Shared.MESSAGE_TYPE.RESUME_GAME });
        } else {
          self.sendMessage({
            type: Astriarch.Shared.MESSAGE_TYPE.JOIN_GAME,
            payload: { playerName: Astriarch.LocalStorageInterface.Prefs.playerName }
          });
        }
        self.reconnecting = false;
      }
      for (var i = 0; i < self.messageQueue.length; i++) {
        self.ws.send(JSON.stringify(self.messageQueue[i]));
      }
      self.messageQueue = [];
    };

    for (var mt in Astriarch.Shared.MESSAGE_TYPE) {
      this.registeredListeners[Astriarch.Shared.MESSAGE_TYPE[mt]] = [];
    }
  },

  sendMessage: function(message) {
    message.payload = message.payload || {};
    message.payload.gameId = Astriarch.GameId;
    if (this.ws.readyState == 1) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.pingInterval = setInterval(function() {
      Astriarch.server_comm.sendMessage({ type: Astriarch.Shared.MESSAGE_TYPE.PING, payload: {} });
    }, this.pingFreq);
  },

  receivedMessage: function(event) {
    if (event.data) {
      //console.log("Event Data: ", event.data);
      var messageData = { type: -1 }; //ERROR
      try {
        messageData = JSON.parse(event.data);
      } catch (err) {
        console.error("Error parsing message: ", err, event.data);
      }

      if (Astriarch.server_comm.registeredListeners.hasOwnProperty(messageData.type)) {
        for (var i = 0; i < Astriarch.server_comm.registeredListeners[messageData.type].length; i++) {
          Astriarch.server_comm.registeredListeners[messageData.type][i](messageData);
        }
      } else {
        console.warn("Message type not registered: ", messageData.type);
      }
    } else {
      console.log("receivedMessage without Data: ", event);
    }
  },

  register: function(messageType, callback) {
    if (messageType in this.registeredListeners) {
      this.registeredListeners[messageType].push(callback);
    } else {
      console.warn("Message type not registered: ", messageType);
    }
  }
};

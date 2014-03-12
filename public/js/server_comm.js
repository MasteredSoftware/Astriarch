var Astriarch = Astriarch || {};

Astriarch.server_comm = {
	ws:null,
	registeredListeners:{},//key is messagetype, value is array of callbacks
	messageQueue: [],

	init: function(port){
		var host = window.document.location.host.replace(/:.*/, '');
		var portString = !port  ? "" : ":" + port;
		this.ws = new WebSocket('ws://' + host + portString);
		this.ws.onmessage = this.receivedMessage;

		for(var mt in Astriarch.Shared.MESSAGE_TYPE){
			this.registeredListeners[Astriarch.Shared.MESSAGE_TYPE[mt]] = [];
		}
	},

	sendMessage: function(message){
		message.payload = message.payload || {};
		message.payload.gameId = Astriarch.GameId;
		if(this.ws.readyState == 1){
			this.ws.send(JSON.stringify(message));
		} else {
			this.messageQueue.push(message);
			this.ws.onopen = function(e){
				for(var i = 0; i < Astriarch.server_comm.messageQueue.length; i++){
					Astriarch.server_comm.ws.send(JSON.stringify(Astriarch.server_comm.messageQueue[i]));
				}
				Astriarch.server_comm.messageQueue = [];
			}
		}
	},

	receivedMessage: function(event){
		if(event.data){
			//console.log("Event Data: ", event.data);
			var messageData = {"type":-1};//ERROR
			try{
				messageData = JSON.parse(event.data);
			} catch (err){
				console.error("Error parsing message: ", err, event.data);
			}

			if(Astriarch.server_comm.registeredListeners.hasOwnProperty(messageData.type)){
				for(var i=0; i < Astriarch.server_comm.registeredListeners[messageData.type].length; i++){
					Astriarch.server_comm.registeredListeners[messageData.type][i](messageData);
				}
			} else {
				console.warn("Message type not registered: ", messageData.type);
			}

		} else {
			console.log("receivedMessage without Data: ", event);
		}
	},

	register: function(messageType, callback){
		if(messageType in this.registeredListeners){
			this.registeredListeners[messageType].push(callback);
		} else {
			console.warn("Message type not registered: ", messageType);
		}
	}
};

var Astriarch = Astriarch || require('./astriarch_base');

Astriarch.ClientModelInterface = {
	GetClientModelFromSerializableClientModel: function(scm, gameGrid){

		var planetsById = {};
		for(var sp in scm.MainPlayerOwnedSerializablePlanets) {
			var planet = Astriarch.SavedGameInterface.getPlanetFromSerializedPlanet(scm.MainPlayerOwnedSerializablePlanets[sp], gameGrid);
			planetsById[planet.Id] = planet;
		}

		var clientPlayersById = {};
		var clientPlayers = [];
		for(var plr in scm.SerializableClientPlayers){
			var cp = this.GetClientPlayerFromSerializableClientPlayer(scm.SerializableClientPlayers[plr]);
			clientPlayers.push(cp);
			clientPlayersById[cp.Id] = cp;
		}

		var clientPlanetsById = {};
		var clientPlanets = [];
		for(var pla in scm.SerializableClientPlanets){
			var clientPlanet = this.GetClientPlanetFromSerializableClientPlanet(scm.SerializableClientPlanets[pla], gameGrid);
			clientPlanets.push(clientPlanet);
			clientPlanetsById[clientPlanet.Id] = clientPlanet;
		}

		var mainPlayer = Astriarch.SavedGameInterface.getPlayerFromSerializedPlayer(gameGrid, scm.SerializableMainPlayer, planetsById, clientPlanetsById);

		Astriarch.SavedGameInterface.setPlayerLastKnownPlanetFleetStrength(mainPlayer, scm.SerializableMainPlayer, gameGrid, clientPlayersById);

		return new Astriarch.ClientModel(scm.TurnNumber, mainPlayer, clientPlayers, clientPlanets, scm.ClientTradingCenter, gameGrid, scm.Options);
	},

	GetClientPlayerFromSerializableClientPlayer: function(scp){
		var color = new Astriarch.Util.ColorRGBA(scp.Color.r, scp.Color.g, scp.Color.b, scp.Color.a);
		return new Astriarch.ClientPlayer(scp.Id, scp.Type, scp.Name, color, scp.Points);
	},

	GetClientPlanetFromSerializableClientPlanet: function(scp, gameGrid){
		return new Astriarch.ClientPlanet(scp.Id, scp.Name, scp.OriginPoint, gameGrid, null, scp.Type);
	},

	GetTurnEventMessageFromSerializableTurnEventMessage:function(stem, gameGrid){
		var cp = null;
		if(stem.SerializableClientPlanet){
			cp = Astriarch.ClientModelInterface.GetClientPlanetFromSerializableClientPlanet(stem.SerializableClientPlanet, gameGrid);
		}
		var tem = new Astriarch.TurnEventMessage(stem.Type, cp, stem.Message);
		if(stem.Data){
			console.log("GetTurnEventMessageFromSerializableTurnEventMessage:", stem.Data);
			//convert SerializablePlanetaryConflictData to PlanetaryConflictData
			var defendingCP = null;
			if(stem.Data.DefendingSerializableClientPlayer){
				defendingCP = Astriarch.ClientModelInterface.GetClientPlayerFromSerializableClientPlayer(stem.Data.DefendingSerializableClientPlayer);
			}
			var defendingFleet = Astriarch.SavedGameInterface.getFleetFromSerializableFleet(defendingCP, stem.Data.DefendingSerializableFleet, gameGrid);
			var attackingCP = Astriarch.ClientModelInterface.GetClientPlayerFromSerializableClientPlayer(stem.Data.AttackingSerializableClientPlayer);
			var attackingFleet = Astriarch.SavedGameInterface.getFleetFromSerializableFleet(attackingCP, stem.Data.AttackingSerializableFleet, gameGrid);
			tem.Data = new Astriarch.TurnEventMessage.PlanetaryConflictData(defendingCP, defendingFleet, attackingCP, attackingFleet);
			//copy other properties not in constructor
			tem.Data.WinningFleet = Astriarch.SavedGameInterface.getFleetFromSerializableFleet(null, stem.Data.WinningSerializableFleet, gameGrid);
			tem.Data.AttackingFleetChances = stem.Data.AttackingFleetChances;//percentage chance the attacking fleet will win
			tem.Data.GoldAmountLooted = stem.Data.GoldAmountLooted;//if there was gold looted from the planet
			tem.Data.OreAmountLooted = stem.Data.OreAmountLooted;//if there was ore looted from the planet
			tem.Data.IridiumAmountLooted = stem.Data.IridiumAmountLooted;//if there was Iridium looted from the planet
			tem.Data.FoodAmountLooted = stem.Data.FoodAmountLooted;//if there was Food looted from the planet
		}
		return tem;
	}
};

Astriarch.ClientModel = function(turnNumber, mainPlayer, clientPlayers, clientPlanets, clientTradingCenter, gameGrid, options){
	this.Turn = new Astriarch.Model.Turn();
	this.Turn.Number = turnNumber;

	this.MainPlayer = mainPlayer;//Astriarch.Player
	this.ClientPlayers = clientPlayers;
	this.ClientPlanets = clientPlanets;

	this.ClientTradingCenter = clientTradingCenter;

	this.GameGrid = gameGrid;

	this.Options = options || {"TurnTimeLimitSeconds":0};
};

Astriarch.ClientModel.prototype.getClientPlanetById = function(id){
	for(var i = 0; i < this.ClientPlanets.length; i++){
		if(this.ClientPlanets[i].Id == id){
			return this.ClientPlanets[i];
		}
	}
	return null;
};

Astriarch.ClientPlayer = function(id, playerType, name, color, points){
	this.Id = id;
	this.Type = playerType;//PlayerType
	this.Name = name;
	this.Color = color;
	this.Points = points;
};

Astriarch.ClientPlanet = function(id, name, originPoint, gameGrid, boundingHex, type){
	this.Id = id;
	this.Name = name;
	this.OriginPoint = originPoint;
	if(gameGrid) {
		this.BoundingHex = gameGrid.GetHexAt(originPoint);
	} else {
		this.BoundingHex = boundingHex;
	}
	this.BoundingHex.ClientPlanetContainedInHex = this;

	this.Type = type; //NOTE: Populated when the main player explores the planet
};

Astriarch.ClientTradingCenter = function(goldAmount, foodResource, oreResource, iridiumResource, clientPlayerTrades){
	this.goldAmount = goldAmount;
	this.foodResource = foodResource;
	this.oreResource = oreResource;
	this.iridiumResource = iridiumResource;

	this.clientPlayerTrades = clientPlayerTrades;
};

Astriarch.SerializableClientModel = function(turnNumber, serializableMainPlayer, serializableClientPlayers, serializableClientPlanets, mainPlayerOwnedSerializablePlanets, clientTradingCenter, options){
	this.TurnNumber = turnNumber;

	this.SerializableMainPlayer = serializableMainPlayer;//Astriarch.SerializablePlayer
	this.SerializableClientPlayers = serializableClientPlayers;
	this.SerializableClientPlanets = serializableClientPlanets;

	//we need serializable planets for the main player's owned planets, so that we can reconstruct the main player without sending all the serializable planet objects
	this.MainPlayerOwnedSerializablePlanets = mainPlayerOwnedSerializablePlanets; //Dictionary<int, SerializablePlanet>

	this.ClientTradingCenter = clientTradingCenter;

	this.Options = options || {"TurnTimeLimitSeconds":0};
};

Astriarch.SerializableClientPlayer = function(id, playerType, name, color, points){
	this.Id = id;
	this.Type = playerType;//PlayerType
	this.Name = name;
	this.Color = color;
	this.Points = points;
};

Astriarch.SerializableClientPlanet = function(id, name, originPoint, type){
	this.Id = id;
	this.Name = name;
	this.OriginPoint = originPoint;
	this.Type = type;
};

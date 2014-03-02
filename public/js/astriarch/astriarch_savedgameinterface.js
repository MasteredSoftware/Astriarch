var Astriarch = Astriarch || require('./astriarch_base');

var require = require || (function(){});

var extend = typeof(jQuery) != "undefined" ? jQuery.extend : require('extend');

/**
 * Saved Game allows serialization and deserialization of the models
 */
Astriarch.SavedGameInterface = {

};


Astriarch.SavedGameInterface.findCircularReferences = function(obj, keyName, parentKeyName, hash){
	if(!hash)
		hash = [];

	if(obj == null || typeof(obj) != 'object')
		return;

	if(hash.indexOf(obj) == -1)
	{
		hash.push(obj);
	}
	else
		alert("found circular reference: " + parentKeyName + "." + keyName);

	for(var key in obj)
		Astriarch.SavedGameInterface.findCircularReferences(obj[key], key, keyName, hash);
	return;

};

Astriarch.SavedGameInterface.getModelFromSerializableModel = function(/*Astriarch.SerializableModel*/ serializedModel){
	
	var players = [];
	//first generate a 'stub' model so we have a grid
	var options = {systemsToGenerate: serializedModel.SystemsToGenerate,
			planetsPerSystem: serializedModel.PlanetsPerSystem,
			distributePlanetsEvenly: serializedModel.DistributePlanetsEvenly,
			turnTimeLimitSeconds: serializedModel.TurnTimeLimitSeconds};
	var newModel = new Astriarch.Model(/*List<Player>*/ players, options, true);
	newModel.ShowUnexploredPlanetsAndEnemyPlayerStats = serializedModel.ShowUnexploredPlanetsAndEnemyPlayerStats;
	newModel.Turn = extend(true, newModel.Turn, serializedModel.Turn);
	
	var planets = [];
	var planetsById = {};//id:planet
	for(var i in serializedModel.SerializablePlanets)
	{
		var sp = serializedModel.SerializablePlanets[i];

		var p = Astriarch.SavedGameInterface.getPlanetFromSerializedPlanet(sp, newModel.GameGrid);
		
		planets.push(p);
		planetsById[p.Id] = p;
	}
	
	//remake players
	for(var i in serializedModel.SerializablePlayers)
	{
		players.push(Astriarch.SavedGameInterface.getPlayerFromSerializedPlayer(newModel.GameGrid, serializedModel.SerializablePlayers[i], planetsById));
	}

	var playersById = {};
	var clientPlayersById = {};
	for(var i in players)
	{
		var player = players[i];
		playersById[player.Id] = player;
		clientPlayersById[player.Id] = new Astriarch.ClientPlayer(player.Id, player.Type, player.Name, player.Color);
	}
	
	//look for serializable destroyed players
	for(var i in serializedModel.SerializablePlayersDestroyed)
	{
		var sp = serializedModel.SerializablePlayersDestroyed[i];
		var player = Astriarch.SavedGameInterface.getPlayerFromSerializedPlayer(newModel.GameGrid, sp, planetsById);
		newModel.PlayersDestroyed.push(player);
		playersById[player.Id] = player;
		clientPlayersById[player.Id] = new Astriarch.ClientPlayer(player.Id, player.Type, player.Name, player.Color);
	}

	//second pass serializable players
	for(var i in serializedModel.SerializablePlayers)
	{
		var sp = serializedModel.SerializablePlayers[i];
		var p = playersById[sp.Id];

		Astriarch.SavedGameInterface.setPlayerLastKnownPlanetFleetStrength(p, sp, newModel.GameGrid, clientPlayersById);
	}

	newModel.Planets = planets;
	
	return newModel;
};

Astriarch.SavedGameInterface.setPlayerLastKnownPlanetFleetStrength = function(/*Player*/p, /*SerializablePlayer*/sp, gameGrid, clientPlayersById){

	//Player has LastKnownPlanetFleetStrength:new Dictionary<int, LastKnownFleet>
	for(var j in sp.LastKnownPlanetSerializableFleetStrength)
	{
		var sLKF = sp.LastKnownPlanetSerializableFleetStrength[j];
		var lastKnownOwner = null;
		if(sLKF.LastKnownOwnerId)
		{
			lastKnownOwner = clientPlayersById[sLKF.LastKnownOwnerId];
		}

		//get Fleet from serializable fleet
		var fleet = Astriarch.SavedGameInterface.getFleetFromSerializableFleet(lastKnownOwner, sLKF.SerializableFleet, gameGrid);
		var lastKnownFleet = new Astriarch.Fleet.LastKnownFleet(/*Fleet*/ fleet, /*ClientPlayer*/ lastKnownOwner);
		lastKnownFleet.TurnLastExplored = sLKF.TurnLastExplored;
		p.LastKnownPlanetFleetStrength[j] = lastKnownFleet;
	}
};

Astriarch.SavedGameInterface.getPlanetFromSerializedPlanet = function(sp, gameGrid){
	var boundingHex = gameGrid.GetHexAt(sp.OriginPoint);
	var p = new Astriarch.Planet(/*PlanetType*/ sp.Type, /*string*/ sp.Name, /*Hexagon*/ boundingHex, /*Player*/ null);

	p.Id = sp.Id;
	p.Population = sp.Population;//List<Citizen>
	p.RemainderProduction = sp.RemainderProduction;//if we finished building something we may have remainder to apply to the next item

	//populate BuildQueue:Queue<PlanetProductionItem>
	for(var j in sp.BuildQueue)
	{
		var sppi = sp.BuildQueue[j];
		var ppi = Astriarch.SavedGameInterface.getPlanetProductionItemFromSerializedPlanetProductionItem(sppi);
		p.BuildQueue.push(ppi);
	}


	p.BuiltImprovements = sp.BuiltImprovements;//Dictionary<PlanetImprovementType, List<PlanetImprovement>>
	p.MaxImprovements = sp.MaxImprovements;
	p.Resources = extend(true, p.Resources, sp.Resources);//PlanetResources
	p.OriginPoint = sp.OriginPoint;//Point

	//populate Owner later in planets.SetPlanetOwner
	//this.Owner = null;//Player//null means it is ruled by natives or nobody in the case of an asteroid belt

	p.PlanetaryFleet = Astriarch.SavedGameInterface.getFleetFromSerializableFleet(null, sp.PlanetarySerializableFleet, gameGrid);

	//populate outgoingFleets
	for(var j in sp.OutgoingSerializableFleets)
	{
		p.OutgoingFleets.push(Astriarch.SavedGameInterface.getFleetFromSerializableFleet(null, sp.OutgoingSerializableFleets[j], gameGrid));
	}

	p.PlanetHappiness = sp.PlanetHappiness;//PlanetHappinessType

	p.StarShipTypeLastBuilt = sp.StarShipTypeLastBuilt;//StarShipType
	p.BuildLastStarShip = sp.BuildLastStarShip;

	p.ResourcesPerTurn = new Astriarch.Planet.PlanetPerTurnResourceGeneration(/*Planet*/ p, /*PlanetType*/ p.Type);

	//NOTE: not serialized
	p.maxPopulation = p.MaxImprovements;

	return p;
};

Astriarch.SavedGameInterface.getPlayerFromSerializedPlayer = function(gameGrid, /*SerializablePlayer*/sp, planetsById, clientPlanetsById) {
	var p = new Astriarch.Player(/*PlayerType*/ sp.Type, /*string*/ sp.Name);
	p.Id = sp.Id;
	p.Resources = extend(true, p.Resources, sp.Resources);
	//for the main player we just want the color to be set, keep default image data
	//maybe this logic should be in SetColor instead?
	sp.Color = extend(true, new Astriarch.Util.ColorRGBA(0, 0, 0, 0), sp.Color);
	if(p.Type == Astriarch.Player.PlayerType.Human)
	{
		p.Color = sp.Color;
	}
	else
	{
		p.SetColor(sp.Color);
	}
	p.LastTurnFoodNeededToBeShipped = sp.LastTurnFoodNeededToBeShipped;//this is for computers to know how much gold to keep in surplus for food shipments
	p.Options = sp.Options;

	//player model has OwnedPlanets:Dictionary<int, Planet>
	for(var j in sp.OwnedPlanetIds)
	{
		var planet = planetsById[sp.OwnedPlanetIds[j]];
		planet.SetPlanetOwner(p);
		planet.PlanetaryFleet.Owner = p;
		for(var k in planet.OutgoingFleets){
			planet.OutgoingFleets[k].Owner = p;
		}
	}
	
	//player model has KnownClientPlanets:Dictionary<int, Planet>
	for(var j in sp.KnownPlanetIds)
	{
		var id = sp.KnownPlanetIds[j];
		if(id in planetsById){
			p.KnownClientPlanets[id] = planetsById[id].GetClientPlanet();
		} else {
			p.KnownClientPlanets[id] = clientPlanetsById[id];
		}
	}
	
	//LastKnownPlanetFleetStrength populated in second pass
	
	//populate PlanetBuildGoals:Dictionary<int, PlanetProductionItem>
	for(var j in sp.PlanetBuildGoals)
	{
		var sppi = sp.PlanetBuildGoals[j];
		var ppi = Astriarch.SavedGameInterface.getPlanetProductionItemFromSerializedPlanetProductionItem(sppi);
		p.PlanetBuildGoals[j] = ppi;
	}

	p.HomePlanet = null;
	if(sp.HomePlanetId){
		p.HomePlanet = planetsById[sp.HomePlanetId];
	}

	for(var j in sp.SerializableFleetsInTransit)
	{
		p.FleetsInTransit.push(Astriarch.SavedGameInterface.getFleetFromSerializableFleet(p, sp.SerializableFleetsInTransit[j], gameGrid));
	}
	
	return p;
};

Astriarch.SavedGameInterface.getPlanetProductionItemFromSerializedPlanetProductionItem = function(/*PlanetProductionItem*/ sppi) {
	var ppi = null;
	if (sppi.PlanetProductionItemType == Astriarch.Planet.PlanetProductionItemType.PlanetImprovement)
	{
		ppi = new Astriarch.Planet.PlanetImprovement(sppi.Type);
	}
	else if (sppi.PlanetProductionItemType == Astriarch.Planet.PlanetProductionItemType.StarShipInProduction)//it's a ship
	{
		ppi = new Astriarch.Planet.StarShipInProduction(sppi.Type);
	}
	else if(sppi.PlanetProductionItemType == Astriarch.Planet.PlanetProductionItemType.PlanetImprovementToDestroy)//it is a destroy improvement request
	{
		ppi = new Astriarch.Planet.PlanetImprovementToDestroy(sppi.Type);
	}
	else
	{
		var string = "Problem!";
	}
	
	return extend(true, ppi, sppi);
};

Astriarch.SavedGameInterface.getFleetFromSerializableFleet = function(/*ClientPlayer*/cp, /*Astriarch.SerializableFleet*/ serializedFleet, gameGrid) {
	var f = new Astriarch.Fleet(cp);
		
	f.HasSpacePlatform = serializedFleet.HasSpacePlatform;
	f.SpacePlatformDamage = serializedFleet.SpacePlatformDamage;
	
	//populate starships, have to call constructors for all serialized starships because our methods won't be serialized
	for (var i in serializedFleet.StarShips[Astriarch.Fleet.StarShipType.SystemDefense])
	{
		var ship = extend(true, new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.SystemDefense), serializedFleet.StarShips[Astriarch.Fleet.StarShipType.SystemDefense][i]);
		f.StarShips[Astriarch.Fleet.StarShipType.SystemDefense].push(ship);
	}
	for (var i in serializedFleet.StarShips[Astriarch.Fleet.StarShipType.Scout])
	{
		var ship = extend(true, new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.Scout), serializedFleet.StarShips[Astriarch.Fleet.StarShipType.Scout][i]);
		f.StarShips[Astriarch.Fleet.StarShipType.Scout].push(ship);
	}
	for (var i in serializedFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer])
	{
		var ship = extend(true, new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.Destroyer), serializedFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer][i]);
		f.StarShips[Astriarch.Fleet.StarShipType.Destroyer].push(ship);
	}
	for (var i in serializedFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser])
	{
		var ship = extend(true, new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.Cruiser), serializedFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser][i]);
		f.StarShips[Astriarch.Fleet.StarShipType.Cruiser].push(ship);
	}
	for (var i in serializedFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship])
	{
		var ship = extend(true, new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.Battleship), serializedFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship][i]);
		f.StarShips[Astriarch.Fleet.StarShipType.Battleship].push(ship);
	}

	f.LocationHex = null;//Hexagon
	if(serializedFleet.LocationHexMidPoint)
	{
		f.LocationHex = gameGrid.GetHexAt(serializedFleet.LocationHexMidPoint)
	}
	//NOTE: need to populate?:
	//this.OnFleetMoved = null;//function pointer: FleetMoved(Fleet f);
	//this.OnFleetMergedOrDestroyed = null;//function pointer: FleetMergedOrDestroyed(Fleet f)
	
	//this.DrawnFleet = null;//backreference if we are drawing this fleet
	
	//remake DrawnFleet if this was a fleet in transit
	//NOTE: we may have to remake fleets in transit as a DrawnFleet when we resume a game
	if(serializedFleet.travelingFromHexMidPoint)
	{
		var travelingFromHex = gameGrid.GetHexAt(serializedFleet.travelingFromHexMidPoint);
		var destinationHex = gameGrid.GetHexAt(serializedFleet.DestinationHexMidPoint);
		var totalTravelDistance = gameGrid.GetHexDistance(travelingFromHex, destinationHex);

		//f.CreateDrawnFleetAndSetDestination(travelingFromHex, destinationHex, serializedFleet.addDrawnFleetToCanvas, serializedFleet.TurnsToDestination, totalTravelDistance);
		f.SetDestination(gameGrid, travelingFromHex, destinationHex, serializedFleet.TurnsToDestination, totalTravelDistance);
	}
	return f;
};

/**
 * SerializableModel is a serializable version of the model, Creates a new version of the model without recursive/circular references so that it can be stringified
 * @constructor
 */
Astriarch.SerializableModel = function(/*Astriarch.Model*/ model) {

	this.ShowUnexploredPlanetsAndEnemyPlayerStats = model.ShowUnexploredPlanetsAndEnemyPlayerStats;//for debugging for now, could eventually be used once a scanner is researched?

    this.SystemsToGenerate = model.SystemsToGenerate;

    this.PlanetsPerSystem = model.PlanetsPerSystem;//Astriarch.Model.PlanetsPerSystemOption.FOUR;

	this.DistributePlanetsEvenly = model.DistributePlanetsEvenly;

	this.TurnTimeLimitSeconds = model.TurnTimeLimitSeconds;
    //public bool EnsureEachSystemContainsAllPlanetTypes = true;//TODO: implement if false every planet type (except home) will be randomly selected

	this.Turn = model.Turn;
	
	//this.Players = players;//model has Players:Astriarch.Player
	this.SerializablePlayers = [];
	for(var i in model.Players)
	{
		this.SerializablePlayers.push(new Astriarch.SerializablePlayer(model.Players[i]));
	}
	
	//we keep a reference to dead players in the last known fleet,
	//	this way we have this structure for destroyed players that are "last known" in at least one fleet
	this.SerializablePlayersDestroyed = [];
	for(var i in model.PlayersDestroyed)
	{
		this.SerializablePlayersDestroyed.push(new Astriarch.SerializablePlayer(model.PlayersDestroyed[i]));
	}
	
	//this.Planets = [];//model has Planets:Astriarch.Planet
	this.SerializablePlanets = [];
	for(var i in model.Planets)
	{
		this.SerializablePlanets.push(new Astriarch.SerializablePlanet(model.Planets[i]));
	}
	
	//save the version to the serializable model too so we could eventually be able to be smart about backwards compatibility for saved games
	this['Version'] = Astriarch.Version;
};

/**
 * A SerializablePlayer is a serializable version of the Player
 * @constructor
 */
Astriarch.SerializablePlayer = function(/*Astriarch.Player*/ player) {

	this.Id = player.Id;
	
	this.Type = player.Type;//PlayerType

	this.Name = player.Name;

	this.Resources = player.Resources;

	this.Color = player.Color;

	this.LastTurnFoodNeededToBeShipped = player.LastTurnFoodNeededToBeShipped;//this is for computers to know how much gold to keep in surplus for food shipments

	this.Options = player.Options;

	this.OwnedPlanetIds = [];//player model has OwnedPlanets:Dictionary<int, Planet>
	for(var i in player.OwnedPlanets)
	{
		this.OwnedPlanetIds.push(player.OwnedPlanets[i].Id);
	}
	
	this.KnownPlanetIds = [];//player model has KnownClientPlanets:Dictionary<int, Planet>
	for(var i in player.KnownClientPlanets)
	{
		this.KnownPlanetIds.push(player.KnownClientPlanets[i].Id);
	}
	
	this.LastKnownPlanetSerializableFleetStrength = {};//Player has LastKnownPlanetFleetStrength:new Dictionary<int, LastKnownFleet>
	for(var i in player.LastKnownPlanetFleetStrength)
	{
		this.LastKnownPlanetSerializableFleetStrength[i] = new Astriarch.Fleet.SerializableLastKnownFleet(player.LastKnownPlanetFleetStrength[i]);
	}
	
	this.PlanetBuildGoals = player.PlanetBuildGoals;//Dictionary<int, PlanetProductionItem>
	for(var i in this.PlanetBuildGoals)
	{
		Astriarch.SavedGameInterface.makePlanetProductionItemSerializable(this.PlanetBuildGoals[i]);
	}

	this.HomePlanetId = null;
	if(player.HomePlanet){
		this.HomePlanetId = player.HomePlanet.Id;//Player has HomePlanet:Planet
	}

	this.SerializableFleetsInTransit = [];//Player has FleetsInTransit:List<Fleet>
	for(var i in player.FleetsInTransit)
	{
		this.SerializableFleetsInTransit.push(new Astriarch.SerializableFleet(player.FleetsInTransit[i], this.Type == Astriarch.Player.PlayerType.Human));
	}
	
	//NOTE: not serialized
	//this.fleetsArrivingOnUnownedPlanets = {};//Dictionary<int, Fleet>//indexed by planet id

};

/**
 * A SerializableFleet is a serializable version of the Fleet
 * @constructor
 */
Astriarch.SerializableFleet = function(/*Astriarch.Fleet*/ fleet) {
        this.StarShips = fleet.StarShips;
		
        this.HasSpacePlatform = fleet.HasSpacePlatform;
        this.SpacePlatformDamage = fleet.SpacePlatformDamage;

		//NOTE: not serialized
        this.LocationHexMidPoint = null;//Fleet has LocationHex:Hexagon
		if(fleet.LocationHex)
		{
			this.LocationHexMidPoint = fleet.LocationHex.MidPoint;
		}

		//NOTE: not serialized
        //this.OnFleetMoved = null;//function pointer: FleetMoved(Fleet f);
		//NOTE: not serialized
        //this.OnFleetMergedOrDestroyed = null;//function pointer: FleetMergedOrDestroyed(Fleet f)
		
		//NOTE: not serialized
		//this.DrawnFleet = null;//backreference if we are drawing this fleet

		//NOTE: not serialized
		//this.Owner = p;//backreference to player
		
		//if this is a fleet in transit, we need to serialize where it's going and coming from
		if(fleet.travelingFromHex && fleet.DestinationHex)
		{
			this.travelingFromHexMidPoint = fleet.travelingFromHex.MidPoint;
			this.DestinationHexMidPoint = fleet.DestinationHex.MidPoint;
			this.TurnsToDestination = fleet.TurnsToDestination;
		}
};

/**
 * A SerializableLastKnownFleet is a serializable version of the LastKnownFleet
 * @constructor
 */
Astriarch.Fleet.SerializableLastKnownFleet = function(/*LastKnownFleet*/ lastKnownFleet){
	this.TurnLastExplored = lastKnownFleet.TurnLastExplored;

	this.SerializableFleet = new Astriarch.SerializableFleet(lastKnownFleet.Fleet, false);//LastKnownFleet has Fleet:Astriarch.Fleet
	
	if(lastKnownFleet.LastKnownOwner)
	{
		this.LastKnownOwnerId = lastKnownFleet.LastKnownOwner.Id;//LastKnownFleet has LastKnownOwner:Player
	}

};

/**
 * A SerializablePlanet is a serializable version of the Planet
 * @constructor
 */
Astriarch.SerializablePlanet = function(/*Astriarch.Planet*/ planet) {

	this.Id = planet.Id;
	this.Name = planet.Name;
	this.Type = planet.Type;
	this.Population = planet.Population;//List<Citizen>
	this.RemainderProduction = planet.RemainderProduction;//if we finished building something we may have remainder to apply to the next item
	
	this.BuildQueue = planet.BuildQueue;//Queue<PlanetProductionItem>
	for(var i in this.BuildQueue)
	{
		Astriarch.SavedGameInterface.makePlanetProductionItemSerializable(this.BuildQueue[i]);
	}
	
	this.BuiltImprovements = planet.BuiltImprovements;//Dictionary<PlanetImprovementType, List<PlanetImprovement>>

	this.MaxImprovements = planet.MaxImprovements;

	this.Resources = planet.Resources;//PlanetResources

	//NOTE: not serialized
	//this.BoundingHex = boundingHex;//Hexagon

	this.OriginPoint = planet.OriginPoint;//Point

	//NOTE: not serialized
	//this.Owner = null;//Player//null means it is ruled by natives or nobody in the case of an asteroid belt

	this.PlanetarySerializableFleet = new Astriarch.SerializableFleet(planet.PlanetaryFleet, false);//Planet has PlanetaryFleet:Fleet//the fleet stationed at this planet
	
	//populate outgoingFleets
	this.OutgoingSerializableFleets = [];//Planet has OutgoingFleets List<Fleet>
	for(var i in planet.OutgoingFleets)
	{
		this.OutgoingSerializableFleets.push(new Astriarch.SerializableFleet(planet.OutgoingFleets[i], planet.Owner.Type == Astriarch.Player.PlayerType.Human));
	}

	this.PlanetHappiness = planet.PlanetHappiness;//PlanetHappinessType

	this.BuiltImprovements = planet.BuiltImprovements;//Dictionary<PlanetImprovementType, List<PlanetImprovement>>
	
	this.StarShipTypeLastBuilt = planet.StarShipTypeLastBuilt;//StarShipType
    this.BuildLastStarShip = planet.BuildLastStarShip;

	//NOTE: not serialized
	//this.maxPopulation = this.MaxImprovements;
};

Astriarch.Planet.PlanetProductionItemType = {
	Unknown: 0,
    PlanetImprovement: 1,
    StarShipInProduction: 2,
    PlanetImprovementToDestroy: 3
};

Astriarch.SavedGameInterface.makePlanetProductionItemSerializable = function(/*PlanetProductionItem*/ sppi) {
	//since the instanceof is not serializable, we need to add a property to the PlanetProductionItem to tell what type it is
	sppi.PlanetProductionItemType = Astriarch.Planet.PlanetProductionItemType.Unknown
	if (sppi instanceof Astriarch.Planet.PlanetImprovement)
	{
		sppi.PlanetProductionItemType = Astriarch.Planet.PlanetProductionItemType.PlanetImprovement;
	}
	else if (sppi instanceof Astriarch.Planet.StarShipInProduction)//it's a ship
	{
		sppi.PlanetProductionItemType = Astriarch.Planet.PlanetProductionItemType.StarShipInProduction;
	}
	else if(sppi instanceof Astriarch.Planet.PlanetImprovementToDestroy)//it is a destroy improvement request
	{
		sppi.PlanetProductionItemType = Astriarch.Planet.PlanetProductionItemType.PlanetImprovementToDestroy;
	}
	else
	{
		var string = "Problem!";
	}
	return sppi;
};
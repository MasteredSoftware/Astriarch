var Astriarch = Astriarch || require('./astriarch_base');

/**
 * TurnEventMessage is a end of turn news item
 * @constructor
 */
Astriarch.TurnEventMessage = function(/*TurnEventMessageType*/ type, /*Planet*/ p, /*string*/ message) {
	this.Type = type;
	this.Planet = p;//only populated if applies to message
	this.Message = message;

	this.Data = null;//PlanetaryConflictData//for planetary conflict type messages
};

/**
 * TurnEventMessageComparerSortFunction is a end of turn news item sort function
 * @constructor
 */
Astriarch.TurnEventMessage.TurnEventMessageComparerSortFunction = function(a, b) {
	if (a.Type > b.Type)
		return -1;
	else if (a.Type < b.Type)
		return 1;
	return 0;
};

Astriarch.TurnEventMessage.TurnEventMessageType = {
	ResourcesAutoSpent: 0,
	PopulationGrowth: 1,
	ImprovementBuilt: 2,
	ShipBuilt: 3,
	ImprovementDemolished: 4,
	InsufficientFood: 5,//either general food shortage or couldn't ship becuase of lack of gold, leads to population unrest
	BuildQueueEmpty: 6,
	DefendedAgainstAttackingFleet: 7,
	AttackingFleetLost: 8,
	PlanetCaptured: 9,
	PopulationStarvation: 10,
	FoodShortageRiots: 11,
	PlanetLostDueToStarvation: 12,//this is bad but you probably know it's bad
	PlanetLost: 13
};

/**
 * PlanetaryConflictData is the data member for the TurnEventMessage representing what happened when there was a planetary conflict
 * @constructor
 */
Astriarch.TurnEventMessage.PlanetaryConflictData = function(/*Player*/ defendingPlayer, /*Fleet*/ defendingFleet, /*Player*/ attackingPlayer, /*Fleet*/ attackingFleet) {
	this.DefendingPlayer = defendingPlayer;
	this.DefendingFleet = defendingFleet.CloneFleet();
	this.AttackingPlayer = attackingPlayer;
	this.AttackingFleet = attackingFleet.CloneFleet();
	this.WinningFleet = null;
	this.AttackingFleetChances = 0;//percentage chance the attacking fleet will win
	this.GoldAmountLooted = 0;//if there was gold looted from the planet
	this.OreAmountLooted = 0;//if there was ore looted from the planet
	this.IridiumAmountLooted = 0;//if there was Iridium looted from the planet
	this.FoodAmountLooted = 0;//if there was Food looted from the planet
};

Astriarch.SerializableTurnEventMessage = function(/*TurnEventMessageType*/ type, /*Planet*/ p, /*string*/ message){
	this.Type = type;
	this.SerializableClientPlanet = null;//only populated if applies to message
	if(p){
		this.SerializableClientPlanet = new Astriarch.SerializableClientPlanet(p.Id, p.Name, p.OriginPoint)
	}
	this.Message = message;

	this.Data = null;//SerializablePlanetaryConflictData//for planetary conflict type messages
};

Astriarch.TurnEventMessage.SerializablePlanetaryConflictData = function(/*PlanetaryConflictData*/ pcd){
	this.DefendingSerializableClientPlayer = null;
	if(pcd.DefendingPlayer){
		this.DefendingSerializableClientPlayer = new Astriarch.SerializableClientPlayer(pcd.DefendingPlayer.Id, pcd.DefendingPlayer.Type, pcd.DefendingPlayer.Name, pcd.DefendingPlayer.Color);
	}
	this.DefendingSerializableFleet = new Astriarch.SerializableFleet(pcd.DefendingFleet, false);
	this.AttackingSerializableClientPlayer = new Astriarch.SerializableClientPlayer(pcd.AttackingPlayer.Id, pcd.AttackingPlayer.Type, pcd.AttackingPlayer.Name, pcd.AttackingPlayer.Color);
	this.AttackingSerializableFleet = new Astriarch.SerializableFleet(pcd.AttackingFleet, false);
	this.WinningSerializableFleet = null;
	if(pcd.WinningFleet){
		this.WinningSerializableFleet = new Astriarch.SerializableFleet(pcd.WinningFleet, false);
	}

	this.AttackingFleetChances = pcd.AttackingFleetChances;//percentage chance the attacking fleet will win
	this.GoldAmountLooted = pcd.GoldAmountLooted;//if there was gold looted from the planet
	this.OreAmountLooted = pcd.OreAmountLooted;//if there was ore looted from the planet
	this.IridiumAmountLooted = pcd.IridiumAmountLooted;//if there was Iridium looted from the planet
	this.FoodAmountLooted = pcd.FoodAmountLooted;//if there was Food looted from the planet
};


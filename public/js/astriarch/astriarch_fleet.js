var Astriarch = Astriarch || require('./astriarch_base');

/**
 * A Fleet is a collection of starships with a space platform
 * @constructor
 */
Astriarch.Fleet = function() {
        this.StarShips = {};//Dictionary<StarShipType, List<StarShip>>
		this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense] = [];
		this.StarShips[Astriarch.Fleet.StarShipType.Scout] = [];
		this.StarShips[Astriarch.Fleet.StarShipType.Destroyer] = [];
		this.StarShips[Astriarch.Fleet.StarShipType.Cruiser] = [];
		this.StarShips[Astriarch.Fleet.StarShipType.Battleship] = [];
		
        this.HasSpacePlatform = false;
        this.SpacePlatformDamage = 0;

        this.LocationHex = null;//Hexagon

		this.travelingFromHex = null;//Hexagon
		this.DestinationHex = null;//Hexagon

		this.totalTravelDistance = 0;
		this.TurnsToDestination = 0;

        this.OnFleetMoved = null;//function pointer: FleetMoved(Fleet f);
        this.OnFleetMergedOrDestroyed = null;//function pointer: FleetMergedOrDestroyed(Fleet f)

		this.SetFleetHasSpacePlatform();
		
		this.DrawnFleet = null;//backreference if we are drawing this fleet
};

Astriarch.Fleet.Static = {SPACE_PLATFORM_STRENGTH: 64};//TODO: twice the strength of a battleship, is this good?

/**
 * Sets the HasSpacePlatform var if there is a space platform at the fleet's planet.
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.SetFleetHasSpacePlatform = function() {
	this.HasSpacePlatform = false;
	if (this.LocationHex != null && this.LocationHex.PlanetContainedInHex != null && this.LocationHex.PlanetContainedInHex.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform].length > 0)
		this.HasSpacePlatform = true;
};

/**
 * Sets the destimation hex for a fleet
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.SetDestination = function(gameGrid, /*Hexagon*/ travelingFromHex, /*Hexagon*/ destinationHex, /*int?*/ turnsToDestination, /*int?*/ totalTravelDistance) {
	this.HasSpacePlatform = false;
	this.DestinationHex = destinationHex;

	this.travelingFromHex = travelingFromHex;
	this.totalTravelDistance = totalTravelDistance;
	if(!this.totalTravelDistance)
	{
		this.totalTravelDistance = gameGrid.GetHexDistance(this.travelingFromHex, this.DestinationHex);
	}
	this.TurnsToDestination = this.totalTravelDistance;
	if(turnsToDestination)
	{
		this.TurnsToDestination = turnsToDestination;
	}
};

/**
 * Sets the destimation hex for a fleet and creates a drawn representation
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.CreateDrawnFleetAndSetDestination = function(gameGrid, /*Hexagon*/ travelingFromHex, /*Hexagon*/ destinationHex, /*int?*/ turnsToDestination, /*int?*/ totalTravelDistance) {

	this.SetDestination(gameGrid, travelingFromHex, destinationHex, turnsToDestination, totalTravelDistance);

	this.CreateDrawnFleet();
};

/**
 * Creates a drawn representation of this fleet
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.CreateDrawnFleet = function(){
	this.DrawnFleet = new Astriarch.DrawnFleet(this);
	Astriarch.View.DrawnFleets.push(this.DrawnFleet);
	Astriarch.View.CanvasFleetsLayer.addChild(this.DrawnFleet);

	this.DrawnFleet.updateTravelLine();
};

/**
 * Moves a fleet one space
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.MoveFleet = function() {
	this.LocationHex = null;
	//TODO: should this update the location hex to a closer hex as well?
	this.TurnsToDestination -= 1;

	if(this.DrawnFleet){
		this.DrawnFleet.updateTravelLine();
	}
	
	if (this.OnFleetMoved != null)
	{
		this.OnFleetMoved(this);
	}
}

/**
 * Lands a fleet on a planet
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.LandFleet = function(/*Fleet*/ landingFleet, /*Hexagon*/ newLocation){

	landingFleet.travelingFromHex = null;
	landingFleet.DestinationHex = null;
	landingFleet.TurnsToDestination = 0;
	
	this.LocationHex = newLocation;

	this.MergeFleet(landingFleet);

	this.SetFleetHasSpacePlatform();
};

/**
 * Joins this fleet with the fleet passed in
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.MergeFleet = function(/*Fleet*/ mergingFleet)
{
	this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense] = this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense].concat(mergingFleet.StarShips[Astriarch.Fleet.StarShipType.SystemDefense]);

	this.StarShips[Astriarch.Fleet.StarShipType.Scout] = this.StarShips[Astriarch.Fleet.StarShipType.Scout].concat(mergingFleet.StarShips[Astriarch.Fleet.StarShipType.Scout]);

	this.StarShips[Astriarch.Fleet.StarShipType.Destroyer] = this.StarShips[Astriarch.Fleet.StarShipType.Destroyer].concat(mergingFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer]);

	this.StarShips[Astriarch.Fleet.StarShipType.Cruiser] = this.StarShips[Astriarch.Fleet.StarShipType.Cruiser].concat(mergingFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser]);

	this.StarShips[Astriarch.Fleet.StarShipType.Battleship] = this.StarShips[Astriarch.Fleet.StarShipType.Battleship].concat(mergingFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship]);

	mergingFleet.SendFleetMergedOrDestroyed();
};

/**
 * Gets a flat array of all starships in the fleet
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.GetAllStarShips = function() {//returns List<StarShip>
	var ships = []; //List<StarShip>
	ships = ships.concat(this.StarShips[Astriarch.Fleet.StarShipType.Battleship]);
	ships = ships.concat(this.StarShips[Astriarch.Fleet.StarShipType.Cruiser]);
	ships = ships.concat(this.StarShips[Astriarch.Fleet.StarShipType.Destroyer]);
	ships = ships.concat(this.StarShips[Astriarch.Fleet.StarShipType.Scout]);
	ships = ships.concat(this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense]);
	return ships;
};

/**
 * sends the OnFleetMergedOrDestroyed event
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.SendFleetMergedOrDestroyed = function(){
	if (this.OnFleetMergedOrDestroyed != null)
	{
		this.OnFleetMergedOrDestroyed(this);
	}
};

/// <summary>
/// Simply remove ships with strength = 0
/// </summary>
/// <param name="spacePlatformDamage">amount the space platform was damaged</param>
/**
 * Simply remove ships with strength = 0
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.ReduceFleet = function(spacePlatformDamage)
{
	//start by reducing the weakest ships first (they are sent to the front lines)
	//if a starship's damage gets to it's strength level, it's destroyed
	for(var key in this.StarShips)
	{
		var typeArray = this.StarShips[key];//StarShipType
		for (var i = typeArray.length - 1; i >= 0; i--)
		{
			if (typeArray[i].Strength() <= 0)
				typeArray.splice(i, 1);
		}
	}

	this.SpacePlatformDamage += spacePlatformDamage;

	if (this.SpacePlatformDamage != 0 && this.HasSpacePlatform && this.SpacePlatformDamage >= Astriarch.Fleet.Static.SPACE_PLATFORM_STRENGTH)
	{
		//destroy the space platform
		if (this.LocationHex != null && this.LocationHex.PlanetContainedInHex != null)
		{
			this.LocationHex.PlanetContainedInHex.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform] = [];
			this.HasSpacePlatform = false;
		}
	}
};

/**
 * Calculates the strength of the fleet
 * @this {Astriarch.Fleet}
 * @return {number} the fleet strength
 */
Astriarch.Fleet.prototype.DetermineFleetStrength = function(includeSpacePlatformDefence)
{
	if(includeSpacePlatformDefence === null || typeof includeSpacePlatformDefence == "undefined")
		includeSpacePlatformDefence = true;
	var strength = 0;

	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense])
	{
		strength += this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense][i].Strength();
	}

	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Scout])
	{
		strength += this.StarShips[Astriarch.Fleet.StarShipType.Scout][i].Strength();
	}

	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Destroyer])
	{
		strength += this.StarShips[Astriarch.Fleet.StarShipType.Destroyer][i].Strength();
	}

	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Cruiser])
	{
		strength += this.StarShips[Astriarch.Fleet.StarShipType.Cruiser][i].Strength();
	}

	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Battleship])
	{
		strength += this.StarShips[Astriarch.Fleet.StarShipType.Battleship][i].Strength();
	}

	if (includeSpacePlatformDefence && this.HasSpacePlatform)
		strength += Astriarch.Fleet.Static.SPACE_PLATFORM_STRENGTH - this.SpacePlatformDamage;

	return strength;
};

/// <summary>
/// Creates a new fleet with the number of ships specified, removing the ships from this fleet
/// </summary>
/// <param name="scoutCount"></param>
/// <param name="destoyerCount"></param>
/// <param name="cruiserCount"></param>
/// <param name="battleshipCount"></param>
/// <returns>the new fleet</returns>
/**
 * Splits this fleet off into another fleet
 * @this {Astriarch.Fleet}
 * @return {Astriarch.Fleet} the new fleet
 */
Astriarch.Fleet.prototype.SplitFleet = function(scoutCount, destoyerCount, cruiserCount, battleshipCount) {//returns Fleet

	var newFleet = new Astriarch.Fleet();
	newFleet.LocationHex = this.LocationHex;

	if (scoutCount > this.StarShips[Astriarch.Fleet.StarShipType.Scout].length ||
		destoyerCount > this.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length ||
		cruiserCount > this.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length ||
		battleshipCount > this.StarShips[Astriarch.Fleet.StarShipType.Battleship].length)
	{
		console.error("Cannot send more ships than in the fleet!", scoutCount, destoyerCount, cruiserCount, battleshipCount, this.StarShips);
		throw new Error("Cannot send more ships than in the fleet!");
	}

	for (var i = 0; i < scoutCount; i++)
	{
		newFleet.StarShips[Astriarch.Fleet.StarShipType.Scout].push(this.StarShips[Astriarch.Fleet.StarShipType.Scout][0]);
		this.StarShips[Astriarch.Fleet.StarShipType.Scout].shift();
	}
	for (var i = 0; i < destoyerCount; i++)
	{
		newFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer].push(this.StarShips[Astriarch.Fleet.StarShipType.Destroyer][0]);
		this.StarShips[Astriarch.Fleet.StarShipType.Destroyer].shift();
	}
	for (var i = 0; i < cruiserCount; i++)
	{
		newFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser].push(this.StarShips[Astriarch.Fleet.StarShipType.Cruiser][0]);
		this.StarShips[Astriarch.Fleet.StarShipType.Cruiser].shift();
	}
	for (var i = 0; i < battleshipCount; i++)
	{
		newFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship].push(this.StarShips[Astriarch.Fleet.StarShipType.Battleship][0]);
		this.StarShips[Astriarch.Fleet.StarShipType.Battleship].shift();
	}

	return newFleet;
};

/**
 * Splits this fleet off in a fleet that contains one weak ship
 * @this {Astriarch.Fleet}
 * @return {Astriarch.Fleet} the new fleet
 */
Astriarch.Fleet.prototype.SplitOffSmallestPossibleFleet = function(){//returns Fleet
	var newFleet = null;//Fleet //if we can't find any to send
	var scoutCount = 0;
	var destroyerCount = 0;
	var cruiserCount = 0;
	var battleshipCount = 0;

	if (this.StarShips[Astriarch.Fleet.StarShipType.Scout].length != 0)
		scoutCount = 1;
	else if (this.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length != 0)
		destroyerCount = 1;
	else if (this.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length != 0)
		cruiserCount = 1;
	else if (this.StarShips[Astriarch.Fleet.StarShipType.Battleship].length != 0)
		battleshipCount = 1;

	if (scoutCount != 0 || destroyerCount != 0 || cruiserCount != 0 || battleshipCount != 0)
		newFleet = this.SplitFleet(scoutCount, destroyerCount, cruiserCount, battleshipCount);

	return newFleet;
};

/**
 * Counts number of starships that can move between planets
 * @this {Astriarch.Fleet}
 * @return {number} the number of mobile ships
 */
Astriarch.Fleet.prototype.GetPlanetaryFleetMobileStarshipCount = function(){
	var mobileStarships = 0;

	mobileStarships += this.StarShips[Astriarch.Fleet.StarShipType.Scout].length;
	mobileStarships += this.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length;
	mobileStarships += this.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length;
	mobileStarships += this.StarShips[Astriarch.Fleet.StarShipType.Battleship].length;

	return mobileStarships;
};

/**
 * Copies this fleet
 * @this {Astriarch.Fleet}
 * @return {Astriarch.Fleet} the new fleet
 */
Astriarch.Fleet.prototype.CloneFleet = function(){//returns Fleet
	var f = new Astriarch.Fleet();

	f.LocationHex = this.LocationHex;
	f.HasSpacePlatform = this.HasSpacePlatform;

	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense])
	{
		f.StarShips[Astriarch.Fleet.StarShipType.SystemDefense].push(this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense][i].CloneStarShip());
	}
	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Scout])
	{
		f.StarShips[Astriarch.Fleet.StarShipType.Scout].push(this.StarShips[Astriarch.Fleet.StarShipType.Scout][i].CloneStarShip());
	}
	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Destroyer])
	{
		f.StarShips[Astriarch.Fleet.StarShipType.Destroyer].push(this.StarShips[Astriarch.Fleet.StarShipType.Destroyer][i].CloneStarShip());
	}
	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Cruiser])
	{
		f.StarShips[Astriarch.Fleet.StarShipType.Cruiser].push(this.StarShips[Astriarch.Fleet.StarShipType.Cruiser][i].CloneStarShip());
	}
	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Battleship])
	{
		f.StarShips[Astriarch.Fleet.StarShipType.Battleship].push(this.StarShips[Astriarch.Fleet.StarShipType.Battleship][i].CloneStarShip());
	}

	return f;
};

/**
 * Repairs this fleet
 * @this {Astriarch.Fleet}
 */
Astriarch.Fleet.prototype.RepairFleet = function(){
	this.SpacePlatformDamage = 0;
	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense])
	{
		this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense][i].DamageAmount = 0;
	}
	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Scout])
	{
		this.StarShips[Astriarch.Fleet.StarShipType.Scout][i].DamageAmount = 0;
	}
	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Destroyer])
	{
		this.StarShips[Astriarch.Fleet.StarShipType.Destroyer][i].DamageAmount = 0;
	}
	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Cruiser])
	{
		this.StarShips[Astriarch.Fleet.StarShipType.Cruiser][i].DamageAmount = 0;
	}
	for (var i in this.StarShips[Astriarch.Fleet.StarShipType.Battleship])
	{
		this.StarShips[Astriarch.Fleet.StarShipType.Battleship][i].DamageAmount = 0;
	}
};

/**
 * A printable version of the fleet
 * @this {Astriarch.Fleet}
 * @return {string} the fleet string
 */
Astriarch.Fleet.prototype.ToString = function(){
	var fleetSummary = "";
	var count = -1;
	count = this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense].length;
	if (count > 0)
	{
		fleetSummary = count + " Defender" + (count > 1 ? "s" : "");
	}
	count = this.StarShips[Astriarch.Fleet.StarShipType.Scout].length;
	if (count > 0)
	{
		if (fleetSummary != "")
			fleetSummary += ", ";
		fleetSummary += count + " Scout" + (count > 1 ? "s" : "");
	}
	count = this.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length;
	if (count > 0)
	{
		if (fleetSummary != "")
			fleetSummary += ", ";
		fleetSummary += count + " Destroyer" + (count > 1 ? "s" : "");
	}
	count = this.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length;
	if (count > 0)
	{
		if (fleetSummary != "")
			fleetSummary += ", ";
		fleetSummary += count + " Cruiser" + (count > 1 ? "s" : "");
	}
	count = this.StarShips[Astriarch.Fleet.StarShipType.Battleship].length;
	if (count > 0)
	{
		if (fleetSummary != "")
			fleetSummary += ", ";
		fleetSummary += count + " Battleship" + (count > 1 ? "s" : "");
	}

	if (this.HasSpacePlatform)
	{
		if (fleetSummary != "")
			fleetSummary += ", ";
		fleetSummary += "1 Space Platform";
	}

	if (fleetSummary == "")
		fleetSummary = "No Ships";

	return fleetSummary;
};

/**
 * A LastKnownFleet is the data used to know what you saw at a planet last time you explored it
 * @constructor
 */
Astriarch.Fleet.LastKnownFleet = function(/*Fleet*/ fleet, /*ClientPlayer*/ owner){
	this.TurnLastExplored = 0;

	this.Fleet = fleet;
	
	this.LastKnownOwner = owner;

};

/**
 * A Starship is an attack platform that has weapons and an amount of damage
 * @constructor
 */
Astriarch.Fleet.StarShip = function(/*StarShipType*/ type){
	this.id = Astriarch.Fleet.StarShip.Static.NEXT_STARSHIP_ID++
	this.Type = type;

	this.BaseStarShipStrength = 0;
	//TODO: could eventually allow ship upgrades? to improve on base strength

	this.DamageAmount = 0;//starships will auto-heal between turns but if there are multiple battles in one turn involving a starship then this comes into play

	//ship strength is based on ship cost
	//  right now it is double the value of the next lower ship class
	//maybe later: + 50% (rounded up) of the next lower ship cost
	//each system defender is worth 2
	//each scout is worth 4 points
	//each destroyer is worth 8
	//each cruiser is worth 16
	//each battleship is worth 32

	switch (this.Type)
	{
		case Astriarch.Fleet.StarShipType.SystemDefense:
			this.BaseStarShipStrength = 2;
			break;
		case Astriarch.Fleet.StarShipType.Scout:
			this.BaseStarShipStrength = 4;
			break;
		case Astriarch.Fleet.StarShipType.Destroyer:
			this.BaseStarShipStrength = 8;
			break;
		case Astriarch.Fleet.StarShipType.Cruiser:
			this.BaseStarShipStrength = 16;
			break;
		case Astriarch.Fleet.StarShipType.Battleship:
			this.BaseStarShipStrength = 32;
			break;
	}
};

Astriarch.Fleet.StarShip.Static = {NEXT_STARSHIP_ID: 1};

/**
 * A printable version of the fleet
 * @this {Astriarch.Fleet.StarShip}
 * @return {number} the starship's strength
 */
Astriarch.Fleet.StarShip.prototype.Strength = function() {
	return this.BaseStarShipStrength - this.DamageAmount;
};

/**
 * Copies the properties of this starship
 * @this {Astriarch.Fleet.StarShip}
 * @return {Astriarch.Fleet.StarShip} the copied starship
 */
Astriarch.Fleet.StarShip.prototype.CloneStarShip = function(){//returns StarShip
	var s = new Astriarch.Fleet.StarShip(this.Type);
	s.DamageAmount = this.DamageAmount;
	return s;
};

/**
 * StarShipAdvantageStrengthComparer is an object that allows array sorting of starships
 * @constructor
 */
Astriarch.Fleet.StarShipAdvantageStrengthComparer = function(/*StarShipType*/ type, /*bool*/ isSpacePlatform, /*Dictionary<StarShip, int>*/ fleetDamagePending) {
	this.type = type;
	this.isSpacePlatform = isSpacePlatform;
	this.fleetDamagePending = fleetDamagePending;
	var self = this;
	this.sortFunction = function(/*StarShip*/ a, /*StarShip*/ b) {

		var ret = 0;
		var strengthA = self.getStarShipAdvantageDisadvantageAdjustedStrength(a);
		var strengthB = self.getStarShipAdvantageDisadvantageAdjustedStrength(b);

		if (strengthA == strengthB)
			ret = 0;
		else if (strengthA < strengthB)
			ret = -1;
		else
			ret = 1;

		return ret;
	};
};

/**
 * Adjusts the starships relative strength for sorting based on starship advantages
 * @this {Astriarch.Fleet.StarShipAdvantageStrengthComparer}
 * @return {number} the starship's adjusted strength
 */
Astriarch.Fleet.StarShipAdvantageStrengthComparer.prototype.getStarShipAdvantageDisadvantageAdjustedStrength = function(/*StarShip*/ enemy) {
	var adjustedStrength = enemy.Strength();
	if (this.fleetDamagePending[enemy])
		adjustedStrength -= this.fleetDamagePending[enemy];

	if (Astriarch.BattleSimulator.StarshipHasAdvantageBasedOnType(this.isSpacePlatform, this.type, false, enemy.Type))
		adjustedStrength *= 1;//this just ensures we're always attaking the enemy we have an advantage over
	else if (Astriarch.BattleSimulator.StarshipHasDisadvantageBasedOnType(this.isSpacePlatform, this.type, false, enemy.Type))
		adjustedStrength *= 10000;
	else
		adjustedStrength *= 100;

	return adjustedStrength;
};
    
/**
 * StarShipFactoryHelper is an object that allows creating fleets easier
 * @constructor
 */
Astriarch.Fleet.StarShipFactoryHelper = {

	GenerateShips: function(/*StarShipType*/ type, /*int*/ number, /*Hexagon*/ locationHex)//returns Fleet
	{
		var f = new Astriarch.Fleet();
		f.LocationHex = locationHex;
		for (var i = 0; i < number; i++)
			f.StarShips[type].push(new Astriarch.Fleet.StarShip(type));
		return f;
	},

	GenerateFleetWithShipCount: function(defenders, scouts, destroyers, cruisers, battleships, /*Hexagon*/ locationHex){//returns Fleet
		var f = new Astriarch.Fleet();
		f.LocationHex = locationHex;

		for (var i = 0; i < defenders; i++)
			f.StarShips[Astriarch.Fleet.StarShipType.SystemDefense].push(new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.SystemDefense));
		for (var i = 0; i < scouts; i++)
			f.StarShips[Astriarch.Fleet.StarShipType.Scout].push(new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.Scout));
		for (var i = 0; i < destroyers; i++)
			f.StarShips[Astriarch.Fleet.StarShipType.Destroyer].push(new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.Destroyer));
		for (var i = 0; i < cruisers; i++)
			f.StarShips[Astriarch.Fleet.StarShipType.Cruiser].push(new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.Cruiser));
		for (var i = 0; i < battleships; i++)
			f.StarShips[Astriarch.Fleet.StarShipType.Battleship].push(new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.Battleship));

		return f;
	}
};

Astriarch.Fleet.StarShipType = {
	SystemDefense: 1,//System defense ships are not equiped with hyperdrive and cannot leave the system they are in
	Scout: 2,
	Destroyer: 3,
	Cruiser: 4,
	Battleship: 5
};
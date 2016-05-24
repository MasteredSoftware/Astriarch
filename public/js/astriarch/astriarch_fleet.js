var Astriarch = Astriarch || require('./astriarch_base');

/**
 * A Fleet is a collection of starships with a space platform
 * @constructor
 */
Astriarch.Fleet = function(/*Player*/ p) {
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

		this.Owner = p;//backreference to player (or ClientPlayer on client)
};

Astriarch.Fleet.Static = {
	SPACE_PLATFORM_STRENGTH: 64,//TODO: twice the strength of a battleship, is this good?
	getStrengthDetailsForShips: function(ships){
		var details = {strength: 0, maxStrength:0, damageAmount:0, percentDamage:0, color:null, percentDamageText: "", damageText: ""};
		for(var i = 0; i < ships.length; i++) {
			var s = ships[i];
			details.strength += s.Strength();
			details.maxStrength += s.MaxStrength();
			details.damageAmount += s.DamageAmount;
		}
		details.percentDamage = details.maxStrength == 0 ? 0 : details.damageAmount / details.maxStrength;
		var percentDamageFriendly = details.percentDamage ? ((1 - details.percentDamage) * 100).toFixed(1) : 100;
		details.percentDamageText = ships.length == 0 ? "" : percentDamageFriendly + "%";
		details.damageText = details.strength + "/" + details.maxStrength;
		if(details.percentDamage == 0)
			details.color = "green";
		else if(details.percentDamage < 0.25)
			details.color = "yellow";
		else if(details.percentDamage < 0.5)
			details.color = "orange";
		else
			details.color = "red";
		return details;
	}
};

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
};

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
			if (typeArray[i].Strength() <= 0){
				typeArray.splice(i, 1);
			}
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
	includeSpacePlatformDefence = includeSpacePlatformDefence || true;
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

	var newFleet = new Astriarch.Fleet(this.Owner);
	newFleet.LocationHex = this.LocationHex;

	if (scoutCount > this.StarShips[Astriarch.Fleet.StarShipType.Scout].length ||
		destoyerCount > this.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length ||
		cruiserCount > this.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length ||
		battleshipCount > this.StarShips[Astriarch.Fleet.StarShipType.Battleship].length)
	{
		console.error("Cannot send more ships than in the fleet!", scoutCount, destoyerCount, cruiserCount, battleshipCount, this.StarShips);
        scoutCount = Math.min(scoutCount, this.StarShips[Astriarch.Fleet.StarShipType.Scout].length);
        destoyerCount = Math.min(destoyerCount, this.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length);
        cruiserCount = Math.min(cruiserCount, this.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length);
        battleshipCount = Math.min(battleshipCount, this.StarShips[Astriarch.Fleet.StarShipType.Battleship].length);
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

/// <summary>
/// Creates a new fleet with the ships specified, removing the ships from this fleet
/// </summary>
/// <param name="scouts">array of starship ids</param>
/// <param name="destoyers">array of starship ids</param>
/// <param name="cruisers">array of starship ids</param>
/// <param name="battleships">array of starship ids</param>
/// <returns>the new fleet</returns>
/**
 * Splits this fleet off into another fleet
 * @this {Astriarch.Fleet}
 * @return {Astriarch.Fleet} the new fleet
 */
Astriarch.Fleet.prototype.SplitFleetWithShipIds = function(scouts, destoyers, cruisers, battleships) {//returns Fleet

	var newFleet = new Astriarch.Fleet(this.Owner);
	newFleet.LocationHex = this.LocationHex;

	var moveShipsToFleet = function(sourceFleet, destFleet, starShipType, idsToMove) {
		var sourceStarShipArray = sourceFleet.StarShips[starShipType];
		for(var j = 0; j < idsToMove.length; j++) {
			for(var i = sourceStarShipArray.length - 1; i >= 0; i--) {
				if(sourceStarShipArray[i].id == idsToMove[j]) {
					var ship = sourceStarShipArray[i];
					destFleet.StarShips[starShipType].push(ship);
					sourceStarShipArray.splice(i, 1);
					break;
				}
			}
		}
	};

	moveShipsToFleet(this, newFleet, Astriarch.Fleet.StarShipType.Scout, scouts);

	moveShipsToFleet(this, newFleet, Astriarch.Fleet.StarShipType.Destroyer, destoyers);

	moveShipsToFleet(this, newFleet, Astriarch.Fleet.StarShipType.Cruiser, cruisers);

	moveShipsToFleet(this, newFleet, Astriarch.Fleet.StarShipType.Battleship, battleships);

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
	var f = new Astriarch.Fleet(this.Owner);

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
Astriarch.Fleet.prototype.RepairFleet = function(maxStrengthToRepair){
	var totalStrengthRepaired = 0;
	var amountRepaired = 0;
	var allEligibleStarShips = [];

	if(this.LocationHex.PlanetContainedInHex.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length > 0){

		//space platforms, cruisers and battleships all need a factory and a spaceplatform for repairs
		if(this.LocationHex.PlanetContainedInHex.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform].length > 0){
			amountRepaired = Math.min(maxStrengthToRepair, this.SpacePlatformDamage);
			this.SpacePlatformDamage -= amountRepaired;
			maxStrengthToRepair -= amountRepaired;
			totalStrengthRepaired += amountRepaired;

			allEligibleStarShips = allEligibleStarShips.concat(this.StarShips[Astriarch.Fleet.StarShipType.Battleship]);
			allEligibleStarShips = allEligibleStarShips.concat(this.StarShips[Astriarch.Fleet.StarShipType.Cruiser]);
		}
		allEligibleStarShips = allEligibleStarShips.concat(this.StarShips[Astriarch.Fleet.StarShipType.Destroyer]);
	}
	allEligibleStarShips = allEligibleStarShips.concat(this.StarShips[Astriarch.Fleet.StarShipType.Scout]);
	allEligibleStarShips = allEligibleStarShips.concat(this.StarShips[Astriarch.Fleet.StarShipType.SystemDefense]);

	for (var e in allEligibleStarShips)
	{
		amountRepaired = allEligibleStarShips[e].RepairStarShip(maxStrengthToRepair);
		totalStrengthRepaired += amountRepaired;
		maxStrengthToRepair -= amountRepaired;
		if(maxStrengthToRepair <= 0){
			break;
		}
	}


	return totalStrengthRepaired;
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
	this.id = Astriarch.Fleet.StarShip.Static.NEXT_STARSHIP_ID++;
	this.Type = type;

	this.BaseStarShipStrength = 0;
	//TODO: could eventually allow ship upgrades? to improve on base strength

	this.DamageAmount = 0;//starships will heal between turns if the planet has the necessary building and the player has the requisite resources
	this.ExperienceAmount = 0;//each time a starship damages an opponent the experience amount increases by the damage amount

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
 * Get a starships's total Strength
 * @this {Astriarch.Fleet.StarShip}
 * @return {number} the starship's strength
 */
Astriarch.Fleet.StarShip.prototype.Strength = function() {
	return this.MaxStrength() - this.DamageAmount;
};

/**
 * Get a starships's maximum Strength (not including damage)
 * @this {Astriarch.Fleet.StarShip}
 * @return {number} the starship's max strength
 */
Astriarch.Fleet.StarShip.prototype.MaxStrength = function() {
	return this.BaseStarShipStrength + this.StrengthBoostFromLevel();
};

/**
 * Get a starships's level strength boost
 * @this {Astriarch.Fleet.StarShip}
 * @return {number} the additional starship strength based on it's level
 */
Astriarch.Fleet.StarShip.prototype.StrengthBoostFromLevel = function() {
	var level = this.Level().level;
	if(level <= 2) {
		return level * (this.BaseStarShipStrength/4);
	}
	//at some level the ship's strength should be about 3 times it's base strength
	//well use the log function to figure out at a given level for a certain ship what the proper boost should be
	var x = 9;//the target level (which is somewhat difficult to achieve)
	var y = this.BaseStarShipStrength * 2;
	var b = Math.pow(x,(1/y));
	return Math.round(Math.log(level)/Math.log(b));//b^y=x
};

/**
 * Get a starships's level based on experience points
 * @this {Astriarch.Fleet.StarShip}
 * @return {number} {level: 1, nextLevelExpRequirement: 4}
 */
Astriarch.Fleet.StarShip.prototype.Level = function() {
	var level = -1;
	var levelExpRequirement = this.BaseStarShipStrength / 2;
	//for the ship to make it to level 1 it must have 1/2 the base strength in experience points
	// after that the experience needed for each level = previous level exp + round((previous level exp)/2);
	var foundLevel = false;
	while(!foundLevel) {
		if(this.ExperienceAmount < levelExpRequirement) {
			foundLevel = true;
		}
		levelExpRequirement += levelExpRequirement + Math.round(levelExpRequirement/2);
		level++;
	}
	return {level: level, nextLevelExpRequirement: levelExpRequirement};
};

/**
 * Copies the properties of this starship
 * @this {Astriarch.Fleet.StarShip}
 * @return {Astriarch.Fleet.StarShip} the copied starship
 */
Astriarch.Fleet.StarShip.prototype.CloneStarShip = function(){//returns StarShip
	var s = new Astriarch.Fleet.StarShip(this.Type);
	s.DamageAmount = this.DamageAmount;
	s.ExperienceAmount = this.ExperienceAmount;
	return s;
};

/**
 * Repairs this starship up to max strength to repair
 * @this {Astriarch.Fleet.StarShip}
 * @return {Number} the amount repaired
 */
Astriarch.Fleet.StarShip.prototype.RepairStarShip = function(maxStrengthToRepair){//returns Number
	var amountRepaired = Math.min(maxStrengthToRepair, this.DamageAmount);
	this.DamageAmount -= amountRepaired;
	return amountRepaired;
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

	GenerateShips: function(/*Player*/p, /*StarShipType*/ type, /*int*/ number, /*Hexagon*/ locationHex)//returns Fleet
	{
		var f = new Astriarch.Fleet(p);
		f.LocationHex = locationHex;
		for (var i = 0; i < number; i++)
			f.StarShips[type].push(new Astriarch.Fleet.StarShip(type));
		return f;
	},

	GenerateFleetWithShipCount: function(/*Player*/p, defenders, scouts, destroyers, cruisers, battleships, /*Hexagon*/ locationHex){//returns Fleet
		var f = new Astriarch.Fleet(p);
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
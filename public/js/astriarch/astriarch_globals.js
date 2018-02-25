var Astriarch = Astriarch || require('./astriarch_base');

Astriarch.NextRandom = function(lowInclusive, highExclusive) {

	if(highExclusive === null || typeof highExclusive == "undefined")
	{
		highExclusive = lowInclusive;
		lowInclusive = 0;
	}

	if(lowInclusive < 0)
		highExclusive += Math.abs(lowInclusive);
	else
		highExclusive -= lowInclusive;

	return Math.floor(Math.random()*highExclusive) + lowInclusive;
};

Astriarch.NextRandomFloat = function(lowInclusive, highExclusive) {
	return Math.random() * (highExclusive - lowInclusive) + lowInclusive;
};

Astriarch.DecimalToFixed = function(number, maxDecimalPlaces) {
	return number ? (Math.round(number) != number ? number.toFixed(maxDecimalPlaces).replace(/0+$/, '') : number) : number;
};

//could add as prototype to object but that may cause problems:
//http://stackoverflow.com/questions/5223/length-of-javascript-associative-array
Astriarch.CountObjectKeys = function(obj) {
	var count = 0;
	for (var k in obj)
      count++;
	return count;
};

Number.prototype.compareTo = function(num) {
	 if (typeof num != "number") return false; // if number is not of type number return false

	 if (num < this) return 1;
	 else if (num > this) return -1;
	 else return 0;
};

Astriarch.GameTools = {

	OpponentOptionToFriendlyString: function(opponentOption){
		var friendlyString = "";
		switch(opponentOption.type){
			case -2:
				friendlyString = "Closed";
				break;
			case -1:
				friendlyString = "Open";
				break;
			case Astriarch.Player.PlayerType.Human:
				friendlyString = "Human Player: " + opponentOption.name;
				break;
			case Astriarch.Player.PlayerType.Computer_Easy:
				friendlyString = "Easy Computer";
				break;
			case Astriarch.Player.PlayerType.Computer_Normal:
				friendlyString = "Normal Computer";
				break;
			case Astriarch.Player.PlayerType.Computer_Hard:
				friendlyString = "Hard Computer";
				break;
			case Astriarch.Player.PlayerType.Computer_Expert:
				friendlyString = "Expert Computer";
				break;
		}
		return friendlyString;
	},

	PlanetOwnerToFriendlyName: function(/*Astriarch.Planet.PlanetType*/ type, /*ClientPlayer*/ planetOwner){//returns string
		var owner = (type == Astriarch.Planet.PlanetType.AsteroidBelt) ? "None" : "Natives";
		if (planetOwner != null)
			owner = planetOwner.Name;

		return owner;
	},

	PlanetTypeToFriendlyName: function(/*PlanetType*/ t){//returns string
		var typeName = "Asteroid Belt";
		if (t == Astriarch.Planet.PlanetType.DeadPlanet)
			typeName = "Dead";
		else if (t == Astriarch.Planet.PlanetType.PlanetClass1)
			typeName = "Arid";//formerly "Mineral Rich"
		else if (t == Astriarch.Planet.PlanetType.PlanetClass2)
			typeName = "Terrestrial";

		return typeName;
	},

	PlanetImprovementTypeToFriendlyName: function(/*PlanetImprovementType*/ t){//returns string
		var name = "";
		switch(t)
		{
			case Astriarch.Planet.PlanetImprovementType.Factory:
				name = "Factory";
				break;
			case Astriarch.Planet.PlanetImprovementType.Colony:
				name = "Colony";
				break;
			case Astriarch.Planet.PlanetImprovementType.Farm:
				name = "Farm";
				break;
			case Astriarch.Planet.PlanetImprovementType.Mine:
				name = "Mine";
				break;
		}
		return name;
	},

	PlanetImprovementTypeToHelpText: function(/*PlanetImprovementType*/ t){//returns string
		var helpText = "";
		switch (t)
		{
			case Astriarch.Planet.PlanetImprovementType.Farm:
				helpText = "Farms increase amount of Food produced by each farmer.";
				break;
			case Astriarch.Planet.PlanetImprovementType.Mine:
				helpText = "Mines increase the amount of Ore and Iridium produced by each miner.";
				break;
			case Astriarch.Planet.PlanetImprovementType.Factory:
				helpText = "Factories increase the production generated by each worker.\r\n" +
                           "Allows construction of Space Platforms and Destroyers.";
				break;
			case Astriarch.Planet.PlanetImprovementType.Colony:
				helpText = "Colonies increase the planet's maximum population by one.";
				break;
		}

		return helpText;
	},

	ResearchTypeToHelpText: function(/*Astriarch.Research.ResearchType*/ t){//returns string
		var helpText = "";
		switch (t)
		{
			case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DEFENDER:
				helpText = "Create a new Custom Ship with the Defender Hull Type";
				break;
			case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_SCOUT:
				helpText = "Create a new Custom Ship with the Scout Hull Type";
				break;
			case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DESTROYER:
				helpText = "Create a new Custom Ship with the Destroyer Hull Type";
				break;
			case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_CRUISER:
				helpText = "Create a new Custom Ship with the Cruiser Hull Type";
				break;
			case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_BATTLESHIP:
				helpText = "Create a new Custom Ship with the Battleship Hull Type";
				break;
			case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK:
				helpText = "Improves ship attack by up to 50%";
				break;
			case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
				helpText = "Improves ship defense by up to 50%";
				break;
			case Astriarch.Research.ResearchType.PROPULSION_IMPROVEMENT:
				helpText = "Improves ship speed";
				break;
			case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
				helpText = "Boost Farm effectiveness to as much as 200% of normal";
				break;
			case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
				helpText = "Boost Mine effectiveness to as much as 200% of normal";
				break;
			case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
				helpText = "Increase Population growth and Gold generation on planets with colonies";
				break;
			case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
				helpText = "Boost Farm effectiveness to as much as 200% of normal";
				break;
		}

		return helpText;
	},

	StarShipTypeToFriendlyName: function(/*StarShipType*/ t) {
		var name = "";
		switch(t)
		{
			case Astriarch.Fleet.StarShipType.SystemDefense:
				name = "Defender";
				break;
			case Astriarch.Fleet.StarShipType.Scout:
				name = "Scout";
				break;
			case Astriarch.Fleet.StarShipType.Destroyer:
				name = "Destroyer";
				break;
			case Astriarch.Fleet.StarShipType.Cruiser:
				name = "Cruiser";
				break;
			case Astriarch.Fleet.StarShipType.Battleship:
				name = "Battleship";
				break;
			case Astriarch.Fleet.StarShipType.SpacePlatform:
				name = "Space Platform";
				break;
		}
		return name;
	},

	StarShipTypeToHelpText: function(/*Astriarch.Planet.StarShipInProduction*/ ssip){
		var helpText = "";
		switch (ssip.Type)
		{
			case Astriarch.Fleet.StarShipType.SystemDefense:
				helpText = "Defenders protect a planet from attacking fleets but cannot move between planets.\r\n";
				break;
			case Astriarch.Fleet.StarShipType.Scout:
				helpText = "Scouts are the weakest ship equipped with warp drive.\r\n";
				break;
			case Astriarch.Fleet.StarShipType.Destroyer:
				helpText = "Destroyers require a Factory in order to build and are twice the strength of a Scout.\r\n";
				break;
			case Astriarch.Fleet.StarShipType.Cruiser:
				helpText = "Cruisers require a Space Platform in order to build and are twice the strength of a Destroyer.\r\n";
				break;
			case Astriarch.Fleet.StarShipType.Battleship:
				helpText = "Battleships require a Space Platform in order to build and are twice the strength of a Cruiser.\r\n";
				break;
			case Astriarch.Fleet.StarShipType.SpacePlatform:
				helpText = "Space Platforms provide planetary defense.\r\n" +
					"Allows construction of Cruisers and Battleships.\r\n" +
					"Advantage against: All ships, Disadvantage Against: None";
				break;
		}

		if(ssip.Type != Astriarch.Fleet.StarShipType.SpacePlatform) {
			helpText += "Advantage against: " + Astriarch.GameTools.StarShipTypeToFriendlyName(ssip.AdvantageAgainstType) + ", Disadvantage Against: " + Astriarch.GameTools.StarShipTypeToFriendlyName(ssip.DisadvantageAgainstType);
		}

		return helpText;
	},

	PlanetTypeToClassName: function(/*Astriarch.Planet.PlanetType*/planetType){
		var planetImageClass = null;
		switch (planetType) {
			case Astriarch.Planet.PlanetType.PlanetClass2:
				planetImageClass = "icon-32x32-PlanetClass2";
				break;
			case Astriarch.Planet.PlanetType.PlanetClass1:
				planetImageClass = "icon-32x32-PlanetClass1";
				break;
			case Astriarch.Planet.PlanetType.DeadPlanet:
				planetImageClass = "icon-32x32-PlanetDead";
				break;
			case Astriarch.Planet.PlanetType.AsteroidBelt:
				planetImageClass = "icon-32x32-PlanetAsteroid";
				break;
		}
		return planetImageClass;
	},

	PlanetImprovementTypeToClassName: function(/*PlanetImprovementType*/ t){
		var friendlyName = Astriarch.GameTools.PlanetImprovementTypeToFriendlyName(t).replace(' ', '');
		return 'icon-32x32-'+friendlyName+'Large';
	},

	StarShipTypeToClassName: function(/*StarShipType*/ t, isCustom){
		var friendlyName = Astriarch.GameTools.StarShipTypeToFriendlyName(t);
		return 'icon-32x32-'+friendlyName + (isCustom ? 'Custom' : '') + 'Large';
	},

	ResearchTypeToClassName: function(/*Astriarch.Research.ResearchType*/ t) {
		var className = '';
		switch(t) {
			case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DEFENDER:
				className = 'icon-32x32-DefenderCustomLarge';
				break;
			case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_SCOUT:
				className = 'icon-32x32-ScoutCustomLarge';
				break;
			case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DESTROYER:
				className = 'icon-32x32-DestroyerCustomLarge';
				break;
			case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_CRUISER:
				className = 'icon-32x32-CruiserCustomLarge';
				break;
			case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_BATTLESHIP:
				className = 'icon-32x32-BattleshipCustomLarge';
				break;
			case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK:
				className = 'icon-32x32-ResearchAttack';
				break;
			case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
				className = 'icon-32x32-ResearchDefense';
				break;
			case Astriarch.Research.ResearchType.PROPULSION_IMPROVEMENT:
				className = 'icon-32x32-ResearchPropulsion';
				break;
			case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
				className = 'icon-32x32-FarmLarge';
				break;
			case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
				className = 'icon-32x32-MineLarge';
				break;
			case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
				className = 'icon-32x32-ColonyLarge';
				break;
			case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
				className = 'icon-32x32-FactoryLarge';
				break;
			case Astriarch.Research.ResearchType.SPACE_PLATFORM_IMPROVEMENT:
				className = 'icon-32x32-SpacePlatformLarge';
				break;
		}
		return className;
	}

};//Astriarch.GameTools

Astriarch.Util = {

	//image data hard-coded here to get around having to draw an image to a canvas in order to change the pixels
	starshipImageData: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,0,0,0,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0],
	spaceplatformImageData: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,128,0,255,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],

	imageDataByColorRGBA: {},//indexed by ColorRGBA.toString(), value is {starshipImageData:[], spaceplatformImageData:[]}

	GetImageData: function(color){
		var key = color.toString();
		if(!(key in Astriarch.Util.imageDataByColorRGBA)){
			Astriarch.Util.imageDataByColorRGBA[key] = {
							starshipImageData:Astriarch.Util.ChangeImageColor(Astriarch.Util.starshipImageData, color),
							spaceplatformImageData:Astriarch.Util.ChangeImageColor(Astriarch.Util.spaceplatformImageData, color)
			};
		}
		return Astriarch.Util.imageDataByColorRGBA[key];
	},

	ChangeImageColor: function(/*Image bitmap array*/ bmpArr, /*ColorRGBA*/ colorNew) {
		var retBmpArr = new Array(bmpArr.length);
		for (var i = 0; i < bmpArr.length; i+=4)
		{
			if (bmpArr[i+3] != 0)//if the pixel is non-transparent?
			{
				retBmpArr[i+0] = colorNew.r;//red
				retBmpArr[i+1] = colorNew.g;//green
				retBmpArr[i+2] = colorNew.b;//blue
			}
			else//just copy from our source to our return value
			{
				retBmpArr[i+0] = bmpArr[i+0];//red
				retBmpArr[i+1] = bmpArr[i+1];//green
				retBmpArr[i+2] = bmpArr[i+2];//blue
			}
			retBmpArr[i+3] = bmpArr[i+3];//alpha, keep it the same as the source
		}

		return retBmpArr;
	}

};//Astriarch.Util

/**
 * A ColorRGBA represents the red green blue and alpha of a color
 * @constructor
 */
Astriarch.Util.ColorRGBA = function(r, g, b, a) {
	this.r = r;//red
	this.g = g;//green
	this.b = b;//blue
	this.a = a;//alpha
};

/**
 * toString converts a ColorRGBA object to a string the canvas can recognize
 * @this {Astriarch.Util.ColorRGBA}
 * @return {string}
 */
Astriarch.Util.ColorRGBA.prototype.toString = function() {
	return 'rgba(' + this.r + ', ' + this.g + ', ' + this.b + ', ' + this.a + ')';
};

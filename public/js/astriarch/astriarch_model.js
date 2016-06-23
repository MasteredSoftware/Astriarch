var Astriarch = Astriarch || require('./astriarch_base');


/**
 * Model is our global game structure
 * @constructor
 */
Astriarch.Model = function(/*List<Player>*/ players, /*{SystemsToGenerate:4, PlanetsPerSystem:4, GalaxySize:1, DistributePlanetsEvenly: true, "TurnTimeLimitSeconds":0}*/ options, dontPopulatePlanets) {

	this.ShowUnexploredPlanetsAndEnemyPlayerStats = false;//for debugging for now, could eventually be used once a scanner is researched?

    this.GameOptions = new Astriarch.Model.GameOptions(options);

	this.Turn = new Astriarch.Model.Turn();

	this.TradingCenter = new Astriarch.TradingCenter();

	this.Players = players;
	this.PlayersDestroyed = [];

	this.galaxyWidth = 621.0;//TODO: externalize later
	this.galaxyHeight = 480.0;//TODO: externalize later
	this.GameGrid = new Astriarch.Grid(this.galaxyWidth, this.galaxyHeight, this.GameOptions);
	this.Planets = [];

	if(!dontPopulatePlanets)
		this.populatePlanets();
};

/**
 * GameOptions is a simple object for tracking the options selected when the game was created
 * @constructor
 */
Astriarch.Model.GameOptions = function(options) {
	this.SystemsToGenerate = options.SystemsToGenerate;

	this.GalaxySize = options.GalaxySize || Astriarch.Model.GalaxySizeOption.LARGE;

	this.PlanetsPerSystem = options.PlanetsPerSystem;
	//limit planets per system to 6 if GalaxySize is SMALL
	if(this.GalaxySize == Astriarch.Model.GalaxySizeOption.SMALL && this.PlanetsPerSystem > Astriarch.Model.PlanetsPerSystemOption.SIX) {
		this.PlanetsPerSystem = Astriarch.Model.PlanetsPerSystemOption.SIX;
	}

	this.DistributePlanetsEvenly = options.DistributePlanetsEvenly;

	this.TurnTimeLimitSeconds = options.TurnTimeLimitSeconds || 0;
	//public bool EnsureEachSystemContainsAllPlanetTypes = true;//TODO: implement if false every planet type (except home) will be randomly selected
};

/**
 * Returns the planet object corresponding to a given Id
 * @this {Astriarch.Model}
 */
Astriarch.Model.prototype.getPlanetById = function(id){
	for(var i = 0; i < this.Planets.length; i++){
		if(this.Planets[i].Id == id){
			return this.Planets[i];
		}
	}
	return null;
};

/**
 * Returns the player object corresponding to a given Id
 * @this {Astriarch.Model}
 */
Astriarch.Model.prototype.getPlayerById = function(id){
	var player = null;
	for (var i in this.Players)
	{
		var p = this.Players[i];//Player
		if(p.Id == id){
			player = p;
			break;
		}
	}

	if(!player){
		//player was destroyed
		for (var i in this.PlayersDestroyed)
		{
			var p = this.PlayersDestroyed[i];//Player
			if(p.Id == id){
				player = p;
				break;
			}
		}
	}
	return player;
};

/**
 * Populates the planets in the model based on the game options 
 * @this {Astriarch.Model}
 */
Astriarch.Model.prototype.populatePlanets = function(){
	
	for (var q = 0; q < this.GameGrid.Quadrants.length; q++) {
		var r = this.GameGrid.Quadrants[q];/*Rect*/


		//get a list of hexes inside this quadrant
		var subQuadrantHexes = []; //List<List<Hexagon>>

		for (var iSQ = 0; iSQ < r.Children.length; iSQ++) {
			var sub = r.Children[iSQ];//Rect
			subQuadrantHexes[iSQ] = [];

			for (var i in this.GameGrid.Hexes) {
				var h = this.GameGrid.Hexes[i];
				//var testPoint = q == 0 ? h.TopLeftPoint : q == 1 ? h.TopRightPoint : q == 3 ? h.BottomLeftPoint : h.BottomRightPoint;
				if ( sub.Contains(h.MidPoint) ) {
					//the hex is inside the quadrant and possibly an outlier on the edge
					//and the hex doesn't lie on the outside of the sub-quadrant
					subQuadrantHexes[iSQ].push(h);
				}
			}
		}

		if (this.GameOptions.SystemsToGenerate == 2 && (q == 1 || q == 3))
			continue;

		var possiblePlanetTypes = [];//new List<PlanetType>
		possiblePlanetTypes.push(Astriarch.Planet.PlanetType.PlanetClass1);
		possiblePlanetTypes.push(Astriarch.Planet.PlanetType.DeadPlanet);
		possiblePlanetTypes.push(Astriarch.Planet.PlanetType.AsteroidBelt);

		for (var iSQ = 0; iSQ < r.Children.length; iSQ++) {
			var chosenPlanetSubQuadrant = iSQ;
			if(!this.GameOptions.DistributePlanetsEvenly){
				do {
					chosenPlanetSubQuadrant = Astriarch.NextRandom(0, r.Children.length);
				} while (subQuadrantHexes[chosenPlanetSubQuadrant].length == 0)
			}
			//pick a planet bounding hex at random from the sub-quadrant (at least for now)
			var hexPos = Astriarch.NextRandom(0, subQuadrantHexes[chosenPlanetSubQuadrant].length);
			var planetBoundingHex = subQuadrantHexes[chosenPlanetSubQuadrant][hexPos];//Hexagon
			subQuadrantHexes[chosenPlanetSubQuadrant].splice(hexPos, 1);//remove this hex as an option


			//get at least one planet of each type, prefer the highest class planet
			//int type = (Model.PLANETS_PER_QUADRANT - 1) - iSQ;
			var type = 3;
			var pt = Astriarch.Planet.PlanetType.PlanetClass2;
			if (iSQ > 0 && possiblePlanetTypes.length <= 3) {
				type = Astriarch.NextRandom(0, possiblePlanetTypes.length);
				pt = possiblePlanetTypes[type];
				possiblePlanetTypes.splice(type, 1);
			}
			
			var initialPlanetOwner = null;//Player

			var assignPlayer = false;
			var assignedPlayerIndex = 0;

			//it's a home planet, we'll see if we should assign a player
			if (pt == Astriarch.Planet.PlanetType.PlanetClass2) {
				//TODO: make this more intelligent, based on # of players
				if (q == 0) {
					assignPlayer = true;
				} else if (this.Players.length == 2) {
					if (q == 2) {
						assignPlayer = true;
						assignedPlayerIndex = 1;
						
					}
				} else if (q < this.Players.length) {
					assignPlayer = true;
					assignedPlayerIndex = q;
				}
			}

			if (assignPlayer) {
				initialPlanetOwner = this.Players[assignedPlayerIndex];
				initialPlanetOwner.SetColor(Astriarch.Model.PlayerColors[assignedPlayerIndex]);
			}

			var p = new Astriarch.Planet(pt, planetBoundingHex.Id, planetBoundingHex, initialPlanetOwner);
			//if we set an initial owner, give the planet 2 ore and 1 iridium
			if(initialPlanetOwner) {
				initialPlanetOwner.HomePlanetId = p.Id;
				p.Resources.OreAmount = 2;
				p.Resources.IridiumAmount = 1;
			}

			this.Planets.push(p);
		}

		if (this.GameOptions.PlanetsPerSystem != Astriarch.Model.PlanetsPerSystemOption.FOUR) {
			var quadrantChances = [25, 25, 25, 25];

			var chanceToGetAsteroid = 40;
			var chanceToGetDead = 34;
			var chanceToGetClass1 = 26;

			for (var iPlanet = 4; iPlanet < this.GameOptions.PlanetsPerSystem; iPlanet++) {
				var hexFound = false;

				while (!hexFound) {
					//pick sub quadrant to put the planet in
					//TODO: should we have another option to evenly space out the picking of quadrants? so that you don't end up with 5 planets in one quadrant potentially?

					for(iSQ = 0; iSQ < quadrantChances.length; iSQ++) {
						if(!subQuadrantHexes[iSQ].length) {
							continue;
						}
						var chance = quadrantChances[iSQ];
						var max = quadrantChances.reduce(function(a, b) { return a + b; }, 0);
						if (Astriarch.NextRandom(0, max) < chance) {
							//pick a planet bounding hex at random from the sub-quadrant (at lest for now)
							var hexPos = Astriarch.NextRandom(0, subQuadrantHexes[iSQ].length);
							var planetBoundingHex = subQuadrantHexes[iSQ][hexPos];//Hexagon
							subQuadrantHexes[iSQ].splice(hexPos, 1);//remove this hex as an option
							//now that we've picked a quadrant, subtract some off the chances for next time
							quadrantChances[iSQ] -= 6;
							break;
						}
					}

					if (planetBoundingHex.PlanetContainedInHex != null)
						continue;


					//hex has been found, now randomly choose planet type
					//this logic prefers asteroids then dead then class1 and decreases our chances each time

					var pt = Astriarch.Planet.PlanetType.PlanetClass1;
					max = chanceToGetAsteroid + chanceToGetDead + chanceToGetClass1;
					if (Astriarch.NextRandom(0, max) > chanceToGetClass1) {
						pt = Astriarch.Planet.PlanetType.DeadPlanet;
						if (Astriarch.NextRandom(0, max) > chanceToGetDead) {
							pt = Astriarch.Planet.PlanetType.AsteroidBelt;
							chanceToGetAsteroid -= 15;
						} else {
							chanceToGetDead -= 15;
						}
					} else {
						chanceToGetClass1 -= 15;
					}

					var p = new Astriarch.Planet(pt, planetBoundingHex.Id, planetBoundingHex, null);//Planet

					this.Planets.push(p);

					hexFound = true;
				}
			}
		}

	}//foreach quadrant

};//populate planets

Astriarch.Model.PlayerColors = [
	new Astriarch.Util.ColorRGBA(0, 255, 0, 255),//Light Green
	new Astriarch.Util.ColorRGBA(200, 0, 200, 255),//Light Purple
	new Astriarch.Util.ColorRGBA(0, 128, 255, 255),//Light Blue
	new Astriarch.Util.ColorRGBA(255, 0, 0, 255)//Light Red
];

/**
 * Turn is a very simple object for tracking the turn number
 * @constructor
 */
Astriarch.Model.Turn = function() {
	this.Number = 1;
};

/**
 * Increments the turn number
 * @this {Astriarch.Model.Turn}
 */
Astriarch.Model.Turn.prototype.Next = function() {
	this.Number++;
};

Astriarch.Model.PlanetsPerSystemOption = {FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8};

Astriarch.Model.GalaxySizeOption = {SMALL: 1, MEDIUM: 2, LARGE: 3}; //multiplier for Astriarch.Hexagon.Static

Astriarch.Model.GalaxySizeOptionToHexSizeMultiplier = function(galaxySize) {
	if(galaxySize == Astriarch.Model.GalaxySizeOption.LARGE) {
		return 1;
	}
	var hexesInRow = galaxySize == Astriarch.Model.GalaxySizeOption.MEDIUM ? 4 : 3;

	var galaxyWidth = 621;
	//calculate hex multiplier
	var multiplier = (hexesInRow * Astriarch.Hexagon.Static.WIDTH) + (hexesInRow * Astriarch.Hexagon.Static.SIDE) + Astriarch.Hexagon.Static.X;
	return galaxyWidth/multiplier;
};

/**
 * WorkingPlayerResources is the players resources at the global level
 * @constructor
 */
Astriarch.Model.WorkingPlayerResources = function(player, workingPlayerResources) {
	if(player){
		this.GoldAmount = player.Resources.GoldAmount;

		this.OreAmount = player.TotalOreAmount();

		this.IridiumAmount = player.TotalIridiumAmount();
	} else {
		this.GoldAmount = workingPlayerResources.GoldAmount;

		this.OreAmount = workingPlayerResources.OreAmount;

		this.IridiumAmount = workingPlayerResources.IridiumAmount;
	}
};
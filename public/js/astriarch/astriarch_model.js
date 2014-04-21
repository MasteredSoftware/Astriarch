var Astriarch = Astriarch || require('./astriarch_base');

/**
 * Model is our global game structure
 * @constructor
 */
Astriarch.Model = function(/*List<Player>*/ players, /*{systemsToGenerate:4, planetsPerSystem:4, distributePlanetsEvenly: true, "turnTimeLimitSeconds":0}*/ options, dontPopulatePlanets) {

	this.ShowUnexploredPlanetsAndEnemyPlayerStats = false;//for debugging for now, could eventually be used once a scanner is researched?

    this.SystemsToGenerate = options.systemsToGenerate;

    this.PlanetsPerSystem = options.planetsPerSystem;

	this.DistributePlanetsEvenly = options.distributePlanetsEvenly;

	this.TurnTimeLimitSeconds = options.turnTimeLimitSeconds;
    //public bool EnsureEachSystemContainsAllPlanetTypes = true;//TODO: implement if false every planet type (except home) will be randomly selected

	this.Turn = new Astriarch.Model.Turn();

	this.Players = players;
	this.PlayersDestroyed = [];
	
	this.GameGrid = new Astriarch.Grid(615.0, 480.0);//TODO: externalize later
	this.Planets = [];
	this.galaxyWidth = 615.0;//TODO: externalize later
	this.galaxyHeight = 480.0;//TODO: externalize later
	
	this.Quadrants = [];//List<Rect>
	this.SubQuadrants = [];//List<List<Rect>>

	var x, y, width, height;
	x = 0;
	y = 0;
	width = this.galaxyWidth / 2;
	height = this.galaxyHeight / 2;
	if (this.SystemsToGenerate == 2 || this.SystemsToGenerate == 4)
	{
		//[0 , 0]
		this.Quadrants.push(new Astriarch.Model.Rect(x, y, width, height));
		//[0 , 1]
		x = width;
		this.Quadrants.push(new Astriarch.Model.Rect(x, y, width, height));
		//[1 , 1]
		y = height;
		this.Quadrants.push(new Astriarch.Model.Rect(x, y, width, height));
		//[1 , 0]
		x = 0;
		this.Quadrants.push(new Astriarch.Model.Rect(x, y, width, height));
	}
	else//we're generating 3 systems in a triangle arrangement
	{
		//[0 , 0]
		this.Quadrants.push(new Astriarch.Model.Rect(x, y, width, height));
		//[0 , 1]
		x = width;
		this.Quadrants.push(new Astriarch.Model.Rect(x, y, width, height));
		//[middle]
		x = width/2;
		y = height;
		this.Quadrants.push(new Astriarch.Model.Rect(x, y, width, height));
	}

	if(!dontPopulatePlanets)
		this.populatePlanets();
};

/**
 * Populates the planets in the model based on the game options 
 * @this {Astriarch.Model}
 */
Astriarch.Model.prototype.populatePlanets = function(){
	
	for (var q = 0; q < this.Quadrants.length; q++)
	{
		var r = this.Quadrants[q];/*Rect*/

		//build sub-quadrants for each quadrant
		var subQuadrants = [];//List<Rect>
		var subWidth = r.Width / 2;
		var subHeight = r.Height / 2;
		//insert for the corner sub-quadrants
		//this will prefer this sub-quadrant for the home planet

		var r0Sub = new Astriarch.Model.Rect(r.X, r.Y, subWidth, subHeight);
		subQuadrants.push(r0Sub);

		var r1Sub = new Astriarch.Model.Rect(r.X + subWidth, r.Y, subWidth, subHeight);
		if(q == 1)
			subQuadrants.splice(0, 0, r1Sub);
		else
			subQuadrants.push(r1Sub);

		var r2Sub = new Astriarch.Model.Rect(r.X + subWidth, r.Y + subHeight, subWidth, subHeight);
		if (q == 2)
			subQuadrants.splice(0, 0, r2Sub);
		else
			subQuadrants.push(r2Sub);

		var r3Sub = new Astriarch.Model.Rect(r.X, r.Y + subHeight, subWidth, subHeight);
		if(q == 3)
			subQuadrants.splice(0, 0, r3Sub);
		else
			subQuadrants.push(r3Sub);


		this.SubQuadrants.push(subQuadrants);//save this just for debugging

		//get a list of hexes inside this quadrant
		var subQuadrantHexes = []; //List<List<Hexagon>>
		var subQuadrantBoundedHexes = []; //List<List<Hexagon>>
		for (var iSQ = 0; iSQ < subQuadrants.length; iSQ++)
		{
			var sub = subQuadrants[iSQ];//Rect
			subQuadrantHexes[iSQ] = new Array();
			subQuadrantBoundedHexes[iSQ] = new Array();
			for (var i in this.GameGrid.Hexes)//Hexagon
			{
				var h = this.GameGrid.Hexes[i];
				if (sub.Left !== h.TopLeftPoint.X && sub.Top !== h.TopLeftPoint.Y &&
					sub.Right !== h.BottomRightPoint.X && sub.Bottom !== h.BottomRightPoint.Y &&
					sub.Contains(h.TopLeftPoint) && sub.Contains(h.BottomRightPoint))
				{
					//the hex is fully contained within this sub-quadrant
					//and the hex doesn't lie on the outside of the sub-quadrant
					subQuadrantHexes[iSQ].push(h);
					subQuadrantBoundedHexes[iSQ].push(h);
				}
				else if (sub.Contains(h.TopLeftPoint) && sub.Contains(h.BottomRightPoint))
				{
					//the hex is inside the quadrant and possibly an outlier on the edge
					subQuadrantBoundedHexes[iSQ].push(h);
				}
			}
		}

		if (this.SystemsToGenerate == 2 && (q == 1 || q == 3))
			continue;

		var possiblePlanetTypes = [];//new List<PlanetType>
		possiblePlanetTypes.push(Astriarch.Planet.PlanetType.PlanetClass1);
		possiblePlanetTypes.push(Astriarch.Planet.PlanetType.DeadPlanet);
		possiblePlanetTypes.push(Astriarch.Planet.PlanetType.AsteroidBelt);

		for (var iSQ = 0; iSQ < subQuadrants.length; iSQ++)
		{
			var chosenPlanetSubQuadrant = iSQ;
			if(!this.DistributePlanetsEvenly){
				do {
					chosenPlanetSubQuadrant = Astriarch.NextRandom(0, subQuadrants.length);
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
			if (iSQ > 0 && possiblePlanetTypes.length <= 3)
			{
				type = Astriarch.NextRandom(0, possiblePlanetTypes.length);
				pt = possiblePlanetTypes[type];
				possiblePlanetTypes.splice(type, 1);
			}
			
			var initialPlanetOwner = null;//Player

			var assignPlayer = false;
			var assignedPlayerIndex = 0;

			//it's a home planet, we'll see if we should assign a player
			if (pt == Astriarch.Planet.PlanetType.PlanetClass2)
			{
				//TODO: make this more intelligent, based on # of players
				if (q == 0)
				{
					assignPlayer = true;
				}
				else if (this.Players.length == 2)
				{
					if (q == 2)
					{
						assignPlayer = true;
						assignedPlayerIndex = 1;
						
					}
				}
				else if (q < this.Players.length)
				{
					assignPlayer = true;
					assignedPlayerIndex = q;
				}
			}

			if (assignPlayer)
			{
				initialPlanetOwner = this.Players[assignedPlayerIndex];
				initialPlanetOwner.SetColor(Astriarch.Model.PlayerColors[assignedPlayerIndex]);
			}

			var p = new Astriarch.Planet(pt, planetBoundingHex.Id, planetBoundingHex, initialPlanetOwner);
			//if we set an initial owner, give the planet 2 ore and 1 iridium
			if(initialPlanetOwner)
			{
				p.Resources.OreAmount = 2;
				p.Resources.IridiumAmount = 1;
			}

			this.Planets.push(p);
		}

		if (this.PlanetsPerSystem != Astriarch.Model.PlanetsPerSystemOption.FOUR)
		{
			var chanceQuadrant0 = 25;
			var chanceQuadrant1 = 25;
			var chanceQuadrant2 = 25;
			var chanceQuadrant3 = 25;

			var chanceToGetAsteroid = 50;
			var chanceToGetDead = 34;
			var chanceToGetClass1 = 16;

			for (var iPlanet = 4; iPlanet < this.PlanetsPerSystem; iPlanet++)
			{
				var hexFound = false;

				while (!hexFound)
				{
					//pick sub quadrant to put the planet in
					//TODO: should we have another option to evenly space out the picking of quadrants? so that you don't end up with 5 planets in one quadrant potentially?

					var iSQ = 0;
					var max = chanceQuadrant0 + chanceQuadrant1 + chanceQuadrant2 + chanceQuadrant3;
					if (Astriarch.NextRandom(0, max) > chanceQuadrant0)
					{
						iSQ = 1;
						if (Astriarch.NextRandom(0, max) > chanceQuadrant1)
						{
							iSQ = 2;
							if (Astriarch.NextRandom(0, max) > chanceQuadrant2)
							{
								iSQ = 3;
							}
						}
					}
						

					//pick a planet bounding hex at random from the sub-quadrant (at lest for now)
					var hexPos = Astriarch.NextRandom(0, subQuadrantBoundedHexes[iSQ].length);
					var planetBoundingHex = subQuadrantBoundedHexes[iSQ][hexPos];//Hexagon
					subQuadrantHexes[iSQ].splice(hexPos, 1);//remove this hex as an option

					if (planetBoundingHex.PlanetContainedInHex != null)
						continue;

					//now that we've picked a quadrant, subtract some off the chances for next time
					switch (iSQ)
					{
						case 0:
							chanceQuadrant0 -= 6;
							break;
						case 1:
							chanceQuadrant1 -= 6;
							break;
						case 2:
							chanceQuadrant2 -= 6;
							break;
						case 3:
							chanceQuadrant3 -= 6;
							break;
					}

					//hex has been found, now randomly choose planet type
					//this logic prefers asteroids then dead then class1 and decreases our chances each time

					var pt = Astriarch.Planet.PlanetType.PlanetClass1;
					max = chanceToGetAsteroid + chanceToGetDead + chanceToGetClass1;
					if (Astriarch.NextRandom(0, max) > chanceToGetClass1)
					{
						pt = Astriarch.Planet.PlanetType.DeadPlanet;
						if (Astriarch.NextRandom(0, max) > chanceToGetDead)
						{
							pt = Astriarch.Planet.PlanetType.AsteroidBelt;
							chanceToGetAsteroid -= 15;
						}
						else
							chanceToGetDead -= 15;
					}
					else
						chanceToGetClass1 -= 15;

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
 * Rect is another rectangle
 * @constructor
 */
Astriarch.Model.Rect = function(x, y, width, height) {
	this.X = x;
	this.Y = y;
	this.Width = width;
	this.Height = height;
	
	this.Left = x;
	this.Right = x + width;
	this.Top = y;
	this.Bottom = y + height;
};

/**
 * Contains for rect
 * @this {Astriarch.Model.Rect}
 * @param {Astriarch.Point} point the test point
 */
Astriarch.Model.Rect.prototype.Contains = function(/*Astriarch.Point*/ point) {
	if(this.Left <= point.X && this.Right >= point.X &&
		this.Bottom >= point.Y && this.Top <= point.Y)
		return true;
	else
		return false;
};

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


/**
 * WorkingPlayerResources is the players resources at the global level
 * @constructor
 */
Astriarch.Model.WorkingPlayerResources = function(player, workingPlayerResources) {
	if(player){
		this.GoldAmount = player.Resources.GoldAmount;
		this.GoldRemainder = 0.0;

		this.OreAmount = player.TotalOreAmount();
		this.OreRemainder = 0.0;

		this.IridiumAmount = player.TotalIridiumAmount();
		this.IridiumRemainder = 0.0;
	} else {
		this.GoldAmount = workingPlayerResources.GoldAmount;
		this.GoldRemainder = workingPlayerResources.GoldRemainder;

		this.OreAmount = workingPlayerResources.OreAmount;
		this.OreRemainder = workingPlayerResources.OreRemainder;

		this.IridiumAmount = workingPlayerResources.IridiumAmount;
		this.IridiumRemainder = workingPlayerResources.IridiumRemainder;
	}
};

/**
 * AccumulateResourceRemainders for our WorkingPlayerResources object
 * @this {Astriarch.Model.WorkingPlayerResources}
 */
Astriarch.Model.WorkingPlayerResources.prototype.AccumulateResourceRemainders = function() {

	if (this.GoldRemainder >= 1.0)
	{
		this.GoldAmount += Math.floor(this.GoldRemainder / 1.0);
		this.GoldRemainder = this.GoldRemainder % 1;
	}

	if (this.OreRemainder >= 1.0)
	{
		this.OreAmount += Math.floor(this.OreRemainder / 1.0);
		this.OreRemainder = this.OreRemainder % 1;
	}

	if (this.IridiumRemainder >= 1.0)
	{
		this.IridiumAmount += Math.floor(this.IridiumRemainder / 1.0);
		this.IridiumRemainder = this.IridiumRemainder % 1;
	}
};
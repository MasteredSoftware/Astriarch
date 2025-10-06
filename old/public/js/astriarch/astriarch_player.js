var Astriarch = Astriarch || require("./astriarch_base");

/**
 * A Player represents either the main player or computer players
 * @constructor
 */
Astriarch.Player = function(id, /*PlayerType*/ playerType, /*string*/ name) {
  this.Id = id;

  this.Type = playerType; //PlayerType

  this.Name = name;

  this.Resources = new Astriarch.Player.PlayerResources();

  this.Research = new Astriarch.Research();

  this.Color = new Astriarch.Util.ColorRGBA(0, 255, 0, 255); //green

  this.LastTurnFoodNeededToBeShipped = 0; //this is for computers to know how much gold to keep in surplus for food shipments

  this.OwnedPlanets = {}; //Dictionary<int, Planet>
  this.KnownClientPlanets = {}; //Dictionary<int, ClientPlanet>
  this.LastKnownPlanetFleetStrength = {}; //new Dictionary<int, LastKnownFleet>

  this.PlanetBuildGoals = {}; //Dictionary<int, PlanetProductionItem>

  this.HomePlanetId = null; //int

  this.EarnedPointsByType = {}; //indexed by Astriarch.Player.EarnedPointsType.key value is number of earned points for that type
  this.Points = 0; //computed value based on EarnedPointsByType

  this.FleetsInTransit = []; //List<Fleet>

  this.fleetsArrivingOnUnownedPlanets = {}; //Dictionary<int, Fleet>//indexed by planet id

  this.CurrentTurnEnded = false;
  this.Destroyed = false;
};

Astriarch.Player.EarnedPointsType = {
  POPULATION_GROWTH: { key: 0, points_per: 4, max_points: 100000 },
  PRODUCTION_UNIT_BUILT: { key: 1, points_per: 0.25, max_points: 500 },
  REPAIRED_STARSHIP_STRENGTH: { key: 2, points_per: 2, max_points: 4000 },
  DAMAGED_STARSHIP_STRENGTH: { key: 3, points_per: 0.5, max_points: 1000 },
  CITIZEN_ON_CAPTURED_PLANET: { key: 4, points_per: 10, max_points: 10000 }
};

/**
 * Increases the players points
 * @this {Astriarch.Player}
 */
Astriarch.Player.prototype.IncreasePoints = function(earnedPointsType, amount) {
  if (!(earnedPointsType.key in this.EarnedPointsByType)) {
    this.EarnedPointsByType[earnedPointsType.key] = 0;
  }

  if (this.EarnedPointsByType[earnedPointsType.key] < earnedPointsType.max_points) {
    this.EarnedPointsByType[earnedPointsType.key] += earnedPointsType.points_per * amount;
  }

  this.Points = 0;
  for (var i in this.EarnedPointsByType) {
    this.Points += this.EarnedPointsByType[i];
  }
  this.Points = Math.floor(this.Points);
  return this.Points;
};

/**
 * returns what the player would earn per turn in research and taxes
 * @this {Astriarch.Player}
 */
Astriarch.Player.prototype.GetTaxRevenueAtMaxPercent = function() {
  //determine tax revenue (gold)
  var totalPop = 0;
  for (var i in this.OwnedPlanets) {
    var p = this.OwnedPlanets[i]; //Planet
    var colonyCount = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Colony].length;
    if (colonyCount) {
      totalPop +=
        (this.Research.getResearchData(Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES)
          .percent -
          1.0) *
        colonyCount *
        2;
    }
    totalPop += p.Id == this.HomePlanetId ? p.Population.length * 2 : p.Population.length;
  }

  return totalPop / 1.5;
};

/**
 * sets the players rgba color
 * @this {Astriarch.Player}
 */
Astriarch.Player.prototype.SetColor = function(/*Astriarch.Util.ColorRGBA*/ colorNew) {
  Astriarch.Util.GetImageData(colorNew);
  this.Color = colorNew;
};

/**
 * returns an array of the Owned Planets sorted by population and improvement count descending
 * @this {Astriarch.Player}
 * @return {Array.<Astriarch.Planet>}
 */
Astriarch.Player.prototype.GetOwnedPlanetsListSorted = function() {
  var sortedOwnedPlanets = [];
  for (var i in this.OwnedPlanets) {
    sortedOwnedPlanets.push(this.OwnedPlanets[i]);
  }
  sortedOwnedPlanets.sort(Astriarch.Planet.PlanetPopulationImprovementCountComparerSortFunction);
  return sortedOwnedPlanets;
};

/**
 * the total food on all owned planets for this player
 * @this {Astriarch.Player}
 * @return {number}
 */
Astriarch.Player.prototype.TotalFoodAmount = function() {
  var foodAmt = 0;
  for (var i in this.OwnedPlanets) {
    foodAmt += this.OwnedPlanets[i].Resources.FoodAmount;
  }
  return foodAmt;
};

/**
 * the total ore on all owned planets for this player
 * @this {Astriarch.Player}
 * @return {number}
 */
Astriarch.Player.prototype.TotalOreAmount = function() {
  var oreAmt = 0;
  for (var i in this.OwnedPlanets) {
    oreAmt += this.OwnedPlanets[i].Resources.OreAmount;
  }
  return oreAmt;
};

/**
 * the total Iridium on all owned planets for this player
 * @this {Astriarch.Player}
 * @return {number}
 */
Astriarch.Player.prototype.TotalIridiumAmount = function() {
  var iridiumAmt = 0;
  for (var i in this.OwnedPlanets) {
    iridiumAmt += this.OwnedPlanets[i].Resources.IridiumAmount;
  }
  return iridiumAmt;
};

/**
 * adds a fleet to the fleets landing on unowned planets object
 * @this {Astriarch.Player}
 */
Astriarch.Player.prototype.AddFleetArrivingOnUnownedPlanet = function(/*Planet*/ p, /*Fleet*/ f) {
  if (!this.fleetsArrivingOnUnownedPlanets[p.Id]) {
    this.fleetsArrivingOnUnownedPlanets[p.Id] = f;
  } //merge fleet with existing
  else {
    this.fleetsArrivingOnUnownedPlanets[p.Id].MergeFleet(f);
  }
};

/**
 * returns and clears our index of fleets arriving on unowned planets
 * @this {Astriarch.Player}
 * @return {Array.<Astriarch.Fleet>} list of fleets arriving on unowned planets
 */
Astriarch.Player.prototype.GatherFleetsArrivingOnUnownedPlanets = function() {
  var unownedPlanetFleets = new Array();
  for (var i in this.fleetsArrivingOnUnownedPlanets) {
    unownedPlanetFleets.push(this.fleetsArrivingOnUnownedPlanets[i]);
  }
  this.fleetsArrivingOnUnownedPlanets = {}; //Dictionary<int, Fleet>
  return unownedPlanetFleets; //returns List<Fleet>
};

/**
 * returns true if the player owns the planet passed in
 * @this {Astriarch.Player}
 * @return {boolean}
 */
Astriarch.Player.prototype.GetPlanetIfOwnedByPlayer = function(planetId) {
  var planet = null;
  if (planetId in this.OwnedPlanets) {
    planet = this.OwnedPlanets[planetId];
  }

  return planet;
};

/**
 * returns true if the player has explored the planet passed in
 * @this {Astriarch.Player}
 * @return {boolean}
 */
Astriarch.Player.prototype.PlanetTypeIfKnownByPlayer = function(/*ClientPlanet*/ p) {
  var planetTypeIfKnownByPlayer = null;
  if (p.Id in this.KnownClientPlanets) planetTypeIfKnownByPlayer = this.KnownClientPlanets[p.Id].Type;

  return planetTypeIfKnownByPlayer;
};

/**
 * returns true if the planet already has reinforcements arriving
 * @this {Astriarch.Player}
 * @return {boolean}
 */
Astriarch.Player.prototype.PlanetContainsFriendlyInboundFleet = function(/*Planet*/ p) {
  for (var i in this.FleetsInTransit) {
    if (this.FleetsInTransit[i].DestinationHex.PlanetContainedInHex.Id == p.Id) {
      return true;
    }
  }

  return false;
};

/**
 * returns the total population of the player's planets
 * @this {Astriarch.Player}
 * @return {number}
 */
Astriarch.Player.prototype.GetTotalPopulation = function() {
  var totalPop = 0;

  for (var i in this.OwnedPlanets) {
    totalPop += this.OwnedPlanets[i].Population.length;
  }

  return totalPop;
};

/**
 * returns the total resource production of the players owned planets
 * @this {Astriarch.Player}
 * @return {Object}
 */
Astriarch.Player.prototype.GetTotalResourceProductionPerTurn = function() {
  var totalResourceProduction = { gold: 0, research: 0, foodToShip: 0, food: 0, ore: 0, iridium: 0 };

  var researchObj = this.Research.getGoldAndResearchAmountEarned(this.GetTaxRevenueAtMaxPercent());
  totalResourceProduction.gold = researchObj.goldAmountEarned;
  totalResourceProduction.research = researchObj.researchAmountEarned;

  for (var i in this.OwnedPlanets) {
    var p = this.OwnedPlanets[i];
    var foodProduced = p.ResourcesPerTurn.GetFoodAmountPerTurn();
    totalResourceProduction.food += foodProduced;
    totalResourceProduction.foodToShip += Math.max(0, p.Population.length - foodProduced);

    totalResourceProduction.ore += p.ResourcesPerTurn.GetOreAmountPerTurn();

    totalResourceProduction.iridium += p.ResourcesPerTurn.GetIridiumAmountPerTurn();
  }

  return totalResourceProduction;
};

Astriarch.Player.PlayerType = {
  Human: 0,
  Computer_Easy: 1,
  Computer_Normal: 2,
  Computer_Hard: 3,
  Computer_Expert: 4
};

/**
 * PlayerResources is the resources at the global level
 * @constructor
 */
Astriarch.Player.PlayerResources = function() {
  //players start with some resources
  this.GoldAmount = 3;
};

/**
 * if amount to spend is higher than total gold, subtracts gold to zero, and returns how much was spent
 * @this {Astriarch.Player.PlayerResources}
 * @return {number} the amount of gold actually spent
 */
Astriarch.Player.PlayerResources.prototype.SpendGoldAsPossible = function(/*int*/ amountToSpend) {
  if (this.GoldAmount >= amountToSpend) {
    this.GoldAmount = this.GoldAmount - amountToSpend;
    return amountToSpend;
  } else {
    var spent = amountToSpend - this.GoldAmount;
    this.GoldAmount = 0;
    return spent;
  }
};

/**
 * Options for the game
 * @constructor
 */
Astriarch.Player.PlayerGameOptions = function() {
  this.ShowHexGrid = false;
  this.ShowPlanetaryConflictPopups = true;
};

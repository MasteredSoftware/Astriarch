var Astriarch = Astriarch || require("./astriarch_base");

/**
 * A Planet is a representation of a planet in space
 * @constructor
 */
Astriarch.Planet = function(/*PlanetType*/ type, /*string*/ name, /*Hexagon*/ boundingHex, /*Player*/ initialOwner) {
  this.Id = Astriarch.Planet.Static.NEXT_PLANET_ID++;
  this.Name = name;
  this.Type = type;
  this.Population = []; //List<Citizen>
  this.RemainderProduction = 0; //if we finished building something we may have remainder to apply to the next item
  this.BuildQueue = []; //Queue<PlanetProductionItem>
  this.BuiltImprovements = {}; //Dictionary<PlanetImprovementType, List<PlanetImprovement>>

  this.MaxImprovements = null;

  this.Resources = null; //PlanetResources

  this.BoundingHex = boundingHex; //Hexagon

  this.OriginPoint = null; //Point

  this.Owner = null; //Player//null means it is ruled by natives or nobody in the case of an asteroid belt

  this.PlanetaryFleet = null; //Fleet//the fleet stationed at this planet
  this.OutgoingFleets = []; //List<Fleet>

  this.ResourcesPerTurn = null; //PlanetPerTurnResourceGeneration

  this.PlanetHappiness = Astriarch.Planet.PlanetHappinessType.Normal; //PlanetHappinessType

  //set planet owner ensures there is one citizen
  this.SetPlanetOwner(initialOwner);
  if (this.Type == Astriarch.Planet.PlanetType.AsteroidBelt) {
    //asteroids and (dead planets?) don't start with pop
    this.Population = [];
  }

  this.recomputeOriginPoint();

  this.BuildQueue = []; //Queue<PlanetProductionItem>

  this.BuiltImprovements = {}; //Dictionary<PlanetImprovementType, List<PlanetImprovement>>
  //setup the build improvements dictionary for each type
  this.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Colony] = []; //List<PlanetImprovement>
  this.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory] = []; //List<PlanetImprovement>
  this.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Farm] = []; //List<PlanetImprovement>
  this.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Mine] = []; //List<PlanetImprovement>

  this.Resources = new Astriarch.Planet.PlanetResources();

  this.StarShipTypeLastBuilt = null; //StarShipType
  this.StarShipCustomShipLastBuilt = false;
  this.BuildLastStarShip = true;
  this.WayPointPlanetId = null; //string Planet Id

  if (initialOwner !== null) {
    //initialize home planet
    //add an aditional citizen
    this.Population.push(new Astriarch.Planet.Citizen(this.Type, initialOwner.Id));
    this.Population.push(new Astriarch.Planet.Citizen(this.Type, initialOwner.Id));

    //setup resources
    this.Resources.FoodAmount = 4;
  }

  this.ResourcesPerTurn = new Astriarch.Planet.PlanetPerTurnResourceGeneration(this, this.Type);
  this.GenerateResources(); //set inital resources

  //set our max slots for improvements and build an initial defense fleet
  switch (this.Type) {
    case Astriarch.Planet.PlanetType.AsteroidBelt:
      this.MaxImprovements = 3;
      this.PlanetaryFleet = Astriarch.Fleet.StarShipFactoryHelper.GenerateShips(
        initialOwner,
        Astriarch.Fleet.StarShipType.SystemDefense,
        0,
        this.BoundingHex
      );
      break;
    case Astriarch.Planet.PlanetType.DeadPlanet:
      this.MaxImprovements = 5;
      this.PlanetaryFleet = Astriarch.Fleet.StarShipFactoryHelper.GenerateShips(
        initialOwner,
        Astriarch.Fleet.StarShipType.SystemDefense,
        Astriarch.NextRandom(3, 5),
        this.BoundingHex
      );
      break;
    case Astriarch.Planet.PlanetType.PlanetClass1:
      this.MaxImprovements = 6;
      this.PlanetaryFleet = Astriarch.Fleet.StarShipFactoryHelper.GenerateShips(
        initialOwner,
        Astriarch.Fleet.StarShipType.SystemDefense,
        Astriarch.NextRandom(4, 6),
        this.BoundingHex
      );
      break;
    case Astriarch.Planet.PlanetType.PlanetClass2:
      this.MaxImprovements = 9;
      this.PlanetaryFleet = Astriarch.Fleet.StarShipFactoryHelper.GenerateShips(
        initialOwner,
        Astriarch.Fleet.StarShipType.SystemDefense,
        Astriarch.NextRandom(10, 15),
        this.BoundingHex
      );
      break;
    default:
      throw new NotImplementedException("Planet type " + this.Type + "not supported by planet constructor.");
  }

  this.maxPopulation = this.MaxImprovements;

  boundingHex.PlanetContainedInHex = this; //fill backreference
};

Astriarch.Planet.Static = { NEXT_PLANET_ID: 1, PLANET_SIZE: 20.0 };

/**
 * Gets all population by whether they have a ProtestLevel or not
 * @returns {{protesting: Array, content: Array}}
 * @constructor
 */
Astriarch.Planet.prototype.GetPopulationByContentment = function() {
  var citizens = { protesting: [], content: [] };
  for (var c in this.Population) {
    var citizen = this.Population[c];
    if (citizen.ProtestLevel > 0) {
      citizens.protesting.push(citizen);
    } else {
      citizens.content.push(citizen);
    }
  }
  return citizens;
};

/**
 * Gets the speed that population is currently growing on this planet
 * @returns {number} a decimal value of the fraction added to the population each turn
 * @constructor
 */
Astriarch.Planet.prototype.GetPopulationGrowthRate = function() {
  var popCount = this.Population.length;
  var growthRate = 0;
  //check if we can grow
  if (
    popCount > 0 &&
    this.PlanetHappiness != Astriarch.Planet.PlanetHappinessType.Riots &&
    (popCount < this.MaxPopulation() || this.Population[popCount - 1].PopulationChange < 1.0)
  ) {
    var openSlots = this.MaxPopulation() - popCount;
    var maxProcreation = popCount / 8.0;
    var colonyCount = this.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Colony].length;
    if (this.Owner && colonyCount) {
      maxProcreation *=
        this.Owner.Research.getResearchData(Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES)
          .percent * colonyCount;
    }
    //when there are 2 open slots per pop, then the maximum growth rate is achieved per population
    growthRate = maxProcreation * Math.min(openSlots / popCount, 2.0);
    if (this.PlanetHappiness == Astriarch.Planet.PlanetHappinessType.Unrest)
      //unrest slows pop growth
      growthRate = growthRate / 2.0;
  }
  return growthRate;
};

/**
 * Gets the number of turns estimated till the planet grows in population
 * @returns {number} turns till growth
 * @constructor
 */
Astriarch.Planet.prototype.GetTurnsUntilPopulationGrowth = function() {
  var turns = 999;
  if (this.Population.length > 0 && this.Population.length < this.MaxPopulation()) {
    var currentLevel = this.Population[this.Population.length - 1].PopulationChange;
    if (currentLevel >= 1) {
      turns = 1;
    } else {
      turns = Math.floor((1 - currentLevel) / this.GetPopulationGrowthRate()) + 1;
    }
  }
  return turns;
};

/**
 * Gets the max population of the planet taking into account the number of colonies built
 * @this {Astriarch.Planet}
 * @return {number}
 */
Astriarch.Planet.prototype.MaxPopulation = function() {
  return this.maxPopulation + this.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Colony].length;
};

/**
 * Counts the number of improvements that take up slots on the planet
 * @this {Astriarch.Planet}
 * @return {number}
 */
Astriarch.Planet.prototype.BuiltImprovementCount = function() {
  var improvementCount = 0;

  for (var key in this.BuiltImprovements) {
    improvementCount += this.BuiltImprovements[key].length;
  }

  return improvementCount;
};

/**
 * Removes an item from the build queue and credits the owner based on how far the item is along in being built
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.RemoveBuildQueueItemForRefund = function(/*int*/ index) {
  var goldRefunded = 0;
  if (this.BuildQueue.length > index) {
    var productionItems = []; //List<PlanetProductionItem>();
    for (var i in this.BuildQueue) {
      productionItems.push(this.BuildQueue[i]);
    }

    var ppi = productionItems[index]; //PlanetProductionItem

    var refundObject = ppi.GetRefundAmount();

    goldRefunded += refundObject.Gold;
    this.Owner.Resources.GoldAmount += refundObject.Gold;
    this.Owner.Resources.OreAmount += refundObject.Ore;
    this.Owner.Resources.IridiumAmount += refundObject.Iridium;

    //remove item and repopulate buildQueue
    productionItems.splice(index, 1);
    this.BuildQueue = [];
    for (var i in productionItems) this.BuildQueue.push(productionItems[i]);
  }
  return goldRefunded;
};

/**
 * Counts the SpacePlatforms in the fleet
 * @this {Astriarch.Planet}
 * @constructor
 */
Astriarch.Planet.prototype.GetSpacePlatformCount = function(includeQueue) {
  var count = 0;
  if (this.PlanetaryFleet) {
    count = this.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.SpacePlatform].length;
  }
  if (includeQueue) {
    for (var i in this.BuildQueue) {
      var ppi = this.BuildQueue[i]; //PlanetProductionItem
      if (
        ppi instanceof Astriarch.Planet.StarShipInProduction &&
        ppi.Type == Astriarch.Fleet.StarShipType.SpacePlatform
      ) {
        count++;
      }
    }
  }
  return count;
};

/**
 * Counts the improvements built as well as the improvements in the queue
 * @this {Astriarch.Planet}
 * @return {number}
 */
Astriarch.Planet.prototype.BuiltAndBuildQueueImprovementCount = function() {
  var count = this.BuiltImprovementCount();
  for (var i in this.BuildQueue) {
    var ppi = this.BuildQueue[i]; //PlanetProductionItem
    if (ppi instanceof Astriarch.Planet.PlanetImprovement) {
      count++;
    }
  }
  return count;
};

/**
 * Counts the improvements built as well as the improvements in the queue by type
 * @this {Astriarch.Planet}
 * @return {number}
 */
Astriarch.Planet.prototype.BuiltAndBuildQueueImprovementTypeCount = function(/*PlanetImprovementType*/ type) {
  var count = this.BuiltImprovements[type].length;
  for (var i in this.BuildQueue) {
    var ppi = this.BuildQueue[i]; //PlanetProductionItem
    if (ppi instanceof Astriarch.Planet.PlanetImprovement && ppi.Type == type) {
      count++;
    }
  }
  return count;
};

//turnsToCompleteStarshipStrengthObject is for out parms to BuildQueueContainsMobileStarship: {turnsToComplete:99, starshipStrength: 0}
/**
 * Returns true if there is a mobile starship in the queue
 * @this {Astriarch.Planet}
 * @return {boolean}
 */
Astriarch.Planet.prototype.BuildQueueContainsMobileStarship = function(turnsToCompleteStarshipStrengthObject) {
  turnsToCompleteStarshipStrengthObject["turnsToComplete"] = 99;
  turnsToCompleteStarshipStrengthObject["starshipStrength"] = 0; //setup defaults
  for (var i in this.BuildQueue) {
    var ppi = this.BuildQueue[i]; //PlanetProductionItem
    if (
      ppi instanceof Astriarch.Planet.StarShipInProduction &&
      ppi.Type != Astriarch.Fleet.StarShipType.SystemDefense
    ) {
      turnsToCompleteStarshipStrengthObject["turnsToComplete"] = ppi.TurnsToComplete;
      turnsToCompleteStarshipStrengthObject["starshipStrength"] = new Astriarch.Fleet.StarShip(ppi.Type).Strength();
      return true;
    }
  }
  return false;
};

/**
 * Returns true if the build queue contains an improvement
 * @this {Astriarch.Planet}
 * @return {boolean}
 */
Astriarch.Planet.prototype.BuildQueueContainsImprovement = function(/*PlanetImprovementType*/ type) {
  for (var i in this.BuildQueue) {
    var ppi = this.BuildQueue[i]; //PlanetProductionItem
    if (ppi instanceof Astriarch.Planet.PlanetImprovement && ppi.Type == type) {
      return true;
    }
  }
  return false;
};

/**
 * Adds an item to the build queue and reduces the players resources based on the cost
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.EnqueueProductionItemAndSpendResources = function(
  gameModel,
  /*PlanetProductionItem*/ item,
  /*Player*/ player
) {
  if (item) {
    this.BuildQueue.push(item);

    this.SpendResources(gameModel, item.GoldCost, 0, item.OreCost, item.IridiumCost, player);
  }
};

/**
 * Returns the top item of the BuildQueue
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.GetNextProductionItemFromBuildQueue = function() {
  return this.BuildQueue[0];
};

/**
 * reduces the players resources based on the cost
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.SpendResources = function(
  gameModel,
  goldCost,
  foodCost,
  oreCost,
  iridiumCost,
  /*Player*/ player
) {
  player.Resources.GoldAmount -= goldCost;

  //first check for required food, ore and iridium on this planet
  var foodNeeded = foodCost - this.Resources.SpendFoodAsPossible(foodCost);
  var oreNeeded = oreCost - this.Resources.SpendOreAsPossible(oreCost);
  var iridiumNeeded = iridiumCost - this.Resources.SpendIridiumAsPossible(iridiumCost);

  if (foodNeeded != 0 || oreNeeded != 0 || iridiumNeeded != 0) {
    var ownedPlanets = [];
    for (var i in player.OwnedPlanets) {
      if (this.Id != player.OwnedPlanets[i].Id) ownedPlanets.push(player.OwnedPlanets[i]);
    }
    //get closest planets to source resources for, we don't charge for shipping ore or iridium
    var planetDistanceComparer = new Astriarch.Planet.PlanetDistanceComparer(gameModel, this);
    ownedPlanets.sort(planetDistanceComparer.sortFunction);

    for (var i in ownedPlanets) {
      if (foodNeeded != 0) foodNeeded -= ownedPlanets[i].Resources.SpendFoodAsPossible(oreNeeded);
      if (oreNeeded != 0) oreNeeded -= ownedPlanets[i].Resources.SpendOreAsPossible(oreNeeded);
      if (iridiumNeeded != 0) iridiumNeeded -= ownedPlanets[i].Resources.SpendIridiumAsPossible(iridiumNeeded);

      if (foodNeeded == 0 && oreNeeded == 0 && iridiumNeeded == 0) break;
    }
    if (foodNeeded != 0 || oreNeeded != 0 || iridiumNeeded != 0) {
      console.warn(
        "Problem spending food, ore and iridium as necessary! Player:",
        player.Name,
        this.Name,
        foodNeeded,
        oreNeeded,
        iridiumNeeded
      );
    }
  }
};

/**
 * Sets the orgin point of the planet based on the bounding hex
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.recomputeOriginPoint = function() {
  this.OriginPoint = new Astriarch.Point(
    this.BoundingHex.MidPoint.X - Astriarch.Planet.Static.PLANET_SIZE / 2,
    this.BoundingHex.MidPoint.Y - Astriarch.Planet.Static.PLANET_SIZE / 2
  );
};

/**
 * Generates resources on the planet
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.GenerateResources = function() {
  this.ResourcesPerTurn.UpdateResourcesPerTurnBasedOnPlanetStats();

  if (this.Owner !== null) {
    var divisor = 1.0;
    if (this.PlanetHappiness == Astriarch.Planet.PlanetHappinessType.Unrest)
      //unrest causes 1/2 production
      divisor = 2.0;
    else if (this.PlanetHappiness == Astriarch.Planet.PlanetHappinessType.Riots)
      //riots cause 1/4 production
      divisor = 4.0;

    this.Resources.FoodAmount += this.ResourcesPerTurn.FoodAmountPerTurn / divisor;

    this.Resources.OreAmount += this.ResourcesPerTurn.OreAmountPerTurn / divisor;

    this.Resources.IridiumAmount += this.ResourcesPerTurn.IridiumAmountPerTurn / divisor;
  }
};

Astriarch.Planet.prototype.AddBuiltImprovement = function(planetImprovementItem) {
  if (planetImprovementItem instanceof Astriarch.Planet.PlanetImprovement) {
    this.BuiltImprovements[planetImprovementItem.Type].push(planetImprovementItem);
  }
};

//buildQueueEmptyObject is just for an out parameter: {'buildQueueEmpty': false}
/**
 * Builds improvements in the queue
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.BuildImprovements = function(gameModel, buildQueueEmptyObject) {
  //returns List<SerializableTurnEventMessage>
  buildQueueEmptyObject.buildQueueEmpty = false;
  var eotMessages = []; //List<SerializableTurnEventMessage>
  if (this.BuildQueue.length > 0) {
    var nextItem = this.BuildQueue.slice(0, 1)[0]; //PlanetProductionItem

    var divisor = this.ResourcesPerTurn.GetProductionDivisor();
    var planetProductionPerTurn = this.ResourcesPerTurn.GetProductionAmountPerTurn();

    nextItem.ProductionCostComplete += planetProductionPerTurn + this.RemainderProduction;
    this.RemainderProduction = 0;

    if (nextItem.ProductionCostComplete >= nextItem.BaseProductionCost) {
      //build it
      nextItem = this.BuildQueue.shift();
      nextItem.TurnsToComplete = 0;

      //assign points
      if (this.Owner) {
        this.Owner.IncreasePoints(Astriarch.Player.EarnedPointsType.PRODUCTION_UNIT_BUILT, nextItem.BaseProductionCost);
      }

      var nextItemInQueueName = "Nothing";
      if (this.BuildQueue.length > 0) {
        var nextInQueue = this.BuildQueue.slice(0, 1)[0]; //PlanetProductionItem
        nextItemInQueueName = nextInQueue.ToString();

        //estimate turns left for next item so that we display it correctly on the main screen
        nextInQueue.EstimateTurnsToComplete(planetProductionPerTurn);
      }

      if (nextItem instanceof Astriarch.Planet.PlanetImprovement) {
        this.AddBuiltImprovement(nextItem);

        eotMessages.push(
          new Astriarch.SerializableTurnEventMessage(
            Astriarch.TurnEventMessage.TurnEventMessageType.ImprovementBuilt,
            this,
            nextItem.ToString() + " built on planet: " + this.Name + ", next in queue: " + nextItemInQueueName
          )
        );
      } else if (nextItem instanceof Astriarch.Planet.StarShipInProduction) {
        //it's a ship
        var ship = new Astriarch.Fleet.StarShip(
          nextItem.Type,
          nextItem.CustomShip,
          nextItem.AdvantageAgainstType,
          nextItem.DisadvantageAgainstType
        );

        //don't set last built option for space platforms
        if (ship.Type != Astriarch.Fleet.StarShipType.SpacePlatform) {
          this.StarShipTypeLastBuilt = nextItem.Type;
          this.StarShipCustomShipLastBuilt = nextItem.CustomShip;
        }

        //if we have a waypoint set on the planet, send this new starship to the waypoint planet
        var waypointPlanet = this.WayPointPlanetId ? gameModel.getPlanetById(this.WayPointPlanetId) : null;
        if (waypointPlanet && nextItem.Type != Astriarch.Fleet.StarShipType.SystemDefense) {
          var newFleet = new Astriarch.Fleet(this.Owner);
          newFleet.AddShip(ship);

          newFleet.SetDestination(gameModel.GameGrid, this.BoundingHex, waypointPlanet.BoundingHex);

          this.OutgoingFleets.push(newFleet);
        } else {
          this.PlanetaryFleet.AddShip(ship);
        }

        eotMessages.push(
          new Astriarch.SerializableTurnEventMessage(
            Astriarch.TurnEventMessage.TurnEventMessageType.ShipBuilt,
            this,
            nextItem.ToString() + " built on planet: " + this.Name + ", next in queue: " + nextItemInQueueName
          )
        );
      } else if (nextItem instanceof Astriarch.Planet.PlanetImprovementToDestroy) {
        //it is a destroy improvement request
        if (this.BuiltImprovements[nextItem.TypeToDestroy].length > 0) {
          this.BuiltImprovements[nextItem.TypeToDestroy].pop();
          eotMessages.push(
            new Astriarch.SerializableTurnEventMessage(
              Astriarch.TurnEventMessage.TurnEventMessageType.ImprovementDemolished,
              this,
              Astriarch.GameTools.PlanetImprovementTypeToFriendlyName(nextItem.TypeToDestroy) +
                " demolished on planet: " +
                this.Name +
                ", next in queue: " +
                nextItemInQueueName
            )
          );

          //TODO: there is probably a better place to handle this check for population overages
          //TODO: should we also notify the user he/she lost a pop due to overcrowding or do this slower?
          while (this.MaxPopulation() < this.Population.length) {
            //pitd.TypeToDestroy == PlanetImprovementType.Colony)
            this.Population.pop();
          }
        }
      }

      this.RemainderProduction = nextItem.ProductionCostComplete - nextItem.BaseProductionCost;
      this.ResourcesPerTurn.UpdateResourcesPerTurnBasedOnPlanetStats(); //now that we've built something, recalc production
    } else {
      //not done yet, estimate turns to complete
      nextItem.EstimateTurnsToComplete(planetProductionPerTurn);
    }
  } else {
    //notify user of empty build queue
    buildQueueEmptyObject.buildQueueEmpty = true;
  }

  return eotMessages;
};

/**
 * Gets a ClientPlanet Version of this Planet
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.GetClientPlanet = function() {
  return new Astriarch.ClientPlanet(this.Id, this.Name, this.OriginPoint, null, this.BoundingHex, this.Type);
};

/**
 * Sets the planet owner to the player passed in
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.SetPlanetOwner = function(/*Player*/ p) {
  var goldRefunded = 0; //this is so we can use this to loot gold when the planet changes hands

  var newOwnerPlayerId = null;
  if (p) {
    newOwnerPlayerId = p.Id;
  }

  //remove current planet owner
  if (this.Owner !== null) {
    this.WayPointPlanetId = null;
    this.StarShipTypeLastBuilt = null;
    //if this planet has items in the build queue we should remove them now
    for (var i = this.BuildQueue.length - 1; i >= 0; i--) {
      goldRefunded += this.RemoveBuildQueueItemForRefund(i);
    }
    //Also clear out any remainder production
    this.RemainderProduction = 0;

    if (this.Owner.PlanetBuildGoals[this.Id]) delete this.Owner.PlanetBuildGoals[this.Id];

    delete this.Owner.OwnedPlanets[this.Id];

    //set Protest Levels for citizens
    var contentCitizenCount = 0;
    var citizen = null;
    for (var c = 0; c < this.Population.length; c++) {
      citizen = this.Population[c];
      //they were loyal to this player before, they won't be protesting now
      //there is a 1 in 3 chance that a citizen won't protest the new ruler
      if ((citizen.LoyalToPlayerId && citizen.LoyalToPlayerId == newOwnerPlayerId) || Astriarch.NextRandom(0, 3) == 0) {
        citizen.ProtestLevel = 0;
        citizen.LoyalToPlayerId = newOwnerPlayerId;
        contentCitizenCount++;
        continue;
      }

      var minProtestLevel = citizen.LoyalToPlayerId ? 0.5 : 0; //if the planet was run by natives they won't be protesting as much
      var maxProtestLevel = citizen.LoyalToPlayerId ? 1 : 0.5; //if the planet was run by natives they won't be protesting as much
      citizen.ProtestLevel = Astriarch.NextRandomFloat(minProtestLevel, maxProtestLevel);
    }

    if (contentCitizenCount == 0 && this.Population.length > 0) {
      //ensure we have at least one loyal, non-protesting citizen (they were in awe of the new leadership's ability to take the planet)
      citizen = this.Population[0];
      citizen.ProtestLevel = 0;
      citizen.LoyalToPlayerId = newOwnerPlayerId;
    }

    //when a planet changes hands it should initially be in unrest
    this.PlanetHappiness = Astriarch.Planet.PlanetHappinessType.Riots;

    //assign points
    if (p) {
      p.IncreasePoints(Astriarch.Player.EarnedPointsType.CITIZEN_ON_CAPTURED_PLANET, this.Population.length);
    }
  }

  this.Owner = p;
  if (this.Owner) {
    p.KnownClientPlanets[this.Id] = this.GetClientPlanet();
    p.OwnedPlanets[this.Id] = this;
  }

  if (this.Population.length == 0) {
    this.Population.push(new Astriarch.Planet.Citizen(this.Type, newOwnerPlayerId));
  }

  return goldRefunded;
};

/**
 * Sets the planet as explored for the player passed in
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.SetPlanetExplored = function(gameModel, /*Player*/ p) {
  var cp = this.GetClientPlanet();
  cp.Type = this.Type;
  p.KnownClientPlanets[this.Id] = cp;
  this.SetPlayerLastKnownPlanetFleetStrength(gameModel, p);
};

/**
 * Sets the known planet's fleet strength for the player passed in
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.SetPlayerLastKnownPlanetFleetStrength = function(gameModel, /*Player*/ p) {
  //Fleet
  var lastKnownFleet = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(
    p,
    this.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.SystemDefense].length,
    this.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Scout].length,
    this.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length,
    this.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length,
    this.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship].length,
    this.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.SpacePlatform].length,
    this.BoundingHex
  );

  var lastKnownFleetObject = new Astriarch.Fleet.LastKnownFleet(lastKnownFleet, this.Owner);
  lastKnownFleetObject.TurnLastExplored = gameModel.Turn.Number;

  p.LastKnownPlanetFleetStrength[this.Id] = lastKnownFleetObject;
};

//populationWorkerTypesObject is an instance of Astriarch.Planet.PopulationAssignments for out parameters
/**
 * uses the input parameter as an output object counting the assigned workers based on type
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.CountPopulationWorkerTypes = function(populationWorkerTypesObject) {
  farmers = 0;
  miners = 0;
  workers = 0;
  var citizens = this.GetPopulationByContentment();
  for (var i in citizens.content) {
    var c = citizens.content[i]; //Citizen
    switch (c.WorkerType) {
      case Astriarch.Planet.CitizenWorkerType.Farmer:
        farmers++;
        break;
      case Astriarch.Planet.CitizenWorkerType.Miner:
        miners++;
        break;
      case Astriarch.Planet.CitizenWorkerType.Worker:
        workers++;
        break;
    }
  }
  populationWorkerTypesObject.Farmers = farmers;
  populationWorkerTypesObject.Miners = miners;
  populationWorkerTypesObject.Workers = workers;
};

/**
 * updates the population worker assignments based on the differences passed in
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.UpdatePopulationWorkerTypesByDiff = function(
  currentFarmers,
  currentMiners,
  currentWorkers,
  farmerDiff,
  minerDiff,
  workerDiff
) {
  while (farmerDiff !== 0) {
    if (farmerDiff > 0) {
      //move miners and workers to be farmers
      if (currentMiners > 0 && minerDiff < 0) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Miner).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Farmer;
        currentMiners--;
        currentFarmers++;
        farmerDiff--;
        minerDiff++;
      }
      if (farmerDiff !== 0 && currentWorkers > 0 && workerDiff < 0) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Worker).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Farmer;
        currentWorkers--;
        currentFarmers++;
        farmerDiff--;
        workerDiff++;
      }
    } else {
      //make farmers to miners and workers
      if (minerDiff > 0 && currentMiners < this.MaxPopulation()) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Farmer).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Miner;
        currentFarmers--;
        currentMiners++;
        farmerDiff++;
        minerDiff--;
      }
      if (farmerDiff !== 0 && workerDiff > 0 && currentWorkers < this.MaxPopulation()) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Farmer).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Worker;
        currentFarmers--;
        currentWorkers++;
        farmerDiff++;
        workerDiff--;
      }
    }
  }

  //next check miners, don't touch farmers
  while (minerDiff !== 0) {
    if (minerDiff > 0) {
      //move workers to be miners
      if (currentWorkers > 0 && workerDiff < 0) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Worker).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Miner;
        currentWorkers--;
        currentMiners++;
        minerDiff--;
        workerDiff++;
      }
    } else {
      //make miners to workers
      if (workerDiff > 0 && currentWorkers < this.MaxPopulation()) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Miner).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Worker;
        currentMiners--;
        currentWorkers++;
        minerDiff++;
        workerDiff--;
      }
    }
  }

  //check for problems
  if (farmerDiff !== 0 || minerDiff !== 0 || workerDiff !== 0) {
    console.error(
      "Couldn't move workers in Planet.UpdatePopulationWorkerTypesByDiff!",
      farmerDiff,
      minerDiff,
      workerDiff
    );
  }
  this.ResourcesPerTurn.UpdateResourcesPerTurnBasedOnPlanetStats();
};

/**
 * updates the population worker assignments based on the targets passed in
 * @this {Astriarch.Planet}
 */
Astriarch.Planet.prototype.UpdatePopulationWorkerTypes = function(targetFarmers, targetMiners, targetWorkers) {
  //this would be easier if we just cleared out our population and rebuilt it making sure we copy pop differences

  var pop = new Astriarch.Planet.PopulationAssignments();
  this.CountPopulationWorkerTypes(pop);
  var currentFarmers = pop.Farmers;
  var currentMiners = pop.Miners;
  var currentWorkers = pop.Workers;

  //first check for farmers
  var diff = targetFarmers - currentFarmers;
  while (currentFarmers != targetFarmers) {
    if (diff > 0) {
      //move miners and workers to be farmers
      if (currentMiners > 0) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Miner).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Farmer;
        currentMiners--;
        currentFarmers++;
        diff--;
      }
      if (diff > 0 && currentWorkers > 0) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Worker).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Farmer;
        currentWorkers--;
        currentFarmers++;
        diff--;
      }
    } else {
      //make farmers to miners and workers
      if (currentMiners < targetMiners && currentMiners < this.MaxPopulation()) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Farmer).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Miner;
        currentFarmers--;
        currentMiners++;
        diff++;
      }
      if (diff < 0 && currentWorkers < targetWorkers && currentWorkers < this.MaxPopulation()) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Farmer).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Worker;
        currentFarmers--;
        currentWorkers++;
        diff++;
      }
    }
  }

  //next check workers, don't touch farmers
  diff = targetMiners - currentMiners;
  while (currentMiners != targetMiners) {
    if (diff > 0) {
      //move workers to be miners
      if (currentWorkers > 0) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Worker).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Miner;
        currentWorkers--;
        currentMiners++;
        diff--;
      }
    } else {
      //make miners to workers
      if (currentWorkers < targetWorkers && currentWorkers < this.MaxPopulation()) {
        this.getCitizenType(Astriarch.Planet.CitizenWorkerType.Miner).WorkerType =
          Astriarch.Planet.CitizenWorkerType.Worker;
        currentMiners--;
        currentWorkers++;
        diff++;
      }
    }
  }

  //check for problems
  if (currentFarmers != targetFarmers || currentMiners != targetMiners || currentWorkers != targetWorkers) {
    console.error(
      "Couldn't move workers in Planet.UpdatePopulationWorkerTypes! targets: ",
      targetFarmers,
      targetMiners,
      targetWorkers,
      "currents:",
      currentFarmers,
      currentMiners,
      currentWorkers
    );
  }
  this.ResourcesPerTurn.UpdateResourcesPerTurnBasedOnPlanetStats();
};

/**
 * Gets a citizen based on worker type
 * @this {Astriarch.Planet}
 * @return {Astriarch.Planet.Citizen}
 */
Astriarch.Planet.prototype.getCitizenType = function(/*CitizenWorkerType*/ desiredType) {
  var citizens = this.GetPopulationByContentment();
  for (var i in citizens.content) {
    if (citizens.content[i].WorkerType == desiredType) return citizens.content[i];
  }
  if (citizens.content.length > 0) {
    console.error("Couldn't find: " + desiredType + " in Planet.getCitizenType!");
    //just return someone so that we don't get a null reference?
    return citizens.content[0];
  } else if (citizens.protesting.length > 0) {
    for (var p in citizens.protesting) {
      if (citizens.protesting[p].WorkerType == desiredType) {
        console.error("No content citizens found in Planet.getCitizenType! Returning protesting citizen.");
        return citizens.protesting[p];
      }
    }
    console.error("Couldn't find: " + desiredType + " in Planet.getCitizenType for protesting citizens!");
    //just return someone so that we don't get a null reference?
    return citizens.protesting[0];
  } else {
    console.error("No citizens found in Planet.getCitizenType!");
    return null;
  }
};

/**
 * A sort function to prefer planets with higher pop and number of improvements
 * @return {number}
 */
Astriarch.Planet.PlanetPopulationImprovementCountComparerSortFunction = function(/*Planet*/ a, /*Planet*/ b) {
  var ret = b.Population.length.compareTo(a.Population.length);
  if (ret == 0) ret = b.BuiltImprovementCount().compareTo(a.BuiltImprovementCount());
  return ret;
};

/**
 * A sort function to prefer planets with higher food production
 * @return {number}
 */
Astriarch.Planet.PlanetFoodProductionPotentialComparerSortFunction = function(/*Planet*/ a, /*Planet*/ b) {
  return b.ResourcesPerTurn.GetExactFoodAmountNextWorkerPerTurn().compareTo(
    a.ResourcesPerTurn.GetExactFoodAmountNextWorkerPerTurn()
  );
};

/**
 * A sort function object to prefer planets with higher mineral production
 * @constructor
 */
Astriarch.Planet.PlanetMineralProductionPotentialComparer = function(/*int*/ oreNeeded, /*int*/ iridiumNeeded) {
  this.oreNeeded = oreNeeded;
  this.iridiumNeeded = iridiumNeeded;
};

/**
 * Gets a citizen based on worker type
 * @this {Astriarch.Planet.PlanetMineralProductionPotentialComparer}
 * @return {number}
 */
Astriarch.Planet.PlanetMineralProductionPotentialComparer.prototype.sortFunction = function(
  /*Planet*/ a,
  /*Planet*/ b
) {
  var ret = 0;
  if (this.oreNeeded >= this.iridiumNeeded)
    ret = b.ResourcesPerTurn.GetExactOreAmountNextWorkerPerTurn().compareTo(
      a.ResourcesPerTurn.GetExactOreAmountNextWorkerPerTurn()
    );
  else
    ret = b.ResourcesPerTurn.GetExactIridiumAmountNextWorkerPerTurn().compareTo(
      a.ResourcesPerTurn.GetExactIridiumAmountNextWorkerPerTurn()
    );

  return ret;
};

/**
 * A sort function object to prefer planets with less distance
 * @constructor
 */
Astriarch.Planet.PlanetDistanceComparer = function(gameModel, /*Planet*/ source) {
  this.gameModel = gameModel;
  this.source = source;

  var self = this;

  /**
   * sort function for planet distances
   * @this {Astriarch.Planet.PlanetDistanceComparer}
   * @return {number}
   */
  this.sortFunction = function(/*Planet*/ a, /*Planet*/ b) {
    //TODO: this could be slow, we could just have an index for all distances instead of calculating it each time
    var ret = 0;
    var distanceA = 0;
    var distanceB = 0;
    if (a != self.source) {
      //just to be sure
      distanceA = self.gameModel.GameGrid.GetHexDistance(self.source.BoundingHex, a.BoundingHex);
      ret = 1;
    }
    if (b != self.source) {
      //just to be sure
      distanceB = self.gameModel.GameGrid.GetHexDistance(self.source.BoundingHex, b.BoundingHex);
      ret = -1;
    }

    if (ret !== 0) {
      //NOTE: this sorts in decending order or distance because we start at the end of the list
      if (distanceA == distanceB) ret = 0;
      else if (distanceA < distanceB) ret = 1;
      else ret = -1;
    }

    return ret;
  };
};

/**
 * A sort function object to prefer planets with less distance and less strength
 * @constructor
 */
Astriarch.Planet.PlanetValueDistanceStrengthComparer = function(
  gameModel,
  /*Planet*/ source,
  /*Dictionary<int, LastKnownFleet>*/ lastKnownPlanetFleetStrength
) {
  this.gameModel = gameModel;
  this.source = source;
  this.lastKnownPlanetFleetStrength = lastKnownPlanetFleetStrength;
  var self = this;

  /**
   * sort function for planet distances and strength
   * @this {Astriarch.Planet.PlanetValueDistanceStrengthComparer}
   * @return {number}
   */
  this.sortFunction = function(/*Planet*/ a, /*Planet*/ b) {
    //TODO: this could be slow, we could just have an index for all distances instead of calculating it each time
    var ret = 0;
    var distanceA = 0;
    var distanceB = 0;
    if (a != self.source) {
      //just to be sure
      distanceA = self.gameModel.GameGrid.GetHexDistance(self.source.BoundingHex, a.BoundingHex);
      ret = 1;
    }
    if (b != self.source) {
      //just to be sure
      distanceB = self.gameModel.GameGrid.GetHexDistance(self.source.BoundingHex, b.BoundingHex);
      ret = -1;
    }

    if (ret !== 0) {
      //NOTE: this sorts in decending order or distance because we start at the end of the list
      distanceA = Astriarch.Planet.PlanetValueDistanceStrengthComparer.increaseDistanceBasedOnPlanetValueAndFleetStrength(
        self.lastKnownPlanetFleetStrength,
        distanceA,
        a
      );
      distanceB = Astriarch.Planet.PlanetValueDistanceStrengthComparer.increaseDistanceBasedOnPlanetValueAndFleetStrength(
        self.lastKnownPlanetFleetStrength,
        distanceB,
        b
      );
      if (distanceA == distanceB) ret = 0;
      else if (distanceA < distanceB) ret = 1;
      else ret = -1;
    }

    return ret;
  };
};

//'static' function
/**
 * adjusts the distance for sorting based on strength
 * @return {number}
 */
Astriarch.Planet.PlanetValueDistanceStrengthComparer.increaseDistanceBasedOnPlanetValueAndFleetStrength = function(
  lastKnownPlanetFleetStrength,
  /*int*/ distance,
  /*Planet*/ p
) {
  //to normalize distance, value and strength we increase the distance as follows
  //Based on Value (could eventually base this on what we need so if we need more minerals we prefer asteroids:
  // Class 2 planets add +0 distance
  // Class 1 planets add +1 distance
  // Dead planets add +2 distance
  // Asteroids add +3 distance
  //Based on last known fleet strength:
  // Strength < 20 add + 0
  // Strength 20 to 39 + 1
  // Strength 40 to 79 + 2
  // Strength > 80 + 3

  switch (p.Type) {
    case Astriarch.Planet.PlanetType.AsteroidBelt:
      distance += 3;
      break;
    case Astriarch.Planet.PlanetType.DeadPlanet:
      distance += 2;
      break;
    case Astriarch.Planet.PlanetType.PlanetClass1:
      distance += 1;
      break;
  }

  if (lastKnownPlanetFleetStrength[p.Id]) {
    var strength = lastKnownPlanetFleetStrength[p.Id].Fleet.DetermineFleetStrength();

    if (strength >= 20 && strength < 40) {
      distance += 1;
    } else if (strength >= 40 && strength < 80) {
      distance += 2;
    } else if (strength >= 80) {
      distance += 3;
    }
  }

  return distance;
};

/**
 * PlanetPerTurnResourceGeneration is how much a planet produces per turn
 * @constructor
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration = function(/*Planet*/ p, /*PlanetType*/ type) {
  this.BaseFoodAmountPerWorkerPerTurn = 0;
  this.BaseOreAmountPerWorkerPerTurn = 0;
  this.BaseIridiumAmountPerWorkerPerTurn = 0;
  this.BaseProductionPerWorkerPerTurn = 2.0;

  this.FoodAmountPerTurn = 0;
  this.FoodAmountPerFarmerPerTurn = 0;
  this.FoodAmountNextFarmerPerTurn = 0; //Potential extra food if the player adds a farmer

  this.OreAmountPerTurn = 0;
  this.OreAmountPerMinerPerTurn = 0;
  this.OreAmountNextMinerPerTurn = 0; //Potential extra ore if the player adds a miner

  this.IridiumAmountPerTurn = 0;
  this.IridiumAmountPerMinerPerTurn = 0;
  this.IridiumAmountNextMinerPerTurn = 0; //Potential extra iridium if the player adds a miner

  this.ProductionAmountPerTurn = 0;
  this.ProductionAmountPerBuilderPerTurn = 0;

  this.Planet = p;

  //this is the initial/base planet resource production
  //base values by planet type:
  switch (type) {
    case Astriarch.Planet.PlanetType.AsteroidBelt:
      this.BaseFoodAmountPerWorkerPerTurn = 0.5;
      this.BaseOreAmountPerWorkerPerTurn = 1.75;
      this.BaseIridiumAmountPerWorkerPerTurn = 1.0;
      break;
    case Astriarch.Planet.PlanetType.DeadPlanet:
      this.BaseFoodAmountPerWorkerPerTurn = 1.0;
      this.BaseOreAmountPerWorkerPerTurn = 1.5;
      this.BaseIridiumAmountPerWorkerPerTurn = 0.5;
      break;
    case Astriarch.Planet.PlanetType.PlanetClass1:
      this.BaseFoodAmountPerWorkerPerTurn = 1.5;
      this.BaseOreAmountPerWorkerPerTurn = 0.5;
      this.BaseIridiumAmountPerWorkerPerTurn = 0.375;
      break;
    case Astriarch.Planet.PlanetType.PlanetClass2:
      this.BaseFoodAmountPerWorkerPerTurn = 2.0;
      this.BaseOreAmountPerWorkerPerTurn = 0.25;
      this.BaseIridiumAmountPerWorkerPerTurn = 0.125;
      break;
    default:
      throw new NotImplementedException(
        "Planet type " + type + "not supported by PlanetPerTurnResourceGeneration constructor."
      );
  }
  //update our stats
  this.UpdateResourcesPerTurnBasedOnPlanetStats();
};

/**
 * gets divisor to adjust production based on planet happiness
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetProductionDivisor = function() {
  var divisor = 1.0;
  if (this.Planet.PlanetHappiness == Astriarch.Planet.PlanetHappinessType.Unrest)
    //unrest causes 1/4 development
    divisor = 4.0;
  else if (this.Planet.PlanetHappiness == Astriarch.Planet.PlanetHappinessType.Riots)
    //riots cause 1/8 development
    divisor = 8.0;

  return divisor;
};

/**
 * gets divisor to adjust resource production based on planet happiness
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetResourceDivisor = function() {
  var divisor = 1.0;
  if (this.Planet.PlanetHappiness == Astriarch.Planet.PlanetHappinessType.Unrest)
    //unrest causes 1/2 resource production
    divisor = 2.0;
  else if (this.Planet.PlanetHappiness == Astriarch.Planet.PlanetHappinessType.Riots)
    //riots cause 1/4 resource production
    divisor = 4.0;

  return divisor;
};

/**
 * gets adjusted production per turn based on planet happiness
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetProductionAmountPerTurn = function() {
  return this.ProductionAmountPerTurn / this.GetProductionDivisor();
};

/**
 * gets adjusted food production per turn based on planet happiness
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetFoodAmountPerTurn = function() {
  return this.FoodAmountPerTurn / this.GetResourceDivisor();
};

/**
 * gets adjusted ore production per turn based on planet happiness
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetOreAmountPerTurn = function() {
  return this.OreAmountPerTurn / this.GetResourceDivisor();
};

/**
 * gets adjusted iridium production per turn based on planet happiness
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetIridiumAmountPerTurn = function() {
  return this.IridiumAmountPerTurn / this.GetResourceDivisor();
};

/**
 * updates resources generated per turn based on improvements, etc...
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.UpdateResourcesPerTurnBasedOnPlanetStats = function() {
  //base resource generation on citizen amount and assignment
  var pop = new Astriarch.Planet.PopulationAssignments();
  this.Planet.CountPopulationWorkerTypes(pop);

  this.FoodAmountNextFarmerPerTurn = 0;
  this.OreAmountNextMinerPerTurn = 0;
  this.IridiumAmountNextMinerPerTurn = 0;
  if (pop.Farmers < this.Planet.Population.length) {
    this.FoodAmountNextFarmerPerTurn = this.BaseFoodAmountPerWorkerPerTurn;
  }

  if (pop.Miners < this.Planet.Population.length) {
    this.OreAmountNextMinerPerTurn = this.BaseOreAmountPerWorkerPerTurn;
    this.IridiumAmountNextMinerPerTurn = this.BaseIridiumAmountPerWorkerPerTurn;
  }

  var baseFoodAmountPerTurn = this.BaseFoodAmountPerWorkerPerTurn * pop.Farmers;
  var baseOreAmountPerTurn = this.BaseOreAmountPerWorkerPerTurn * pop.Miners;
  var baseIridiumAmountPerTurn = this.BaseIridiumAmountPerWorkerPerTurn * pop.Miners;
  var baseProductionAmountPerTurn = this.BaseProductionPerWorkerPerTurn * pop.Workers;

  //determine production per turn
  this.FoodAmountPerTurn = baseFoodAmountPerTurn;
  this.OreAmountPerTurn = baseOreAmountPerTurn;
  this.IridiumAmountPerTurn = baseIridiumAmountPerTurn;
  this.ProductionAmountPerTurn = baseProductionAmountPerTurn;

  //each mine increases mineral production 50% from base (additive)
  //each farm increases food production 50% from base (additive)
  //additive means if you have two mines you don't get (base production * 1.5 * 1.5),
  //you get (base production + (base production * 0.5) + (base production * 0.5))

  if (this.Planet.BuiltImprovementCount() > 0) {
    var farmCount = this.Planet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Farm].length;
    var mineCount = this.Planet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Mine].length;
    var factoryCount = this.Planet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length;

    var researchEffectiveness = null;
    if (farmCount > 0) {
      researchEffectiveness = this.Planet.Owner
        ? this.Planet.Owner.Research.getResearchData(
            Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS
          ).percent
        : 1.0;
      if (pop.Farmers < farmCount) {
        this.FoodAmountNextFarmerPerTurn =
          this.BaseFoodAmountPerWorkerPerTurn *
          Astriarch.Planet.PlanetPerTurnResourceGeneration.Static.IMPROVEMENT_RATIO *
          researchEffectiveness;
      }
      if (pop.Farmers > 0) {
        this.FoodAmountPerTurn +=
          Math.min(farmCount, pop.Farmers) *
          this.BaseFoodAmountPerWorkerPerTurn *
          Astriarch.Planet.PlanetPerTurnResourceGeneration.Static.IMPROVEMENT_RATIO *
          researchEffectiveness;
      }
    }
    if (mineCount > 0) {
      researchEffectiveness = this.Planet.Owner
        ? this.Planet.Owner.Research.getResearchData(
            Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES
          ).percent
        : 1.0;
      if (pop.Miners < mineCount) {
        this.OreAmountNextMinerPerTurn =
          this.BaseOreAmountPerWorkerPerTurn *
          Astriarch.Planet.PlanetPerTurnResourceGeneration.Static.IMPROVEMENT_RATIO *
          researchEffectiveness;
        this.IridiumAmountNextMinerPerTurn =
          this.BaseIridiumAmountPerWorkerPerTurn *
          Astriarch.Planet.PlanetPerTurnResourceGeneration.Static.IMPROVEMENT_RATIO *
          researchEffectiveness;
      }

      if (pop.Miners > 0) {
        this.OreAmountPerTurn +=
          Math.min(mineCount, pop.Miners) *
          this.BaseOreAmountPerWorkerPerTurn *
          Astriarch.Planet.PlanetPerTurnResourceGeneration.Static.IMPROVEMENT_RATIO *
          researchEffectiveness;
        this.IridiumAmountPerTurn +=
          Math.min(mineCount, pop.Miners) *
          this.BaseIridiumAmountPerWorkerPerTurn *
          Astriarch.Planet.PlanetPerTurnResourceGeneration.Static.IMPROVEMENT_RATIO *
          researchEffectiveness;
      }
    }
    if (factoryCount > 0 && pop.Workers > 0) {
      researchEffectiveness = this.Planet.Owner
        ? this.Planet.Owner.Research.getResearchData(
            Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES
          ).percent
        : 1.0;
      this.ProductionAmountPerTurn +=
        Math.min(factoryCount, pop.Workers) *
        this.BaseProductionPerWorkerPerTurn *
        Astriarch.Planet.PlanetPerTurnResourceGeneration.Static.IMPROVEMENT_RATIO *
        researchEffectiveness;
    }
  }

  this.FoodAmountPerFarmerPerTurn = pop.Farmers ? this.FoodAmountPerTurn / pop.Farmers : 0;
  this.OreAmountPerMinerPerTurn = pop.Miners ? this.OreAmountPerTurn / pop.Miners : 0;
  this.IridiumAmountPerMinerPerTurn = pop.Miners ? this.IridiumAmountPerTurn / pop.Miners : 0;
  this.ProductionAmountPerBuilderPerTurn = pop.Workers ? this.ProductionAmountPerTurn / pop.Workers : 0;
};

Astriarch.Planet.PlanetPerTurnResourceGeneration.Static = { IMPROVEMENT_RATIO: 2.0 };

/**
 * returns how much food each worker produces per turn without rounding
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 * @return {number}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetExactFoodAmountPerWorkerPerTurn = function() {
  return this.FoodAmountPerFarmerPerTurn;
};

/**
 * returns how much additional food the planet will produce if we add a farmer
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 * @return {number}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetExactFoodAmountNextWorkerPerTurn = function() {
  return this.FoodAmountNextFarmerPerTurn;
};

/**
 * returns how much ore each worker produces per turn without rounding
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 * @return {number}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetExactOreAmountPerWorkerPerTurn = function() {
  return this.OreAmountPerMinerPerTurn;
};

/**
 * returns how much additional ore the planet will produce if we add a miner
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 * @return {number}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetExactOreAmountNextWorkerPerTurn = function() {
  return this.OreAmountNextMinerPerTurn;
};

/**
 * returns how much iridium each worker produces per turn without rounding
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 * @return {number}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetExactIridiumAmountPerWorkerPerTurn = function() {
  return this.IridiumAmountPerMinerPerTurn;
};

/**
 * returns how much additional iridium the planet will produce if we add a miner
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 * @return {number}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetExactIridiumAmountNextWorkerPerTurn = function() {
  return this.IridiumAmountNextMinerPerTurn;
};

/**
 * returns how much production each worker produces per turn without rounding
 * @this {Astriarch.Planet.PlanetPerTurnResourceGeneration}
 * @return {number}
 */
Astriarch.Planet.PlanetPerTurnResourceGeneration.prototype.GetExactProductionAmountPerWorkerPerTurn = function() {
  return this.ProductionAmountPerBuilderPerTurn;
};

/**
 * PlanetResources is how much food a planet has on it, gold, ore and iridium are stored globaly at the player level
 * @constructor
 */
Astriarch.Planet.PlanetResources = function() {
  this.FoodAmount = 0;

  this.OreAmount = 0;

  this.IridiumAmount = 0;
};

/**
 * if amount to spend is higher than total food, subtracts food to zero, and returns how much was spent
 * @this {Astriarch.Planet.PlanetResources}
 * @return {number} the amount of food actually spent
 */
Astriarch.Planet.PlanetResources.prototype.SpendFoodAsPossible = function(/*int*/ amountToSpend) {
  if (this.FoodAmount >= amountToSpend) {
    this.FoodAmount = this.FoodAmount - amountToSpend;
    return amountToSpend;
  } else {
    var spent = this.FoodAmount;
    this.FoodAmount = 0;
    return spent;
  }
};

/**
 * if amount to spend is higher than total ore, subtracts ore to zero, and returns how much was spent
 * @this {Astriarch.Planet.PlanetResources}
 * @return {number} the amount of ore actually spent
 */
Astriarch.Planet.PlanetResources.prototype.SpendOreAsPossible = function(/*int*/ amountToSpend) {
  if (this.OreAmount >= amountToSpend) {
    this.OreAmount = this.OreAmount - amountToSpend;
    return amountToSpend;
  } else {
    var spent = this.OreAmount;
    this.OreAmount = 0;
    return spent;
  }
};

/**
 * if amount to spend is higher than total Iridium, subtracts Iridium to zero, and returns how much was spent
 * @this {Astriarch.Planet.PlanetResources}
 * @return {number} the amount of Iridium actually spent
 */
Astriarch.Planet.PlanetResources.prototype.SpendIridiumAsPossible = function(/*int*/ amountToSpend) {
  if (this.IridiumAmount >= amountToSpend) {
    this.IridiumAmount = this.IridiumAmount - amountToSpend;
    return amountToSpend;
  } else {
    var spent = this.IridiumAmount;
    this.IridiumAmount = 0;
    return spent;
  }
};

//the ProductionResources class is not in the Silverlight version, it is so we can pass an object into certain functions which take in/out parms of gold, ore and iridium
/**
 * ProductionResources is just gold, ore and iridium (what is required to produce ships and improvements
 * @constructor
 */
Astriarch.Planet.ProductionResources = function(gold, ore, iridium) {
  this.Gold = gold;
  this.Ore = ore;
  this.Iridium = iridium;
};

//the PopulationAssignments class is not in the Silverlight version, it is so we can pass an object into certain functions which take in/out parms of farmers, miners and workers
/**
 * PopulationAssignments is just the number of farmers, miners and workers, what each citizen can be assigned as
 * @constructor
 */
Astriarch.Planet.PopulationAssignments = function(farmers, miners, workers) {
  this.Farmers = farmers;
  this.Miners = miners;
  this.Workers = workers;
};

/**
 * PlanetProductionItem is an abstract class for either starships or improvements
 * @constructor
 */
Astriarch.Planet.PlanetProductionItem = Class.extend({
  //abstract class

  /**
   * initializes this PlanetProductionItem
   * @this {Astriarch.Planet.PlanetProductionItem}
   */
  init: function() {
    this.TurnsToComplete = 99; //once this is built turns to complete will be 0 and will go into the built improvements for the planet

    this.ProductionCostComplete = 0; //this is how much of the BaseProductionCost we've completed
    this.BaseProductionCost = 0; //this will translate into Turns to Complete based on population, factories, etc...

    this.GoldCost = 1;
    this.OreCost = 0;
    this.IridiumCost = 0;
  },

  /**
   * sets the turns to complete based on production
   * @this {Astriarch.Planet.PlanetProductionItem}
   */
  EstimateTurnsToComplete: function(/*int*/ planetProductionPerTurn, remainderProductionStockpile) {
    remainderProductionStockpile = remainderProductionStockpile || 0;
    if (planetProductionPerTurn !== 0) {
      var productionCostLeft = this.BaseProductionCost - this.ProductionCostComplete - remainderProductionStockpile;
      this.TurnsToComplete = Math.ceil(productionCostLeft / planetProductionPerTurn);
    } else {
      this.TurnsToComplete = 999; //if there are no workers
    }
    //We at least need one turn to build it, even if we have stockpile greater than the production cost
    if (this.TurnsToComplete <= 0) {
      this.TurnsToComplete = 1;
    }
  },

  /**
   * returns how many resources should be refunded when this improvement is canceled
   * @this {Astriarch.Planet.PlanetProductionItem}
   * @return {Astriarch.Planet.ProductionResources}
   */
  GetRefundAmount: function() {
    //returns Astriarch.Planet.ProductionResources object
    //give refund
    var refundPercent = 1 - this.ProductionCostComplete / (this.BaseProductionCost * 1.0);
    goldRefund = this.GoldCost * refundPercent;
    oreRefund = this.OreCost * refundPercent;
    iridiumRefund = this.IridiumCost * refundPercent;
    return new Astriarch.Planet.ProductionResources(goldRefund, oreRefund, iridiumRefund);
  }
});

/**
 * PlanetImprovementToDestroy is a built improvement we want to demolish in the queue
 * @constructor
 */
Astriarch.Planet.PlanetImprovementToDestroy = Astriarch.Planet.PlanetProductionItem.extend({
  /**
   * initializes this PlanetImprovementToDestroy
   * @this {Astriarch.Planet.PlanetImprovementToDestroy}
   */
  init: function(/*PlanetImprovementType*/ typeToDestroy) {
    this._super(); //invoke base class constructor

    this.TypeToDestroy = typeToDestroy;
    this.GoldCost = 0;
    var originalProductionCost = new Astriarch.Planet.PlanetImprovement(typeToDestroy).BaseProductionCost;
    this.BaseProductionCost = originalProductionCost / 4;
  },

  /**
   * returns a string representation of this improvement type
   * @this {Astriarch.Planet.PlanetImprovementToDestroy}
   * @return {string}
   */
  ToString: function() {
    return "Demolish " + Astriarch.GameTools.PlanetImprovementTypeToFriendlyName(this.TypeToDestroy);
  }
});

/**
 * PlanetImprovement is an improvement in the queue
 * @constructor
 */
Astriarch.Planet.PlanetImprovement = Astriarch.Planet.PlanetProductionItem.extend({
  /**
   * initializes this PlanetImprovement
   * @this {Astriarch.Planet.PlanetImprovement}
   */
  init: function(/*PlanetImprovementType*/ type) {
    this._super(); //invoke base class constructor

    this.Type = type;

    //setup production costs
    switch (this.Type) {
      case Astriarch.Planet.PlanetImprovementType.Colony:
        this.BaseProductionCost = 16;
        this.OreCost = 2;
        this.IridiumCost = 1;
        this.GoldCost = 3;
        break;
      case Astriarch.Planet.PlanetImprovementType.Factory:
        this.BaseProductionCost = 32;
        this.OreCost = 4;
        this.IridiumCost = 2;
        this.GoldCost = 6;
        break;
      case Astriarch.Planet.PlanetImprovementType.Farm:
        this.BaseProductionCost = 4;
        this.GoldCost = 1;
        break;
      case Astriarch.Planet.PlanetImprovementType.Mine:
        this.BaseProductionCost = 8;
        this.OreCost = 1;
        this.GoldCost = 2;
        break;
    }
  },

  /**
   * returns a string representation of this improvement type
   * @this {Astriarch.Planet.PlanetImprovement}
   * @return {string}
   */
  ToString: function() {
    return Astriarch.GameTools.PlanetImprovementTypeToFriendlyName(this.Type);
  }
});

/**
 * StarShipInProduction is an starship in the queue
 * @constructor
 */
Astriarch.Planet.StarShipInProduction = Astriarch.Planet.PlanetProductionItem.extend({
  /**
   * initializes this StarShipInProduction
   * @this {Astriarch.Planet.StarShipInProduction}
   */
  init: function(/*StarShipType*/ type, isCustomShip, advantageAgainst, disadvantageAgainst) {
    this._super(); //invoke base class constructor

    this.Type = type;

    //make a new starship just to set the Advantage/Disadvantage Against Type properties
    var ship = new Astriarch.Fleet.StarShip(type);
    this.AdvantageAgainstType = ship.AdvantageAgainstType;
    this.DisadvantageAgainstType = ship.DisadvantageAgainstType;

    var baseShipAdvantageFactor = this.AdvantageAgainstType - (this.DisadvantageAgainstType - 1);

    if (isCustomShip) {
      this.CustomShip = true;
      this.AdvantageAgainstType = advantageAgainst;
      this.DisadvantageAgainstType = disadvantageAgainst;
    }

    switch (this.Type) {
      case Astriarch.Fleet.StarShipType.SpacePlatform:
        this.BaseProductionCost = 162; //space platforms should take a while to build
        this.OreCost = 12;
        this.IridiumCost = 6;
        this.GoldCost = 18;
        break;
      case Astriarch.Fleet.StarShipType.Battleship:
        this.BaseProductionCost = 104;
        this.OreCost = 16;
        this.IridiumCost = 8;
        this.GoldCost = 24;
        break;
      case Astriarch.Fleet.StarShipType.Cruiser:
        this.BaseProductionCost = 41;
        this.OreCost = 8;
        this.IridiumCost = 4;
        this.GoldCost = 12;
        break;
      case Astriarch.Fleet.StarShipType.Destroyer:
        this.BaseProductionCost = 16;
        this.OreCost = 4;
        this.IridiumCost = 2;
        this.GoldCost = 6;
        break;
      case Astriarch.Fleet.StarShipType.Scout:
        this.BaseProductionCost = 6;
        this.OreCost = 2;
        this.IridiumCost = 1;
        this.GoldCost = 3;
        break;
      case Astriarch.Fleet.StarShipType.SystemDefense:
        this.BaseProductionCost = 2;
        this.OreCost = 1;
        this.GoldCost = 1;
        break;
    }

    if (this.CustomShip) {
      //increase cost based on advantages/disadvantages
      var advantageFactorDifference =
        this.AdvantageAgainstType - (this.DisadvantageAgainstType - 1) - baseShipAdvantageFactor;
      var costMultiplier = Math.max(1.0, 1 + advantageFactorDifference / 10);

      this.BaseProductionCost = Math.ceil(this.BaseProductionCost * costMultiplier);
      this.OreCost = Math.ceil(this.OreCost * costMultiplier);
      this.GoldCost = Math.ceil(this.GoldCost * costMultiplier);
    }
  },

  /**
   * returns a string representation of this improvement type
   * @this {Astriarch.Planet.StarShipInProduction}
   * @return {string}
   */
  ToString: function() {
    return Astriarch.GameTools.StarShipTypeToFriendlyName(this.Type);
  }
});

Astriarch.Planet.PlanetImprovementType = {
  Factory: 1, //increases the speed of building other improvements and ships (and allows for building destroyers and the space platform)
  Colony: 2, //increases the max population
  Farm: 3, //increases food production
  Mine: 4 //increases the rate of raw minerals production
};

Astriarch.Planet.PlanetType = {
  AsteroidBelt: 1,
  DeadPlanet: 2,
  PlanetClass1: 3,
  PlanetClass2: 4
};

Astriarch.Planet.PlanetHappinessType = {
  Normal: 1,
  Unrest: 2,
  Riots: 3
};

Astriarch.Planet.CitizenWorkerType = {
  Farmer: 1,
  Miner: 2,
  Worker: 3
};

/**
 * Citizen is an single population (maybe a billion people)
 * @constructor
 */
Astriarch.Planet.Citizen = function(/*PlanetType*/ type, loyalToPlayerId) {
  this.PopulationChange = 0; //between -1 and 1, when this gets >= -1 then we loose one pop, > 1 we gain one pop

  this.LoyalToPlayerId = loyalToPlayerId; //this allows us to remove the protest level when ownership of the planet reverts to this player, after protest level hits 0, this should be reset to the current owner
  this.ProtestLevel = 0; //between 0 and 1, 0 means they are able to work, anything above this means they are busy protesting the government rule

  this.WorkerType = Astriarch.Planet.CitizenWorkerType.Farmer;

  if (type == Astriarch.Planet.PlanetType.AsteroidBelt || type == Astriarch.Planet.PlanetType.DeadPlanet)
    //default to miners for asteroids & dead planets
    this.WorkerType = Astriarch.Planet.CitizenWorkerType.Miner;
};

var Astriarch = Astriarch || require('./astriarch_base');

Astriarch.AI = {

	OnComputerSentFleet: function(f) {
		console.debug("Computer Sent Fleet:", f.ToString(), "From:", f.travelingFromHex.PlanetContainedInHex.Name, "To:", f.DestinationHex.PlanetContainedInHex.Name);
	},

	ComputerTakeTurn: function(gameModel, /*Player*/ player){
		//determine highest priority for resource usage
		//early game should be building developments and capturing/exploring planets while keeping up food production
		//mid game should be building space-platforms, high-class ships and further upgrading planets
		//late game should be strategically engaging the enemy
		//check planet production, prefer high-class planets (or even weather strategic points should be developed instead of high-class planets?)
		//if the planet has slots available and we have enough resources build (in order when we don't have)
		//
		
		var ownedPlanetsSorted = player.GetOwnedPlanetsListSorted();
		Astriarch.AI.computerSetPlanetBuildGoals(gameModel, player, ownedPlanetsSorted);

		Astriarch.AI.computerSubmitTrades(gameModel, player, ownedPlanetsSorted);

		Astriarch.AI.computerBuildImprovementsAndShips(gameModel, player, ownedPlanetsSorted);


		//adjust population assignments as appropriate based on planet and needs
		Astriarch.AI.computerAdjustPopulationAssignments(player);


		//base strategies on computer-level
		//here is the basic strategy:
		//if there are unclaimed explored planets
		//find the closest one and send a detachment, based on planet class
		//for easy level send detachments based only on distance
		//normal mode additionally prefers class 2 planets
		//hard mode additionally prefers Dead planets and considers enemy force before making an attack
		//expert mode additionally prefers asteroid belts late in the game when it needs crystal

		//send scouts to unexplored planets (harder levels of computers know where better planets are?)

		Astriarch.AI.computerSendShips(gameModel, player, ownedPlanetsSorted);

	},

	computerAdjustPopulationAssignments: function(/*Player*/ player){
		//TODO: this could be better by having an object for the planet pop assignments
		var planetFarmers = {}; //Dictionary<int, int>
		var planetMiners = {}; //Dictionary<int, int>
		var planetWorkers = {}; //Dictionary<int, int>

		var allPlanets = []; //List<Planet>//this list will be for sorting

		for (var i in player.OwnedPlanets)
		{
			var p = player.OwnedPlanets[i];//Planet
			var pop = new Astriarch.Planet.PopulationAssignments();
			p.CountPopulationWorkerTypes(pop);
			planetFarmers[p.Id] = pop.Farmers;
			planetMiners[p.Id] = pop.Miners;
			planetWorkers[p.Id] = pop.Workers;

			allPlanets.push(p);

			console.debug(player.Name, "Population Assignment for planet:", p.Name, pop);

			//make sure we have up to date resources per turn before we make decisions based on assignments
			p.ResourcesPerTurn.UpdateResourcesPerTurnBasedOnPlanetStats();
		}


		var totalPopulation = player.GetTotalPopulation();
		var totalFoodProduction = 0;
		var totalFoodAmountOnPlanets = 0;
		var totalPlanetsWithPopulationGrowthPotential = 0; //this will always give the computers some extra food surplus to avoid starving new population
		for (var i in player.OwnedPlanets)
		{
			var p = player.OwnedPlanets[i];//Planet
			totalFoodAmountOnPlanets += p.Resources.FoodAmount;
			totalFoodProduction += p.ResourcesPerTurn.GetFoodAmountPerTurn();
			if (p.Population.length < p.MaxPopulation())
				totalPlanetsWithPopulationGrowthPotential++;
		}
		totalFoodAmountOnPlanets -= (totalPopulation);//this is what we'll eat this turn

		//this is what we'll keep in surplus to avoid starving more-difficult comps
		totalFoodAmountOnPlanets -= totalPlanetsWithPopulationGrowthPotential;

		//to make the easier computers even easier we will sometimes have them generate too much food and sometimes generate too little so they starve
		var totalFoodAmountOnPlanetsAdjustmentLow = 0;
		var totalFoodAmountOnPlanetsAdjustmentHigh = 0;
		//add some extra food padding based on player type, this will make the easier computers less agressive
		switch (player.Type)
		{
			case Astriarch.Player.PlayerType.Computer_Easy:
				totalFoodAmountOnPlanetsAdjustmentLow -= (totalPopulation * 3);
				totalFoodAmountOnPlanetsAdjustmentHigh = Math.floor(totalPopulation * 1.5);
				break;
			case Astriarch.Player.PlayerType.Computer_Normal:
				totalFoodAmountOnPlanetsAdjustmentLow -= Math.floor(totalPopulation * 1.5);
				totalFoodAmountOnPlanetsAdjustmentHigh = totalPopulation;
				break;
			case Astriarch.Player.PlayerType.Computer_Hard:
				totalFoodAmountOnPlanetsAdjustmentLow -= (totalPopulation / 2);
				totalFoodAmountOnPlanetsAdjustmentHigh = 0;
				break;
		}

		var totalFoodAmountOnPlanetsAdjustment = Astriarch.NextRandom(totalFoodAmountOnPlanetsAdjustmentLow, totalFoodAmountOnPlanetsAdjustmentHigh + 1);

		totalFoodAmountOnPlanets += totalFoodAmountOnPlanetsAdjustment;

		var oreAmountRecommended = 0;
		var iridiumAmountRecommended = 0;
		//base mineral need on desired production (build goals)
		//  for each planet with a space platform 
		//    if it is a class 1 or asteroid belt (planets with the most mineral potential), recommended ore and iridium should be for a battleship
		//    otherwise recommended ore and iridum should be for a cruiser
		//  for each planet without a space platform but at least one factory
		//    recommended ore and iridum should be for a destroyer
		//  for each planet witout a factory
		//    recommended ore for a scout only

		for (var i in player.OwnedPlanets)
		{
			var p = player.OwnedPlanets[i];//Planet
			if (p.Id in player.PlanetBuildGoals)
			{
				var ppi = player.PlanetBuildGoals[p.Id];//PlanetProductionItem
				oreAmountRecommended += ppi.OreCost;
				iridiumAmountRecommended += ppi.IridiumCost;
			}
			else//this happens when we have placed our build goal into the queue already
			{
				continue;
				//add a bit more?
				//oreAmountRecommended += 2;
				//iridiumAmountRecommended += 1;
			}
		}

		//further stunt the easy computers growth by over estimating ore and iridium amount recommended
		var mineralOverestimation = 1.0;
		switch (player.Type)
		{
			case Astriarch.Player.PlayerType.Computer_Easy:
				mineralOverestimation = Astriarch.NextRandom(20, 41)/10.0;
				break;
			case Astriarch.Player.PlayerType.Computer_Normal:
				mineralOverestimation = Astriarch.NextRandom(10, 21) / 10.0;
				break;
		}

		var oreAmountNeeded = Math.round(oreAmountRecommended * mineralOverestimation) - player.TotalOreAmount();
		var iridiumAmountNeeded = Math.round(iridiumAmountRecommended * mineralOverestimation) - player.TotalIridiumAmount();
		var foodDiff = 0;
		console.debug(player.Name, "Mineral Needs:", oreAmountNeeded, iridiumAmountNeeded);

		if (totalPopulation > (totalFoodProduction + totalFoodAmountOnPlanets))
		{
			//check to see if we can add farmers to class 1 and class 2 planets
			foodDiff = totalPopulation - (totalFoodProduction + totalFoodAmountOnPlanets);
			//first try to satiate by retasking miners/workers on planets with less food amount than population
			console.debug(player.Name, "potential food shortage:", foodDiff);

			//gather potential planets for adding farmers to
			//TODO: this should order by planets with farms as well as planets who's population demands more food than it produces (more potential for growth)
			allPlanets.sort(Astriarch.Planet.PlanetFoodProductionPotentialComparerSortFunction);

			var neededFarmers = foodDiff;
			var planetCandidatesForAddingFarmers = []; //List<Planet>

			if (neededFarmers > 0)
				for (var i in allPlanets)
				{
					var p = allPlanets[i];//Planet
					if (neededFarmers > 0 && p.ResourcesPerTurn.GetExactFoodAmountNextWorkerPerTurn() > 0
							&& (planetMiners[p.Id] > 0 || planetWorkers[p.Id] > 0))
					{
						planetCandidatesForAddingFarmers.push(p);
						neededFarmers -= p.ResourcesPerTurn.GetExactFoodAmountNextWorkerPerTurn();
						if (neededFarmers <= 0)
							break;
					}
				}

			while (foodDiff > 0)
			{
				var changedAssignment = false;
				for (var i in planetCandidatesForAddingFarmers)
				{
					var p = planetCandidatesForAddingFarmers[i];//Planet
					var maxMiners = planetWorkers[p.Id];//we don't want more miners than workers when we have food shortages
					if (p.Type == Astriarch.Planet.PlanetType.PlanetClass2)
					{
						if (p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Mine].length == 0)
							maxMiners = 0;
						else
							maxMiners = 1;
					}
					if (planetMiners[p.Id] >= maxMiners && planetMiners[p.Id] > 0)
					{
						p.UpdatePopulationWorkerTypesByDiff(planetFarmers[p.Id], planetMiners[p.Id], planetWorkers[p.Id], 1, -1, 0);
						planetFarmers[p.Id]++;
						planetMiners[p.Id]--;
						foodDiff -= p.ResourcesPerTurn.GetExactFoodAmountNextWorkerPerTurn();
						changedAssignment = true;
					}
					else if (planetWorkers[p.Id] > 0)
					{
						p.UpdatePopulationWorkerTypesByDiff(planetFarmers[p.Id], planetMiners[p.Id], planetWorkers[p.Id], 1, 0, -1);
						planetFarmers[p.Id]++;
						planetWorkers[p.Id]--;
						foodDiff -= p.ResourcesPerTurn.GetExactFoodAmountNextWorkerPerTurn();
						changedAssignment = true;
					}

					if (foodDiff <= 0)
						break;
				}

				//if we got here and didn't change anything, break out
				if (!changedAssignment)
					break;
			}//while (foodDiff > 0)

			//if we weren't able to satisfy the population's hunger at this point,
			// we may just have to starve
		}
		else//we can re-task farmers at class 1 and class 2 planets (and maybe dead planets?)
		{
			foodDiff = (totalFoodProduction + totalFoodAmountOnPlanets) - totalPopulation;
			console.debug(player.Name, "potential food surplus:", foodDiff);

			//gather potential planets for removing farmers from
			//TODO: this should order by planets without farms and planets which have more food production than it's population demands (less potential for growth)
			allPlanets.sort(Astriarch.Planet.PlanetFoodProductionPotentialComparerSortFunction);
			allPlanets.reverse();

			var unneededFarmers = foodDiff;
			var planetCandidatesForRemovingFarmers = []; //List<Planet>
			if (unneededFarmers > 0)
				for (var i in allPlanets)
				{
					var p = allPlanets[i];//Planet
					if (unneededFarmers > 0 &&
						unneededFarmers > p.ResourcesPerTurn.GetExactFoodAmountPerWorkerPerTurn() &&
						planetFarmers[p.Id] > 0)
					{
						planetCandidatesForRemovingFarmers.push(p);
						unneededFarmers -= p.ResourcesPerTurn.GetExactFoodAmountPerWorkerPerTurn();
						if (unneededFarmers <= 0)
							break;
					}
				}

			while (foodDiff > 0)
			{
				var changedAssignment = false;
				for (var i in planetCandidatesForRemovingFarmers)
				{
					var p = planetCandidatesForRemovingFarmers[i];//Planet
					if (foodDiff < p.ResourcesPerTurn.GetExactFoodAmountPerWorkerPerTurn())
						continue;//if removing this farmer would create a shortage, skip this planet

					//check if we need more minerals, otherwise prefer production
					//on terrestrial planets, make sure we have a mine before we add a miner
					var addMiner = (p.Type != Astriarch.Planet.PlanetType.PlanetClass2 || p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Mine].length > 0);
					if (addMiner && (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) && planetFarmers[p.Id] > 0)
					{
						p.UpdatePopulationWorkerTypesByDiff(planetFarmers[p.Id], planetMiners[p.Id], planetWorkers[p.Id], -1, 1, 0);
						planetFarmers[p.Id]--;
						planetMiners[p.Id]++;
						oreAmountNeeded -= p.ResourcesPerTurn.GetExactOreAmountNextWorkerPerTurn();
						iridiumAmountNeeded -= p.ResourcesPerTurn.GetExactIridiumAmountNextWorkerPerTurn();
						foodDiff -= p.ResourcesPerTurn.GetExactFoodAmountPerWorkerPerTurn();
						changedAssignment = true;
					}
					else if (planetFarmers[p.Id] > 0)
					{
						p.UpdatePopulationWorkerTypesByDiff(planetFarmers[p.Id], planetMiners[p.Id], planetWorkers[p.Id], -1, 0, 1);
						planetFarmers[p.Id]--;
						planetWorkers[p.Id]++;
						foodDiff -= p.ResourcesPerTurn.GetExactFoodAmountPerWorkerPerTurn();
						changedAssignment = true;
					}

					if (foodDiff <= 0)
						break;
				}

				//if we got here and didn't change anything, break out
				if (!changedAssignment)
					break;
			}//while (foodDiff > 0)
		}

		var oreAmountNeededWorking = (oreAmountNeeded * 1.0);
		var iridumAmountNeededWorking = (iridiumAmountNeeded * 1.0);
		//next see if we need miners, look for workers to reassign (don't reassign farmers at this point)
		if (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) {

			var planetCandidatesForRemovingWorkers = []; //List<Planet>
			
			var mineralProductionComparer = new Astriarch.Planet.PlanetMineralProductionPotentialComparer(oreAmountNeeded, iridiumAmountNeeded);
			allPlanets.sort(mineralProductionComparer.sortFunction);

			for (var i in allPlanets) {
				if (oreAmountNeededWorking < 0 && iridumAmountNeededWorking < 0) {
					break;
				}
				var p = allPlanets[i];//Planet
				//leave at least one worker on terrestrial planets, leave 2 workers if we don't have a mine yet
				var minWorkers = 0;
				var minFarmers = -1;
				if (p.Type == Astriarch.Planet.PlanetType.PlanetClass2) {
					minWorkers = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Mine].length == 0 ? 2 : 1;
					minFarmers = 0;//also make sure we have one farmer before reassigning a worker to be miner
				}


				if (planetWorkers[p.Id] > minWorkers && planetFarmers[p.Id] > minFarmers) {
					planetCandidatesForRemovingWorkers.push(p);
					oreAmountNeededWorking -= p.ResourcesPerTurn.GetExactOreAmountNextWorkerPerTurn();
					iridumAmountNeededWorking -= p.ResourcesPerTurn.GetExactIridiumAmountNextWorkerPerTurn();
				}
			}
			

			while (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) {
				var changedAssignment = false;
				for (var i in planetCandidatesForRemovingWorkers) {
					var p = planetCandidatesForRemovingWorkers[i];//Planet
					//double check we have enough workers still
					var minWorkers = 1;
					if (p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Mine].length == 0)
						minWorkers = 2;

					if (planetWorkers[p.Id] > minWorkers) {
						p.UpdatePopulationWorkerTypesByDiff(planetFarmers[p.Id], planetMiners[p.Id], planetWorkers[p.Id], 0, 1, -1);
						planetMiners[p.Id]++;
						planetWorkers[p.Id]--;
						oreAmountNeeded -= p.ResourcesPerTurn.GetExactOreAmountNextWorkerPerTurn();
						iridiumAmountNeeded -= p.ResourcesPerTurn.GetExactIridiumAmountNextWorkerPerTurn();
						changedAssignment = true;
					}

					if (oreAmountNeeded <= 0 && iridiumAmountNeeded <= 0)
						break;
				}

				//if we got here and didn't change anything, break out
				if (!changedAssignment)
					break;
			}//while (oreAmountNeeded > 0 || iridiumAmountNeeded > 0)

		} else {
			//we have enough minerals, reassign miners to workers

			var planetCandidatesForRemovingMiners = []; //List<Planet>

			var mineralProductionComparer = new Astriarch.Planet.PlanetMineralProductionPotentialComparer(oreAmountNeeded, iridiumAmountNeeded);
			allPlanets.sort(mineralProductionComparer.sortFunction);
			allPlanets.reverse();


			for (var i in allPlanets) {
				if (oreAmountNeededWorking > 0 || iridumAmountNeededWorking > 0) {
					break;
				}
				var p = allPlanets[i];//Planet
				if (planetMiners[p.Id] > 0) {
					planetCandidatesForRemovingMiners.push(p);
					oreAmountNeededWorking += p.ResourcesPerTurn.GetExactOreAmountPerWorkerPerTurn();
					iridumAmountNeededWorking += p.ResourcesPerTurn.GetExactIridiumAmountPerWorkerPerTurn();
				}
			}

			while (oreAmountNeeded < 0 && iridiumAmountNeeded < 0) {
				var changedAssignment = false;
				for (var i in planetCandidatesForRemovingMiners) {
					var p = planetCandidatesForRemovingMiners[i];//Planet
					//double check we still have miners and that we don't over compensate
					if (planetMiners[p.Id] > 0 && (oreAmountNeeded + p.ResourcesPerTurn.GetExactOreAmountPerWorkerPerTurn() < 0 && iridiumAmountNeeded + p.ResourcesPerTurn.GetExactIridiumAmountPerWorkerPerTurn() < 0)) {
						p.UpdatePopulationWorkerTypesByDiff(planetFarmers[p.Id], planetMiners[p.Id], planetWorkers[p.Id], 0, -1, 1);
						planetMiners[p.Id]--;
						planetWorkers[p.Id]++;
						oreAmountNeeded += p.ResourcesPerTurn.GetExactOreAmountPerWorkerPerTurn();
						iridiumAmountNeeded += p.ResourcesPerTurn.GetExactIridiumAmountPerWorkerPerTurn();
						changedAssignment = true;
					}

					if (oreAmountNeeded > 0 || iridiumAmountNeeded > 0)
						break;
				}

				//if we got here and didn't change anything, break out
				if (!changedAssignment)
					break;
			}//while (oreAmountNeeded < 0 || iridiumAmountNeeded < 0)
		}
	},

	computerSetPlanetBuildGoals: function(gameModel, /*Player*/ player, ownedPlanetsSorted){
		//first look for planets that need build goals set, either for ships or for improvements

		var planetCandidatesForNeedingImprovements = []; //List<Planet>
		var planetCandidatesForNeedingSpacePlatforms = []; //List<Planet>
		var planetCandidatesForNeedingShips = []; //List<Planet>

		var planetCountNeedingExploration = Astriarch.AI.countPlanetsNeedingExploration(gameModel, player);

		for(var i in ownedPlanetsSorted) {
			var p = ownedPlanetsSorted[i];//Planet
			//if this planet doesn't already have a build goal in player.PlanetBuildGoals
			if (!player.PlanetBuildGoals[p.Id]) {
				if(p.BuildQueue.length)
					console.debug(player.Name, "build queue on:", p.Name, p.BuildQueue[0]);
				if (p.BuildQueue.length <= 1) {
					//even if we have something in queue we might want to set a goal to save up resources?

					//always check for improvements in case we need to destroy some
					planetCandidatesForNeedingImprovements.push(p);
					if(ownedPlanetsSorted.length > 1){
						if (p.GetSpacePlatformCount() == 0 && p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length > 0) {
							planetCandidatesForNeedingSpacePlatforms.push(p);
						} else {
							planetCandidatesForNeedingShips.push(p);
						}
					} else {
						if (planetCountNeedingExploration != 0) {
							//if we need to explore some planets before building a space platform, do so
							planetCandidatesForNeedingShips.push(p);
						} else if (p.GetSpacePlatformCount() == 0 && p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length > 0) {
							planetCandidatesForNeedingSpacePlatforms.push(p);
						} else {
							planetCandidatesForNeedingShips.push(p);
						}
					}
				}
			}
		}

		//space platforms
		for (var i in planetCandidatesForNeedingSpacePlatforms) {
			var p = planetCandidatesForNeedingSpacePlatforms[i];//Planet
			if (p.GetSpacePlatformCount(true) == 0) {
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.StarShipInProduction(Astriarch.Fleet.StarShipType.SpacePlatform);
			}
		}
		
		//build improvements
		for (var i in planetCandidatesForNeedingImprovements) {
			var p = planetCandidatesForNeedingImprovements[i];//Planet
			//planet class 2 should have 3 farms and 2 mines
			//planet class 1 should have 2 farms and 0 mines
			//dead planets should have 0 farms and 1 mine
			//asteroids should have 0 farms and 1 mine
			//otherwise build 1 factory if none exist
			//otherwise build 1 colony if none exist
			//otherwise build factories to recommended amount
			//otherwise build a spaceport space platform is none exist
			//otherwise colonies till we're filled up

			var recommendedFarms = 0;
			var recommendedMines = 0;
			var recommendedFactories = 1;
			var recommendedColonies = 1;

			var farmCount = p.BuiltAndBuildQueueImprovementTypeCount(Astriarch.Planet.PlanetImprovementType.Farm);
			var mineCount = p.BuiltAndBuildQueueImprovementTypeCount(Astriarch.Planet.PlanetImprovementType.Mine);
			var factoryCount = p.BuiltAndBuildQueueImprovementTypeCount(Astriarch.Planet.PlanetImprovementType.Factory);
			var colonyCount = p.BuiltAndBuildQueueImprovementTypeCount(Astriarch.Planet.PlanetImprovementType.Colony);

			//NOTE: we aren't checking gold for the purposes of farms, we'll just build them
			var origRecommendedMines = 2;
			if (p.Type == Astriarch.Planet.PlanetType.PlanetClass2) {
				if(ownedPlanetsSorted.length == 1) {
					//until we have another planet we need to build some mines to get resources
					recommendedFarms = 3;
					recommendedMines = origRecommendedMines;
				} else {
					recommendedFarms = 4;
					recommendedMines = 0;
				}
			} else if (p.Type == Astriarch.Planet.PlanetType.PlanetClass1) {
				recommendedFarms = 2;
			} else if (p.Type == Astriarch.Planet.PlanetType.DeadPlanet) {
				recommendedMines = 1;
			} else if (p.Type == Astriarch.Planet.PlanetType.AsteroidBelt) {
				recommendedMines = 2;
			}
			recommendedFactories = p.MaxImprovements - recommendedMines - recommendedFarms - recommendedColonies;

			//make sure farms are built before mines
			if (farmCount < recommendedFarms) {
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.PlanetImprovement(Astriarch.Planet.PlanetImprovementType.Farm);
			} else if (mineCount < recommendedMines) {
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.PlanetImprovement(Astriarch.Planet.PlanetImprovementType.Mine);
			} else if (factoryCount == 0 && recommendedFactories > 0) {
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.PlanetImprovement(Astriarch.Planet.PlanetImprovementType.Factory);
			} else if (colonyCount < recommendedColonies) {
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.PlanetImprovement(Astriarch.Planet.PlanetImprovementType.Colony);
			} else if (factoryCount < recommendedFactories) {
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.PlanetImprovement(Astriarch.Planet.PlanetImprovementType.Factory);
			} else if (farmCount > recommendedFarms) {
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.PlanetImprovementToDestroy(Astriarch.Planet.PlanetImprovementType.Farm);
			} else if (mineCount > recommendedMines) {
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.PlanetImprovementToDestroy(Astriarch.Planet.PlanetImprovementType.Mine);
			} else if (factoryCount > recommendedFactories) {
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.PlanetImprovementToDestroy(Astriarch.Planet.PlanetImprovementType.Factory);
			} else if (colonyCount > recommendedColonies) {
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.PlanetImprovementToDestroy(Astriarch.Planet.PlanetImprovementType.Colony);
			}
			if(player.PlanetBuildGoals[p.Id]) {
				console.debug(player.Name, "Planet:", p.Name, "Improvement Build Goal:", player.PlanetBuildGoals[p.Id], Astriarch.GameTools.PlanetImprovementTypeToFriendlyName(player.PlanetBuildGoals[p.Id].Type));
			}


			//after all that we should be ready to set fleet goals
		}

		//build ships
		for (var i in planetCandidatesForNeedingShips) {
			var p = planetCandidatesForNeedingShips[i];//Planet
			if(player.PlanetBuildGoals[p.Id] && (ownedPlanetsSorted.length > 3 || ownedPlanetsSorted.length == 1) && mineCount != origRecommendedMines) {
				//do this for now so that the computer builds improvements before too much scouting, however might want to revisit this so that there is some scouting done before all buildings are built
				continue;
			}
			//defenders and destroyers will be built at random for the easier computers
			var buildDefenders = false;
			var buildDestroyers = false;
			if(player.Type == Astriarch.Player.PlayerType.Computer_Easy) {
				//50% chance to build defenders, 50% chance for destroyers
				buildDefenders = (Astriarch.NextRandom(0, 4) <= 1);
				buildDestroyers = (!buildDefenders && Astriarch.NextRandom(0, 4) <= 1);
			} else if (player.Type == Astriarch.Player.PlayerType.Computer_Normal) {
				//25% chance to build defenders, 25% chance for destroyers
				buildDefenders = (Astriarch.NextRandom(0, 4) == 0);
				buildDestroyers = (!buildDefenders && Astriarch.NextRandom(0, 4) == 0);
			}

			if (p.GetSpacePlatformCount() > 0 && !buildDefenders) {
				var rand = Astriarch.NextRandom(4);
				//build battleships at half the planets with spaceplatforms
				if (rand < 2) {
					if (rand % 2 == 0)//1/4 the time we build battleships 1/2 time build destroyers
						player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.StarShipInProduction(Astriarch.Fleet.StarShipType.Battleship);
					else
						player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.StarShipInProduction(Astriarch.Fleet.StarShipType.Destroyer);
				} else {
					if (rand % 2 == 1)//1/4 the time we build cruisers 1/2 time build destroyers
						player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.StarShipInProduction(Astriarch.Fleet.StarShipType.Cruiser);
					else
						player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.StarShipInProduction(Astriarch.Fleet.StarShipType.Destroyer);
				}
			} else if (planetCountNeedingExploration != 0) {
				//if there are unexplored planets still, build some scouts
				console.debug(player.Name, planetCountNeedingExploration, "Planets needing exploration, building scouts");
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.StarShipInProduction(Astriarch.Fleet.StarShipType.Scout);
			} else if (p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length > 0 && buildDestroyers) {
				//NOTE: this actually never gets hit because right now we're always building scouts, then spaceplatforms, then above applies
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.StarShipInProduction(Astriarch.Fleet.StarShipType.Destroyer);
			} else if (gameModel.Turn.Number % 4 == 0 && buildDefenders) {
				//else create defender (but only sometimes so we save gold)
				player.PlanetBuildGoals[p.Id] = new Astriarch.Planet.StarShipInProduction(Astriarch.Fleet.StarShipType.SystemDefense);
			}
			if(player.PlanetBuildGoals[p.Id]) {
				console.debug(player.Name, "Planet:", p.Name, "StarShip Build Goal:", Astriarch.GameTools.StarShipTypeToFriendlyName(player.PlanetBuildGoals[p.Id].Type));
			}
		}

	},

	computerSubmitTrades: function(gameModel, /*Player*/ player, ownedPlanetsSorted){
		//first decide if we want to trade based on resource prices and needed resources (based on planet build goals)
		var totalPopulation = player.GetTotalPopulation();
		var totalGold = player.Resources.GoldAmount;
		var totalFood = player.TotalFoodAmount();
		var totalOre = player.TotalOreAmount();
		var totalIridium = player.TotalIridiumAmount();

		var goldDesired = 0;
		var oreDesired = 0;
		var iridiumDesired = 0;
		for(var planetId in player.PlanetBuildGoals){
			var ppi = player.PlanetBuildGoals[planetId];
			goldDesired += ppi.GoldCost;
			oreDesired += ppi.OreCost;
			iridiumDesired += ppi.IridiumCost;
		}
		var purchaseMultiplier = 0.25;
		var tradesToExecute = [];
		var planetId = player.HomePlanetId ? player.HomePlanetId : ownedPlanetsSorted[0].Id;
		var amount = 0;
		var orderType = Astriarch.TradingCenter.OrderType.MARKET;
		var limitPrice = null;
		var tradeType = Astriarch.TradingCenter.TradeType.SELL;
		if(totalGold < goldDesired){

			//try to sell resources
			//only sell resources when you have far more than you need
			if (totalFood >= totalPopulation * 4){
				//sell some food
				amount = Math.floor(totalFood * purchaseMultiplier);
				tradesToExecute.push(new Astriarch.TradingCenter.Trade(player.Id, planetId, tradeType, Astriarch.TradingCenter.ResourceType.FOOD, amount, orderType, limitPrice));
			}
			if(totalOre >= oreDesired * 2){
				amount = Math.floor(totalOre * purchaseMultiplier);
				tradesToExecute.push(new Astriarch.TradingCenter.Trade(player.Id, planetId, tradeType, Astriarch.TradingCenter.ResourceType.ORE, amount, orderType, limitPrice));
			}

			if(totalIridium >= iridiumDesired * 2){
				amount = Math.floor(totalIridium * purchaseMultiplier);
				tradesToExecute.push(new Astriarch.TradingCenter.Trade(player.Id, planetId, tradeType, Astriarch.TradingCenter.ResourceType.IRIDIUM, amount, orderType, limitPrice));
			}
		} else if(totalGold > goldDesired * 1.2){
			tradeType = Astriarch.TradingCenter.TradeType.BUY;
			//try to buy resources
			if(totalFood <= totalPopulation * 1.2){
				//buy some food
				var amount = Math.floor(totalPopulation * purchaseMultiplier);
				tradesToExecute.push(new Astriarch.TradingCenter.Trade(player.Id, planetId, tradeType, Astriarch.TradingCenter.ResourceType.FOOD, amount, orderType, limitPrice));
			}

			if(totalOre <= oreDesired * 1.2){
				var amount = Math.floor(oreDesired * purchaseMultiplier);
				tradesToExecute.push(new Astriarch.TradingCenter.Trade(player.Id, planetId, tradeType, Astriarch.TradingCenter.ResourceType.ORE, amount, orderType, limitPrice));
			}
			if(totalIridium <= iridiumDesired * 1.2){
				var amount = Math.floor(iridiumDesired * purchaseMultiplier);
				tradesToExecute.push(new Astriarch.TradingCenter.Trade(player.Id, planetId, tradeType, Astriarch.TradingCenter.ResourceType.IRIDIUM, amount, orderType, limitPrice));
			}
		}

		for(var t in tradesToExecute){
			var trade = tradesToExecute[t];
			if(trade.amount > 0) {
				console.debug(player.Name, "Submitted a Trade: ", trade);
				gameModel.TradingCenter.currentTrades.push(trade);
			} else {
				console.debug(player.Name, "Trade found with zero amount.", trade);
			}
		}

	},

	computerBuildImprovementsAndShips: function(gameModel, /*Player*/ player, ownedPlanetsSorted){

		//determine gold surplus needed to ship food
		var goldSurplus = player.LastTurnFoodNeededToBeShipped;

		//increase recommended goldSurplus based on computer difficulty to further make the easier computers a bit less agressive
		switch (player.Type)
		{
			case Astriarch.Player.PlayerType.Computer_Easy:
				//goldSurplus +=Astriarch.CountObjectKeys(player.OwnedPlanets) - 1);
				goldSurplus = Astriarch.NextRandom(0, (goldSurplus + 1)/4);//this should make the easy computer even easier, because sometimes he should starve himself
				break;
			case Astriarch.Player.PlayerType.Computer_Normal:
				//goldSurplus += (Astriarch.CountObjectKeys(player.OwnedPlanets) - 1 / 2);
				goldSurplus = Astriarch.NextRandom(0, (goldSurplus + 1)/2);//this should make the normal computer easier, because sometimes he should starve himself
				break;
			case Astriarch.Player.PlayerType.Computer_Hard:
				goldSurplus += (Astriarch.CountObjectKeys(player.OwnedPlanets) - 1 / 2);
				break;
			case Astriarch.Player.PlayerType.Computer_Expert:
				goldSurplus += (Astriarch.CountObjectKeys(player.OwnedPlanets) - 1 / 4);
				break;
		}

		//build improvements and ships based on build goals
		for (var i in ownedPlanetsSorted)
		{
			var p = ownedPlanetsSorted[i];//Planet
			if (p.BuildQueue.length == 0)
			{
				if (p.Id in player.PlanetBuildGoals)
				{
					var ppi = player.PlanetBuildGoals[p.Id];//PlanetProductionItem
					//check resources
					if (player.Resources.GoldAmount - ppi.GoldCost > goldSurplus &&
						player.TotalOreAmount() - ppi.OreCost >= 0 &&
						player.TotalIridiumAmount() - ppi.IridiumCost >= 0)
					{
						p.EnqueueProductionItemAndSpendResources(gameModel, ppi, player);
						delete player.PlanetBuildGoals[p.Id];
					}
				}
				else//could this be a problem?
				{
					continue;
				}
			}

		}

	},

	computerSendShips: function(gameModel, /*Player*/ player, ownedPlanetsSorted){
		//easy computer sends ships to closest planet at random
		//normal computers keep detachments of ships as defence as deemed necessary based on scouted enemy forces and planet value
		//hard computers also prefer planets based on class, location, and fleet defence
		//expert computers also amass fleets at strategic planets,
		//when two planets have ship building capabilities (i.e. have at least one factory),
		//and a 3rd desired planet is unowned, the further of the two owned planets sends it's ships to the closer as reinforcements

		//all but easy computers will also re-scout enemy planets after a time to re-establish intelligence

		var planetCandidatesForSendingShips = []; //List<Planet>
		for (var i in ownedPlanetsSorted)
		{
			var p = ownedPlanetsSorted[i];//Planet
			if (p.PlanetaryFleet.GetPlanetaryFleetMobileStarshipCount() > 0)
			{
				if (player.Type == Astriarch.Player.PlayerType.Computer_Easy)//easy computers can send ships as long as there is somthing to send
				{
					planetCandidatesForSendingShips.push(p);
				}
				else
				{

					var strengthToDefend = 0;

					if (Astriarch.AI.countPlanetsNeedingExploration(gameModel, player) != 0)
					{
						//this is done because of how the goals are set right now,
						//we don't want the computer defending with all of it's ships when there is exploring to be done
						strengthToDefend = 0; 
					}
					else if (p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length > 0)//if we can build ships it is probably later in the game and we should start defending this planet
					{
						strengthToDefend = Math.floor(Math.pow((p.Type), 2) * 4);//defense based on planet type
					}

					if (player.Type == Astriarch.Player.PlayerType.Computer_Hard || player.Type == Astriarch.Player.PlayerType.Computer_Expert)
					{
						//base defense upon enemy fleet strength within a certain range of last known planets
						// as well as if there are ships in queue and estimated time till production

						//TODO: we should get all enemy planets within a certain range instead of just the closest one
						var minDistanceObject = {'minDistance':0};
						var closestUnownedPlanet = Astriarch.AI.getClosestUnownedPlanet(gameModel, player, p, minDistanceObject);//Planet
						if (closestUnownedPlanet != null)
						{
							if (player.LastKnownPlanetFleetStrength[closestUnownedPlanet.Id])
							{
								strengthToDefend += player.LastKnownPlanetFleetStrength[closestUnownedPlanet.Id].Fleet.DetermineFleetStrength(true);
							}
							else if (player.KnownClientPlanets[closestUnownedPlanet.Id])
							{
								strengthToDefend += Math.floor(Math.pow((closestUnownedPlanet.Type), 2) * 4);
							}
						}

						var turnsToCompleteStarshipStrengthObject = {'turnsToComplete': 99, 'starshipStrength':0};
						if (p.BuildQueueContainsMobileStarship(turnsToCompleteStarshipStrengthObject))
						{
							if (turnsToCompleteStarshipStrengthObject['turnsToComplete'] <= minDistanceObject['minDistance'] + 1)//if we can build this before an enemy can get here
							{
								strengthToDefend -= turnsToCompleteStarshipStrengthObject['starshipStrength'];
							}
						}
					}

					if (p.PlanetaryFleet.DetermineFleetStrength() > strengthToDefend)
					{
						planetCandidatesForSendingShips.push(p);//TODO: for some computer levels below we should also leave a defending detachment based on strength to defend, etc...
					}
				}
			}

		}


		var planetCandidatesForInboundScouts = []; //List<Planet>
		var planetCandidatesForInboundAttackingFleets = []; //List<Planet>
		if (planetCandidatesForSendingShips.length > 0) {
			for (var i in gameModel.Planets) {
				var p = gameModel.Planets[i];//Planet
				if (p.Owner != player && !player.PlanetContainsFriendlyInboundFleet(p)) {
					//exploring/attacking inbound fleets to unowned planets should be excluded
					if (Astriarch.AI.planetNeedsExploration(p, gameModel, player)) {
						planetCandidatesForInboundScouts.push(p);
					} else if (!player.GetPlanetIfOwnedByPlayer(p.Id)) {
						//TODO: we might still want to gather fleets strategically
						planetCandidatesForInboundAttackingFleets.push(p);
					}
				}
			}
		}


		//computer should send one available ship to unexplored planets (TODO: later build scouts/destroyers as appropriate for this)
		//computer should gather fleets strategically at fronts close to unowned planets (TODO: later base this on last known force strength)
		//
		//new send ship logic:
		// for each planet that can send ships
		//  get list of the closest unowned planets
		//   if it is unexplored (and we don't already have an inbound fleet), send a one ship detachment
		//   if it is explored and if we have more strength than the last known strength on planet (and we don't already have an inbound fleet), send a detachment


		//first sort planet candidates for inbound fleets by closest to home planet
		if (player.HomePlanetId != null)//just to make sure
		{
			var homePlanet = gameModel.getPlanetById(player.HomePlanetId);
			if (player.Type == Astriarch.Player.PlayerType.Computer_Easy || player.Type == Astriarch.Player.PlayerType.Computer_Normal)
			{
				var planetDistanceComparer = new Astriarch.Planet.PlanetDistanceComparer(gameModel, homePlanet);
				planetCandidatesForInboundAttackingFleets.sort(planetDistanceComparer.sortFunction);
				planetCandidatesForInboundScouts.sort(planetDistanceComparer.sortFunction);
			}
			else
			{
				//hard and expert computer will sort with a bit of complexly (based on value and last known strength as well as distance)
				var planetValueDistanceStrengthComparer = new Astriarch.Planet.PlanetValueDistanceStrengthComparer(gameModel, homePlanet, player.LastKnownPlanetFleetStrength);
				planetCandidatesForInboundAttackingFleets.sort(planetValueDistanceStrengthComparer.sortFunction);
				planetCandidatesForInboundScouts.sort(planetValueDistanceStrengthComparer.sortFunction);
			}

		}

		var planetCandidatesForInboundReinforcements = []; //List<Planet>
		if (player.Type == Astriarch.Player.PlayerType.Computer_Expert)
		{
			for (var i in player.OwnedPlanets)
			{
				var p = player.OwnedPlanets[i];
				if (p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length > 0)
				{
					planetCandidatesForInboundReinforcements.push(p);
				}
			}
		}

		console.debug(player.Name, "planetCandidatesForSendingShips:", planetCandidatesForSendingShips.length, "planetCandidatesForInboundScouts:", planetCandidatesForInboundScouts.length, "planetCandidatesForInboundAttackingFleets:", planetCandidatesForInboundAttackingFleets.length, "planetCandidatesForInboundReinforcements:", planetCandidatesForInboundReinforcements.length);

		if (planetCandidatesForSendingShips.length > 0) {
			for (var i = planetCandidatesForInboundScouts.length - 1; i >= 0; i--) {
				var pEnemyInbound = planetCandidatesForInboundScouts[i];//Planet

				if (player.Type == Astriarch.Player.PlayerType.Computer_Easy || player.Type == Astriarch.Player.PlayerType.Computer_Normal) {
					var planetDistanceComparer = new Astriarch.Planet.PlanetDistanceComparer(gameModel, pEnemyInbound);
					planetCandidatesForSendingShips.sort(planetDistanceComparer.sortFunction);
				} else {
					// harder computers should start with planets with more ships and/or reinforce closer planets from further planets with more ships
					var planetValueDistanceStrengthComparer = new Astriarch.Planet.PlanetValueDistanceStrengthComparer(gameModel, pEnemyInbound, player.LastKnownPlanetFleetStrength)
					planetCandidatesForSendingShips.sort(planetValueDistanceStrengthComparer.sortFunction);
					//because the PlanetValueDistanceStrengthComparer prefers weakest planets, we want the opposite in this case
					//so we want to prefer sending from asteroid belts with high strength value
					planetCandidatesForSendingShips.reverse();
				}

				for (var j = planetCandidatesForSendingShips.length - 1; j >= 0; j--) {
					var pFriendly = planetCandidatesForSendingShips[j];//Planet

					//send smallest detachment possible
					var inboundPlanet = planetCandidatesForInboundScouts[i];//Planet
					var newFleet = pFriendly.PlanetaryFleet.SplitOffSmallestPossibleFleet();//Fleet
					//if we do this right newFleet should never be null
					{
						newFleet.SetDestination(gameModel.GameGrid, pFriendly.BoundingHex, inboundPlanet.BoundingHex);
						pFriendly.OutgoingFleets.push(newFleet);
						if (Astriarch.AI.OnComputerSentFleet != null) {
							Astriarch.AI.OnComputerSentFleet(newFleet);
						}

						var mobileStarshipsLeft = pFriendly.PlanetaryFleet.GetPlanetaryFleetMobileStarshipCount();
						if (mobileStarshipsLeft == 0) {
							planetCandidatesForSendingShips.splice(j, 1);
						}

						break;
					}
				}

				if (planetCandidatesForSendingShips.length == 0)
					break;
			}
		}

		//next for each candidate for inbound attacking fleets, sort the candidates for sending ships by closest first

		//look for closest planet to attack first
		for (var i = planetCandidatesForInboundAttackingFleets.length - 1; i >= 0; i--)
		{
			var pEnemyInbound = planetCandidatesForInboundAttackingFleets[i];//Planet

			if (player.Type == Astriarch.Player.PlayerType.Computer_Easy || player.Type == Astriarch.Player.PlayerType.Computer_Normal)
			{
				var planetDistanceComparer = new Astriarch.Planet.PlanetDistanceComparer(gameModel, pEnemyInbound);
				planetCandidatesForSendingShips.sort(planetDistanceComparer.sortFunction);
			}
			else// harder computers should start with planets with more ships and/or reinforce closer planets from further planets with more ships
			{
				var planetValueDistanceStrengthComparer = new Astriarch.Planet.PlanetValueDistanceStrengthComparer(gameModel, pEnemyInbound, player.LastKnownPlanetFleetStrength);
				planetCandidatesForSendingShips.sort(planetValueDistanceStrengthComparer.sortFunction);
				//because the PlanetValueDistanceStrengthComparer prefers weakest planets, we want the opposite in this case
				//so we want to prefer sending from asteroid belts with high strength value
				planetCandidatesForSendingShips.reverse();
			}

			//in order to slow the agression of the easier computers we want to only attack when we have a multiple of the enemy fleet
			var additionalStrengthMultiplierNeededToAttackLow = 0.5;
			var additionalStrengthMultiplierNeededToAttackHigh = 1.0;
			switch (player.Type)
			{
				case Astriarch.Player.PlayerType.Computer_Easy:
					additionalStrengthMultiplierNeededToAttackLow = 3.0;
					additionalStrengthMultiplierNeededToAttackHigh = 6.0;
					break;
				case Astriarch.Player.PlayerType.Computer_Normal:
					additionalStrengthMultiplierNeededToAttackLow = 2.0;
					additionalStrengthMultiplierNeededToAttackHigh = 4.0;
					break;
				case Astriarch.Player.PlayerType.Computer_Hard:
					additionalStrengthMultiplierNeededToAttackLow = 1.0;
					additionalStrengthMultiplierNeededToAttackHigh = 2.0;
					break;
			}

			var additionalStrengthMultiplierNeededToAttack = Astriarch.NextRandom(Math.floor(additionalStrengthMultiplierNeededToAttackLow * 10), Math.floor(additionalStrengthMultiplierNeededToAttackHigh * 10) + 1) / 10.0;

			var fleetSent = false;
			for (var j = planetCandidatesForSendingShips.length - 1; j >= 0; j--)
			{
				var pFriendly = planetCandidatesForSendingShips[j];//Planet

				//send attacking fleet

				//rely only on our last known-information
				var fleetStrength = Math.floor(Math.pow((pEnemyInbound.Type + 1), 2) * 4);//estimate required strength based on planet type
				var lkpfs = player.LastKnownPlanetFleetStrength[pEnemyInbound.Id];
				if (lkpfs) {
					fleetStrength = lkpfs.Fleet.DetermineFleetStrength();
				}

				var scouts = pFriendly.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Scout].length;
				var destroyers = pFriendly.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length;
				var cruisers = pFriendly.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length;
				var battleships = pFriendly.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship].length;

				//TODO: for some computer levels below we should also leave a defending detachment based on strength to defend, etc...

				//generate this fleet just to ensure strength > destination fleet strength
				var newFleet = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player, 0, scouts, destroyers, cruisers, battleships, 0, pFriendly.BoundingHex);//Fleet
				if (newFleet.DetermineFleetStrength() > (fleetStrength * additionalStrengthMultiplierNeededToAttack))
				{
					newFleet = pFriendly.PlanetaryFleet.SplitFleet(scouts, destroyers, cruisers, battleships);

					newFleet.SetDestination(gameModel.GameGrid, pFriendly.BoundingHex, pEnemyInbound.BoundingHex);

					pFriendly.OutgoingFleets.push(newFleet);

					if (Astriarch.AI.OnComputerSentFleet != null)
					{
						Astriarch.AI.OnComputerSentFleet(newFleet);
					}

					var mobileStarshipsLeft = pFriendly.PlanetaryFleet.GetPlanetaryFleetMobileStarshipCount();
					if (mobileStarshipsLeft == 0)
					{
						planetCandidatesForSendingShips.splice(j, 1);
					}

					fleetSent = true;
					break;
				}
			}

			if (!fleetSent && planetCandidatesForInboundReinforcements.length > 0)
			{
				//here is where we reinforce close planets for expert computers

				//logic:
				//  find closest planet capable of building better ships (has at least one factory) to enemy planet
				//  send a detachment from each planetCandidatesForSendingShips other than closest ship builder to reinforce and amass for later
				var planetDistanceComparer = new Astriarch.Planet.PlanetDistanceComparer(gameModel, pEnemyInbound);
				planetCandidatesForInboundReinforcements.sort(planetDistanceComparer.sortFunction);
				var planetToReinforce = planetCandidatesForInboundReinforcements[planetCandidatesForInboundReinforcements.length - 1];
				var distanceFromPlanetToReinforceToEnemy = gameModel.GameGrid.GetHexDistance(pEnemyInbound.BoundingHex, planetToReinforce.BoundingHex);

				for (var r = planetCandidatesForSendingShips.length - 1; r >= 0; r--)
				{
					var pFriendly = planetCandidatesForSendingShips[r];//Planet

					if (pFriendly.Id == planetToReinforce.Id)//don't reinforce ourselves
						break;

					//also make sure the friendly planet is further from our target than the planet to reinforce
					if (gameModel.GameGrid.GetHexDistance(pEnemyInbound.BoundingHex, pFriendly.BoundingHex) < distanceFromPlanetToReinforceToEnemy)
						break;

					var scouts = pFriendly.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Scout].length;
					var destroyers = pFriendly.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length;
					var cruisers = pFriendly.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length;
					var battleships = pFriendly.PlanetaryFleet.StarShips[Astriarch.Fleet.StarShipType.Battleship].length;

					//TODO: for some computer levels below we should also leave a defending detachment based on strength to defend, etc...

					//var newFleet = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player, 0, scouts, destroyers, cruisers, battleships, pFriendly.BoundingHex);//Fleet

					var newFleet = pFriendly.PlanetaryFleet.SplitFleet(scouts, destroyers, cruisers, battleships);

					newFleet.SetDestination(gameModel.GameGrid, pFriendly.BoundingHex, planetToReinforce.BoundingHex);

					pFriendly.OutgoingFleets.push(newFleet);

					if (Astriarch.AI.OnComputerSentFleet != null)
					{
						Astriarch.AI.OnComputerSentFleet(newFleet);
					}

					var mobileStarshipsLeft = pFriendly.PlanetaryFleet.GetPlanetaryFleetMobileStarshipCount();
					if (mobileStarshipsLeft == 0)
					{
						planetCandidatesForSendingShips.splice(r, 1);
					}

					fleetSent = true;
					break;

				}
			}

			if (planetCandidatesForSendingShips.length == 0)
				break;

		}//end planetCandidatesForInboundAttackingFleets loop


	},

	//minDistance object is for out parameters: {minDistance: 999}
	getClosestUnownedPlanet: function(gameModel, /*Player*/ player, /*Planet*/ playerOwnedPlanet, minDistanceObject){//returns Planet
		minDistanceObject['minDistance'] = 999;
		var closestUnownedPlanet = null;//Planet

		for (var i in gameModel.Planets)
		{
			var p = gameModel.Planets[i];//Planet
			if (p.Id != playerOwnedPlanet.Id && p.Owner != player)
			{
				var distance = gameModel.GameGrid.GetHexDistance(playerOwnedPlanet.BoundingHex, p.BoundingHex);
				if (distance < minDistanceObject['minDistance'])
				{
					minDistanceObject['minDistance'] = distance;
					closestUnownedPlanet = p;
				}
			}
		}

		return closestUnownedPlanet;
	},

	/**
	 * returns the number of unexplored planets
	 * @return {number}
	 */
	countPlanetsNeedingExploration: function(gameModel, player) {
		var planetsNeedingExploration = 0;
		for (var i in gameModel.Planets) {
			var p = gameModel.Planets[i];
			if (p.Owner != player && !player.PlanetContainsFriendlyInboundFleet(p)) {
				//exploring/attacking inbound fleets to unowned planets should be excluded
				if (Astriarch.AI.planetNeedsExploration(p, gameModel, player)) {
					planetsNeedingExploration++;
				}
			}
		}

		return planetsNeedingExploration;
	},

	/**
	 * returns true if it has been enough turns since this planet was explored
	 * @return {number}
	 */
	planetNeedsExploration: function(p, gameModel, player) {
		if(!(p.Id in player.KnownClientPlanets)) {
			return true;
		} else if(player.Type === Astriarch.Player.PlayerType.Computer_Easy) {
			return false;//easy computers never update intelligence by scouting
		}


		var turnsSinceLastExplored = (p.Id in player.LastKnownPlanetFleetStrength) ? (gameModel.Turn.Number - player.LastKnownPlanetFleetStrength[p.Id].TurnLastExplored) : 0;
		//the more planets and larger the galaxy, the longer the time till new intelligence is needed
		var turnLastExploredCutoff = (gameModel.Planets.length / 2) * gameModel.GameOptions.GalaxySize;//range: 4 - 48
		if(turnsSinceLastExplored > turnLastExploredCutoff) {
			//this is just a quick short circuit
			return true;
		} else {
			//get average distance of planet to other owned planets, if distance below threshold, treat as needs exploration
			var distanceCutoff = turnLastExploredCutoff / 2;
			var averageDistance = Astriarch.CountObjectKeys(player.OwnedPlanets) || 1;
			for(var i in player.OwnedPlanets) {
				averageDistance += gameModel.GameGrid.GetHexDistance(p.BoundingHex, player.OwnedPlanets[i].BoundingHex);
			}
			averageDistance = averageDistance / (Astriarch.CountObjectKeys(player.OwnedPlanets) || 1);
			if(averageDistance <= distanceCutoff && turnsSinceLastExplored > averageDistance) {
				return true;
			}
		}
		return false;
	}
};

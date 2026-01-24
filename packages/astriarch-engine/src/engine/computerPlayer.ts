import { PlanetById } from '../model/clientModel';
import { FleetData, StarShipType } from '../model/fleet';
import { PlanetData, PlanetImprovementType, PlanetResourceType, PlanetType } from '../model/planet';
import { PlayerData, PlayerType } from '../model/player';
import { ResearchType } from '../model/research';
import { TradeType, TradingCenterResourceType } from '../model/tradingCenter';
import { Utils } from '../utils/utils';
import { BattleSimulator } from './battleSimulator';
import { Fleet } from './fleet';
import { GameModelData } from './gameModel';
import { Grid } from './grid';
import { Planet, PlanetPerTurnResourceGeneration, PopulationAssignments } from './planet';
import { PlanetDistanceComparer } from './planetDistanceComparer';
import { PlanetProductionItem } from './planetProductionItem';
import { PlanetResourcePotentialComparer } from './planetResourcePotentialComparer';
import { Player } from './player';
import { Research } from './research';
import { TradingCenter } from './tradingCenter';

export type PlanetResourcesPerTurn = Record<number, PlanetPerTurnResourceGeneration>;

export class ComputerPlayer {
  // Set to true to enable detailed AI decision-making logs
  private static DEBUG_AI = false;

  private static debugLog(...args: unknown[]) {
    if (this.DEBUG_AI) {
      console.debug(...args);
    }
  }

  private static onComputerSentFleet(fleet: FleetData) {
    this.debugLog('Computer Sent Fleet:', fleet);
  }

  public static computerTakeTurn(gameModel: GameModelData, player: PlayerData, ownedPlanets: PlanetById) {
    //determine highest priority for resource usage
    //early game should be building developments and capturing/exploring planets while keeping up food production
    //mid game should be building space-platforms, high-class ships and further upgrading planets
    //late game should be strategically engaging the enemy
    //check planet production, prefer high-class planets (or even weather strategic points should be developed instead of high-class planets?)
    //if the planet has slots available and we have enough resources build (in order when we don't have)
    //

    const ownedPlanetsSorted = Player.getOwnedPlanetsListSorted(player, ownedPlanets);

    // Manage research allocation based on game state and difficulty
    this.computerManageResearch(gameModel, player, ownedPlanets, ownedPlanetsSorted);

    this.computerSetPlanetBuildGoals(gameModel, player, ownedPlanets, ownedPlanetsSorted);

    this.computerSubmitTrades(gameModel, player, ownedPlanets, ownedPlanetsSorted);

    this.computerBuildImprovementsAndShips(gameModel, player, ownedPlanets, ownedPlanetsSorted);

    //adjust population assignments as appropriate based on planet and needs
    this.computerAdjustPopulationAssignments(player, ownedPlanets, ownedPlanetsSorted);

    // Manage fleet repairs - send damaged fleets back to repair capable planets
    this.computerManageFleetRepairs(gameModel, player, ownedPlanets, ownedPlanetsSorted);

    //base strategies on computer-level
    //here is the basic strategy:
    //if there are unclaimed explored planets
    //find the closest one and send a detachment, based on planet class
    //for easy level send detachments based only on distance
    //normal mode additionally prefers class 2 planets
    //hard mode additionally prefers Dead planets and considers enemy force before making an attack
    //expert mode additionally prefers asteroid belts late in the game when it needs crystal

    //send scouts to unexplored planets (harder levels of computers know where better planets are?)

    this.computerSendShips(gameModel, player, ownedPlanets, ownedPlanetsSorted);
  }

  public static computerAdjustPopulationAssignments(
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ) {
    const planetPopulationWorkerTypes: Record<number, PopulationAssignments> = {};
    const planetResourcesPerTurn: PlanetResourcesPerTurn = {};
    const totalResources = Player.getTotalResourceAmount(player, ownedPlanets);
    const allPlanets: PlanetData[] = []; //this list will be for sorting

    for (const planet of ownedPlanetsSorted) {
      planetPopulationWorkerTypes[planet.id] = Planet.countPopulationWorkerTypes(planet);
      planetResourcesPerTurn[planet.id] = Planet.getPlanetWorkerResourceGeneration(planet, player);
      allPlanets.push(planet);

      this.debugLog(
        player.name,
        'Population Assignment for planet:',
        planet.name,
        planetPopulationWorkerTypes[planet.id],
      );
    }

    const totalPopulation = Player.getTotalPopulation(player, ownedPlanets);
    let totalFoodProduction = 0;
    let totalFoodAmountOnPlanets = 0;
    let totalPlanetsWithPopulationGrowthPotential = 0; //this will always give the computers some extra food surplus to avoid starving new population
    for (const planet of ownedPlanetsSorted) {
      totalFoodAmountOnPlanets += planet.resources.food;
      totalFoodProduction += planetResourcesPerTurn[planet.id].amountPerTurn.food;
      if (planet.population.length < Planet.maxPopulation(planet)) totalPlanetsWithPopulationGrowthPotential++;
    }
    totalFoodAmountOnPlanets -= totalPopulation; //this is what we'll eat this turn

    //this is what we'll keep in surplus to avoid starving more-difficult comps
    totalFoodAmountOnPlanets -= totalPlanetsWithPopulationGrowthPotential;

    //to make the easier computers even easier we will sometimes have them generate too much food and sometimes generate too little so they starve
    let totalFoodAmountOnPlanetsAdjustmentLow = 0;
    let totalFoodAmountOnPlanetsAdjustmentHigh = 0;
    //add some extra food padding based on player type, this will make the easier computers less agressive
    switch (player.type) {
      case PlayerType.Computer_Easy:
        totalFoodAmountOnPlanetsAdjustmentLow -= totalPopulation * 3;
        totalFoodAmountOnPlanetsAdjustmentHigh = Math.floor(totalPopulation * 1.5);
        break;
      case PlayerType.Computer_Normal:
        totalFoodAmountOnPlanetsAdjustmentLow -= Math.floor(totalPopulation * 1.5);
        totalFoodAmountOnPlanetsAdjustmentHigh = totalPopulation;
        break;
      case PlayerType.Computer_Hard:
        totalFoodAmountOnPlanetsAdjustmentLow -= totalPopulation / 2;
        totalFoodAmountOnPlanetsAdjustmentHigh = 0;
        break;
    }

    const totalFoodAmountOnPlanetsAdjustment = Utils.nextRandom(
      totalFoodAmountOnPlanetsAdjustmentLow,
      totalFoodAmountOnPlanetsAdjustmentHigh + 1,
    );

    totalFoodAmountOnPlanets += totalFoodAmountOnPlanetsAdjustment;

    let oreAmountRecommended = 0;
    let iridiumAmountRecommended = 0;
    //base mineral need on desired production (build goals)
    //  for each planet with a space platform
    //    if it is a class 1 or asteroid belt (planets with the most mineral potential), recommended ore and iridium should be for a battleship
    //    otherwise recommended ore and iridum should be for a cruiser
    //  for each planet without a space platform but at least one factory
    //    recommended ore and iridum should be for a destroyer
    //  for each planet witout a factory
    //    recommended ore for a scout only

    for (const planet of ownedPlanetsSorted) {
      if (planet.id in player.planetBuildGoals) {
        const ppi = player.planetBuildGoals[planet.id];
        oreAmountRecommended += ppi.oreCost;
        iridiumAmountRecommended += ppi.iridiumCost;
      } //this happens when we have placed our build goal into the queue already
      else {
        continue;
        //add a bit more?
        //oreAmountRecommended += 2;
        //iridiumAmountRecommended += 1;
      }
    }

    //further stunt the easy computers growth by over estimating ore and iridium amount recommended
    let mineralOverestimation = 1.0;
    switch (player.type) {
      case PlayerType.Computer_Easy:
        mineralOverestimation = Utils.nextRandom(20, 41) / 10.0;
        break;
      case PlayerType.Computer_Normal:
        mineralOverestimation = Utils.nextRandom(15, 26) / 10.0;
        break;
      case PlayerType.Computer_Hard:
        mineralOverestimation = Utils.nextRandom(11, 16) / 10.0;
        break;
      case PlayerType.Computer_Expert:
        mineralOverestimation = Utils.nextRandom(10, 14) / 10.0;
        break;
    }

    let oreAmountNeeded = Math.round(oreAmountRecommended * mineralOverestimation) - totalResources.ore;
    let iridiumAmountNeeded = Math.round(iridiumAmountRecommended * mineralOverestimation) - totalResources.iridium;
    let foodDiff = 0;
    this.debugLog(player.name, 'Mineral Needs:', oreAmountNeeded, iridiumAmountNeeded);
    const foodResourcePotentialComparer = new PlanetResourcePotentialComparer(
      planetResourcesPerTurn,
      PlanetResourceType.FOOD,
    );

    if (totalPopulation > totalFoodProduction + totalFoodAmountOnPlanets) {
      //check to see if we can add farmers to class 1 and class 2 planets
      foodDiff = totalPopulation - (totalFoodProduction + totalFoodAmountOnPlanets);
      //first try to satiate by retasking miners/workers on planets with less food amount than population
      this.debugLog(player.name, 'potential food shortage:', foodDiff);

      //gather potential planets for adding farmers to
      //TODO: this should order by planets with farms as well as planets who's population demands more food than it produces (more potential for growth)
      allPlanets.sort((a, b) => foodResourcePotentialComparer.sortFunction(a, b));

      let neededFarmers = foodDiff;
      const planetCandidatesForAddingFarmers: PlanetData[] = [];

      if (neededFarmers > 0) {
        for (const p of allPlanets) {
          const rpt = planetResourcesPerTurn[p.id];
          const pw = planetPopulationWorkerTypes[p.id];
          if (neededFarmers > 0 && rpt.amountNextWorkerPerTurn.food > 0 && (pw.miners > 0 || pw.builders > 0)) {
            planetCandidatesForAddingFarmers.push(p);
            neededFarmers -= rpt.amountNextWorkerPerTurn.food;
            if (neededFarmers <= 0) break;
          }
        }
      }

      while (foodDiff > 0) {
        let changedAssignment = false;
        for (const p of planetCandidatesForAddingFarmers) {
          const pw = planetPopulationWorkerTypes[p.id];
          let maxMiners = pw.builders; //we don't want more miners than builders when we have food shortages
          if (p.type == PlanetType.PlanetClass2) {
            if (p.builtImprovements[PlanetImprovementType.Mine] == 0) maxMiners = 0;
            else maxMiners = 1;
          }
          if (pw.miners >= maxMiners && pw.miners > 0) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, 1, -1, 0);
            pw.farmers++;
            pw.miners--;
            foodDiff -= planetResourcesPerTurn[p.id].amountNextWorkerPerTurn.food;
            changedAssignment = true;
          } else if (pw.builders > 0) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, 1, 0, -1);
            pw.farmers++;
            pw.builders--;
            foodDiff -= planetResourcesPerTurn[p.id].amountNextWorkerPerTurn.food;
            changedAssignment = true;
          }

          if (foodDiff <= 0) break;
        }

        //if we got here and didn't change anything, break out
        if (!changedAssignment) break;
      } //while (foodDiff > 0)

      //if we weren't able to satisfy the population's hunger at this point,
      // we may just have to starve
    } //we can re-task farmers at class 1 and class 2 planets (and maybe dead planets?)
    else {
      foodDiff = totalFoodProduction + totalFoodAmountOnPlanets - totalPopulation;
      this.debugLog(player.name, 'potential food surplus:', foodDiff);

      //gather potential planets for removing farmers from
      //TODO: this should order by planets without farms and planets which have more food production than it's population demands (less potential for growth)
      allPlanets.sort((a, b) => foodResourcePotentialComparer.sortFunction(a, b));
      allPlanets.reverse();

      let unneededFarmers = foodDiff;
      const planetCandidatesForRemovingFarmers: PlanetData[] = [];
      if (unneededFarmers > 0) {
        for (const p of allPlanets) {
          const rpt = planetResourcesPerTurn[p.id];
          const pw = planetPopulationWorkerTypes[p.id];
          if (unneededFarmers > 0 && unneededFarmers > rpt.amountPerWorkerPerTurn.food && pw.farmers > 0) {
            planetCandidatesForRemovingFarmers.push(p);
            unneededFarmers -= rpt.amountPerWorkerPerTurn.food;
            if (unneededFarmers <= 0) break;
          }
        }
      }

      while (foodDiff > 0) {
        let changedAssignment = false;
        for (const p of planetCandidatesForRemovingFarmers) {
          const pw = planetPopulationWorkerTypes[p.id];
          if (foodDiff < planetResourcesPerTurn[p.id].amountPerWorkerPerTurn.food) continue; //if removing this farmer would create a shortage, skip this planet

          //check if we need more minerals, otherwise prefer production
          //on terrestrial planets, make sure we have a mine before we add a miner
          const addMiner = p.type !== PlanetType.PlanetClass2 || p.builtImprovements[PlanetImprovementType.Mine] > 0;
          if (addMiner && (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) && pw.farmers > 0) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, -1, 1, 0);
            pw.farmers--;
            pw.miners++;
            oreAmountNeeded -= planetResourcesPerTurn[p.id].amountNextWorkerPerTurn.ore;
            iridiumAmountNeeded -= planetResourcesPerTurn[p.id].amountNextWorkerPerTurn.iridium;
            foodDiff -= planetResourcesPerTurn[p.id].amountPerWorkerPerTurn.food;
            changedAssignment = true;
          } else if (pw.farmers > 0) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, -1, 0, 1);
            pw.farmers--;
            pw.builders++;
            foodDiff -= planetResourcesPerTurn[p.id].amountPerWorkerPerTurn.food;
            changedAssignment = true;
          }

          if (foodDiff <= 0) break;
        }

        //if we got here and didn't change anything, break out
        if (!changedAssignment) break;
      } //while (foodDiff > 0)
    }

    const mineralResourceNeeded =
      oreAmountNeeded > iridiumAmountNeeded ? PlanetResourceType.ORE : PlanetResourceType.IRIDIUM;
    const mineralResourcePotentialComparer = new PlanetResourcePotentialComparer(
      planetResourcesPerTurn,
      mineralResourceNeeded,
    );
    let oreAmountNeededWorking = oreAmountNeeded * 1.0;
    let iridiumAmountNeededWorking = iridiumAmountNeeded * 1.0;
    //next see if we need miners, look for workers to reassign (don't reassign farmers at this point)
    if (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) {
      const planetCandidatesForRemovingWorkers = []; //List<Planet>

      allPlanets.sort((a, b) => mineralResourcePotentialComparer.sortFunction(a, b));

      for (const p of allPlanets) {
        if (oreAmountNeededWorking < 0 && iridiumAmountNeededWorking < 0) {
          break;
        }
        const rpt = planetResourcesPerTurn[p.id];
        const pw = planetPopulationWorkerTypes[p.id];
        //leave at least one worker on terrestrial planets, leave 2 workers if we don't have a mine yet
        let minBuilders = 0;
        let minFarmers = -1;
        if (p.type == PlanetType.PlanetClass2) {
          minBuilders = p.builtImprovements[PlanetImprovementType.Mine] == 0 ? 2 : 1;
          minFarmers = 0; //also make sure we have one farmer before reassigning a worker to be miner
        }

        if (pw.builders > minBuilders && pw.farmers > minFarmers) {
          planetCandidatesForRemovingWorkers.push(p);
          oreAmountNeededWorking -= rpt.amountNextWorkerPerTurn.ore;
          iridiumAmountNeededWorking -= rpt.amountNextWorkerPerTurn.iridium;
        }
      }

      while (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) {
        let changedAssignment = false;
        for (const p of planetCandidatesForRemovingWorkers) {
          const rpt = planetResourcesPerTurn[p.id];
          const pw = planetPopulationWorkerTypes[p.id];
          //double check we have enough workers still
          let minBuilders = 1;
          if (p.builtImprovements[PlanetImprovementType.Mine] == 0) minBuilders = 2;

          if (pw.builders > minBuilders) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, 0, 1, -1);
            pw.miners++;
            pw.builders--;
            oreAmountNeeded -= rpt.amountNextWorkerPerTurn.ore;
            iridiumAmountNeeded -= rpt.amountNextWorkerPerTurn.iridium;
            changedAssignment = true;
          }

          if (oreAmountNeeded <= 0 && iridiumAmountNeeded <= 0) break;
        }

        //if we got here and didn't change anything, break out
        if (!changedAssignment) break;
      } //while (oreAmountNeeded > 0 || iridiumAmountNeeded > 0)
    } else {
      //we have enough minerals, reassign miners to workers

      const planetCandidatesForRemovingMiners = []; //List<Planet>

      allPlanets.sort((a, b) => mineralResourcePotentialComparer.sortFunction(a, b));
      allPlanets.reverse();

      for (const p of allPlanets) {
        if (oreAmountNeededWorking > 0 || iridiumAmountNeededWorking > 0) {
          break;
        }
        const rpt = planetResourcesPerTurn[p.id];
        const pw = planetPopulationWorkerTypes[p.id];
        if (pw.miners > 0) {
          planetCandidatesForRemovingMiners.push(p);
          oreAmountNeededWorking += rpt.amountPerWorkerPerTurn.ore;
          iridiumAmountNeededWorking += rpt.amountPerWorkerPerTurn.iridium;
        }
      }

      while (oreAmountNeeded < 0 && iridiumAmountNeeded < 0) {
        let changedAssignment = false;
        for (const p of planetCandidatesForRemovingMiners) {
          const rpt = planetResourcesPerTurn[p.id];
          const pw = planetPopulationWorkerTypes[p.id];
          //double check we still have miners and that we don't over compensate
          if (
            pw.miners > 0 &&
            oreAmountNeeded + rpt.amountPerWorkerPerTurn.ore < 0 &&
            iridiumAmountNeeded + rpt.amountPerWorkerPerTurn.iridium < 0
          ) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, 0, -1, 1);
            pw.miners--;
            pw.builders++;
            oreAmountNeeded += rpt.amountPerWorkerPerTurn.ore;
            iridiumAmountNeeded += rpt.amountPerWorkerPerTurn.iridium;
            changedAssignment = true;
          }

          if (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) break;
        }

        //if we got here and didn't change anything, break out
        if (!changedAssignment) break;
      } //while (oreAmountNeeded < 0 || iridiumAmountNeeded < 0)
    }
  }

  public static computerSetPlanetBuildGoals(
    gameModel: GameModelData,
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ) {
    //first look for planets that need build goals set, either for ships or for improvements

    const planetCandidatesForNeedingImprovements: PlanetData[] = [];
    const planetCandidatesForNeedingSpacePlatforms: PlanetData[] = [];
    const planetCandidatesForNeedingShips: PlanetData[] = [];

    const planetCountNeedingExploration = this.countPlanetsNeedingExploration(gameModel, player, ownedPlanets);

    for (const p of ownedPlanetsSorted) {
      //if this planet doesn't already have a build goal in player.planetBuildGoals
      if (!(p.id in player.planetBuildGoals)) {
        if (p.buildQueue.length) {
          this.debugLog(player.name, 'build queue on:', p.name, p.buildQueue[0]);
        }
        if (p.buildQueue.length <= 1) {
          const canBuildSpacePlatform =
            Planet.getSpacePlatformCount(p, true) < Research.getMaxSpacePlatformCount(player.research) &&
            p.builtImprovements[PlanetImprovementType.Factory] > 0;
          //even if we have something in queue we might want to set a goal to save up resources?

          //always check for improvements in case we need to destroy some
          planetCandidatesForNeedingImprovements.push(p);
          if (ownedPlanetsSorted.length > 1) {
            if (canBuildSpacePlatform) {
              planetCandidatesForNeedingSpacePlatforms.push(p);
            } else {
              planetCandidatesForNeedingShips.push(p);
            }
          } else {
            if (planetCountNeedingExploration != 0) {
              //if we need to explore some planets before building a space platform, do so
              planetCandidatesForNeedingShips.push(p);
            } else if (canBuildSpacePlatform) {
              planetCandidatesForNeedingSpacePlatforms.push(p);
            } else {
              planetCandidatesForNeedingShips.push(p);
            }
          }
        }
      }
    }

    //space platforms
    for (const p of planetCandidatesForNeedingSpacePlatforms) {
      player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.SpacePlatform);
    }

    const origRecommendedMines = 2;
    //build improvements
    for (const p of planetCandidatesForNeedingImprovements) {
      //planet class 2 should have 3 farms and 2 mines
      //planet class 1 should have 2 farms and 0 mines
      //dead planets should have 0 farms and 1 mine
      //asteroids should have 0 farms and 1 mine
      //otherwise build 1 factory if none exist
      //otherwise build 1 colony if none exist
      //otherwise build factories to recommended amount
      //otherwise build a spaceport space platform is none exist
      //otherwise colonies till we're filled up

      let recommendedFarms = 0;
      let recommendedMines = 0;
      let recommendedFactories = 1;
      const recommendedColonies = 1;

      const farmCount = Planet.builtAndBuildQueueImprovementTypeCount(p, PlanetImprovementType.Farm);
      const mineCount = Planet.builtAndBuildQueueImprovementTypeCount(p, PlanetImprovementType.Mine);
      const factoryCount = Planet.builtAndBuildQueueImprovementTypeCount(p, PlanetImprovementType.Factory);
      const colonyCount = Planet.builtAndBuildQueueImprovementTypeCount(p, PlanetImprovementType.Colony);

      //NOTE: we aren't checking gold for the purposes of farms, we'll just build them
      if (p.type == PlanetType.PlanetClass2) {
        if (ownedPlanetsSorted.length == 1) {
          //until we have another planet we need to build some mines to get resources
          recommendedFarms = 3;
          recommendedMines = origRecommendedMines;
        } else {
          recommendedFarms = 4;
          recommendedMines = 0;
        }
      } else if (p.type == PlanetType.PlanetClass1) {
        recommendedFarms = 2;
      } else if (p.type == PlanetType.DeadPlanet) {
        recommendedMines = 1;
      } else if (p.type == PlanetType.AsteroidBelt) {
        recommendedMines = 1;
      }
      recommendedFactories = p.maxImprovements - recommendedMines - recommendedFarms - recommendedColonies;

      //make sure farms are built before mines
      if (farmCount < recommendedFarms) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Farm);
      } else if (mineCount < recommendedMines) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Mine);
      } else if (factoryCount == 0 && recommendedFactories > 0) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Factory);
      } else if (colonyCount < recommendedColonies) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Colony);
      } else if (factoryCount < recommendedFactories) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Factory);
      } else if (farmCount > recommendedFarms) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovementToDestroy(
          PlanetImprovementType.Farm,
        );
      } else if (mineCount > recommendedMines) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovementToDestroy(
          PlanetImprovementType.Mine,
        );
      } else if (factoryCount > recommendedFactories) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovementToDestroy(
          PlanetImprovementType.Factory,
        );
      } else if (colonyCount > recommendedColonies) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovementToDestroy(
          PlanetImprovementType.Colony,
        );
      }
      if (player.planetBuildGoals[p.id]) {
        this.debugLog(player.name, 'Planet:', p.name, 'Improvement Build Goal:', player.planetBuildGoals[p.id]);
      }

      //after all that we should be ready to set fleet goals
    }

    //build ships
    for (const p of planetCandidatesForNeedingShips) {
      const mineCount = Planet.builtAndBuildQueueImprovementTypeCount(p, PlanetImprovementType.Mine);
      if (
        player.planetBuildGoals[p.id] &&
        (ownedPlanetsSorted.length > 3 || ownedPlanetsSorted.length == 1) &&
        mineCount != origRecommendedMines
      ) {
        //do this for now so that the computer builds improvements before too much scouting, however might want to revisit this so that there is some scouting done before all buildings are built
        continue;
      }
      // Fleet composition strategy based on difficulty and game state
      let buildDefenders = false;
      let buildDestroyers = false;

      if (player.type == PlayerType.Computer_Easy) {
        //Easy: 50% chance to build defenders, 50% chance for destroyers
        buildDefenders = Utils.nextRandom(0, 4) <= 1;
        buildDestroyers = !buildDefenders && Utils.nextRandom(0, 4) <= 1;
      } else if (player.type == PlayerType.Computer_Normal) {
        //Normal: 25% chance to build defenders, analyze enemy for counters
        buildDefenders = Utils.nextRandom(0, 4) == 0;
        buildDestroyers = !buildDefenders && Utils.nextRandom(0, 4) == 0;
      }

      if (Planet.getSpacePlatformCount(p, false) > 0 && !buildDefenders) {
        // With space platforms, build balanced mixed fleets
        // Hard/Expert prefer balanced compositions, Normal/Easy more random
        if (player.type == PlayerType.Computer_Hard || player.type == PlayerType.Computer_Expert) {
          // Maintain 1:1:1 destroyer:cruiser:battleship ratio with scout support
          const rand = Utils.nextRandom(3);
          if (rand == 0) {
            player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Destroyer);
          } else if (rand == 1) {
            player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Cruiser);
          } else {
            player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Battleship);
          }
        } else {
          // Normal/Easy: more random distribution
          const rand = Utils.nextRandom(4);
          if (rand < 2) {
            if (rand % 2 == 0)
              player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(
                StarShipType.Battleship,
              );
            else
              player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(
                StarShipType.Destroyer,
              );
          } else {
            if (rand % 2 == 1)
              player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Cruiser);
            else
              player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(
                StarShipType.Destroyer,
              );
          }
        }
      } else if (planetCountNeedingExploration != 0) {
        //if there are unexplored planets still, build some scouts
        this.debugLog(player.name, planetCountNeedingExploration, 'Planets needing exploration, building scouts');
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Scout);
      } else if (p.builtImprovements[PlanetImprovementType.Factory] > 0 && buildDestroyers) {
        //NOTE: this actually never gets hit because right now we're always building scouts, then spaceplatforms, then above applies
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Destroyer);
      } else if (gameModel.modelData.currentCycle % 4 == 0 && buildDefenders) {
        //else create defender (but only sometimes so we save gold)
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.SystemDefense);
      }
      if (player.planetBuildGoals[p.id]) {
        this.debugLog(player.name, 'Planet:', p.name, 'StarShip Build Goal:', player.planetBuildGoals[p.id]);
      }
    }
  }

  public static computerSubmitTrades(
    gameModel: GameModelData,
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ) {
    //first decide if we want to trade based on resource prices and needed resources (based on planet build goals)
    const totalPopulation = Player.getTotalPopulation(player, ownedPlanets);
    const totalResources = Player.getTotalResourceAmount(player, ownedPlanets);

    // Early return if player has no owned planets
    if (ownedPlanetsSorted.length === 0) {
      return;
    }

    let energyDesired = 0;
    let oreDesired = 0;
    let iridiumDesired = 0;
    for (const ppi of Object.values(player.planetBuildGoals)) {
      energyDesired += ppi.energyCost;
      oreDesired += ppi.oreCost;
      iridiumDesired += ppi.iridiumCost;
    }
    const purchaseMultiplier = 0.25;
    const tradesToExecute = [];
    const planetId = player.homePlanetId ? player.homePlanetId : ownedPlanetsSorted[0].id;
    let amount = 0;
    if (totalResources.energy < energyDesired) {
      //try to sell resources
      //only sell resources when you have far more than you need
      if (totalResources.food >= totalPopulation * 4) {
        //sell some food
        amount = Math.floor(totalResources.food * purchaseMultiplier);
        tradesToExecute.push(
          TradingCenter.constructTrade(player.id, planetId, TradeType.SELL, TradingCenterResourceType.FOOD, amount),
        );
      }
      if (totalResources.ore >= oreDesired * 2) {
        amount = Math.floor(totalResources.ore * purchaseMultiplier);
        tradesToExecute.push(
          TradingCenter.constructTrade(player.id, planetId, TradeType.SELL, TradingCenterResourceType.ORE, amount),
        );
      }

      if (totalResources.iridium >= iridiumDesired * 2) {
        amount = Math.floor(totalResources.iridium * purchaseMultiplier);
        tradesToExecute.push(
          TradingCenter.constructTrade(player.id, planetId, TradeType.SELL, TradingCenterResourceType.IRIDIUM, amount),
        );
      }
    } else if (totalResources.energy > energyDesired * 1.2) {
      //try to buy resources
      if (totalResources.food <= totalPopulation * 1.2) {
        //buy some food
        const amount = Math.floor(totalPopulation * purchaseMultiplier);
        tradesToExecute.push(
          TradingCenter.constructTrade(player.id, planetId, TradeType.BUY, TradingCenterResourceType.FOOD, amount),
        );
      }

      if (totalResources.ore <= oreDesired * 1.2) {
        const amount = Math.floor(oreDesired * purchaseMultiplier);
        tradesToExecute.push(
          TradingCenter.constructTrade(player.id, planetId, TradeType.BUY, TradingCenterResourceType.ORE, amount),
        );
      }
      if (totalResources.iridium <= iridiumDesired * 1.2) {
        const amount = Math.floor(iridiumDesired * purchaseMultiplier);
        tradesToExecute.push(
          TradingCenter.constructTrade(player.id, planetId, TradeType.BUY, TradingCenterResourceType.IRIDIUM, amount),
        );
      }
    }

    for (const trade of tradesToExecute) {
      if (trade.amount > 0) {
        this.debugLog(player.name, 'Submitted a Trade: ', trade);
        gameModel.modelData.tradingCenter.currentTrades.push(trade);
      } else {
        this.debugLog(player.name, 'Trade found with zero amount.', trade);
      }
    }
  }

  public static computerBuildImprovementsAndShips(
    gameModel: GameModelData,
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ) {
    const totalResources = Player.getTotalResourceAmount(player, ownedPlanets);
    //determine energy surplus needed to ship food
    let energySurplus = player.lastTurnFoodNeededToBeShipped;

    //increase recommended energySurplus based on computer difficulty to further make the easier computers a bit less agressive
    switch (player.type) {
      case PlayerType.Computer_Easy:
        energySurplus = Utils.nextRandom(0, (energySurplus + 1) / 4); //this should make the easy computer even easier, because sometimes he should starve himself
        break;
      case PlayerType.Computer_Normal:
        energySurplus = Utils.nextRandom(0, (energySurplus + 1) / 2); //this should make the normal computer easier, because sometimes he should starve himself
        break;
      case PlayerType.Computer_Hard:
        energySurplus += (ownedPlanetsSorted.length - 1) / 2;
        break;
      case PlayerType.Computer_Expert:
        energySurplus += (ownedPlanetsSorted.length - 1) / 4;
        break;
    }

    //build improvements and ships based on build goals
    for (const p of ownedPlanetsSorted) {
      if (p.buildQueue.length == 0) {
        if (p.id in player.planetBuildGoals) {
          const ppi = player.planetBuildGoals[p.id];
          //check resources
          if (
            totalResources.energy - ppi.energyCost > energySurplus &&
            totalResources.ore - ppi.oreCost >= 0 &&
            totalResources.iridium - ppi.iridiumCost >= 0
          ) {
            Planet.enqueueProductionItemAndSpendResources(gameModel.grid, player, ownedPlanets, p, ppi);
            delete player.planetBuildGoals[p.id];
          }
        } //could this be a problem?
        else {
          continue;
        }
      }
    }
  }

  public static computerSendShips(
    gameModel: GameModelData,
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ) {
    //easy computer sends ships to closest planet at random
    //normal computers keep detachments of ships as defence as deemed necessary based on scouted enemy forces and planet value
    //hard computers also prefer planets based on class, location, and fleet defence
    //expert computers also amass fleets at strategic planets,
    //when two planets have ship building capabilities (i.e. have at least one factory),
    //and a 3rd desired planet is unowned, the further of the two owned planets sends it's ships to the closer as reinforcements

    //all but easy computers will also re-scout enemy planets after a time to re-establish intelligence

    const planetCandidatesForSendingShips = [];
    for (const p of ownedPlanetsSorted) {
      if (Fleet.countMobileStarships(p.planetaryFleet) > 0) {
        if (player.type == PlayerType.Computer_Easy) {
          //easy computers can send ships as long as there is somthing to send
          planetCandidatesForSendingShips.push(p);
        } else {
          let strengthToDefend = 0;

          if (this.countPlanetsNeedingExploration(gameModel, player, ownedPlanets) != 0) {
            //this is done because of how the goals are set right now,
            //we don't want the computer defending with all of it's ships when there is exploring to be done
            strengthToDefend = 0;
          } else if (p.builtImprovements[PlanetImprovementType.Factory] > 0) {
            //if we can build ships it is probably later in the game and we should start defending this planet
            strengthToDefend = Math.floor(Math.pow(p.type, 2) * 4); //defense based on planet type
          }

          if (player.type == PlayerType.Computer_Hard || player.type == PlayerType.Computer_Expert) {
            //base defense upon enemy fleet strength within a certain range of last known planets
            // as well as if there are ships in queue and estimated time till production

            //TODO: we should get all enemy planets within a certain range instead of just the closest one
            const closestUnownedPlanetResults = this.getClosestUnownedPlanet(gameModel, ownedPlanets, p);
            if (closestUnownedPlanetResults.planet) {
              if (closestUnownedPlanetResults.planet.id in player.lastKnownPlanetFleetStrength) {
                strengthToDefend += Fleet.determineFleetStrength(
                  player.lastKnownPlanetFleetStrength[closestUnownedPlanetResults.planet.id].fleetData,
                  true,
                );
              } else if (closestUnownedPlanetResults.planet.id in player.knownPlanetIds) {
                strengthToDefend += Math.floor(Math.pow(closestUnownedPlanetResults.planet.type, 2) * 4);
              }
            }

            const turnsToCompleteStarship = Planet.buildQueueContainsMobileStarship(p);
            if (turnsToCompleteStarship) {
              if (turnsToCompleteStarship.turnsToComplete <= closestUnownedPlanetResults.minDistance + 1) {
                //if we can build this before an enemy can get here
                strengthToDefend -= turnsToCompleteStarship.starshipStrength;
              }
            }
          }

          if (Fleet.determineFleetStrength(p.planetaryFleet) > strengthToDefend) {
            planetCandidatesForSendingShips.push(p); //TODO: for some computer levels below we should also leave a defending detachment based on strength to defend, etc...
          }
        }
      }
    }

    const planetCandidatesForInboundScouts = [];
    const planetCandidatesForInboundAttackingFleets = [];
    if (planetCandidatesForSendingShips.length > 0) {
      for (const p of gameModel.modelData.planets) {
        if (!(p.id in ownedPlanets) && !Player.planetContainsFriendlyInboundFleet(player, p)) {
          //exploring/attacking inbound fleets to unowned planets should be excluded
          if (this.planetNeedsExploration(p, gameModel, player, ownedPlanets)) {
            planetCandidatesForInboundScouts.push(p);
          } else {
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
    if (player.homePlanetId && player.homePlanetId in ownedPlanets) {
      //just to make sure
      const homePlanet = ownedPlanets[player.homePlanetId];
      if (player.type == PlayerType.Computer_Easy || player.type == PlayerType.Computer_Normal) {
        const planetDistanceComparer = new PlanetDistanceComparer(gameModel.grid, homePlanet);
        planetCandidatesForInboundAttackingFleets.sort((a, b) => planetDistanceComparer.sortFunction(a, b));
        planetCandidatesForInboundScouts.sort((a, b) => planetDistanceComparer.sortFunction(a, b));
      } else {
        //hard and expert computer will sort with a bit of complexly (based on value and last known strength as well as distance)
        const planetValueDistanceStrengthComparer = new PlanetDistanceComparer(
          gameModel.grid,
          homePlanet,
          player.lastKnownPlanetFleetStrength,
        );
        planetCandidatesForInboundAttackingFleets.sort((a, b) =>
          planetValueDistanceStrengthComparer.sortFunction(a, b),
        );
        planetCandidatesForInboundScouts.sort((a, b) => planetValueDistanceStrengthComparer.sortFunction(a, b));
      }
    }

    const planetCandidatesForInboundReinforcements = [];
    if (player.type == PlayerType.Computer_Expert) {
      for (const p of ownedPlanetsSorted) {
        if (p.builtImprovements[PlanetImprovementType.Factory] > 0) {
          planetCandidatesForInboundReinforcements.push(p);
        }
      }
    }

    this.debugLog(
      player.name,
      'planetCandidatesForSendingShips:',
      planetCandidatesForSendingShips.length,
      'planetCandidatesForInboundScouts:',
      planetCandidatesForInboundScouts.length,
      'planetCandidatesForInboundAttackingFleets:',
      planetCandidatesForInboundAttackingFleets.length,
      'planetCandidatesForInboundReinforcements:',
      planetCandidatesForInboundReinforcements.length,
    );

    if (planetCandidatesForSendingShips.length > 0) {
      for (let i = planetCandidatesForInboundScouts.length - 1; i >= 0; i--) {
        const pEnemyInbound = planetCandidatesForInboundScouts[i];

        if (player.type == PlayerType.Computer_Easy || player.type == PlayerType.Computer_Normal) {
          const planetDistanceComparer = new PlanetDistanceComparer(gameModel.grid, pEnemyInbound);
          planetCandidatesForSendingShips.sort((a, b) => planetDistanceComparer.sortFunction(a, b));
        } else {
          // harder computers should start with planets with more ships and/or reinforce closer planets from further planets with more ships
          const planetValueDistanceStrengthComparer = new PlanetDistanceComparer(
            gameModel.grid,
            pEnemyInbound,
            player.lastKnownPlanetFleetStrength,
          );
          planetCandidatesForSendingShips.sort((a, b) => planetValueDistanceStrengthComparer.sortFunction(a, b));
          //because the PlanetValueDistanceStrengthComparer prefers weakest planets, we want the opposite in this case
          //so we want to prefer sending from asteroid belts with high strength value
          planetCandidatesForSendingShips.reverse();
        }

        for (let j = planetCandidatesForSendingShips.length - 1; j >= 0; j--) {
          const pFriendly = planetCandidatesForSendingShips[j];

          //send smallest detachment possible
          const inboundPlanet = planetCandidatesForInboundScouts[i];
          const newFleet = Fleet.splitOffSmallestPossibleFleet(pFriendly.planetaryFleet, player);
          //if we do this right newFleet should never be null
          if (newFleet) {
            Fleet.setDestination(
              newFleet,
              gameModel.grid,
              pFriendly.boundingHexMidPoint,
              inboundPlanet.boundingHexMidPoint,
            );

            pFriendly.outgoingFleets.push(newFleet);
            this.onComputerSentFleet(newFleet);

            const mobileStarshipsLeft = Fleet.countMobileStarships(pFriendly.planetaryFleet);
            if (mobileStarshipsLeft == 0) {
              planetCandidatesForSendingShips.splice(j, 1);
            }

            break;
          } else {
            console.error('splitOffSmallestPossibleFleet returned no newFleet!');
          }
        }

        if (planetCandidatesForSendingShips.length == 0) break;
      }
    }

    //next for each candidate for inbound attacking fleets, sort the candidates for sending ships by closest first

    //look for closest planet to attack first
    for (let i = planetCandidatesForInboundAttackingFleets.length - 1; i >= 0; i--) {
      const pEnemyInbound = planetCandidatesForInboundAttackingFleets[i];

      if (player.type == PlayerType.Computer_Easy || player.type == PlayerType.Computer_Normal) {
        const planetDistanceComparer = new PlanetDistanceComparer(gameModel.grid, pEnemyInbound);
        planetCandidatesForSendingShips.sort((a, b) => planetDistanceComparer.sortFunction(a, b));
      } // harder computers should start with planets with more ships and/or reinforce closer planets from further planets with more ships
      else {
        const planetValueDistanceStrengthComparer = new PlanetDistanceComparer(
          gameModel.grid,
          pEnemyInbound,
          player.lastKnownPlanetFleetStrength,
        );
        planetCandidatesForSendingShips.sort((a, b) => planetValueDistanceStrengthComparer.sortFunction(a, b));
        //because the PlanetValueDistanceStrengthComparer prefers weakest planets, we want the opposite in this case
        //so we want to prefer sending from asteroid belts with high strength value
        planetCandidatesForSendingShips.reverse();
      }

      //in order to slow the agression of the easier computers we want to only attack when we have a multiple of the enemy fleet
      let additionalStrengthMultiplierNeededToAttackLow = 0.5;
      let additionalStrengthMultiplierNeededToAttackHigh = 1.0;
      switch (player.type) {
        case PlayerType.Computer_Easy:
          additionalStrengthMultiplierNeededToAttackLow = 3.0;
          additionalStrengthMultiplierNeededToAttackHigh = 6.0;
          break;
        case PlayerType.Computer_Normal:
          additionalStrengthMultiplierNeededToAttackLow = 2.0;
          additionalStrengthMultiplierNeededToAttackHigh = 4.0;
          break;
        case PlayerType.Computer_Hard:
          additionalStrengthMultiplierNeededToAttackLow = 1.0;
          additionalStrengthMultiplierNeededToAttackHigh = 2.0;
          break;
      }

      const additionalStrengthMultiplierNeededToAttack =
        Utils.nextRandom(
          Math.floor(additionalStrengthMultiplierNeededToAttackLow * 10),
          Math.floor(additionalStrengthMultiplierNeededToAttackHigh * 10) + 1,
        ) / 10.0;

      let fleetSent = false;
      for (let j = planetCandidatesForSendingShips.length - 1; j >= 0; j--) {
        const pFriendly = planetCandidatesForSendingShips[j]; //Planet

        //send attacking fleet

        //rely only on our last known-information
        let estimatedEnemyStrength = Math.floor(Math.pow(pEnemyInbound.type + 1, 2) * 4); //estimate required strength based on planet type
        let enemyHasSpacePlatform = false;

        const lkpfs = player.lastKnownPlanetFleetStrength[pEnemyInbound.id];
        if (lkpfs) {
          estimatedEnemyStrength = Fleet.determineFleetStrength(lkpfs.fleetData);
          enemyHasSpacePlatform = Fleet.getStarshipsByType(lkpfs.fleetData)[StarShipType.SpacePlatform].length > 0;
        }

        const starshipCounts = Fleet.countStarshipsByType(pFriendly.planetaryFleet);

        //generate this fleet just to check effective strength
        const testFleet = Fleet.generateFleetWithShipCount(
          0,
          starshipCounts.scouts,
          starshipCounts.destroyers,
          starshipCounts.cruisers,
          starshipCounts.battleships,
          0,
          pFriendly.boundingHexMidPoint,
        );

        // Use effective strength calculation for Hard/Expert
        let ourEffectiveStrength = Fleet.determineFleetStrength(testFleet);
        if (player.type === PlayerType.Computer_Hard || player.type === PlayerType.Computer_Expert) {
          const enemyFleet = lkpfs ? lkpfs.fleetData : Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 0, null);
          ourEffectiveStrength = this.calculateEffectiveFleetStrength(
            testFleet,
            enemyFleet,
            enemyHasSpacePlatform,
            player,
          );
        }

        if (ourEffectiveStrength > estimatedEnemyStrength * additionalStrengthMultiplierNeededToAttack) {
          const newFleet = Fleet.splitFleet(
            pFriendly.planetaryFleet,
            starshipCounts.scouts,
            starshipCounts.destroyers,
            starshipCounts.cruisers,
            starshipCounts.battleships,
            player,
          );

          Fleet.setDestination(
            newFleet,
            gameModel.grid,
            pFriendly.boundingHexMidPoint,
            pEnemyInbound.boundingHexMidPoint,
          );

          pFriendly.outgoingFleets.push(newFleet);

          this.onComputerSentFleet(newFleet);

          const mobileStarshipsLeft = Fleet.countMobileStarships(pFriendly.planetaryFleet);
          if (mobileStarshipsLeft == 0) {
            planetCandidatesForSendingShips.splice(j, 1);
          }

          fleetSent = true;
          break;
        }
      }

      if (!fleetSent && planetCandidatesForInboundReinforcements.length > 0) {
        //here is where we reinforce close planets for expert computers

        //logic:
        //  find closest planet capable of building better ships (has at least one factory) to enemy planet
        //  send a detachment from each planetCandidatesForSendingShips other than closest ship builder to reinforce and amass for later
        const planetDistanceComparer = new PlanetDistanceComparer(gameModel.grid, pEnemyInbound);
        planetCandidatesForInboundReinforcements.sort((a, b) => planetDistanceComparer.sortFunction(a, b));
        const planetToReinforce =
          planetCandidatesForInboundReinforcements[planetCandidatesForInboundReinforcements.length - 1];
        const distanceFromPlanetToReinforceToEnemy = Grid.getHexDistanceForMidPoints(
          gameModel.grid,
          pEnemyInbound.boundingHexMidPoint,
          planetToReinforce.boundingHexMidPoint,
        );

        for (let r = planetCandidatesForSendingShips.length - 1; r >= 0; r--) {
          const pFriendly = planetCandidatesForSendingShips[r];

          if (pFriendly.id == planetToReinforce.id)
            //don't reinforce ourselves
            break;

          //also make sure the friendly planet is further from our target than the planet to reinforce
          if (
            Grid.getHexDistanceForMidPoints(
              gameModel.grid,
              pEnemyInbound.boundingHexMidPoint,
              pFriendly.boundingHexMidPoint,
            ) < distanceFromPlanetToReinforceToEnemy
          )
            break;

          const starshipCounts = Fleet.countStarshipsByType(pFriendly.planetaryFleet);

          //TODO: for some computer levels below we should also leave a defending detachment based on strength to defend, etc...

          //const newFleet = StarShipFactoryHelper.GenerateFleetWithShipCount(player, 0, scouts, destroyers, cruisers, battleships, pFriendly.BoundingHex);//Fleet

          const newFleet = Fleet.splitFleet(
            pFriendly.planetaryFleet,
            starshipCounts.scouts,
            starshipCounts.destroyers,
            starshipCounts.cruisers,
            starshipCounts.battleships,
            player,
          );

          Fleet.setDestination(
            newFleet,
            gameModel.grid,
            pFriendly.boundingHexMidPoint,
            planetToReinforce.boundingHexMidPoint,
          );

          pFriendly.outgoingFleets.push(newFleet);

          this.onComputerSentFleet(newFleet);

          const mobileStarshipsLeft = Fleet.countMobileStarships(pFriendly.planetaryFleet);
          if (mobileStarshipsLeft == 0) {
            planetCandidatesForSendingShips.splice(r, 1);
          }

          fleetSent = true;
          break;
        }
      }

      if (planetCandidatesForSendingShips.length == 0) break;
    } //end planetCandidatesForInboundAttackingFleets loop
  }

  public static countPlanetsNeedingExploration(gameModel: GameModelData, player: PlayerData, ownedPlanets: PlanetById) {
    let planetsNeedingExploration = 0;
    for (const p of gameModel.modelData.planets) {
      if (!(p.id in ownedPlanets) && !Player.planetContainsFriendlyInboundFleet(player, p)) {
        //exploring/attacking inbound fleets to unowned planets should be excluded
        if (this.planetNeedsExploration(p, gameModel, player, ownedPlanets)) {
          planetsNeedingExploration++;
        }
      }
    }

    return planetsNeedingExploration;
  }

  /**
   * returns true if it has been enough turns since this planet was explored
   */
  public static planetNeedsExploration(
    planet: PlanetData,
    gameModel: GameModelData,
    player: PlayerData,
    ownedPlanets: PlanetById,
  ) {
    if (!player.knownPlanetIds.includes(planet.id)) {
      return true;
    } else if (player.type === PlayerType.Computer_Easy) {
      return false; //easy computers never update intelligence by scouting
    }

    const turnsSinceLastExplored =
      planet.id in player.lastKnownPlanetFleetStrength
        ? gameModel.modelData.currentCycle - player.lastKnownPlanetFleetStrength[planet.id].cycleLastExplored
        : 0;
    //the more planets and larger the galaxy, the longer the time till new intelligence is needed
    const turnLastExploredCutoff =
      (gameModel.modelData.planets.length / 2) * gameModel.modelData.gameOptions.galaxySize; //range: 4 - 48
    if (turnsSinceLastExplored > turnLastExploredCutoff) {
      //this is just a quick short circuit
      return true;
    } else {
      //get average distance of planet to other owned planets, if distance below threshold, treat as needs exploration
      const distanceCutoff = turnLastExploredCutoff / 2;
      let totalDistance = player.ownedPlanetIds.length || 1;
      for (const ownedPlanet of Object.values(ownedPlanets)) {
        totalDistance += Grid.getHexDistanceForMidPoints(
          gameModel.grid,
          planet.boundingHexMidPoint,
          ownedPlanet.boundingHexMidPoint,
        );
      }
      const averageDistance = totalDistance / (player.ownedPlanetIds.length || 1);
      if (averageDistance <= distanceCutoff && turnsSinceLastExplored > averageDistance) {
        return true;
      }
    }
    return false;
  }

  public static getClosestUnownedPlanet(
    gameModel: GameModelData,
    ownedPlanets: PlanetById,
    ownedPlanet: PlanetData,
  ): { minDistance: number; planet: PlanetData | null } {
    const returnVal: { minDistance: number; planet: PlanetData | null } = { minDistance: 999, planet: null };

    for (const p of gameModel.modelData.planets) {
      if (!(p.id in ownedPlanets)) {
        const distance = Grid.getHexDistanceForMidPoints(
          gameModel.grid,
          p.boundingHexMidPoint,
          ownedPlanet.boundingHexMidPoint,
        );
        if (distance < returnVal.minDistance) {
          returnVal.minDistance = distance;
          returnVal.planet = p;
        }
      }
    }

    return returnVal;
  }

  /**
   * Manages research allocation and priorities based on game state and difficulty
   */
  public static computerManageResearch(
    _gameModel: GameModelData,
    player: PlayerData,
    _ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ) {
    // Set research percentage based on difficulty
    let targetResearchPercent = 0;

    switch (player.type) {
      case PlayerType.Computer_Easy:
        targetResearchPercent = Utils.nextRandom(10, 31) / 100.0; // 10-30%
        break;
      case PlayerType.Computer_Normal:
        targetResearchPercent = Utils.nextRandom(30, 51) / 100.0; // 30-50%
        break;
      case PlayerType.Computer_Hard:
        targetResearchPercent = Utils.nextRandom(50, 71) / 100.0; // 50-70%
        break;
      case PlayerType.Computer_Expert:
        targetResearchPercent = Utils.nextRandom(70, 91) / 100.0; // 70-90%
        break;
    }

    player.research.researchPercent = targetResearchPercent;

    // If no research queued, determine priority based on game state
    if (!player.research.researchTypeInQueue) {
      const researchPriorities: ResearchType[] = [];

      // Early game: building efficiency
      if (ownedPlanetsSorted.length <= 2) {
        if (player.type === PlayerType.Computer_Easy || player.type === PlayerType.Computer_Normal) {
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES);
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES);
        } else {
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES);
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES);
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS);
        }
      }
      // Mid game: space platforms and combat
      else if (ownedPlanetsSorted.length <= 4) {
        if (player.type === PlayerType.Computer_Hard || player.type === PlayerType.Computer_Expert) {
          researchPriorities.push(ResearchType.COMBAT_IMPROVEMENT_ATTACK);
          researchPriorities.push(ResearchType.SPACE_PLATFORM_IMPROVEMENT);
          researchPriorities.push(ResearchType.PROPULSION_IMPROVEMENT);
        } else {
          researchPriorities.push(ResearchType.SPACE_PLATFORM_IMPROVEMENT);
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES);
        }
      }
      // Late game: combat and propulsion
      else {
        if (player.type === PlayerType.Computer_Hard || player.type === PlayerType.Computer_Expert) {
          researchPriorities.push(ResearchType.COMBAT_IMPROVEMENT_ATTACK);
          researchPriorities.push(ResearchType.COMBAT_IMPROVEMENT_DEFENSE);
          researchPriorities.push(ResearchType.PROPULSION_IMPROVEMENT);
        } else {
          researchPriorities.push(ResearchType.PROPULSION_IMPROVEMENT);
          researchPriorities.push(ResearchType.COMBAT_IMPROVEMENT_ATTACK);
        }
      }

      // Find first research that can still be researched
      for (const researchType of researchPriorities) {
        const researchProgress = player.research.researchProgressByType[researchType];
        if (Research.canResearch(researchProgress)) {
          player.research.researchTypeInQueue = researchType;
          this.debugLog(player.name, 'Queuing research:', researchType);
          break;
        }
      }
    }
  }

  /**
   * Calculates effective fleet strength considering ship type advantages/disadvantages and space platforms
   */
  public static calculateEffectiveFleetStrength(
    ourFleet: FleetData,
    enemyFleet: FleetData,
    enemyHasSpacePlatform: boolean,
    ourPlayer: PlayerData,
  ): number {
    let effectiveStrength = 0;
    const ourShipsByType = Fleet.getStarshipsByType(ourFleet);
    const enemyShipsByType = Fleet.getStarshipsByType(enemyFleet);

    // Space platforms have 2x effective strength since they have advantage over all ships
    if (enemyHasSpacePlatform) {
      const spacePlatformStrength = Fleet.determineFleetStrength({
        starships: enemyShipsByType[StarShipType.SpacePlatform],
      } as FleetData);
      // Need 2x strength to overcome space platform advantage
      effectiveStrength -= spacePlatformStrength * 2;
    }

    // Calculate effective strength for each of our ship types against enemy composition
    for (const ourShipType of [
      StarShipType.Scout,
      StarShipType.Destroyer,
      StarShipType.Cruiser,
      StarShipType.Battleship,
      StarShipType.SystemDefense,
    ]) {
      const ourShips = ourShipsByType[ourShipType];
      if (ourShips.length === 0) continue;

      const baseStrength = Fleet.determineFleetStrength({ starships: ourShips } as FleetData);
      let strengthMultiplier = 1.0;

      // Check advantages/disadvantages against enemy composition
      for (const enemyShipType of [
        StarShipType.Scout,
        StarShipType.Destroyer,
        StarShipType.Cruiser,
        StarShipType.Battleship,
        StarShipType.SystemDefense,
      ]) {
        const enemyShips = enemyShipsByType[enemyShipType];
        if (enemyShips.length === 0) continue;

        const sampleOurShip = ourShips[0];
        const sampleEnemyShip = enemyShips[0];

        // Use existing advantage checking from BattleSimulator
        if (BattleSimulator.starshipHasAdvantage(sampleOurShip, sampleEnemyShip)) {
          strengthMultiplier += 0.25; // Advantage gives ~50% more damage, so +25% effective strength
        } else if (BattleSimulator.starshipHasDisadvantage(sampleOurShip, sampleEnemyShip)) {
          strengthMultiplier -= 0.25; // Disadvantage
        }
      }

      effectiveStrength += baseStrength * strengthMultiplier;
    }

    // Factor in research bonuses (small adjustment)
    const attackBonus =
      ourPlayer.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_ATTACK].data.chance || 0;
    const defenseBonus =
      ourPlayer.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_DEFENSE].data.chance || 0;
    const researchMultiplier = 1.0 + (attackBonus + defenseBonus) / 2;

    effectiveStrength *= researchMultiplier;

    return Math.max(0, effectiveStrength);
  }

  /**
   * Manages fleet repairs by sending damaged fleets back to planets with repair capabilities
   */
  public static computerManageFleetRepairs(
    gameModel: GameModelData,
    player: PlayerData,
    _ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ) {
    // Only Hard and Expert AI manage repairs actively
    if (player.type !== PlayerType.Computer_Hard && player.type !== PlayerType.Computer_Expert) {
      return;
    }

    // Find planets capable of repairing ships
    const repairPlanets: PlanetData[] = [];
    for (const planet of ownedPlanetsSorted) {
      // Need colony for any repairs, factory for advanced repairs
      if (
        planet.builtImprovements[PlanetImprovementType.Colony] > 0 &&
        planet.builtImprovements[PlanetImprovementType.Factory] > 0
      ) {
        repairPlanets.push(planet);
      }
    }

    if (repairPlanets.length === 0) return;

    // Check fleets in transit for damage
    for (const fleet of player.fleetsInTransit) {
      const totalHealth = fleet.starships.reduce((sum, ship) => sum + ship.health, 0);
      const totalMaxHealth = fleet.starships.reduce(
        (sum, ship) => sum + Fleet.getStarshipTypeBaseStrength(ship.type),
        0,
      );

      // If fleet is less than 75% health and has at least one non-scout ship, consider retreat
      if (totalHealth < totalMaxHealth * 0.75 && fleet.starships.some((s) => s.type !== StarShipType.Scout)) {
        // Find nearest repair planet
        let nearestRepairPlanet: PlanetData | null = null;
        let minDistance = Infinity;

        for (const repairPlanet of repairPlanets) {
          // Check if planet can repair the ship types in this fleet
          const hasSpacePlatform = Planet.getSpacePlatformCount(repairPlanet, false) > 0;
          const canRepairThisFleet = fleet.starships.every((ship) => {
            if (ship.type === StarShipType.Scout || ship.type === StarShipType.SystemDefense) return true;
            if (ship.type === StarShipType.Destroyer || ship.type === StarShipType.SpacePlatform) return true;
            // Cruisers and Battleships need space platform
            return hasSpacePlatform;
          });

          if (!canRepairThisFleet) continue;
          if (!fleet.locationHexMidPoint) continue;

          const distance = Grid.getHexDistanceForMidPoints(
            gameModel.grid,
            fleet.locationHexMidPoint,
            repairPlanet.boundingHexMidPoint,
          );

          if (distance < minDistance) {
            minDistance = distance;
            nearestRepairPlanet = repairPlanet;
          }
        }

        // Redirect fleet to repair planet if found and not already going there
        if (nearestRepairPlanet && fleet.destinationHexMidPoint && fleet.locationHexMidPoint) {
          const currentDestDistance = Grid.getHexDistanceForMidPoints(
            gameModel.grid,
            fleet.locationHexMidPoint,
            fleet.destinationHexMidPoint,
          );

          // Only redirect if repair planet is closer or we're heading into danger
          if (minDistance < currentDestDistance * 0.7 && fleet.locationHexMidPoint) {
            Fleet.setDestination(
              fleet,
              gameModel.grid,
              fleet.locationHexMidPoint,
              nearestRepairPlanet.boundingHexMidPoint,
            );
            this.debugLog(player.name, 'Retreating damaged fleet to', nearestRepairPlanet.name, 'for repairs');
          }
        }
      }
    }
  }
}

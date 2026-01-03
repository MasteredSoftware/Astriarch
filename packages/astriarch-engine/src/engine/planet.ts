import { ClientPlanet, PlanetById } from '../model/clientModel';
import { EarnedPointsType } from '../model/earnedPoints';
import { FleetData, StarShipType } from '../model/fleet';
import {
  Citizen,
  CitizenWorkerType,
  PlanetData,
  PlanetHappinessType,
  PlanetImprovementType,
  PlanetProductionItemData,
  PlanetProductionItemType,
  PlanetResourceData,
  PlanetType,
  ProductionItemResources,
} from '../model/planet';
import { PlayerData } from '../model/player';
import { ResearchType } from '../model/research';
import { PointData } from '../shapes/shapes';
import { Utils } from '../utils/utils';

import { Fleet } from './fleet';
import {
  ClientNotification,
  ClientNotificationType,
  ShipBuiltNotification,
  ImprovementBuiltNotification,
  ImprovementDemolishedNotification,
} from './GameCommands';
import { Grid, GridHex } from './grid';
import { PlanetDistanceComparer } from './planetDistanceComparer';
import { PlanetProductionItem } from './planetProductionItem';
import { PlanetResources } from './planetResources';
import { Player } from './player';
import { Research } from './research';

export interface PlanetPerTurnResourceGeneration {
  baseAmountPerWorkerPerTurn: PlanetResourceData;
  amountPerTurn: PlanetResourceData;
  amountPerWorkerPerTurn: PlanetResourceData;
  amountNextWorkerPerTurn: PlanetResourceData;
}

export interface PopulationAssignments {
  farmers: number;
  miners: number;
  builders: number;
}

export interface PopulationByContentment {
  protesting: Citizen[];
  content: Citizen[];
}

export class Planet {
  private static NEXT_PLANET_ID = 1;
  private static PLANET_SIZE = 20.0;
  private static IMPROVEMENT_RATIO = 2.0;

  public static constructPlanet(
    type: PlanetType,
    name: string,
    boundingHex: GridHex,
    initialOwner?: PlayerData,
  ): PlanetData {
    const halfPlanetSize = Planet.PLANET_SIZE / 2;
    const originPoint = { x: boundingHex.midPoint.x - halfPlanetSize, y: boundingHex.midPoint.y - halfPlanetSize };
    const builtImprovements = {
      [PlanetImprovementType.Colony]: 0,
      [PlanetImprovementType.Factory]: 0,
      [PlanetImprovementType.Farm]: 0,
      [PlanetImprovementType.Mine]: 0,
    };

    const population: Citizen[] = [];
    const resources = PlanetResources.constructPlanetResources(0, 0, 0, 0, 0, 0);
    if (initialOwner) {
      population.push(Planet.constructCitizen(type, initialOwner.id));
      population.push(Planet.constructCitizen(type, initialOwner.id));
      resources.energy = 3;
      resources.food = 4;
      resources.ore = 2;
      resources.iridium = 1;
    }

    let maxImprovements = 0;
    let initialDefenders = 0;

    //set our max slots for improvements and initial defender count
    switch (type) {
      case PlanetType.AsteroidBelt:
        maxImprovements = 3;
        initialDefenders = 0;
        break;
      case PlanetType.DeadPlanet:
        maxImprovements = 5;
        initialDefenders = Utils.nextRandom(3, 5);
        break;
      case PlanetType.PlanetClass1:
        maxImprovements = 6;
        initialDefenders = Utils.nextRandom(4, 6);
        break;
      case PlanetType.PlanetClass2:
        maxImprovements = 9;
        initialDefenders = Utils.nextRandom(10, 15);
        break;
    }

    // Create planet object first (without fleet) so we can pass it to fleet generation
    const planetData: PlanetData = {
      id: Planet.NEXT_PLANET_ID++,
      name,
      type,
      nextShipId: 1, // Initialize planet-scoped ship ID counter
      population,
      buildQueue: [],
      builtImprovements,
      maxImprovements,
      resources,
      originPoint,
      boundingHexMidPoint: boundingHex.midPoint,
      planetaryFleet: {} as FleetData, // Temporary, will be replaced immediately
      outgoingFleets: [],
      planetHappiness: PlanetHappinessType.Normal,
      starshipTypeLastBuilt: null,
      starshipCustomShipLastBuilt: false,
      buildLastStarship: true,
      waypointBoundingHexMidPoint: null,
    };
    
    // Now generate the fleet with planet-scoped IDs
    planetData.planetaryFleet = Fleet.generateInitialFleet(initialDefenders, boundingHex.midPoint, planetData);

    Planet.generateResources(planetData, 1.0, initialOwner);

    return planetData;
  }

  public static generateResources(p: PlanetData, cyclesElapsed: number, owner?: PlayerData) {
    const rpt = Planet.getPlanetWorkerResourceGeneration(p, owner);

    if (owner) {
      let resourceDivisor = 1.0;
      let developmentDivisor = 1.0;
      if (p.planetHappiness == PlanetHappinessType.Unrest) {
        //unrest causes 1/2 resource production & 1/4 development
        resourceDivisor = 2.0;
        developmentDivisor = 4.0;
      } else if (p.planetHappiness == PlanetHappinessType.Riots) {
        //riots cause 1/4 resource production & 1/8 development
        resourceDivisor = 4.0;
        developmentDivisor = 8.0;
      }
      p.resources.food += (rpt.amountPerTurn.food * cyclesElapsed) / resourceDivisor;
      p.resources.ore += (rpt.amountPerTurn.ore * cyclesElapsed) / resourceDivisor;
      p.resources.iridium += (rpt.amountPerTurn.iridium * cyclesElapsed) / resourceDivisor;
      p.resources.production += (rpt.amountPerTurn.production * cyclesElapsed) / developmentDivisor;
      const maxCredits = Planet.getTaxRevenueAtMaxPercent(p, owner);
      const { creditAmountEarnedPerTurn, researchAmountEarnedPerTurn } =
        Research.getCreditAndResearchAmountEarnedPerTurn(owner.research, maxCredits);
      p.resources.energy += (creditAmountEarnedPerTurn * cyclesElapsed) / resourceDivisor;
      //add a bit more research completed based on a random factor
      const additionalResearchBreakthrough = Utils.nextRandom(0, researchAmountEarnedPerTurn * 0.1);
      p.resources.research +=
        ((researchAmountEarnedPerTurn + additionalResearchBreakthrough) * cyclesElapsed) / developmentDivisor;
    }
  }

  public static spendResources(
    grid: Grid,
    player: PlayerData,
    planetById: PlanetById,
    planet: PlanetData,
    energy: number,
    food: number,
    ore: number,
    iridium: number,
  ) {
    const { resources } = planet;
    //first check for required energy, food, ore and iridium on this planet
    let energyNeeded = energy - PlanetResources.spendEnergyAsPossible(resources, energy);
    let foodNeeded = food - PlanetResources.spendFoodAsPossible(resources, food);
    let oreNeeded = ore - PlanetResources.spendOreAsPossible(resources, ore);
    let iridiumNeeded = iridium - PlanetResources.spendIridiumAsPossible(resources, iridium);

    if (energyNeeded !== 0 || foodNeeded !== 0 || oreNeeded !== 0 || iridiumNeeded !== 0) {
      const ownedPlanets: PlanetData[] = [];
      for (const id of player.ownedPlanetIds) {
        const ownedPlanet = planetById[id];
        if (planet.id != ownedPlanet.id) {
          ownedPlanets.push(ownedPlanet);
        }
      }
      //get closest planets to source resources for, we don't charge for shipping ore or iridium
      const planetDistanceComparer = new PlanetDistanceComparer(grid, planet);
      ownedPlanets.sort((a, b) => planetDistanceComparer.sortFunction(a, b));

      for (const p of ownedPlanets) {
        if (energyNeeded !== 0) energyNeeded -= PlanetResources.spendEnergyAsPossible(p.resources, energyNeeded);
        if (foodNeeded !== 0) foodNeeded -= PlanetResources.spendFoodAsPossible(p.resources, foodNeeded);
        if (oreNeeded !== 0) oreNeeded -= PlanetResources.spendOreAsPossible(p.resources, oreNeeded);
        if (iridiumNeeded !== 0) iridiumNeeded -= PlanetResources.spendIridiumAsPossible(p.resources, iridiumNeeded);

        if (energyNeeded === 0 && foodNeeded === 0 && oreNeeded === 0 && iridiumNeeded === 0) break;
      }
      if (energyNeeded !== 0 || foodNeeded !== 0 || oreNeeded !== 0 || iridiumNeeded !== 0) {
        console.warn(
          'Problem spending energy, food, ore and iridium as necessary! ',
          player.name,
          planet.name,
          energyNeeded,
          foodNeeded,
          oreNeeded,
          iridiumNeeded,
        );
      }
    }
  }

  /**
   * Adds an item to the build queue and reduces the players resources based on the cost
   */
  public static enqueueProductionItemAndSpendResources(
    grid: Grid,
    player: PlayerData,
    planetById: PlanetById,
    planet: PlanetData,
    item: PlanetProductionItemData,
  ) {
    planet.buildQueue.push(item);

    this.spendResources(grid, player, planetById, planet, item.energyCost, 0, item.oreCost, item.iridiumCost);
    item.resourcesSpent = true;
  }

  /**
   * Removes an item from the build queue and returns resources to the planet based on how far the item is along in being built
   */
  public static removeBuildQueueItemForRefund(planet: PlanetData, index: number): boolean {
    if (index < 0 || index >= planet.buildQueue.length) {
      return false;
    }
    const [item] = planet.buildQueue.splice(index, 1);
    const refundAmount = this.getRefundAmount(item);

    planet.resources.energy += refundAmount.energyCost;
    planet.resources.ore += refundAmount.oreCost;
    planet.resources.iridium += refundAmount.iridiumCost;
    return true;
  }

  /**
   * returns how many resources should be refunded when this improvement is canceled
   */
  public static getRefundAmount(item: PlanetProductionItemData): ProductionItemResources {
    let energyCost = 0;
    let oreCost = 0;
    let iridiumCost = 0;
    if (item.resourcesSpent) {
      //give refund
      const refundPercent = 1 - item.productionCostComplete / (item.baseProductionCost * 1.0);
      energyCost = item.energyCost * refundPercent;
      oreCost = item.oreCost * refundPercent;
      iridiumCost = item.iridiumCost * refundPercent;
    }

    return { energyCost, oreCost, iridiumCost };
  }

  public static getTaxRevenueAtMaxPercent(p: PlanetData, owner: PlayerData) {
    //determine tax revenue (energy credits)
    const baseAmountPerPopPerTurn = p.id === owner.homePlanetId ? 2.0 : 1.0;
    let amountPerTurn = p.population.length * baseAmountPerPopPerTurn;
    const colonyCount = p.builtImprovements[PlanetImprovementType.Colony];
    if (colonyCount) {
      const colonyBoost = Research.getResearchBoostForEfficiencyImprovement(
        ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES,
        owner,
      );
      amountPerTurn +=
        Math.min(colonyCount, p.population.length) * baseAmountPerPopPerTurn * colonyBoost * Planet.IMPROVEMENT_RATIO;
    }

    return amountPerTurn / 1.5;
  }

  public static constructCitizen(planetType: PlanetType, loyalToPlayerId: string | undefined): Citizen {
    const workerType = [PlanetType.AsteroidBelt, PlanetType.DeadPlanet].includes(planetType)
      ? CitizenWorkerType.Miner
      : CitizenWorkerType.Farmer;

    return {
      populationChange: 0,
      loyalToPlayerId,
      protestLevel: 0,
      workerType,
    };
  }

  public static getPlanetWorkerResourceGeneration(p: PlanetData, owner?: PlayerData): PlanetPerTurnResourceGeneration {
    const rpt = {
      baseAmountPerWorkerPerTurn: PlanetResources.constructPlanetResources(0, 0, 0, 0, 0, 2.0),
      amountPerTurn: PlanetResources.constructPlanetResources(0, 0, 0, 0, 0, 0),
      amountPerWorkerPerTurn: PlanetResources.constructPlanetResources(0, 0, 0, 0, 0, 0),
      amountNextWorkerPerTurn: PlanetResources.constructPlanetResources(0, 0, 0, 0, 0, 0), // Potential extra resources if player adds a farmer or miner
    };

    //this is the initial/base planet resource production
    //base values by planet type:
    switch (p.type) {
      case PlanetType.AsteroidBelt:
        rpt.baseAmountPerWorkerPerTurn.food = 0.5;
        rpt.baseAmountPerWorkerPerTurn.ore = 1.75;
        rpt.baseAmountPerWorkerPerTurn.iridium = 1.0;
        break;
      case PlanetType.DeadPlanet:
        rpt.baseAmountPerWorkerPerTurn.food = 1.0;
        rpt.baseAmountPerWorkerPerTurn.ore = 1.5;
        rpt.baseAmountPerWorkerPerTurn.iridium = 0.5;
        break;
      case PlanetType.PlanetClass1:
        rpt.baseAmountPerWorkerPerTurn.food = 1.5;
        rpt.baseAmountPerWorkerPerTurn.ore = 0.5;
        rpt.baseAmountPerWorkerPerTurn.iridium = 0.375;
        break;
      case PlanetType.PlanetClass2:
        rpt.baseAmountPerWorkerPerTurn.food = 2.0;
        rpt.baseAmountPerWorkerPerTurn.ore = 0.25;
        rpt.baseAmountPerWorkerPerTurn.iridium = 0.125;
        break;
    }

    const { farmers, miners, builders } = Planet.countPopulationWorkerTypes(p);

    if (farmers < p.population.length) {
      rpt.amountNextWorkerPerTurn.food = rpt.baseAmountPerWorkerPerTurn.food;
    }

    if (miners < p.population.length) {
      rpt.amountNextWorkerPerTurn.ore = rpt.baseAmountPerWorkerPerTurn.ore;
      rpt.amountNextWorkerPerTurn.iridium = rpt.baseAmountPerWorkerPerTurn.iridium;
    }

    if (builders < p.population.length) {
      rpt.amountNextWorkerPerTurn.production = rpt.baseAmountPerWorkerPerTurn.production;
    }

    //determine production per turn
    rpt.amountPerTurn.food = rpt.baseAmountPerWorkerPerTurn.food * farmers;
    rpt.amountPerTurn.ore = rpt.baseAmountPerWorkerPerTurn.ore * miners;
    rpt.amountPerTurn.iridium = rpt.baseAmountPerWorkerPerTurn.iridium * miners;
    rpt.amountPerTurn.production = rpt.baseAmountPerWorkerPerTurn.production * builders;

    if (Planet.builtImprovementCount(p) > 0) {
      const farmCount = p.builtImprovements[PlanetImprovementType.Farm];
      const mineCount = p.builtImprovements[PlanetImprovementType.Mine];
      const factoryCount = p.builtImprovements[PlanetImprovementType.Factory];

      let researchEffectiveness = null;
      if (farmCount > 0) {
        researchEffectiveness = Research.getResearchBoostForEfficiencyImprovement(
          ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS,
          owner,
        );
        if (farmers < farmCount) {
          rpt.amountNextWorkerPerTurn.food =
            rpt.baseAmountPerWorkerPerTurn.food * Planet.IMPROVEMENT_RATIO * researchEffectiveness;
        }

        if (farmers > 0) {
          rpt.amountPerTurn.food +=
            Math.min(farmCount, farmers) *
            rpt.baseAmountPerWorkerPerTurn.food *
            Planet.IMPROVEMENT_RATIO *
            researchEffectiveness;
        }
      }
      if (mineCount > 0) {
        researchEffectiveness = Research.getResearchBoostForEfficiencyImprovement(
          ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES,
          owner,
        );
        if (miners < mineCount) {
          rpt.amountNextWorkerPerTurn.ore =
            rpt.baseAmountPerWorkerPerTurn.ore * Planet.IMPROVEMENT_RATIO * researchEffectiveness;
          rpt.amountNextWorkerPerTurn.iridium =
            rpt.baseAmountPerWorkerPerTurn.iridium * Planet.IMPROVEMENT_RATIO * researchEffectiveness;
        }

        if (miners > 0) {
          rpt.amountPerTurn.ore +=
            Math.min(mineCount, miners) *
            rpt.baseAmountPerWorkerPerTurn.ore *
            Planet.IMPROVEMENT_RATIO *
            researchEffectiveness;
          rpt.amountPerTurn.iridium +=
            Math.min(mineCount, miners) *
            rpt.baseAmountPerWorkerPerTurn.iridium *
            Planet.IMPROVEMENT_RATIO *
            researchEffectiveness;
        }
      }
      if (factoryCount > 0) {
        researchEffectiveness = Research.getResearchBoostForEfficiencyImprovement(
          ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES,
          owner,
        );
        if (builders < factoryCount) {
          rpt.amountNextWorkerPerTurn.production =
            rpt.baseAmountPerWorkerPerTurn.production * Planet.IMPROVEMENT_RATIO * researchEffectiveness;
        }

        if (builders > 0) {
          rpt.amountPerTurn.production +=
            Math.min(factoryCount, builders) *
            rpt.baseAmountPerWorkerPerTurn.production *
            Planet.IMPROVEMENT_RATIO *
            researchEffectiveness;
        }
      }
    }

    rpt.amountPerWorkerPerTurn.food = farmers ? rpt.amountPerTurn.food / farmers : 0;
    rpt.amountPerWorkerPerTurn.ore = miners ? rpt.amountPerTurn.ore / miners : 0;
    rpt.amountPerWorkerPerTurn.iridium = miners ? rpt.amountPerTurn.iridium / miners : 0;
    rpt.amountPerWorkerPerTurn.production = builders ? rpt.amountPerTurn.production / builders : 0;

    return rpt;
  }

  public static builtImprovementCount(p: PlanetData): number {
    return (
      p.builtImprovements[PlanetImprovementType.Colony] +
      p.builtImprovements[PlanetImprovementType.Factory] +
      p.builtImprovements[PlanetImprovementType.Farm] +
      p.builtImprovements[PlanetImprovementType.Mine]
    );
  }

  public static countPopulationWorkerTypes(p: PlanetData): PopulationAssignments {
    const pop: PopulationAssignments = {
      farmers: 0,
      miners: 0,
      builders: 0,
    };

    const citizens = Planet.getPopulationByContentment(p);

    return citizens.content.reduce((accum, curr) => {
      if (curr.workerType === CitizenWorkerType.Farmer) {
        accum.farmers++;
      } else if (curr.workerType === CitizenWorkerType.Miner) {
        accum.miners++;
      } else if (curr.workerType === CitizenWorkerType.Builder) {
        accum.builders++;
      }
      return accum;
    }, pop);
  }

  public static getPopulationByContentment(p: PlanetData): PopulationByContentment {
    const protesting: Citizen[] = [];
    const content: Citizen[] = [];
    for (const citizen of p.population) {
      if (citizen.protestLevel > 0) {
        protesting.push(citizen);
      } else {
        content.push(citizen);
      }
    }
    return { protesting, content };
  }

  /**
   * Gets the speed that population is currently growing on this planet
   * @returns {number} a decimal value of the fraction added to the population each turn
   * @constructor
   */
  public static getPopulationGrowthRate(p: PlanetData, owner: PlayerData, cyclesElapsed: number) {
    const popCount = p.population.length;
    const maxPop = Planet.maxPopulation(p);
    let growthRate = 0;
    //check if we can grow
    if (popCount > 0 && p.planetHappiness != PlanetHappinessType.Riots && popCount < maxPop) {
      const openSlots = maxPop - popCount;
      let maxProcreation = popCount / 8.0;
      const colonyCount = p.builtImprovements[PlanetImprovementType.Colony];
      if (owner && colonyCount) {
        maxProcreation *=
          Research.getResearchBoostForEfficiencyImprovement(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES) *
          colonyCount;
      }
      //when there are 2 open slots per pop, then the maximum growth rate is achieved per population
      growthRate = maxProcreation * Math.min(openSlots / popCount, 2.0);
      if (p.planetHappiness === PlanetHappinessType.Unrest)
        //unrest slows pop growth
        growthRate = growthRate / 2.0;
    }
    return growthRate * cyclesElapsed;
  }

  public static getCitizenByType(p: PlanetData, desiredType: CitizenWorkerType): Citizen {
    const citizens = this.getPopulationByContentment(p);
    for (const c of citizens.content) {
      if (c.workerType === desiredType) return c;
    }
    for (const c of citizens.protesting) {
      if (c.workerType === desiredType) {
        console.warn('No content citizens found in Planet.getCitizenByType! Returning protesting citizen.');
        return c;
      }
    }
    throw new Error('No matching citizens found in Planet.getCitizenByType!');
  }

  public static maxPopulation(p: PlanetData) {
    return p.maxImprovements + p.builtImprovements[PlanetImprovementType.Colony];
  }

  public static getPlanetAtMidPoint(planets: PlanetData[], midPoint: PointData): PlanetData | undefined {
    return planets.find((p) => Grid.pointsAreEqual(p.boundingHexMidPoint, midPoint));
  }

  public static getClientPlanetAtMidPoint(planets: ClientPlanet[], midPoint: PointData): ClientPlanet | undefined {
    return planets.find((p) => Grid.pointsAreEqual(p.boundingHexMidPoint, midPoint));
  }

  public static recallOutgoingFleets(p: PlanetData) {
    for (const f of p.outgoingFleets) {
      Fleet.landFleet(p.planetaryFleet, f);
    }
    p.outgoingFleets = [];
  }

  /**
   * Updates population worker assignments based on diffs that don't need to sum to zero
   * Automatically redistributes workers to/from other assignments as needed
   */
  public static updatePopulationWorkerTypes(
    p: PlanetData,
    owner: PlayerData,
    farmerDiff: number,
    minerDiff: number,
    builderDiff: number,
  ) {
    const current = this.countPopulationWorkerTypes(p);

    // Calculate what we want to achieve
    let desiredFarmers = Math.max(0, current.farmers + farmerDiff);
    let desiredMiners = Math.max(0, current.miners + minerDiff);
    let desiredBuilders = Math.max(0, current.builders + builderDiff);

    const totalPopulation = p.population.length;
    const desiredTotal = desiredFarmers + desiredMiners + desiredBuilders;

    // If we're trying to assign more workers than we have population, we need to adjust
    if (desiredTotal > totalPopulation) {
      // We need to reduce some assignments - prioritize keeping the requested increases
      const excess = desiredTotal - totalPopulation;

      // Create array of worker types with their desired amounts and whether they were increased
      const workers = [
        { type: 'farmers', desired: desiredFarmers, wasIncreased: farmerDiff > 0, diff: farmerDiff },
        { type: 'miners', desired: desiredMiners, wasIncreased: minerDiff > 0, diff: minerDiff },
        { type: 'builders', desired: desiredBuilders, wasIncreased: builderDiff > 0, diff: builderDiff },
      ];

      // Sort to reduce from non-increased types first, then by highest count
      workers.sort((a, b) => {
        if (a.wasIncreased !== b.wasIncreased) {
          return a.wasIncreased ? 1 : -1; // Non-increased first
        }
        return b.desired - a.desired; // Then by highest count
      });

      let remaining = excess;
      for (const worker of workers) {
        if (remaining <= 0) break;
        const canReduce = Math.min(worker.desired, remaining);
        worker.desired -= canReduce;
        remaining -= canReduce;
      }

      // Update our desired values
      desiredFarmers = workers.find((w) => w.type === 'farmers')!.desired;
      desiredMiners = workers.find((w) => w.type === 'miners')!.desired;
      desiredBuilders = workers.find((w) => w.type === 'builders')!.desired;
    }

    // If we have unassigned population, assign to the type that needs the most
    const assignedTotal = desiredFarmers + desiredMiners + desiredBuilders;
    if (assignedTotal < totalPopulation) {
      const unassigned = totalPopulation - assignedTotal;

      // Find which assignment has the least workers to balance things out
      const assignments = [
        { type: 'farmers', count: desiredFarmers },
        { type: 'miners', count: desiredMiners },
        { type: 'builders', count: desiredBuilders },
      ];
      assignments.sort((a, b) => a.count - b.count);

      // Distribute unassigned workers starting with the lowest assignment
      let remaining = unassigned;
      for (const assignment of assignments) {
        if (remaining <= 0) break;
        const toAdd = Math.min(remaining, Math.ceil(remaining / assignments.length));
        if (assignment.type === 'farmers') desiredFarmers += toAdd;
        else if (assignment.type === 'miners') desiredMiners += toAdd;
        else if (assignment.type === 'builders') desiredBuilders += toAdd;
        remaining -= toAdd;
      }
    }

    // Now calculate the balanced diffs that sum to zero
    const balancedFarmerDiff = desiredFarmers - current.farmers;
    const balancedMinerDiff = desiredMiners - current.miners;
    const balancedBuilderDiff = desiredBuilders - current.builders;

    // Use the existing method that requires diffs to sum to zero
    return this.updatePopulationWorkerTypesByDiff(p, owner, balancedFarmerDiff, balancedMinerDiff, balancedBuilderDiff);
  }

  /**
   * updates the population worker assignments based on the differences passed in
   */
  public static updatePopulationWorkerTypesByDiff(
    p: PlanetData,
    owner: PlayerData,
    farmerDiff: number,
    minerDiff: number,
    builderDiff: number,
  ) {
    if (farmerDiff + minerDiff + builderDiff !== 0) {
      console.error(
        "Couldn't move workers in Planet.updatePopulationWorkerTypesByDiff!",
        farmerDiff,
        minerDiff,
        builderDiff,
      );
      return this.getPlanetWorkerResourceGeneration(p, owner);
    }

    while (farmerDiff !== 0) {
      if (farmerDiff > 0) {
        //move miners and workers to be farmers
        if (minerDiff < 0) {
          this.getCitizenByType(p, CitizenWorkerType.Miner).workerType = CitizenWorkerType.Farmer;
          farmerDiff--;
          minerDiff++;
        }
        if (farmerDiff !== 0 && builderDiff < 0) {
          this.getCitizenByType(p, CitizenWorkerType.Builder).workerType = CitizenWorkerType.Farmer;
          farmerDiff--;
          builderDiff++;
        }
      } else {
        //make farmers to miners and workers
        if (minerDiff > 0) {
          this.getCitizenByType(p, CitizenWorkerType.Farmer).workerType = CitizenWorkerType.Miner;
          farmerDiff++;
          minerDiff--;
        }
        if (farmerDiff !== 0 && builderDiff > 0) {
          this.getCitizenByType(p, CitizenWorkerType.Farmer).workerType = CitizenWorkerType.Builder;
          farmerDiff++;
          builderDiff--;
        }
      }
    }

    //next check miners, don't touch farmers
    while (minerDiff !== 0) {
      if (minerDiff > 0) {
        //move workers to be miners
        if (builderDiff < 0) {
          this.getCitizenByType(p, CitizenWorkerType.Builder).workerType = CitizenWorkerType.Miner;
          minerDiff--;
          builderDiff++;
        }
      } else {
        //make miners to workers
        if (builderDiff > 0) {
          this.getCitizenByType(p, CitizenWorkerType.Miner).workerType = CitizenWorkerType.Builder;
          minerDiff++;
          builderDiff--;
        }
      }
    }

    //check for problems
    if (farmerDiff !== 0 || minerDiff !== 0 || builderDiff !== 0) {
      console.error(
        "Couldn't move workers in Planet.updatePopulationWorkerTypesByDiff!",
        farmerDiff,
        minerDiff,
        builderDiff,
      );
    }
    return this.getPlanetWorkerResourceGeneration(p, owner);
  }

  /**
   * Counts the SpacePlatforms in the fleet
   */
  public static getSpacePlatformCount(p: PlanetData, includeQueue: boolean) {
    let count = Fleet.countStarshipsByType(p.planetaryFleet).spaceplatforms;
    if (includeQueue) {
      for (const ppi of p.buildQueue) {
        if (
          ppi.itemType == PlanetProductionItemType.StarShipInProduction &&
          ppi.starshipData?.type == StarShipType.SpacePlatform
        ) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Counts the improvements built as well as the improvements in the queue by type
   */
  public static builtAndBuildQueueImprovementTypeCount(p: PlanetData, type: PlanetImprovementType) {
    let count = p.builtImprovements[type];
    for (const ppi of p.buildQueue) {
      if (ppi.itemType === PlanetProductionItemType.PlanetImprovement && ppi.improvementData?.type == type) {
        count++;
      }
    }
    return count;
  }

  /**
   * sets the turns to complete based on production
   */
  public static estimateTurnsToComplete(
    planet: PlanetData,
    item: PlanetProductionItemData,
    resourceGeneration: PlanetPerTurnResourceGeneration,
  ) {
    if (resourceGeneration.amountPerTurn.production !== 0) {
      const productionCostLeft = item.baseProductionCost - item.productionCostComplete - planet.resources.production;
      item.turnsToComplete = Math.ceil(productionCostLeft / resourceGeneration.amountPerTurn.production);
    } else {
      item.turnsToComplete = 999; //if there are no workers
    }
    //We at least need one turn to build it, even if we have stockpile greater than the production cost
    if (item.turnsToComplete <= 0) {
      item.turnsToComplete = 1;
    }
  }

  /**
   * Builds improvements in the queue
   */
  public static buildImprovements(
    planet: PlanetData,
    owner: PlayerData,
    gameGrid: Grid,
    resourceGeneration: PlanetPerTurnResourceGeneration,
  ): { buildQueueEmpty: boolean; events: ClientNotification[] } {
    const returnVal = { buildQueueEmpty: false, events: [] as ClientNotification[] };

    if (planet.buildQueue.length > 0) {
      const nextItem = planet.buildQueue[0];

      // This assumes that the production on the planet has already been adjusted for elapsed cycles
      nextItem.productionCostComplete += planet.resources.production;
      planet.resources.production = 0;

      if (nextItem.productionCostComplete >= nextItem.baseProductionCost) {
        //build it
        planet.buildQueue.shift();
        nextItem.turnsToComplete = 0;

        //assign points
        Player.increasePoints(owner, EarnedPointsType.PRODUCTION_UNIT_BUILT, nextItem.baseProductionCost);

        if (planet.buildQueue.length > 0) {
          const nextInQueue = planet.buildQueue[0];

          //estimate turns left for next item so that we display it correctly on the main screen
          this.estimateTurnsToComplete(planet, nextInQueue, resourceGeneration);
        }

        if (nextItem.itemType === PlanetProductionItemType.PlanetImprovement) {
          planet.builtImprovements[nextItem.improvementData!.type] += 1;

          // Generate IMPROVEMENT_BUILT notification
          const improvementBuiltNotification: ImprovementBuiltNotification = {
            type: ClientNotificationType.IMPROVEMENT_BUILT,
            affectedPlayerIds: [owner.id],
            data: {
              planetId: planet.id,
              planetName: planet.name,
              improvementType: nextItem.improvementData!.type,
              nextItemInQueue:
                planet.buildQueue.length > 0 ? PlanetProductionItem.toString(planet.buildQueue[0]) : undefined,
            },
          };
          returnVal.events.push(improvementBuiltNotification);
        } else if (nextItem.itemType === PlanetProductionItemType.StarShipInProduction) {
          if (!nextItem.starshipData) {
            throw new Error('No starshipData in PlanetProductionItem');
          }
          const { type, customShipData, assignedShipId } = nextItem.starshipData;
          const ship = Fleet.generateStarship(type, customShipData, planet, owner, assignedShipId);

          //don't set last built option for space platforms
          if (type != StarShipType.SpacePlatform) {
            planet.starshipTypeLastBuilt = type;
            planet.starshipCustomShipLastBuilt = Boolean(customShipData);
          }

          //if we have a waypoint set on the planet, send this new starship to the waypoint planet
          if (
            planet.waypointBoundingHexMidPoint &&
            ![StarShipType.SystemDefense, StarShipType.SpacePlatform].includes(type)
          ) {
            const newFleet = Fleet.generateFleet([], planet.boundingHexMidPoint, owner);
            newFleet.starships.push(ship);
            // Update hash for the newly created fleet with the added ship
            Fleet.recalculateFleetCompositionHash(newFleet);
            Fleet.setDestination(newFleet, gameGrid, planet.boundingHexMidPoint, planet.waypointBoundingHexMidPoint);

            planet.outgoingFleets.push(newFleet);
          } else {
            planet.planetaryFleet.starships.push(ship);
            // Update hash for the planetary fleet with the added ship
            Fleet.recalculateFleetCompositionHash(planet.planetaryFleet);
          }

          // Generate SHIP_BUILT notification
          const shipBuiltNotification: ShipBuiltNotification = {
            type: ClientNotificationType.SHIP_BUILT,
            affectedPlayerIds: [owner.id],
            data: {
              planetId: planet.id,
              planetName: planet.name,
              shipType: type,
              customShipData: customShipData || undefined,
              sentToWaypoint: Boolean(
                planet.waypointBoundingHexMidPoint &&
                  ![StarShipType.SystemDefense, StarShipType.SpacePlatform].includes(type),
              ),
              nextItemInQueue:
                planet.buildQueue.length > 0 ? PlanetProductionItem.toString(planet.buildQueue[0]) : undefined,
            },
          };
          returnVal.events.push(shipBuiltNotification);
        } else if (nextItem.itemType === PlanetProductionItemType.PlanetImprovementToDestroy) {
          if (planet.builtImprovements[nextItem.improvementData!.type] > 0) {
            planet.builtImprovements[nextItem.improvementData!.type]--;

            // Generate IMPROVEMENT_DEMOLISHED notification
            const improvementDemolishedNotification: ImprovementDemolishedNotification = {
              type: ClientNotificationType.IMPROVEMENT_DEMOLISHED,
              affectedPlayerIds: [owner.id],
              data: {
                planetId: planet.id,
                planetName: planet.name,
                improvementType: nextItem.improvementData!.type,
                nextItemInQueue:
                  planet.buildQueue.length > 0 ? PlanetProductionItem.toString(planet.buildQueue[0]) : undefined,
              },
            };
            returnVal.events.push(improvementDemolishedNotification);

            //TODO: there is probably a better place to handle this check for population overages
            //TODO: should we also notify the user he/she lost a pop due to overcrowding or do this slower?
            while (Planet.maxPopulation(planet) < planet.population.length) {
              //pitd.TypeToDestroy == PlanetImprovementType.Colony)
              planet.population.pop();
            }
          }
        }

        // return remainder production back to the planet
        planet.resources.production = nextItem.productionCostComplete - nextItem.baseProductionCost;
      } else {
        //not done yet, estimate turns to complete
        this.estimateTurnsToComplete(planet, nextItem, resourceGeneration);
      }
    } else {
      //notify user of empty build queue
      returnVal.buildQueueEmpty = true;
    }
    return returnVal;
  }

  /**
   * Returns data if there is a mobile starship in the queue
   */
  public static buildQueueContainsMobileStarship(
    p: PlanetData,
  ): { turnsToComplete: number; starshipStrength: number } | undefined {
    for (const ppi of p.buildQueue) {
      if (ppi.starshipData && Fleet.starshipTypeIsMobile(ppi.starshipData.type)) {
        const starshipStrength = Fleet.getStarshipTypeBaseStrength(ppi.starshipData.type);
        return { turnsToComplete: ppi.turnsToComplete, starshipStrength };
      }
    }
    return undefined;
  }

  /**
   * A sort function to prefer planets with higher pop and number of improvements
   */
  public static planetPopulationImprovementCountComparerSortFunction(a: PlanetData, b: PlanetData) {
    let ret = Utils.compareNumbers(b.population.length, a.population.length);
    if (ret == 0) ret = Utils.compareNumbers(Planet.builtImprovementCount(b), Planet.builtImprovementCount(a));
    return ret;
  }
}

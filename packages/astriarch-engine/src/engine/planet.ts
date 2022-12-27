import { PlanetById } from "../model/clientModel";
import {
  Citizen,
  CitizenWorkerType,
  PlanetData,
  PlanetHappinessType,
  PlanetImprovementType,
  PlanetResourceData,
  PlanetType,
} from "../model/planet";
import { PlayerData } from "../model/player";
import { ResearchType } from "../model/research";
import { Utils } from "../utils/utils";
import { Fleet } from "./fleet";
import { GameModelData } from "./gameModel";
import { GridHex } from "./grid";
import { PlanetDistanceComparer } from "./planetDistanceComparer";
import { PlanetResources } from "./planetResources";
import { Research } from "./research";

export interface PlanetPerTurnResourceGeneration {
  baseAmountPerWorkerPerTurn: PlanetResourceData;
  amountPerTurn: PlanetResourceData;
  amountPerWorkerPerTurn: PlanetResourceData;
  amountNextWorkerPerTurn: PlanetResourceData;
}

export type PopulationAssignments = {
  farmers: number;
  miners: number;
  builders: number;
};

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
    initialOwner?: PlayerData
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
      resources.food = 4;
      resources.ore = 2;
      resources.iridium = 1;
    }

    let maxImprovements = 0;
    let planetaryFleet;

    //set our max slots for improvements and build an initial defense fleet
    switch (type) {
      case PlanetType.AsteroidBelt:
        maxImprovements = 3;
        planetaryFleet = Fleet.generateInitialFleet(0, boundingHex.midPoint);
        break;
      case PlanetType.DeadPlanet:
        maxImprovements = 5;
        planetaryFleet = Fleet.generateInitialFleet(Utils.nextRandom(3, 5), boundingHex.midPoint);
        break;
      case PlanetType.PlanetClass1:
        maxImprovements = 6;
        planetaryFleet = Fleet.generateInitialFleet(Utils.nextRandom(4, 6), boundingHex.midPoint);
        break;
      case PlanetType.PlanetClass2:
        maxImprovements = 9;
        planetaryFleet = Fleet.generateInitialFleet(Utils.nextRandom(10, 15), boundingHex.midPoint);
        break;
    }

    const planetData = {
      id: Planet.NEXT_PLANET_ID++,
      name,
      type,
      population,
      buildQueue: [],
      builtImprovements,
      maxImprovements,
      resources,
      originPoint,
      boundingHexMidPoint: boundingHex.midPoint,
      planetaryFleet: planetaryFleet!,
      outgoingFleets: [],
      planetHappiness: PlanetHappinessType.Normal,
      starshipTypeLastBuilt: null,
      starshipCustomShipLastBuilt: false,
      buildLastStarShip: true,
      waypointPlanetId: null,
    };

    Planet.generateResources(planetData, 1.0, initialOwner);

    return planetData;
  }

  public static generateResources(p: PlanetData, cyclesElapsed: number, owner?: PlayerData) {
    const rpt = Planet.getPlanetWorkerResourceGeneration(p, owner);

    if (owner) {
      let divisor = 1.0;
      if (p.planetHappiness == PlanetHappinessType.Unrest) {
        //unrest causes 1/2 production
        divisor = 2.0;
      } else if (p.planetHappiness == PlanetHappinessType.Riots) {
        //riots cause 1/4 production
        divisor = 4.0;
      }
      p.resources.food += (rpt.amountPerTurn.food * cyclesElapsed) / divisor;
      p.resources.ore += (rpt.amountPerTurn.ore * cyclesElapsed) / divisor;
      p.resources.iridium += (rpt.amountPerTurn.iridium * cyclesElapsed) / divisor;
      p.resources.production += (rpt.amountPerTurn.production * cyclesElapsed) / divisor;
      const maxCredits = Planet.getTaxRevenueAtMaxPercent(p, owner);
      const { creditAmountEarnedPerTurn, researchAmountEarnedPerTurn } =
        Research.getCreditAndResearchAmountEarnedPerTurn(owner.research, maxCredits);
      p.resources.energy += (creditAmountEarnedPerTurn * cyclesElapsed) / divisor;
      //add a bit more research completed based on a random factor
      const additionalResearchBreakthrough = Utils.nextRandom(0, researchAmountEarnedPerTurn * 0.1);
      p.resources.research +=
        ((researchAmountEarnedPerTurn + additionalResearchBreakthrough) * cyclesElapsed) / divisor;
    }
  }

  public static spendResources(
    gameModel: GameModelData,
    player: PlayerData,
    planetById: PlanetById,
    planet: PlanetData,
    energy: number,
    food: number,
    ore: number,
    iridium: number
  ) {
    const { resources } = planet;
    //first check for required energy, food, ore and iridium on this planet
    let energyNeeded = energy - PlanetResources.spendEnergyAsPossible(resources, energy);
    let foodNeeded = food - PlanetResources.spendFoodAsPossible(resources, food);
    let oreNeeded = ore - PlanetResources.spendOreAsPossible(resources, ore);
    let iridiumNeeded = iridium - PlanetResources.spendIridiumAsPossible(resources, iridium);

    if (energyNeeded !== 0 || foodNeeded !== 0 || oreNeeded !== 0 || iridiumNeeded !== 0) {
      let ownedPlanets: PlanetData[] = [];
      for (const id of player.ownedPlanetIds) {
        const ownedPlanet = planetById[id];
        if (planet.id != ownedPlanet.id) {
          ownedPlanets.push(ownedPlanet);
        }
      }
      //get closest planets to source resources for, we don't charge for shipping ore or iridium
      let planetDistanceComparer = new PlanetDistanceComparer(gameModel, planet);
      ownedPlanets.sort(planetDistanceComparer.sortFunction);

      for (const p of ownedPlanets) {
        if (energyNeeded !== 0) energyNeeded -= PlanetResources.spendEnergyAsPossible(p.resources, energyNeeded);
        if (foodNeeded !== 0) foodNeeded -= PlanetResources.spendFoodAsPossible(p.resources, foodNeeded);
        if (oreNeeded !== 0) oreNeeded -= PlanetResources.spendFoodAsPossible(p.resources, oreNeeded);
        if (iridiumNeeded !== 0) iridiumNeeded -= PlanetResources.spendFoodAsPossible(p.resources, iridiumNeeded);

        if (energyNeeded === 0 && foodNeeded === 0 && oreNeeded === 0 && iridiumNeeded === 0) break;
      }
      if (energyNeeded !== 0 || foodNeeded !== 0 || oreNeeded !== 0 || iridiumNeeded !== 0) {
        console.warn(
          "Problem spending energy, food, ore and iridium as necessary! ",
          player.name,
          planet.name,
          energyNeeded,
          foodNeeded,
          oreNeeded,
          iridiumNeeded
        );
      }
    }
  }

  public static getTaxRevenueAtMaxPercent(p: PlanetData, owner: PlayerData) {
    //determine tax revenue (energy credits)
    let baseAmountPerPopPerTurn = p.id === owner.homePlanetId ? 2.0 : 1.0;
    let amountPerTurn = p.population.length * baseAmountPerPopPerTurn;
    let colonyCount = p.builtImprovements[PlanetImprovementType.Colony];
    if (colonyCount) {
      let colonyBoost = Research.getResearchBoostForBuildingEfficiencyImprovement(
        ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES,
        owner
      );
      amountPerTurn +=
        Math.min(colonyCount, p.population.length) * baseAmountPerPopPerTurn * colonyBoost * Planet.IMPROVEMENT_RATIO;
    }

    return amountPerTurn / 1.5;
  }

  public static constructCitizen(planetType: PlanetType, loyalToPlayerId: string): Citizen {
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
      let farmCount = p.builtImprovements[PlanetImprovementType.Farm];
      let mineCount = p.builtImprovements[PlanetImprovementType.Mine];
      let factoryCount = p.builtImprovements[PlanetImprovementType.Factory];

      let researchEffectiveness = null;
      if (farmCount > 0) {
        researchEffectiveness = Research.getResearchBoostForBuildingEfficiencyImprovement(
          ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS,
          owner
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
        researchEffectiveness = Research.getResearchBoostForBuildingEfficiencyImprovement(
          ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES,
          owner
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
        researchEffectiveness = Research.getResearchBoostForBuildingEfficiencyImprovement(
          ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES,
          owner
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
}

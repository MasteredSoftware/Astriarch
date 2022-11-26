import { Citizen, CitizenWorkerType, PlanetData, PlanetHappinessType, PlanetImprovementType, PlanetResources, PlanetType } from "../model/planet";
import { PlayerData } from "../model/player";
import { GridHex } from "./grid";

export interface PlanetPerTurnResourceGeneration {
    baseAmountPerWorkerPerTurn: PlanetResources;
    amountPerTurn: PlanetResources;
    amountPerWorkerPerTurn: PlanetResources;
    amountNextWorkerPerTurn: PlanetResources;
}

export type PopulationAssignments = {[T in CitizenWorkerType]: number};

export interface PopulationByContentment {
    protesting: Citizen[];
    content: Citizen[];
}

export class Planet {
    private static NEXT_PLANET_ID = 1;
    private static PLANET_SIZE = 20.0;
    public static constructPlanet(type:PlanetType, name:string, boundingHex: GridHex, initialOwner?: PlayerData):PlanetData {
        const halfPlanetSize = Planet.PLANET_SIZE / 2;
        const originPoint = {x: boundingHex.midPoint.x - halfPlanetSize, y: boundingHex.midPoint.y-halfPlanetSize};
        const builtImprovements = {
            [PlanetImprovementType.Colony]: 0,
            [PlanetImprovementType.Factory]: 0,
            [PlanetImprovementType.Farm]: 0,
            [PlanetImprovementType.Mine]: 0,
        };

        const population:Citizen[] = [];
        const resources = Planet.constructPlanetResources(0, 0, 0, 0, 0);
        if(initialOwner) {
            population.push(Planet.constructCitizen(type, initialOwner.id));
            resources.food = 4;
        }
        let maxImprovements = 0;

        return {
            id: Planet.NEXT_PLANET_ID++,
            name,
            type,
            population,
            buildQueue: [],
            builtImprovements,
            maxImprovements,
            resources,
            originPoint,
            planetaryFleet: FleetData,
            outgoingFleets: [],
            planetHappiness: PlanetHappinessType.Normal,
            starshipTypeLastBuilt: null,
            starshipCustomShipLastBuilt: false,
            buildLastStarShip: true,
            waypointPlanetId: null,
          }
    }

    public static constructPlanetResources(food: number, energy: number, ore: number, iridium: number, production: number):PlanetResources {
        return {
            food,
            energy,
            ore,
            iridium,
            production,
          }
    }

    public static constructCitizen(planetType: PlanetType, loyalToPlayerId: string):Citizen {
        const workerType = [PlanetType.AsteroidBelt, PlanetType.DeadPlanet].includes(planetType) ? CitizenWorkerType.Miner : CitizenWorkerType.Farmer;

        return {
            populationChange: 0,
            loyalToPlayerId,
            protestLevel: 0,
            workerType,
          }
    }

    public static getPlanetPerTurnResourceGeneration(p: PlanetData):PlanetPerTurnResourceGeneration {
        const rpt = {
            baseAmountPerWorkerPerTurn: Planet.constructPlanetResources(0, 0, 0, 0, 2.0),
            amountPerTurn: Planet.constructPlanetResources(0, 0, 0, 0, 0),
            amountPerWorkerPerTurn: Planet.constructPlanetResources(0, 0, 0, 0, 0),
            amountNextWorkerPerTurn: Planet.constructPlanetResources(0, 0, 0, 0, 0), // Potential extra resources if player adds a farmer or miner
        }
        
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
        
        const pop = Planet.countPopulationWorkerTypes(p);

        if (pop[CitizenWorkerType.Farmer] < p.population.length) {
            rpt.amountNextWorkerPerTurn.food = rpt.baseAmountPerWorkerPerTurn.food;
        }

        if (pop[CitizenWorkerType.Miner] < p.population.length) {
            rpt.amountNextWorkerPerTurn.ore = rpt.baseAmountPerWorkerPerTurn.ore;
            rpt.amountNextWorkerPerTurn.iridium = rpt.baseAmountPerWorkerPerTurn.iridium;
        }

        if (pop[CitizenWorkerType.Builder] < p.population.length) {
            rpt.amountNextWorkerPerTurn.production = rpt.baseAmountPerWorkerPerTurn.production;
        }

        //determine production per turn
        rpt.amountPerTurn.food = rpt.baseAmountPerWorkerPerTurn.food * pop[CitizenWorkerType.Farmer];
        rpt.amountPerTurn.ore = rpt.baseAmountPerWorkerPerTurn.ore * pop[CitizenWorkerType.Miner];
        rpt.amountPerTurn.iridium = rpt.baseAmountPerWorkerPerTurn.iridium * pop[CitizenWorkerType.Miner];
        rpt.amountPerTurn.production = rpt.baseAmountPerWorkerPerTurn.production * pop[CitizenWorkerType.Builder];

        if(Planet.builtImprovementCount(p) > 0) {

        }

        rpt.amountPerWorkerPerTurn.food = pop[CitizenWorkerType.Farmer] ? rpt.amountPerTurn.food / pop[CitizenWorkerType.Farmer] : 0;
        rpt.amountPerWorkerPerTurn.ore = pop[CitizenWorkerType.Miner] ? rpt.amountPerTurn.ore / pop[CitizenWorkerType.Miner] : 0;
        rpt.amountPerWorkerPerTurn.iridium = pop[CitizenWorkerType.Miner] ? rpt.amountPerTurn.iridium / pop[CitizenWorkerType.Miner] : 0;
        rpt.amountPerWorkerPerTurn.production = pop[CitizenWorkerType.Builder] ? rpt.amountPerTurn.production / pop[CitizenWorkerType.Builder] : 0;
    }

    public static builtImprovementCount(p: PlanetData):number {
        return p.builtImprovements[PlanetImprovementType.Colony] + p.builtImprovements[PlanetImprovementType.Factory] + p.builtImprovements[PlanetImprovementType.Farm] + p.builtImprovements[PlanetImprovementType.Mine];
    }

    public static countPopulationWorkerTypes(p: PlanetData): PopulationAssignments {
        const pop: PopulationAssignments = {[CitizenWorkerType.Farmer]: 0, [CitizenWorkerType.Miner]: 0, [CitizenWorkerType.Builder]: 0};

        const citizens = Planet.getPopulationByContentment(p);

        return citizens.content.reduce((accum, curr) => {
            accum[curr.workerType]++;
            return accum;
        }, pop);
    }

    public static getPopulationByContentment(p: PlanetData): PopulationByContentment {
        const protesting: Citizen[] = []
        const content: Citizen[] = []
        for (const citizen of p.population) {
          if (citizen.protestLevel > 0) {
            protesting.push(citizen);
          } else {
            content.push(citizen);
          }
        }
        return { protesting, content };
      };
}
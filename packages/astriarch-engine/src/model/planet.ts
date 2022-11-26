import { PointData } from "../shapes/shapes";
import { FleetData, StarShipType } from "./fleet";

export interface Citizen {
  populationChange: number; //between -1 and 1, when this gets >= -1 then we loose one pop, > 1 we gain one pop
  loyalToPlayerId: string; //this allows us to remove the protest level when ownership of the planet reverts to this player, after protest level hits 0, this should be reset to the current owner
  protestLevel: number; //between 0 and 1, 0 means they are able to work, anything above this means they are busy protesting the government rule
  workerType: CitizenWorkerType;
}

export interface PlanetResources {
  food: number;
  energy: number;
  ore: number;
  iridium: number;
  production: number;
}

export enum PlanetImprovementType {
  Factory = 1, //increases the speed of building other improvements and ships (and allows for building destroyers and the space platform)
  Colony = 2, //increases the max population
  Farm = 3, //increases food production
  Mine = 4, //increases the rate of raw minerals production
}

export enum PlanetType {
  AsteroidBelt = 1,
  DeadPlanet = 2,
  PlanetClass1 = 3,
  PlanetClass2 = 4,
}

export enum PlanetHappinessType {
  Normal = 1,
  Unrest = 2,
  Riots = 3,
}

export enum CitizenWorkerType {
  Farmer = 1,
  Miner = 2,
  Builder = 3,
}

export enum PlanetProductionItemType {
  PlanetImprovement = 1,
  StarShipInProduction = 2,
  PlanetImprovementToDestroy = 3,
}

export interface PlanetProductionItemData {
  turnsToComplete: number; //once this is built turns to complete will be 0 and will go into the built improvements for the planet
  productionCostComplete: number; //this is how much of the BaseProductionCost we've completed
  baseProductionCost: number; //this will translate into Turns to Complete based on population, factories, etc...

  energyCost: number;
  oreCost: number;
  iridiumCost: number;
}

export interface PlanetData {
  id: number;
  name: string;
  type: PlanetType;
  population: Citizen[];
  buildQueue: PlanetProductionItemData[];
  builtImprovements: { [T in PlanetImprovementType]: number };
  maxImprovements: number;
  resources: PlanetResources;
  originPoint: PointData;
  boundingHexMidPoint: PointData;
  planetaryFleet: FleetData;
  outgoingFleets: FleetData[];
  planetHappiness: PlanetHappinessType;
  starshipTypeLastBuilt: StarShipType | null;
  starshipCustomShipLastBuilt: boolean;
  buildLastStarShip: boolean;
  waypointPlanetId: number | null;
}

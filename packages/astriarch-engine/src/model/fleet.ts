import { PointData } from '../shapes/shapes';

export enum StarShipType {
  SystemDefense = 1, //System defense ships are not equiped with hyperdrive and cannot leave the system they are in
  Scout = 2,
  Destroyer = 3,
  Cruiser = 4,
  Battleship = 5,
  SpacePlatform = 6, //provides defense for the planet, further speeds ship production and allows for cruiser and battleship production
}

export interface StarshipAdvantageData {
  advantageAgainst: StarShipType;
  disadvantageAgainst: StarShipType;
}

export interface StarshipData {
  id: number;
  type: StarShipType;
  customShipData?: StarshipAdvantageData;
  health: number;
  experienceAmount: number;
}

export interface FleetData {
  starships: StarshipData[];
  locationHexMidPoint: PointData | null;
  travelingFromHexMidPoint: PointData | null;
  destinationHexMidPoint: PointData | null;
  parsecsToDestination: number | null;
  totalTravelDistance: number | null;
}

export interface LastKnownFleetData {
  cycleLastExplored: number;
  fleetData: FleetData;
  lastKnownOwnerId: string | undefined;
}

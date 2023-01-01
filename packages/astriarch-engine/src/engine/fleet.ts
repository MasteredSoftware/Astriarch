import { EarnedPointsType } from "../model/earnedPoints";
import { FleetData, LastKnownFleetData, StarshipAdvantageData, StarshipData, StarShipType } from "../model/fleet";
import { PlayerData } from "../model/player";
import { PointData } from "../shapes/shapes";
import { Grid } from "./grid";
import { Player } from "./player";

export type StarshipsByType = { [T in StarShipType]: StarshipData[] };

export interface StarshipTypeCounts {
  defenders: number;
  scouts: number;
  destroyers: number;
  cruisers: number;
  battleships: number;
  spaceplatforms: number;
}

export class Fleet {
  private static NEXT_STARSHIP_ID = 1;
  public static generateFleetWithShipCount(
    defenders: number,
    scouts: number,
    destroyers: number,
    cruisers: number,
    battleships: number,
    spaceplatforms: number,
    locationHexMidPoint: PointData | null
  ): FleetData {
    const starships = [
      ...Fleet.generateStarships(StarShipType.SystemDefense, defenders),
      ...Fleet.generateStarships(StarShipType.Scout, scouts),
      ...Fleet.generateStarships(StarShipType.Destroyer, destroyers),
      ...Fleet.generateStarships(StarShipType.Cruiser, cruisers),
      ...Fleet.generateStarships(StarShipType.Battleship, battleships),
      ...Fleet.generateStarships(StarShipType.SpacePlatform, spaceplatforms),
    ];

    return {
      starships,
      locationHexMidPoint,
      travelingFromHexMidPoint: null,
      destinationHexMidPoint: null,
      parsecsToDestination: null,
      totalTravelDistance: null,
    };
  }

  public static generateInitialFleet(defenders: number, locationHexMidPoint: PointData): FleetData {
    return Fleet.generateFleetWithShipCount(defenders, 0, 0, 0, 0, 0, locationHexMidPoint);
  }

  public static generateStarships(type: StarShipType, count: number): StarshipData[] {
    const ships = [];
    for (let i = 0; i < count; i++) {
      ships.push(Fleet.generateStarship(type));
    }
    return ships;
  }

  public static generateStarship(type: StarShipType): StarshipData {
    //ship strength is based on ship cost
    //  right now it is double the value of the next lower ship class
    //maybe later: + 50% (rounded up) of the next lower ship cost
    //each system defender is worth 2
    //each scout is worth 4 points
    //each destroyer is worth 8
    //each cruiser is worth 16
    //each battleship is worth 32

    //here are the advantages (-> means has an advantage over):
    //space platforms -> all
    //battleships -> cruisers -> destroyers -> scouts -> defenders (-> battleships)
    let baseStarShipStrength = 0;

    switch (type) {
      case StarShipType.SystemDefense:
        baseStarShipStrength = 2;
        break;
      case StarShipType.Scout:
        baseStarShipStrength = 4;
        break;
      case StarShipType.Destroyer:
        baseStarShipStrength = 8;
        break;
      case StarShipType.Cruiser:
        baseStarShipStrength = 16;
        break;
      case StarShipType.Battleship:
        baseStarShipStrength = 32;
        break;
      case StarShipType.SpacePlatform:
        baseStarShipStrength = 64;
        break;
    }

    return {
      id: Fleet.NEXT_STARSHIP_ID++,
      type,
      health: baseStarShipStrength, //starships will heal between turns if the planet has the necessary building and the player has the requisite resources
      experienceAmount: 0, //each time a starship damages an opponent the experience amount increases by the damage amount
    };
  }

  public static getStarshipStandardAdvantageByType(type: StarShipType): StarshipAdvantageData | undefined {
    let advantageAgainst = null;
    let disadvantageAgainst = null;

    switch (type) {
      case StarShipType.SystemDefense:
        advantageAgainst = StarShipType.Battleship;
        disadvantageAgainst = StarShipType.Scout;
        break;
      case StarShipType.Scout:
        advantageAgainst = StarShipType.SystemDefense;
        disadvantageAgainst = StarShipType.Destroyer;
        break;
      case StarShipType.Destroyer:
        advantageAgainst = StarShipType.Scout;
        disadvantageAgainst = StarShipType.Cruiser;
        break;
      case StarShipType.Cruiser:
        advantageAgainst = StarShipType.Destroyer;
        disadvantageAgainst = StarShipType.Battleship;
        break;
      case StarShipType.Battleship:
        advantageAgainst = StarShipType.Cruiser;
        disadvantageAgainst = StarShipType.SystemDefense;
        break;
      case StarShipType.SpacePlatform:
        return undefined;
        break;
    }
    return {
      advantageAgainst,
      disadvantageAgainst,
    };
  }

  public static starshipTypeIsMobile(type: StarShipType): boolean {
    return ![StarShipType.SystemDefense, StarShipType.SpacePlatform].includes(type);
  }

  /**
   * Calculates the strength of the fleet
   */
  public static determineFleetStrength(fleet: FleetData, mobileOnly?: boolean) {
    let starships = fleet.starships;
    if (mobileOnly) {
      starships = starships.filter((s) => this.starshipTypeIsMobile(s.type));
    }

    const strength = starships.reduce((accum, curr) => accum + curr.health, 0);

    return strength;
  }

  public static getStarshipsByType(fleet: FleetData): StarshipsByType {
    const starshipsByType = Object.values(StarShipType).reduce((accum, curr) => {
      accum[curr as StarShipType] = [];
      return accum;
    }, {} as StarshipsByType);
    return fleet.starships.reduce((accum, curr) => {
      accum[curr.type].push(curr);
      return accum;
    }, starshipsByType);
  }

  public static countStarshipsByType(fleet: FleetData): StarshipTypeCounts {
    const ships = Fleet.getStarshipsByType(fleet);
    return {
      defenders: ships[StarShipType.SystemDefense].length,
      scouts: ships[StarShipType.Scout].length,
      destroyers: ships[StarShipType.Destroyer].length,
      cruisers: ships[StarShipType.Cruiser].length,
      battleships: ships[StarShipType.Battleship].length,
      spaceplatforms: ships[StarShipType.SpacePlatform].length,
    };
  }

  public static countMobileStarships(fleet: FleetData): number {
    const counts = this.countStarshipsByType(fleet);
    return counts.scouts + counts.destroyers + counts.cruisers + counts.battleships;
  }

  /**
   * Creates a new fleet with the number of ships specified, removing the ships from the fleet passed in
   */
  public static splitFleet(
    fleet: FleetData,
    scouts: number,
    destoyers: number,
    cruisers: number,
    battleships: number
  ): FleetData {
    const newFleet = this.generateFleetWithShipCount(0, 0, 0, 0, 0, 0, fleet.locationHexMidPoint);
    const starshipsByType = this.getStarshipsByType(fleet);

    for (let i = 0; i < Math.min(scouts, starshipsByType[StarShipType.Scout].length); i++) {
      newFleet.starships.push(starshipsByType[StarShipType.Scout].shift()!);
    }
    for (let i = 0; i < Math.min(destoyers, starshipsByType[StarShipType.Destroyer].length); i++) {
      newFleet.starships.push(starshipsByType[StarShipType.Destroyer].shift()!);
    }
    for (let i = 0; i < Math.min(cruisers, starshipsByType[StarShipType.Cruiser].length); i++) {
      newFleet.starships.push(starshipsByType[StarShipType.Cruiser].shift()!);
    }
    for (let i = 0; i < Math.min(battleships, starshipsByType[StarShipType.Battleship].length); i++) {
      newFleet.starships.push(starshipsByType[StarShipType.Battleship].shift()!);
    }

    fleet.starships = [
      ...starshipsByType[StarShipType.SystemDefense],
      ...starshipsByType[StarShipType.Scout],
      ...starshipsByType[StarShipType.Destroyer],
      ...starshipsByType[StarShipType.Cruiser],
      ...starshipsByType[StarShipType.Battleship],
      ...starshipsByType[StarShipType.SpacePlatform],
    ];

    return newFleet;
  }

  /**
   * Splits this fleet off in a fleet that contains one weak ship
   */
  public static splitOffSmallestPossibleFleet(fleet: FleetData): FleetData | undefined {
    let newFleet;
    let scoutCount = 0;
    let destroyerCount = 0;
    let cruiserCount = 0;
    let battleshipCount = 0;
    const starshipCounts = this.countStarshipsByType(fleet);

    if (starshipCounts.scouts !== 0) scoutCount = 1;
    else if (starshipCounts.destroyers !== 0) destroyerCount = 1;
    else if (starshipCounts.cruisers !== 0) cruiserCount = 1;
    else if (starshipCounts.battleships !== 0) battleshipCount = 1;

    if (scoutCount !== 0 || destroyerCount !== 0 || cruiserCount !== 0 || battleshipCount !== 0)
      newFleet = this.splitFleet(fleet, scoutCount, destroyerCount, cruiserCount, battleshipCount);

    return newFleet;
  }

  /**
   * Sets the destimation hex for a fleet
   */
  public static setDestination(
    fleet: FleetData,
    gameGrid: Grid,
    locationHexMidPoint: PointData,
    destinationHexMidPoint: PointData
  ) {
    fleet.locationHexMidPoint = locationHexMidPoint;
    fleet.destinationHexMidPoint = destinationHexMidPoint;

    fleet.totalTravelDistance = Grid.getHexDistanceForMidPoints(gameGrid, locationHexMidPoint, destinationHexMidPoint);
    fleet.parsecsToDestination = fleet.totalTravelDistance;
  }

  /**
   * Simply remove ships with strength <= 0
   */
  public static reduceFleet = function (fleet: FleetData) {
    //if a starship's health is at 0 it's destroyed
    fleet.starships = fleet.starships.filter((s) => s.health > 0);
  };

  /**
   * Reduce a ship's strength / health
   */
  public static damageStarship(owner: PlayerData, starship: StarshipData, damageAmount: number): number {
    var damageInflicted = Math.min(starship.health, damageAmount);
    starship.health -= damageInflicted;
    //assign points
    Player.increasePoints(owner, EarnedPointsType.DAMAGED_STARSHIP_STRENGTH, damageInflicted);

    return damageInflicted;
  }

  /**
   * Copies this fleet
   */
  public static cloneFleet(fleet: FleetData): FleetData {
    const f = this.generateFleetWithShipCount(0, 0, 0, 0, 0, 0, fleet.locationHexMidPoint);

    for (const s of fleet.starships) {
      f.starships.push(this.cloneStarship(s));
    }

    return f;
  }

  /**
   * Copies the properties of this starship
   */
  public static cloneStarship(starship: StarshipData): StarshipData {
    const s = this.generateStarship(starship.type);
    s.health = starship.health;
    s.experienceAmount = starship.experienceAmount;
    if (starship.customShipData) {
      s.customShipData = { ...starship.customShipData };
    }
    return s;
  }

  public static constructLastKnownFleet(
    cycleLastExplored: number,
    fleetData: FleetData,
    lastKnownOwnerId: string | null
  ): LastKnownFleetData {
    return {
      cycleLastExplored,
      fleetData,
      lastKnownOwnerId,
    };
  }
}

import { EarnedPointsType } from '../model/earnedPoints';
import { FleetData, LastKnownFleetData, StarshipAdvantageData, StarshipData, StarShipType } from '../model/fleet';
import { PlanetData, PlanetImprovementType } from '../model/planet';
import { PlayerData } from '../model/player';
import { ResearchType } from '../model/research';
import { PointData } from '../shapes/shapes';
import { GameTools } from '../utils/gameTools';
import { Grid } from './grid';
import { Player } from './player';
import { Research } from './research';

export type StarshipsByType = Record<StarShipType, StarshipData[]>;

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
  public static generateFleet(starships: StarshipData[], locationHexMidPoint: PointData | null) {
    return {
      starships,
      locationHexMidPoint,
      travelingFromHexMidPoint: null,
      destinationHexMidPoint: null,
      parsecsToDestination: null,
      totalTravelDistance: null,
    };
  }

  public static generateFleetWithShipCount(
    defenders: number,
    scouts: number,
    destroyers: number,
    cruisers: number,
    battleships: number,
    spaceplatforms: number,
    locationHexMidPoint: PointData | null,
  ): FleetData {
    const starships = [
      ...Fleet.generateStarships(StarShipType.SystemDefense, defenders),
      ...Fleet.generateStarships(StarShipType.Scout, scouts),
      ...Fleet.generateStarships(StarShipType.Destroyer, destroyers),
      ...Fleet.generateStarships(StarShipType.Cruiser, cruisers),
      ...Fleet.generateStarships(StarShipType.Battleship, battleships),
      ...Fleet.generateStarships(StarShipType.SpacePlatform, spaceplatforms),
    ];

    return this.generateFleet(starships, locationHexMidPoint);
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

  public static getStarshipTypeBaseStrength(type: StarShipType) {
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
    return baseStarShipStrength;
  }

  public static generateStarship(type: StarShipType, customShipData?: StarshipAdvantageData): StarshipData {
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

    return {
      id: Fleet.NEXT_STARSHIP_ID++,
      type,
      customShipData,
      health: this.getStarshipTypeBaseStrength(type), //starships will heal between turns if the planet has the necessary building and the player has the requisite resources
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
    battleships: number,
  ): FleetData {
    const newFleet = this.generateFleet([], fleet.locationHexMidPoint);
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
   * Creates a new fleet by removing specific ships by ID from the source fleet
   * Used when players select specific ships to send
   */
  public static splitFleetByShipIds(
    fleet: FleetData,
    shipIds: {
      scouts: number[];
      destroyers: number[];
      cruisers: number[];
      battleships: number[];
    },
  ): FleetData {
    const newFleet = this.generateFleet([], fleet.locationHexMidPoint);

    const moveShipsToFleet = (ids: number[], targetType: StarShipType) => {
      for (const shipId of ids) {
        const shipIndex = fleet.starships.findIndex((s) => s.id === shipId && s.type === targetType);
        if (shipIndex !== -1) {
          const ship = fleet.starships.splice(shipIndex, 1)[0];
          newFleet.starships.push(ship);
        }
      }
    };

    moveShipsToFleet(shipIds.scouts, StarShipType.Scout);
    moveShipsToFleet(shipIds.destroyers, StarShipType.Destroyer);
    moveShipsToFleet(shipIds.cruisers, StarShipType.Cruiser);
    moveShipsToFleet(shipIds.battleships, StarShipType.Battleship);

    return newFleet;
  }

  /**
   * Launches a fleet from a source planet to a destination planet
   * Splits ships from the planetary fleet, sets destination, and adds to outgoing fleets
   */
  public static launchFleetToPlanet(
    sourcePlanet: import('../model/planet').PlanetData,
    destPlanet: import('../model/clientModel').ClientPlanet,
    grid: Grid,
    shipIds: {
      scouts: number[];
      destroyers: number[];
      cruisers: number[];
      battleships: number[];
    },
  ): FleetData {
    // Split the fleet by specific ship IDs
    const newFleet = this.splitFleetByShipIds(sourcePlanet.planetaryFleet, shipIds);

    // Set the destination for the new fleet
    this.setDestination(newFleet, grid, sourcePlanet.boundingHexMidPoint, destPlanet.boundingHexMidPoint);

    // Add the fleet to the source planet's outgoing fleets
    sourcePlanet.outgoingFleets.push(newFleet);

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
    destinationHexMidPoint: PointData,
  ) {
    fleet.locationHexMidPoint = locationHexMidPoint;
    fleet.destinationHexMidPoint = destinationHexMidPoint;
    fleet.travelingFromHexMidPoint = locationHexMidPoint;

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
  public static damageStarship(owner: PlayerData | undefined, starship: StarshipData, damageAmount: number): number {
    const damageInflicted = Math.min(starship.health, damageAmount);
    starship.health -= damageInflicted;
    //assign points
    if (owner) {
      Player.increasePoints(owner, EarnedPointsType.DAMAGED_STARSHIP_STRENGTH, damageInflicted);
    }
    return damageInflicted;
  }

  /**
   * Repairs a fleet
   */
  public static repairPlanetaryFleet(planet: PlanetData, maxStrengthToRepair: number, cyclesElapsed: number) {
    let totalStrengthRepaired = 0;
    let amountRepaired = 0;
    let allEligibleStarShips: StarshipData[] = [];

    const starshipsByType = this.getStarshipsByType(planet.planetaryFleet);

    if (planet.builtImprovements[PlanetImprovementType.Factory] > 0) {
      allEligibleStarShips = allEligibleStarShips.concat(starshipsByType[StarShipType.Destroyer]);
      //cruisers and battleships need a factory and a spaceplatform for repairs
      if (starshipsByType[StarShipType.SpacePlatform].length > 0) {
        allEligibleStarShips = allEligibleStarShips.concat(starshipsByType[StarShipType.Battleship]);
        allEligibleStarShips = allEligibleStarShips.concat(starshipsByType[StarShipType.Cruiser]);
      }
      allEligibleStarShips = allEligibleStarShips.concat(starshipsByType[StarShipType.SpacePlatform]);
    }
    allEligibleStarShips = allEligibleStarShips.concat(starshipsByType[StarShipType.Scout]);
    allEligibleStarShips = allEligibleStarShips.concat(starshipsByType[StarShipType.SystemDefense]);

    for (const s of allEligibleStarShips) {
      // ships should only be able to repair at most 50% of their base strength per turn
      const maxToRepairForShip = this.getStarshipTypeBaseStrength(s.type) * 0.5 * cyclesElapsed;
      amountRepaired = this.repairStarShip(s, Math.min(maxToRepairForShip, maxStrengthToRepair));
      totalStrengthRepaired += amountRepaired;
      maxStrengthToRepair -= amountRepaired;
      if (maxStrengthToRepair <= 0) {
        break;
      }
    }

    return totalStrengthRepaired;
  }

  /**
   * Repairs a starship up to max strength to repair
   */
  public static repairStarShip(ship: StarshipData, maxStrengthToRepair: number) {
    const damageAmount = this.maxStrength(ship) - ship.health;
    const amountRepaired = Math.min(maxStrengthToRepair, damageAmount);
    ship.health += amountRepaired;
    return amountRepaired;
  }

  /**
   * Get a starships's maximum Strength (not including damage)
   */
  public static maxStrength(ship: StarshipData) {
    const baseStrength = this.getStarshipTypeBaseStrength(ship.type);
    return baseStrength + this.strengthBoostFromLevel(ship, baseStrength);
  }

  /**
   * Get a starships's level strength boost
   */
  public static strengthBoostFromLevel(ship: StarshipData, baseStrength: number) {
    const level = this.starShipLevel(ship, baseStrength).level;
    if (level <= 2) {
      return Math.round(level * (baseStrength / 8.0));
    }
    //at some level the ship's strength should be about 2 times it's base strength
    //well use the log function to figure out at a given level for a certain ship what the proper boost should be
    const x = 9; //the target level (which is somewhat difficult to achieve)
    const y = baseStrength * 1.0;
    const b = Math.pow(x, 1 / y);
    return Math.round(Math.log(level) / Math.log(b)); //b^y=x
  }

  /**
   * Get a starships's level based on experience points
   */
  public static starShipLevel(ship: StarshipData, baseStrength: number) {
    let level = -1;
    let levelExpRequirement = baseStrength / 2;
    //for the ship to make it to level 1 it must have 1/2 the base strength in experience points
    // after that the experience needed for each level = previous level exp + round((previous level exp)/2);
    let foundLevel = false;
    while (!foundLevel) {
      if (ship.experienceAmount < levelExpRequirement) {
        foundLevel = true;
      }
      levelExpRequirement += levelExpRequirement + Math.round(levelExpRequirement / 2);
      level++;
    }
    return { level, nextLevelExpRequirement: levelExpRequirement };
  }

  /**
   * Lands a fleet on a planet
   *  the caller is responsible for removing the landing fleet
   */
  public static landFleet = function (planetaryFleet: FleetData, landingFleet: FleetData) {
    // NOTE: this isn't technically necessary since we're going to merge these fleets
    landingFleet.travelingFromHexMidPoint = null;
    landingFleet.destinationHexMidPoint = null;
    landingFleet.parsecsToDestination = 0;

    // merge fleet
    planetaryFleet.starships = planetaryFleet.starships.concat(landingFleet.starships);
  };

  /**
   * Gets parsec / cycle speed based on research
   */
  public static getSpeed(owner: PlayerData) {
    return Research.getResearchBoostForEfficiencyImprovement(ResearchType.PROPULSION_IMPROVEMENT, owner);
  }

  public static getTurnsToDestination(fleet: FleetData, owner: PlayerData) {
    return (fleet.parsecsToDestination || 0) / this.getSpeed(owner);
  }

  /**
   * Moves a fleet
   */
  public static moveFleet(fleet: FleetData, owner: PlayerData, cyclesElapsed: number) {
    if (fleet.parsecsToDestination === null || fleet.parsecsToDestination === undefined) {
      throw new Error('Unable to move fleet until parsecsToDestination is set');
    }
    fleet.locationHexMidPoint = null;
    //TODO: should this update the location hex to a closer hex as well?

    fleet.parsecsToDestination -= this.getSpeed(owner) * cyclesElapsed;
  }

  /**
   * Copies this fleet
   */
  public static cloneFleet(fleet: FleetData): FleetData {
    const f = this.generateFleet([], fleet.locationHexMidPoint);

    for (const s of fleet.starships) {
      f.starships.push(this.cloneStarship(s));
    }

    return f;
  }

  /**
   * A printable version of the fleet
   */
  public static toString(fleet: FleetData) {
    const shipsByType = Fleet.getStarshipsByType(fleet);
    const customCountsByType = Object.entries(shipsByType).reduce(
      (accum, [currType, currShips]) => {
        const key = parseInt(currType) as StarShipType;
        if (!(key in accum)) {
          accum[key] = { standard: 0, custom: 0 };
        }
        accum[key].custom = currShips.filter((s) => !!s.customShipData).length;
        accum[key].standard = currShips.length - accum[key].custom;
        return accum;
      },
      {} as Record<StarShipType, { standard: number; custom: number }>,
    );

    const fleetSummary = Object.entries(customCountsByType).reduce((accum, [currType, currCounts]) => {
      const key = parseInt(currType) as StarShipType;
      if (currCounts.standard) {
        if (accum != '') accum += ', ';
        accum += `${currCounts.standard} ${GameTools.starShipTypeToFriendlyName(key, false)}${
          currCounts.standard > 1 ? 's' : ''
        }`;
      }
      if (currCounts.custom) {
        if (accum != '') accum += ', ';
        accum += `${currCounts.custom} ${GameTools.starShipTypeToFriendlyName(key, true)}${currCounts.custom > 1 ? 's' : ''}`;
      }
      return accum;
    }, '');

    return fleetSummary || 'No Ships';
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
    lastKnownOwnerId: string | undefined,
  ): LastKnownFleetData {
    return {
      cycleLastExplored,
      fleetData,
      lastKnownOwnerId,
    };
  }
}

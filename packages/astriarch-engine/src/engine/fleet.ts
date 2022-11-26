import { FleetData, StarshipData, StarShipType } from "../model/fleet";
import { PointData } from "../shapes/shapes";

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
    };
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
    let advantageAgainstType = null;
    let disadvantageAgainstType = null;

    switch (type) {
      case StarShipType.SystemDefense:
        baseStarShipStrength = 2;
        advantageAgainstType = StarShipType.Battleship;
        disadvantageAgainstType = StarShipType.Scout;
        break;
      case StarShipType.Scout:
        baseStarShipStrength = 4;
        advantageAgainstType = StarShipType.SystemDefense;
        disadvantageAgainstType = StarShipType.Destroyer;
        break;
      case StarShipType.Destroyer:
        baseStarShipStrength = 8;
        advantageAgainstType = StarShipType.Scout;
        disadvantageAgainstType = StarShipType.Cruiser;
        break;
      case StarShipType.Cruiser:
        baseStarShipStrength = 16;
        advantageAgainstType = StarShipType.Destroyer;
        disadvantageAgainstType = StarShipType.Battleship;
        break;
      case StarShipType.Battleship:
        baseStarShipStrength = 32;
        advantageAgainstType = StarShipType.Cruiser;
        disadvantageAgainstType = StarShipType.SystemDefense;
        break;
      case StarShipType.SpacePlatform:
        baseStarShipStrength = 64;
        break;
    }

    return {
      id: Fleet.NEXT_STARSHIP_ID++,
      type,
      customShip: false,
      advantageAgainstType,
      disadvantageAgainstType,
      health: baseStarShipStrength, //starships will heal between turns if the planet has the necessary building and the player has the requisite resources
      experienceAmount: 0, //each time a starship damages an opponent the experience amount increases by the damage amount
    };
  }
}

import { StarShipType } from "../model/fleet";
import { PlanetImprovementType, PlanetType } from "../model/planet";

export class GameTools {
  public static starShipTypeToFriendlyName(t: StarShipType) {
    let name = "";
    switch (t) {
      case StarShipType.SystemDefense:
        name = "Defender";
        break;
      case StarShipType.Scout:
        name = "Scout";
        break;
      case StarShipType.Destroyer:
        name = "Destroyer";
        break;
      case StarShipType.Cruiser:
        name = "Cruiser";
        break;
      case StarShipType.Battleship:
        name = "Battleship";
        break;
      case StarShipType.SpacePlatform:
        name = "Space Platform";
        break;
    }
    return name;
  }

  public static planetImprovementTypeToFriendlyName(t: PlanetImprovementType): string {
    let name = "";
    switch (t) {
      case PlanetImprovementType.Factory:
        name = "Factory";
        break;
      case PlanetImprovementType.Colony:
        name = "Colony";
        break;
      case PlanetImprovementType.Farm:
        name = "Farm";
        break;
      case PlanetImprovementType.Mine:
        name = "Mine";
        break;
    }
    return name;
  }

  public static planetTypeToFriendlyName(t: PlanetType): string {
    let name = "";
    switch (t) {
      case PlanetType.DeadPlanet:
        name = "Dead";
        break;
      case PlanetType.PlanetClass1:
        name = "Arid";
        break;
      case PlanetType.PlanetClass2:
        name = "Terrestrial";
        break;
      case PlanetType.AsteroidBelt:
        name = "Asteroid Belt";
        break;
    }
    return name;
  }
}

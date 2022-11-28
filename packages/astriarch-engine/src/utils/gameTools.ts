import { StarShipType } from "../model/fleet";

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
}

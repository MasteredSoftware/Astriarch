import { PlanetResourceData } from "../model/planet";

export class PlanetResources {
  public static constructPlanetResources(
    food: number,
    energy: number,
    ore: number,
    iridium: number,
    production: number
  ): PlanetResourceData {
    return {
      food,
      energy,
      ore,
      iridium,
      production,
    };
  }

  public static addPlanetResources(r1: PlanetResourceData, r2: PlanetResourceData): PlanetResourceData {
    return {
      food: r1.food + r2.food,
      energy: r1.energy + r2.energy,
      ore: r1.ore + r2.ore,
      iridium: r1.iridium + r2.iridium,
      production: r1.production + r2.production,
    };
  }
}

import { PlanetResourceData } from "../model/planet";

export class PlanetResources {
  public static constructPlanetResources(
    food: number,
    energy: number,
    research: number,
    ore: number,
    iridium: number,
    production: number
  ): PlanetResourceData {
    return {
      food,
      energy,
      research,
      ore,
      iridium,
      production,
    };
  }

  public static addPlanetResources(r1: PlanetResourceData, r2: PlanetResourceData): PlanetResourceData {
    return {
      food: r1.food + r2.food,
      energy: r1.energy + r2.energy,
      research: r1.research + r2.research,
      ore: r1.ore + r2.ore,
      iridium: r1.iridium + r2.iridium,
      production: r1.production + r2.production,
    };
  }
}

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

  public static spendEnergyAsPossible(r: PlanetResourceData, amount: number) {
    if (r.energy >= amount) {
      r.energy = r.energy - amount;
      return amount;
    }
    const spent = r.energy;
    r.energy = 0;
    return spent;
  }

  public static spendFoodAsPossible(r: PlanetResourceData, amount: number) {
    if (r.food >= amount) {
      r.food = r.food - amount;
      return amount;
    }
    const spent = r.food;
    r.food = 0;
    return spent;
  }

  public static spendOreAsPossible(r: PlanetResourceData, amount: number) {
    if (r.ore >= amount) {
      r.ore = r.ore - amount;
      return amount;
    }
    const spent = r.ore;
    r.ore = 0;
    return spent;
  }

  public static spendIridiumAsPossible(r: PlanetResourceData, amount: number) {
    if (r.iridium >= amount) {
      r.iridium = r.iridium - amount;
      return amount;
    }
    const spent = r.iridium;
    r.iridium = 0;
    return spent;
  }
}

import { PlanetData, PlanetResourceType } from "../model/planet";
import { Utils } from "../utils/utils";
import { PlanetResourcesPerTurn } from "./computerPlayer";

/**
 * A sort function object to prefer planets with higher resource generation potential
 */
export class PlanetResourcePotentialComparer {
  planetResourcesPerTurn: PlanetResourcesPerTurn;
  resourceTypeToPrefer: PlanetResourceType;

  constructor(planetResourcesPerTurn: PlanetResourcesPerTurn, resourceTypeToPrefer: PlanetResourceType) {
    this.planetResourcesPerTurn = planetResourcesPerTurn;
    this.resourceTypeToPrefer = resourceTypeToPrefer;
  }

  /**
   * sort function for planet distances
   * @param a
   * @param b
   * @returns
   */
  public sortFunction(a: PlanetData, b: PlanetData): number {
    const nextWorkerPlanetA = this.planetResourcesPerTurn[a.id].amountNextWorkerPerTurn;
    const nextWorkerPlanetB = this.planetResourcesPerTurn[b.id].amountNextWorkerPerTurn;
    switch (this.resourceTypeToPrefer) {
      case PlanetResourceType.FOOD:
        return Utils.compareNumbers(nextWorkerPlanetB.food, nextWorkerPlanetA.food);
        break;
      case PlanetResourceType.ORE:
        return Utils.compareNumbers(nextWorkerPlanetB.ore, nextWorkerPlanetA.ore);
        break;
      case PlanetResourceType.IRIDIUM:
        return Utils.compareNumbers(nextWorkerPlanetB.iridium, nextWorkerPlanetA.iridium);
        break;
      case PlanetResourceType.ENERGY:
        return Utils.compareNumbers(nextWorkerPlanetB.energy, nextWorkerPlanetA.energy);
        break;
      case PlanetResourceType.PRODUCTION:
        return Utils.compareNumbers(nextWorkerPlanetB.production, nextWorkerPlanetA.production);
        break;
      case PlanetResourceType.RESEARCH:
        return Utils.compareNumbers(nextWorkerPlanetB.research, nextWorkerPlanetA.research);
        break;
    }
  }
}

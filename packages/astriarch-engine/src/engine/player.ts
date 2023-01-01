import { PlanetById } from "../model/clientModel";
import { EarnedPointsType, earnedPointsConfigByType } from "../model/earnedPoints";
import { PlanetData, PlanetImprovementType } from "../model/planet";
import { ColorRgbaData, EarnedPointsByType, PlayerData, PlayerType } from "../model/player";
import { ResearchType } from "../model/research";
import { Fleet } from "./fleet";
import { Grid } from "./grid";
import { Planet } from "./planet";
import { PlanetResources } from "./planetResources";
import { Research } from "./research";

export class Player {
  public static constructPlayer(id: string, type: PlayerType, name: string, color: ColorRgbaData): PlayerData {
    const research = Research.constructResearch();
    const earnedPointsByType = Object.values(EarnedPointsType).reduce((accum, curr) => {
      accum[curr as EarnedPointsType] = 0;
      return accum;
    }, {} as EarnedPointsByType);
    return {
      id,
      type,
      name,
      research,
      color,
      lastTurnFoodNeededToBeShipped: 0,
      options: { showPlanetaryConflictPopups: false },
      ownedPlanetIds: [],
      knownPlanetIds: [],
      lastKnownPlanetFleetStrength: {},
      planetBuildGoals: {},
      homePlanetId: null,
      earnedPointsByType,
      points: 0,
      fleetsInTransit: [],
      destroyed: false,
    };
  }

  public static setPlanetExplored(
    p: PlayerData,
    planet: PlanetData,
    cycle: number,
    lastKnownOwnerId: string | undefined
  ) {
    p.knownPlanetIds.push(planet.id);
    p.knownPlanetIds = [...new Set(p.knownPlanetIds)];
    Player.setPlanetLastKnownFleetStrength(p, planet, cycle, lastKnownOwnerId);
  }

  public static setPlanetLastKnownFleetStrength(
    p: PlayerData,
    planet: PlanetData,
    cycle: number,
    lastKnownOwnerId: string | undefined
  ) {
    const { defenders, scouts, destroyers, cruisers, battleships, spaceplatforms } = Fleet.countStarshipsByType(
      planet.planetaryFleet
    );
    let lastKnownFleet = Fleet.generateFleetWithShipCount(
      defenders,
      scouts,
      destroyers,
      cruisers,
      battleships,
      spaceplatforms,
      planet.boundingHexMidPoint
    );
    let lastKnownFleetData = Fleet.constructLastKnownFleet(cycle, lastKnownFleet, lastKnownOwnerId);
    p.lastKnownPlanetFleetStrength[planet.id] = lastKnownFleetData;
  }

  public static advanceGameClockForPlayer(p: PlayerData, ownedPlanets: PlanetById, cyclesElapsed: number) {
    Player.generatePlayerResources(p, ownedPlanets, cyclesElapsed);

    Research.advanceResearchForPlayer(p, ownedPlanets);

    // TODO:
    // eatAndStarve
    // adjustPlayerPlanetProtestLevels
    // buildPlayerPlanetImprovements
    // growPlayerPlanetPopulation
  }

  public static generatePlayerResources(p: PlayerData, ownedPlanets: PlanetById, cyclesElapsed: number) {
    for (const planet of Object.values(ownedPlanets)) {
      Planet.generateResources(planet, cyclesElapsed, p);
    }
  }

  public static getTotalPopulation(p: PlayerData, ownedPlanets: PlanetById) {
    let totalPop = 0;

    for (const planetId of p.ownedPlanetIds) {
      totalPop += ownedPlanets[planetId].population.length;
    }

    return totalPop;
  }

  public static getTotalResourceAmount(p: PlayerData, ownedPlanets: PlanetById) {
    var totalResources = p.ownedPlanetIds
      .map((planetId) => ownedPlanets[planetId])
      .reduce((accum, curr) => {
        return PlanetResources.addPlanetResources(accum, curr.resources);
      }, PlanetResources.constructPlanetResources(0, 0, 0, 0, 0, 0));
    return totalResources;
  }

  /**
   * returns true if the planet already has reinforcements arriving
   */
  public static planetContainsFriendlyInboundFleet(p: PlayerData, planet: PlanetData) {
    for (var f of p.fleetsInTransit) {
      if (Grid.pointsAreEqual(f.destinationHexMidPoint, planet.boundingHexMidPoint)) {
        return true;
      }
    }

    return false;
  }

  /**
   * returns an array of the Owned Planets sorted by population and improvement count descending
   */
  public static getOwnedPlanetsListSorted(p: PlayerData, ownedPlanets: PlanetById): PlanetData[] {
    var sortedOwnedPlanets = p.ownedPlanetIds.map((planetId) => ownedPlanets[planetId]);
    sortedOwnedPlanets.sort(Planet.planetPopulationImprovementCountComparerSortFunction);
    return sortedOwnedPlanets;
  }

  /**
   * Increases the players points
   */
  public static increasePoints(p: PlayerData, type: EarnedPointsType, amount: number) {
    const config = earnedPointsConfigByType[type];

    const additionalPoints = config.pointsPer * amount;
    p.earnedPointsByType[type] = Math.min(p.earnedPointsByType[type] + additionalPoints, config.maxPoints);

    p.points = Object.values(p.earnedPointsByType).reduce((accum, curr) => accum + curr, 0);
    return p.points;
  }
}

import { PlanetById } from "../model/clientModel";
import { EarnedPointsType } from "../model/earnedPoints";
import { PlanetData, PlanetImprovementType } from "../model/planet";
import { ColorRgbaData, EarnedPointsByType, PlayerData, PlayerType } from "../model/player";
import { ResearchType } from "../model/research";
import { Fleet } from "./fleet";
import { Planet } from "./planet";
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

  public static setPlanetExplored(p: PlayerData, planet: PlanetData, cycle: number, lastKnownOwnerId: string | null) {
    p.knownPlanetIds.push(planet.id);
    p.knownPlanetIds = [...new Set(p.knownPlanetIds)];
    Player.setPlanetLastKnownFleetStrength(p, planet, cycle, lastKnownOwnerId);
  }

  public static setPlanetLastKnownFleetStrength(
    p: PlayerData,
    planet: PlanetData,
    cycle: number,
    lastKnownOwnerId: string | null
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
}

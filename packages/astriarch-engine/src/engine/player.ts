import { EarnedPointsType } from "../model/earnedPoints";
import { ColorRgbaData, EarnedPointsByType, PlayerData, PlayerType } from "../model/player";
import { Research } from "./research";


export class Player {
    public static constructPlayer(id: string, type: PlayerType, name: string, color: ColorRgbaData): PlayerData {
        const research = Research.constructResearch();
        const earnedPointsByType = Object.values(EarnedPointsType).reduce((accum, curr) => {
            return accum;
        }, {} as EarnedPointsByType);
        return {
            id,
            type,
            name,
            research,
            color,
            lastTurnFoodNeededToBeShipped: 0,
            options: {showPlanetaryConflictPopups: false},
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
}
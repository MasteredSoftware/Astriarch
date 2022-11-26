import { StarShipType } from "../model/fleet";
import { PlayerData } from "../model/player";
import { ResearchData, ResearchProgressByType, ResearchType, ResearchTypeProgress, ResearchTypeProgressData } from "../model/research";

const MAX_RESEARCH_LEVEL = 9;

export interface ResearchTypeData {
    type: ResearchType;
    researchPointsBase: number; //based on the type and data, some types are intrinsically more expensive
    isCustomShip: boolean;
    researchLevelCosts: number[];
}

export type ResearchTypeIndex = {[T in ResearchType]: ResearchTypeData};

export class Research {

    public static researchTypeIndex: ResearchTypeIndex = Research.constructResearchTypeIndex();

    public static constructResearch():ResearchData {
        const researchProgressByType = Object.values(ResearchType).reduce((accum, curr) => {
            const type = curr as ResearchType;
            accum[type] = Research.constructResearchTypeProgress(type);
            return accum;
        }, {} as ResearchProgressByType)

        return {
            researchProgressByType,
            researchTypeInQueue: null,
            researchPercent: 0,
          }
    }

    public static constructResearchTypeProgress(type: ResearchType): ResearchTypeProgress {
        const researchTypeData = Research.researchTypeIndex[type];
        const maxResearchLevel = researchTypeData.isCustomShip ? 0 : MAX_RESEARCH_LEVEL;
        const researchPointsBase = researchTypeData.researchPointsBase;
        const data:ResearchTypeProgressData = {};
        if([ResearchType.COMBAT_IMPROVEMENT_ATTACK, ResearchType.COMBAT_IMPROVEMENT_DEFENSE].includes(type)) {
            data.chance = 0;
        } else if([ResearchType.PROPULSION_IMPROVEMENT, ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS, ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES, ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES, ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES].includes(type)) {
            data.percent = 1.0
        } else if(type === ResearchType.SPACE_PLATFORM_IMPROVEMENT) {
            data.max = 1;
        }
        return {
            type,
            maxResearchLevel,
            currentResearchLevel: -1,
            researchPointsBase,
            researchPointsCompleted: 0,
            data,
          }
    }

    public static updateResearchTypeProgressData(rtp: ResearchTypeProgress, data: ResearchTypeProgressData) {
        
        const researchTypeData = Research.researchTypeIndex[rtp.type];
        if(researchTypeData.isCustomShip) {
            rtp.researchPointsBase = researchTypeData.researchPointsBase;
            let extraResearchAdvantage = 0;
            let extraResearchDisadvantage = 0;
            switch (data.advantageAgainst) {
                case StarShipType.SystemDefense:
                    extraResearchAdvantage = rtp.researchPointsBase * 0.1;
                    break;
                case StarShipType.Scout:
                    extraResearchAdvantage = rtp.researchPointsBase * 0.2;
                    break;
                case StarShipType.Destroyer:
                    extraResearchAdvantage = rtp.researchPointsBase * 0.3;
                    break;
                case StarShipType.Cruiser:
                    extraResearchAdvantage = rtp.researchPointsBase * 0.5;
                    break;
                case StarShipType.Battleship:
                    extraResearchAdvantage = rtp.researchPointsBase * 0.8;
                    break;
            }
            switch (data.disadvantageAgainst) {
                case StarShipType.SystemDefense:
                    extraResearchDisadvantage = rtp.researchPointsBase * 0.8;
                    break;
                case StarShipType.Scout:
                    extraResearchDisadvantage = rtp.researchPointsBase * 0.5;
                    break;
                case StarShipType.Destroyer:
                    extraResearchDisadvantage = rtp.researchPointsBase * 0.3;
                    break;
                case StarShipType.Cruiser:
                    extraResearchDisadvantage = rtp.researchPointsBase * 0.2;
                    break;
                case StarShipType.Battleship:
                    extraResearchDisadvantage = rtp.researchPointsBase * 0.1;
                    break;
            }
            rtp.researchPointsBase += extraResearchAdvantage + extraResearchDisadvantage;
        }
        rtp.data = data;
    }

    public static getResearchEffectiveness(researchType: ResearchType, player?: PlayerData): number {
        if(!player) {
            return 1.0;
        }
        return player.research.researchPercent
    }

    private static constructResearchTypeIndex():ResearchTypeIndex {
        return Object.values(ResearchType).reduce((accum, curr) => {
            const type = curr as ResearchType;
            accum[type] = Research.constructResearchTypeData(type);
            return accum;
        }, {} as ResearchTypeIndex)
    }

    private static constructResearchTypeData(type: ResearchType):ResearchTypeData {
        let researchPointsBase = 0;
        let isCustomShip = false;

        switch (type) {
            case ResearchType.NEW_SHIP_TYPE_DEFENDER:
              isCustomShip = true;
              researchPointsBase = 10;
              break;
            case ResearchType.NEW_SHIP_TYPE_SCOUT:
              isCustomShip = true;
              researchPointsBase = 20;
              break;
            case ResearchType.NEW_SHIP_TYPE_DESTROYER:
              isCustomShip = true;
              researchPointsBase = 30;
              break;
            case ResearchType.NEW_SHIP_TYPE_CRUISER:
              isCustomShip = true;
              researchPointsBase = 50;
              break;
            case ResearchType.NEW_SHIP_TYPE_BATTLESHIP:
              isCustomShip = true;
              researchPointsBase = 80;
              break;
            case ResearchType.COMBAT_IMPROVEMENT_ATTACK:
              researchPointsBase = 4;
              break;
            case ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
              researchPointsBase = 3;
              break;
            case ResearchType.PROPULSION_IMPROVEMENT:
              researchPointsBase = 8;
              break;
            case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
              researchPointsBase = 2;
              break;
            case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
              researchPointsBase = 1;
              break;
            case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
              researchPointsBase = 3;
              break;
            case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
              researchPointsBase = 5;
              break;
            case ResearchType.SPACE_PLATFORM_IMPROVEMENT:
              researchPointsBase = 10;
              break;
        }

        const researchLevelCosts = Research.getTotalResearchLevelCosts(researchPointsBase);
        return {
            type,
            researchPointsBase,
            isCustomShip,
            researchLevelCosts
        }
    }

    private static getTotalResearchLevelCosts(baseValue:number) {
        let totalResearchLevelCosts = [];
        let researchLevelCosts = Research.getResearchLevelCosts(baseValue);
        let accum = 0;
        for (let i = 0; i <= MAX_RESEARCH_LEVEL; i++) {
          accum += researchLevelCosts[i];
          totalResearchLevelCosts.push(accum);
        }
        return totalResearchLevelCosts;
    };

    private static getResearchLevelCosts(baseValue:number) {
        baseValue = baseValue || 1;
        let curr = baseValue;
        let prev = 0;
        let levelCosts = [];
        for (let i = 0; i <= MAX_RESEARCH_LEVEL; i++) {
          let temp = curr;
          curr += prev;
          levelCosts.push(curr);
          prev = temp;
        }
        return levelCosts;
    };
      
}
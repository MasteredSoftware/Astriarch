import { StarshipAdvantageData, StarShipType } from '../model/fleet';
import { PlayerData } from '../model/player';
import {
  ResearchData,
  ResearchProgressByType,
  ResearchType,
  ResearchTypeProgress,
  ResearchTypeProgressData,
} from '../model/research';
import { GameTools } from '../utils/gameTools';
import { ClientEvent, ClientEventType } from './GameCommands';
import { AdvanceGameClockForPlayerData } from './gameModel';

const MAX_RESEARCH_LEVEL = 9;

export interface ResearchTypeData {
  type: ResearchType;
  researchPointsBase: number; //based on the type and data, some types are intrinsically more expensive
  isCustomShip: boolean;
  researchLevelCosts: number[];
}

export type ResearchTypeIndex = Record<ResearchType, ResearchTypeData>;

export class Research {
  public static researchTypeIndex: ResearchTypeIndex = Research.constructResearchTypeIndex();

  public static constructResearch(): ResearchData {
    const researchProgressByType = Object.values(ResearchType).reduce((accum, curr) => {
      const type = curr as ResearchType;
      accum[type] = Research.constructResearchTypeProgress(type);
      return accum;
    }, {} as ResearchProgressByType);

    return {
      researchProgressByType,
      researchTypeInQueue: null,
      researchPercent: 0,
    };
  }

  public static constructResearchTypeProgress(type: ResearchType): ResearchTypeProgress {
    const researchTypeData = Research.researchTypeIndex[type];
    const maxResearchLevel = researchTypeData.isCustomShip ? 0 : MAX_RESEARCH_LEVEL;
    const researchPointsBase = researchTypeData.researchPointsBase;
    const data: ResearchTypeProgressData = {};
    if ([ResearchType.COMBAT_IMPROVEMENT_ATTACK, ResearchType.COMBAT_IMPROVEMENT_DEFENSE].includes(type)) {
      data.chance = 0;
    } else if (
      [
        ResearchType.PROPULSION_IMPROVEMENT,
        ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS,
        ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES,
        ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES,
        ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES,
      ].includes(type)
    ) {
      data.percent = 1.0;
    } else if (type === ResearchType.SPACE_PLATFORM_IMPROVEMENT) {
      data.max = 1;
    }
    return {
      type,
      maxResearchLevel,
      currentResearchLevel: -1,
      researchPointsBase,
      researchPointsCompleted: 0,
      data,
    };
  }

  public static updateResearchTypeProgressData(rtp: ResearchTypeProgress, data: ResearchTypeProgressData) {
    const researchTypeData = Research.researchTypeIndex[rtp.type];
    if (researchTypeData.isCustomShip) {
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

  public static getResearchData(player: PlayerData, researchType: ResearchType) {
    return player.research.researchProgressByType[researchType].data;
  }

  public static getResearchBoostForEfficiencyImprovement(researchType: ResearchType, player?: PlayerData): number {
    if (!player) {
      return 1.0;
    }
    return this.getResearchData(player, researchType).percent ?? 1.0;
  }

  public static getResearchBoostForStarshipCombatImprovement(researchType: ResearchType, player: PlayerData): number {
    return this.getResearchData(player, researchType).chance ?? 0;
  }

  public static getResearchDataByStarshipHullType(hullType: StarShipType, player: PlayerData) {
    let researchData;
    switch (hullType) {
      case StarShipType.SystemDefense:
        researchData = this.getResearchData(player, ResearchType.NEW_SHIP_TYPE_DEFENDER);
        break;
      case StarShipType.Scout:
        researchData = this.getResearchData(player, ResearchType.NEW_SHIP_TYPE_SCOUT);
        break;
      case StarShipType.Destroyer:
        researchData = this.getResearchData(player, ResearchType.NEW_SHIP_TYPE_DESTROYER);
        break;
      case StarShipType.Cruiser:
        researchData = this.getResearchData(player, ResearchType.NEW_SHIP_TYPE_CRUISER);
        break;
      case StarShipType.Battleship:
        researchData = this.getResearchData(player, ResearchType.NEW_SHIP_TYPE_BATTLESHIP);
        break;
    }
    return researchData ? (researchData as StarshipAdvantageData) : undefined;
  }

  public static getCreditAndResearchAmountEarnedPerTurn(researchData: ResearchData, creditAmountAtMaxPercent: number) {
    const researchAmountEarnedPerTurn = creditAmountAtMaxPercent * researchData.researchPercent;
    const creditAmountEarnedPerTurn = creditAmountAtMaxPercent - researchAmountEarnedPerTurn;
    return { researchAmountEarnedPerTurn, creditAmountEarnedPerTurn };
  }

  public static estimateTurnsRemainingInQueue(researchData: ResearchData, creditAmountAtMaxPercent: number): number {
    if (!researchData.researchTypeInQueue) {
      return 999; // No research in queue
    }

    const { researchAmountEarnedPerTurn } = Research.getCreditAndResearchAmountEarnedPerTurn(
      researchData,
      creditAmountAtMaxPercent,
    );

    if (researchAmountEarnedPerTurn <= 0) {
      return 999; // No research progress possible
    }

    const researchProgress = researchData.researchProgressByType[researchData.researchTypeInQueue];
    const researchTypeData = Research.researchTypeIndex[researchProgress.type];

    // Calculate cost to next level
    const currentLevel = researchProgress.currentResearchLevel;
    const nextLevelIndex = currentLevel + 1;

    if (nextLevelIndex >= researchTypeData.researchLevelCosts.length) {
      return 0; // Already at max level
    }

    const totalCostToNextLevel = researchTypeData.researchLevelCosts[nextLevelIndex];
    const researchCostToNextLevel = totalCostToNextLevel - researchProgress.researchPointsCompleted;

    return Math.ceil(researchCostToNextLevel / researchAmountEarnedPerTurn);
  }

  public static getResearchLevelData(researchProgress: ResearchTypeProgress) {
    const researchTypeData = Research.researchTypeIndex[researchProgress.type];
    const currentLevel = researchProgress.currentResearchLevel;
    const nextLevelIndex = currentLevel + 1;

    const researchLevelData = {
      currentResearchLevel: currentLevel + 1, // Display level (0-based becomes 1-based)
      researchCostToNextLevel: 0,
      percentComplete: 0,
    };

    if (nextLevelIndex >= researchTypeData.researchLevelCosts.length) {
      // Already at max level
      researchLevelData.percentComplete = 1.0;
      return researchLevelData;
    }

    const totalCostAtCurrentLevel = currentLevel === -1 ? 0 : researchTypeData.researchLevelCosts[currentLevel];
    const totalCostToNextLevel = researchTypeData.researchLevelCosts[nextLevelIndex];

    researchLevelData.researchCostToNextLevel = totalCostToNextLevel - researchProgress.researchPointsCompleted;
    researchLevelData.percentComplete =
      (researchProgress.researchPointsCompleted - totalCostAtCurrentLevel) /
      (totalCostToNextLevel - totalCostAtCurrentLevel);

    return researchLevelData;
  }

  public static canResearch(researchProgress: ResearchTypeProgress): boolean {
    return researchProgress.currentResearchLevel < researchProgress.maxResearchLevel;
  }

  public static advanceResearchForPlayer(data: AdvanceGameClockForPlayerData): ClientEvent[] {
    const events: ClientEvent[] = [];
    const { mainPlayer, mainPlayerOwnedPlanets } = data.clientModel;

    if (mainPlayer.research.researchTypeInQueue) {
      let totalResearch = 0;
      Object.values(mainPlayerOwnedPlanets).forEach((planet) => {
        totalResearch += planet.resources.research;
        planet.resources.research = 0;
      });
      const rtpInQueue = mainPlayer.research.researchProgressByType[mainPlayer.research.researchTypeInQueue];
      const levelIncrease = Research.setResearchPointsCompleted(
        rtpInQueue,
        rtpInQueue.researchPointsCompleted + totalResearch,
      );
      if (levelIncrease) {
        //we've gained a level
        const researchQueueCleared = !Research.canResearch(rtpInQueue);

        // Generate RESEARCH_COMPLETED event
        const researchCompletedEvent: ClientEvent = {
          type: ClientEventType.RESEARCH_COMPLETED,
          affectedPlayerIds: [mainPlayer.id],
          data: {
            researchType: rtpInQueue.type,
            newLevel: rtpInQueue.currentResearchLevel,
            researchQueueCleared,
          },
        };
        events.push(researchCompletedEvent);

        if (researchQueueCleared) {
          mainPlayer.research.researchTypeInQueue = null;
        }
      }
    }
    // else notifiy the player at some point?

    return events;
  }

  public static researchProgressToString(researchProgress: ResearchTypeProgress, nextLevel?: number) {
    const level = researchProgress.currentResearchLevel + (nextLevel ? 2 : 1);
    let defaultName = Research.researchProgressFriendlyName(researchProgress);
    switch (researchProgress.type) {
      case ResearchType.COMBAT_IMPROVEMENT_ATTACK:
        defaultName += ' Level ' + level;
        break;
      case ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
        defaultName += ' Level ' + level;
        break;
      case ResearchType.PROPULSION_IMPROVEMENT:
        defaultName += ' Level ' + level;
        break;
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
        defaultName = 'Level ' + level + ' ' + defaultName;
        break;
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
        defaultName = 'Level ' + level + ' ' + defaultName;
        break;
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
        defaultName = 'Level ' + level + ' ' + defaultName;
        break;
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
        defaultName = 'Level ' + level + ' ' + defaultName;
        break;
      case ResearchType.SPACE_PLATFORM_IMPROVEMENT:
        defaultName = 'Level ' + level + ' ' + defaultName;
        break;
    }
    return defaultName;
  }

  public static researchProgressFriendlyName(researchProgress: ResearchTypeProgress) {
    let defaultName = 'Unknown';
    switch (researchProgress.type) {
      case ResearchType.NEW_SHIP_TYPE_DEFENDER:
        defaultName = GameTools.starShipTypeToFriendlyName(StarShipType.SystemDefense, true);
        break;
      case ResearchType.NEW_SHIP_TYPE_SCOUT:
        defaultName = GameTools.starShipTypeToFriendlyName(StarShipType.Scout, true);
        break;
      case ResearchType.NEW_SHIP_TYPE_DESTROYER:
        defaultName = GameTools.starShipTypeToFriendlyName(StarShipType.Destroyer, true);
        break;
      case ResearchType.NEW_SHIP_TYPE_CRUISER:
        defaultName = GameTools.starShipTypeToFriendlyName(StarShipType.Cruiser, true);
        break;
      case ResearchType.NEW_SHIP_TYPE_BATTLESHIP:
        defaultName = GameTools.starShipTypeToFriendlyName(StarShipType.Battleship, true);
        break;
      case ResearchType.COMBAT_IMPROVEMENT_ATTACK:
        defaultName = 'Ship Attack';
        break;
      case ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
        defaultName = 'Ship Defense';
        break;
      case ResearchType.PROPULSION_IMPROVEMENT:
        defaultName = 'Ship Propulsion';
        break;
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
        defaultName = 'Farms';
        break;
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
        defaultName = 'Mines';
        break;
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
        defaultName = 'Colonies';
        break;
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
        defaultName = 'Factories';
        break;
      case ResearchType.SPACE_PLATFORM_IMPROVEMENT:
        defaultName = 'Space Platforms';
        break;
    }
    return defaultName;
  }

  public static setResearchPointsCompleted(researchProgress: ResearchTypeProgress, pointsCompleted: number): number {
    const originalLevel = researchProgress.currentResearchLevel;
    researchProgress.researchPointsCompleted = pointsCompleted;
    const { researchLevelCosts } = Research.researchTypeIndex[researchProgress.type];
    //set current level based on completed points
    for (let i = 0; i < researchLevelCosts.length; i++) {
      const researchCost = researchLevelCosts[i];
      if (researchProgress.researchPointsCompleted >= researchCost) {
        researchProgress.currentResearchLevel = i;
      } else {
        break;
      }
    }
    Research.setDataBasedOnLevel(researchProgress);
    return researchProgress.currentResearchLevel - originalLevel; //returns level increase
  }

  private static setDataBasedOnLevel(researchProgress: ResearchTypeProgress) {
    switch (researchProgress.type) {
      case ResearchType.COMBAT_IMPROVEMENT_ATTACK:
      case ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
        researchProgress.data.chance = (researchProgress.currentResearchLevel + 1) / 10;
        break;
      case ResearchType.PROPULSION_IMPROVEMENT:
        researchProgress.data.percent = 1.0 + (researchProgress.currentResearchLevel + 1) * 0.5;
        break;
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
      case ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
        researchProgress.data.percent = 1.0 + (researchProgress.currentResearchLevel + 1) / 10;
        break;
      case ResearchType.SPACE_PLATFORM_IMPROVEMENT:
        researchProgress.data.max = Math.max(Math.floor((researchProgress.currentResearchLevel + 1) / 2), 1);
        break;
    }
  }

  private static constructResearchTypeIndex(): ResearchTypeIndex {
    return Object.values(ResearchType).reduce((accum, curr) => {
      const type = curr as ResearchType;
      accum[type] = Research.constructResearchTypeData(type);
      return accum;
    }, {} as ResearchTypeIndex);
  }

  private static constructResearchTypeData(type: ResearchType): ResearchTypeData {
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
      researchLevelCosts,
    };
  }

  private static getTotalResearchLevelCosts(baseValue: number) {
    const totalResearchLevelCosts = [];
    const researchLevelCosts = Research.getResearchLevelCosts(baseValue);
    let accum = 0;
    for (let i = 0; i <= MAX_RESEARCH_LEVEL; i++) {
      accum += researchLevelCosts[i];
      totalResearchLevelCosts.push(accum);
    }
    return totalResearchLevelCosts;
  }

  private static getResearchLevelCosts(baseValue: number) {
    baseValue = baseValue || 1;
    let curr = baseValue;
    let prev = 0;
    const levelCosts = [];
    for (let i = 0; i <= MAX_RESEARCH_LEVEL; i++) {
      const temp = curr;
      curr += prev;
      levelCosts.push(curr);
      prev = temp;
    }
    return levelCosts;
  }

  public static getMaxSpacePlatformCount(data: ResearchData): number {
    return data.researchProgressByType[ResearchType.SPACE_PLATFORM_IMPROVEMENT].data.max || 0;
  }

  public static getResearchProgressListSorted(data: ResearchData) {
    const sortedList = Object.values(data.researchProgressByType);

    sortedList.sort((rptA, rptB) => {
      return rptA.currentResearchLevel - rptB.currentResearchLevel;
    });
    return sortedList;
  }
}

import { ResearchData, ResearchType } from '../model/research';
import { PlayerData } from '../model/player';
import { startNewTestGame, TestGameData } from '../test/testUtils';
import { Research } from './research';

let testGameData: TestGameData;
let player1: PlayerData;
let researchData: ResearchData;

describe('Research', function () {
  beforeEach(() => {
    testGameData = startNewTestGame();
    player1 = testGameData.gameModel.modelData.players[0];
    researchData = player1.research;
  });

  describe('estimateTurnsRemainingInQueue', function () {
    it('should return 999 when no research is in queue', () => {
      researchData.researchTypeInQueue = null;
      researchData.researchPercent = 0.5;

      const result = Research.estimateTurnsRemainingInQueue(researchData, 100);
      expect(result).toBe(999);
    });

    it('should return 999 when research percent is 0', () => {
      researchData.researchTypeInQueue = ResearchType.COMBAT_IMPROVEMENT_ATTACK;
      researchData.researchPercent = 0;

      const result = Research.estimateTurnsRemainingInQueue(researchData, 100);
      expect(result).toBe(999);
    });

    it('should calculate correct turns for simple research scenario', () => {
      // Set up research in queue
      researchData.researchTypeInQueue = ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES;
      researchData.researchPercent = 0.5; // 50% of income goes to research

      // Get the research progress for mines (should be at level -1 initially)
      const minesResearch = researchData.researchProgressByType[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES];
      expect(minesResearch.currentResearchLevel).toBe(-1);
      expect(minesResearch.researchPointsCompleted).toBe(0);

      // Research type data for mines has base value 1
      // Level costs should be [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
      // Total costs should be [1, 3, 6, 11, 19, 32, 53, 87, 142, 231]
      const researchTypeData = Research.researchTypeIndex[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES];
      expect(researchTypeData.researchPointsBase).toBe(1);
      expect(researchTypeData.researchLevelCosts[0]).toBe(1); // First level costs 1 total

      // With 100 credits max, 50% research = 50 research per turn
      // Need 1 research point to reach level 0, so should take 1 turn (Math.ceil(1/50) = 1)
      const result = Research.estimateTurnsRemainingInQueue(researchData, 100);
      expect(result).toBe(1);
    });

    it('should calculate correct turns for partially completed research', () => {
      // Set up research in queue with some progress
      researchData.researchTypeInQueue = ResearchType.COMBAT_IMPROVEMENT_ATTACK;
      researchData.researchPercent = 0.25; // 25% of income goes to research

      // Get the research progress for attack (base value 4)
      const attackResearch = researchData.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_ATTACK];

      // Manually set some progress (2 out of 4 points completed for level 0)
      Research.setResearchPointsCompleted(attackResearch, 2);
      expect(attackResearch.currentResearchLevel).toBe(-1); // Still at level -1
      expect(attackResearch.researchPointsCompleted).toBe(2);

      // Research type data for attack has base value 4
      // Level costs should be [4, 8, 12, 20, 32, 52, 84, 136, 220, 356]
      // Total costs should be [4, 12, 24, 44, 76, 128, 212, 348, 568, 924]
      const researchTypeData = Research.researchTypeIndex[ResearchType.COMBAT_IMPROVEMENT_ATTACK];
      expect(researchTypeData.researchLevelCosts[0]).toBe(4); // First level costs 4 total

      // With 200 credits max, 25% research = 50 research per turn
      // Need 2 more research points (4 - 2), so should take 1 turn (Math.ceil(2/50) = 1)
      const result = Research.estimateTurnsRemainingInQueue(researchData, 200);
      expect(result).toBe(1);
    });

    it('should handle very slow research progress', () => {
      // Set up research in queue
      researchData.researchTypeInQueue = ResearchType.PROPULSION_IMPROVEMENT;
      researchData.researchPercent = 0.01; // Only 1% goes to research

      const propulsionResearch = researchData.researchProgressByType[ResearchType.PROPULSION_IMPROVEMENT];
      expect(propulsionResearch.currentResearchLevel).toBe(-1);

      // Research type data for propulsion has base value 8
      // First level costs 8 total
      const researchTypeData = Research.researchTypeIndex[ResearchType.PROPULSION_IMPROVEMENT];
      expect(researchTypeData.researchLevelCosts[0]).toBe(8);

      // With 100 credits max, 1% research = 1 research per turn
      // Need 8 research points, so should take 8 turns
      const result = Research.estimateTurnsRemainingInQueue(researchData, 100);
      expect(result).toBe(8);
    });

    it('should return 0 when research is already at max level', () => {
      // Set up research in queue
      researchData.researchTypeInQueue = ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS;
      researchData.researchPercent = 0.5;

      const farmsResearch = researchData.researchProgressByType[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS];

      // Set research to max level (level 9)
      const researchTypeData = Research.researchTypeIndex[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS];
      const maxLevelCost = researchTypeData.researchLevelCosts[researchTypeData.researchLevelCosts.length - 1];
      Research.setResearchPointsCompleted(farmsResearch, maxLevelCost);

      expect(farmsResearch.currentResearchLevel).toBe(9); // Max level

      const result = Research.estimateTurnsRemainingInQueue(researchData, 100);
      expect(result).toBe(0);
    });

    it('should handle fractional research per turn correctly', () => {
      // Set up research in queue
      researchData.researchTypeInQueue = ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES;
      researchData.researchPercent = 0.33; // 33% goes to research

      const coloniesResearch =
        researchData.researchProgressByType[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES];

      // Research type data for colonies has base value 3
      // First level costs 3 total
      const researchTypeData = Research.researchTypeIndex[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES];
      expect(researchTypeData.researchLevelCosts[0]).toBe(3);

      // With 10 credits max, 33% research = 3.3 research per turn
      // Need 3 research points, so should take 1 turn (Math.ceil(3/3.3) = 1)
      const result = Research.estimateTurnsRemainingInQueue(researchData, 10);
      expect(result).toBe(1);
    });
  });

  describe('getResearchLevelData', function () {
    it('should return correct data for research at level -1', () => {
      const minesResearch = researchData.researchProgressByType[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES];
      expect(minesResearch.currentResearchLevel).toBe(-1);
      expect(minesResearch.researchPointsCompleted).toBe(0);

      const levelData = Research.getResearchLevelData(minesResearch);

      expect(levelData.currentResearchLevel).toBe(0); // Display level (1-based from 0-based)
      expect(levelData.researchCostToNextLevel).toBe(1); // Need 1 point to reach level 0
      expect(levelData.percentComplete).toBe(0); // 0% complete
    });

    it('should return correct data for partially completed research', () => {
      const attackResearch = researchData.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_ATTACK];

      // Set 2 out of 4 points completed for level 0
      Research.setResearchPointsCompleted(attackResearch, 2);

      const levelData = Research.getResearchLevelData(attackResearch);

      expect(levelData.currentResearchLevel).toBe(0); // Still at display level 0
      expect(levelData.researchCostToNextLevel).toBe(2); // Need 2 more points
      expect(levelData.percentComplete).toBe(0.5); // 50% complete (2/4)
    });

    it('should return correct data for completed level transitioning to next', () => {
      const propulsionResearch = researchData.researchProgressByType[ResearchType.PROPULSION_IMPROVEMENT];

      // Complete level 0 (8 points) and add some progress toward level 1 (which costs 24 total)
      // With 10 points, we're at level 0 with 2 points toward level 1
      Research.setResearchPointsCompleted(propulsionResearch, 10);

      const levelData = Research.getResearchLevelData(propulsionResearch);

      expect(levelData.currentResearchLevel).toBe(1); // Display level 1 (0-based level 0)
      expect(levelData.researchCostToNextLevel).toBe(14); // Need 14 more points (24 - 10)
      expect(levelData.percentComplete).toBe(0.125); // 12.5% complete toward level 1 (2/16)
    });

    it('should return 100% complete for max level research', () => {
      const farmsResearch = researchData.researchProgressByType[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS];

      // Set research to max level
      const researchTypeData = Research.researchTypeIndex[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS];
      const maxLevelCost = researchTypeData.researchLevelCosts[researchTypeData.researchLevelCosts.length - 1];
      Research.setResearchPointsCompleted(farmsResearch, maxLevelCost);

      const levelData = Research.getResearchLevelData(farmsResearch);

      expect(levelData.currentResearchLevel).toBe(10); // Display level 10 (0-based level 9)
      expect(levelData.researchCostToNextLevel).toBe(0);
      expect(levelData.percentComplete).toBe(1.0); // 100% complete
    });
  });
});

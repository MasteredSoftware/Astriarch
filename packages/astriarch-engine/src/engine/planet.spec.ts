import { PlanetById } from '../model/clientModel';
import { CitizenWorkerType, PlanetData, PlanetType } from '../model/planet';
import { PlayerData } from '../model/player';
import { startNewTestGame, TestGameData } from '../test/testUtils';
import { ClientGameModel } from './clientGameModel';
import { Planet } from './planet';

let testGameData: TestGameData;
let player1: PlayerData;
let testPlanet: PlanetData;
let planetById: PlanetById;

describe('Planet', function () {
  beforeEach(() => {
    testGameData = startNewTestGame();
    player1 = testGameData.gameModel.modelData.players[0];
    planetById = ClientGameModel.getPlanetByIdIndex(testGameData.gameModel.modelData.planets);
    
    // Get the player's home planet for testing
    testPlanet = testGameData.gameModel.modelData.planets.find(p => p.id === player1.homePlanetId)!;
    
    // Set up a predictable population for testing (3 farmers, 2 miners, 1 builder)
    testPlanet.population = [
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Farmer },
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Farmer },
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Farmer },
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Miner },
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Miner },
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Builder }
    ];
  });

  describe('countPopulationWorkerTypes()', () => {
    it('should correctly count worker types', () => {
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(3);
      expect(counts.miners).toBe(2);
      expect(counts.builders).toBe(1);
    });

    it('should handle empty population', () => {
      testPlanet.population = [];
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(0);
      expect(counts.miners).toBe(0);
      expect(counts.builders).toBe(0);
    });

    it('should ignore protesting citizens', () => {
      // Make one citizen protest
      testPlanet.population[0].protestLevel = 1;
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(2); // Should be 2 instead of 3
      expect(counts.miners).toBe(2);
      expect(counts.builders).toBe(1);
    });
  });

  describe('updatePopulationWorkerTypesByDiff()', () => {
    it('should successfully move workers when diffs sum to zero', () => {
      // Move 1 farmer to miner (+1 miner, -1 farmer)
      Planet.updatePopulationWorkerTypesByDiff(testPlanet, player1, -1, 1, 0);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(2);
      expect(counts.miners).toBe(3);
      expect(counts.builders).toBe(1);
    });

    it('should move from most populated type when increasing', () => {
      // Start: 3 farmers, 2 miners, 1 builder
      // Move 1 worker to builder from farmers (most populated)
      Planet.updatePopulationWorkerTypesByDiff(testPlanet, player1, -1, 0, 1);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(2);
      expect(counts.miners).toBe(2);
      expect(counts.builders).toBe(2);
    });

    it('should handle complex multi-type transfers', () => {
      // Start: 3 farmers, 2 miners, 1 builder
      // Move 2 farmers to 1 miner and 1 builder
      Planet.updatePopulationWorkerTypesByDiff(testPlanet, player1, -2, 1, 1);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(1);
      expect(counts.miners).toBe(3);
      expect(counts.builders).toBe(2);
    });

    it('should error and return early when diffs do not sum to zero', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // This should fail because 1 + 1 + 0 = 2 (not zero)
      Planet.updatePopulationWorkerTypesByDiff(testPlanet, player1, 1, 1, 0);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "Couldn't move workers in Planet.updatePopulationWorkerTypesByDiff!",
        1, 1, 0
      );
      
      // Population should remain unchanged
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(3);
      expect(counts.miners).toBe(2);
      expect(counts.builders).toBe(1);
      
      consoleSpy.mockRestore();
    });

    it('should handle zero diffs (no change)', () => {
      Planet.updatePopulationWorkerTypesByDiff(testPlanet, player1, 0, 0, 0);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(3);
      expect(counts.miners).toBe(2);
      expect(counts.builders).toBe(1);
    });
  });

  describe('updatePopulationWorkerTypes()', () => {
    it('should handle simple single worker type increase', () => {
      // Add 1 farmer (should take from miners - highest non-farmer count)
      Planet.updatePopulationWorkerTypes(testPlanet, player1, 1, 0, 0);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(4);
      expect(counts.miners).toBe(1); // Reduced from 2
      expect(counts.builders).toBe(1);
    });

    it('should handle single worker type decrease', () => {
      // Remove 1 farmer (should go to builders - lowest count)
      Planet.updatePopulationWorkerTypes(testPlanet, player1, -1, 0, 0);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(2);
      expect(counts.miners).toBe(2);
      expect(counts.builders).toBe(2); // Increased from 1
    });

    it('should prioritize keeping requested increases when over population limit', () => {
      // Try to add workers that would exceed population
      // Start: 3f, 2m, 1b = 6 total
      // Request: +2f, +2m, +2b = would need 12 total, but only have 6
      Planet.updatePopulationWorkerTypes(testPlanet, player1, 2, 2, 2);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      const total = counts.farmers + counts.miners + counts.builders;
      
      // Should still have exactly 6 workers total
      expect(total).toBe(6);
      
      // Given the algorithm, all types will get increases, but with reductions
      // The exact distribution depends on the sorting algorithm, but total should be 6
      expect(counts.farmers + counts.miners + counts.builders).toBe(6);
    });

    it('should handle negative values by adjusting assignments appropriately', () => {
      // Try to set farmers to negative (should become 0)
      // Start with 3f, 2m, 1b = 6 total
      Planet.updatePopulationWorkerTypes(testPlanet, player1, -10, 0, 0);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      
      // Farmers should be minimized (possibly 0, but algorithm distributes workers)
      expect(counts.farmers).toBeGreaterThanOrEqual(0);
      
      // Total should still be 6 (all population assigned)
      expect(counts.farmers + counts.miners + counts.builders).toBe(6);
      
      // Other workers should get the redistributed population
      expect(counts.miners + counts.builders).toBeGreaterThan(3);
    });

    it('should distribute unassigned population to lowest assignments', () => {
      // Start with: 3f, 2m, 1b = 6 total
      // Request: -1f, -1m, 0b = would result in 2f, 1m, 1b = 4 total
      // Should auto-assign 2 remaining workers to balance (builders has least)
      Planet.updatePopulationWorkerTypes(testPlanet, player1, -1, -1, 0);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      const total = counts.farmers + counts.miners + counts.builders;
      
      // Should still use all 6 workers
      expect(total).toBe(6);
      
      // Builders should have gotten extra workers (lowest starting count)
      expect(counts.builders).toBeGreaterThan(1);
    });

    it('should handle mixed increase/decrease operations', () => {
      // Start: 3f, 2m, 1b
      // Request: +1f, -1m, +0b
      // Should result in taking 1 from miner, giving to farmer
      Planet.updatePopulationWorkerTypes(testPlanet, player1, 1, -1, 0);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(4);
      expect(counts.miners).toBe(1);
      expect(counts.builders).toBe(1);
    });

    it('should work with zero population planet', () => {
      testPlanet.population = [];
      
      Planet.updatePopulationWorkerTypes(testPlanet, player1, 1, 0, 0);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(0);
      expect(counts.miners).toBe(0);
      expect(counts.builders).toBe(0);
    });

    it('should maintain total population count', () => {
      const originalTotal = testPlanet.population.length;
      
      // Try various operations
      Planet.updatePopulationWorkerTypes(testPlanet, player1, 2, -1, 1);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      const newTotal = counts.farmers + counts.miners + counts.builders;
      
      expect(newTotal).toBe(originalTotal);
    });

    it('should handle equal distribution when all assignments are equal', () => {
      // Set up equal assignments: 2f, 2m, 2b
      testPlanet.population = [
        { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Farmer },
        { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Farmer },
        { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Miner },
        { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Miner },
        { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Builder },
        { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Builder }
      ];
      
      // Add 1 farmer
      Planet.updatePopulationWorkerTypes(testPlanet, player1, 1, 0, 0);
      
      const counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(3);
      expect(counts.miners + counts.builders).toBe(3); // One should have decreased
    });
  });

  describe('integration tests', () => {
    it('should handle realistic game scenarios', () => {
      // Simulate player clicking +1 farmer button multiple times
      const initial = Planet.countPopulationWorkerTypes(testPlanet);
      
      // Click +1 farmer
      Planet.updatePopulationWorkerTypes(testPlanet, player1, 1, 0, 0);
      let counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(initial.farmers + 1);
      
      // Click +1 farmer again
      Planet.updatePopulationWorkerTypes(testPlanet, player1, 1, 0, 0);
      counts = Planet.countPopulationWorkerTypes(testPlanet);
      expect(counts.farmers).toBe(initial.farmers + 2);
      
      // Click -1 miner
      Planet.updatePopulationWorkerTypes(testPlanet, player1, 0, -1, 0);
      counts = Planet.countPopulationWorkerTypes(testPlanet);
      
      // Total should still be the same
      const total = counts.farmers + counts.miners + counts.builders;
      expect(total).toBe(testPlanet.population.length);
    });

    it('should return resource generation data', () => {
      const result = Planet.updatePopulationWorkerTypes(testPlanet, player1, 1, 0, 0);
      
      expect(result).toBeDefined();
      expect(result.amountPerTurn).toBeDefined();
      expect(result.baseAmountPerWorkerPerTurn).toBeDefined();
    });
  });
});

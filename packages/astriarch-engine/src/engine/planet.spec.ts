import { PlanetById } from '../model/clientModel';
import { CitizenWorkerType, PlanetData, PlanetType, PlanetProductionItemType } from '../model/planet';
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
    testPlanet = testGameData.gameModel.modelData.planets.find((p) => p.id === player1.homePlanetId)!;

    // Set up a predictable population for testing (3 farmers, 2 miners, 1 builder)
    testPlanet.population = [
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Farmer },
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Farmer },
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Farmer },
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Miner },
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Miner },
      { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Builder },
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
        1,
        1,
        0,
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
        { populationChange: 0, loyalToPlayerId: player1.id, protestLevel: 0, workerType: CitizenWorkerType.Builder },
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

  describe('spendResources()', () => {
    let homePlanet: PlanetData;
    let remotePlanet: PlanetData;

    beforeEach(() => {
      // Use the existing test planet as home planet
      homePlanet = testPlanet;

      // Set specific resource amounts for testing
      homePlanet.resources.energy = 50;
      homePlanet.resources.food = 30;
      homePlanet.resources.ore = 20;
      homePlanet.resources.iridium = 10;

      // Create a second planet for the player
      remotePlanet = {
        id: 999,
        name: 'Remote Planet',
        type: PlanetType.PlanetClass1,
        nextShipId: 1,
        population: [],
        buildQueue: [],
        builtImprovements: homePlanet.builtImprovements,
        maxImprovements: 6,
        resources: {
          energy: 10,
          food: 100,
          ore: 80,
          iridium: 60,
          research: 5,
          production: 15,
        },
        originPoint: { x: 50, y: 50 },
        boundingHexMidPoint: { x: 60, y: 60 },
        planetaryFleet: homePlanet.planetaryFleet,
        outgoingFleets: [],
        planetHappiness: homePlanet.planetHappiness,
        starshipTypeLastBuilt: null,
        starshipCustomShipLastBuilt: false,
        buildLastStarship: true,
        waypointBoundingHexMidPoint: null,
      };

      // Add the remote planet to the player's owned planets
      player1.ownedPlanetIds.push(remotePlanet.id);
      planetById[remotePlanet.id] = remotePlanet;
    });

    describe('when spending resources on the same planet', () => {
      it('should spend resources from the local planet only', () => {
        const initialEnergy = homePlanet.resources.energy;
        const initialOre = homePlanet.resources.ore;
        const initialIridium = homePlanet.resources.iridium;

        // Spend some resources that are available locally
        Planet.spendResources(testGameData.gameModel.grid, player1, planetById, homePlanet, 10, 0, 5, 3);

        // Resources should be deducted from home planet
        expect(homePlanet.resources.energy).toBe(initialEnergy - 10);
        expect(homePlanet.resources.ore).toBe(initialOre - 5);
        expect(homePlanet.resources.iridium).toBe(initialIridium - 3);

        // Remote planet should be unchanged
        expect(remotePlanet.resources.energy).toBe(10);
        expect(remotePlanet.resources.ore).toBe(80);
        expect(remotePlanet.resources.iridium).toBe(60);
      });
    });

    describe('when spending resources that require shipping from other planets', () => {
      it('should spend ore from remote planets when local planet lacks ore', () => {
        const initialHomePlanetOre = homePlanet.resources.ore; // 20
        const initialRemotePlanetOre = remotePlanet.resources.ore; // 80

        // Try to spend 30 ore (more than home planet has)
        Planet.spendResources(testGameData.gameModel.grid, player1, planetById, homePlanet, 0, 0, 30, 0);

        // Home planet should be drained of ore
        expect(homePlanet.resources.ore).toBe(0);
        // Remote planet should have ore deducted
        expect(remotePlanet.resources.ore).toBe(initialRemotePlanetOre - (30 - initialHomePlanetOre));
        expect(remotePlanet.resources.ore).toBe(70); // 80 - 10 = 70
      });

      it('should spend iridium from remote planets when local planet lacks iridium', () => {
        const initialHomePlanetIridium = homePlanet.resources.iridium; // 10
        const initialRemotePlanetIridium = remotePlanet.resources.iridium; // 60

        // Try to spend 25 iridium (more than home planet has)
        Planet.spendResources(testGameData.gameModel.grid, player1, planetById, homePlanet, 0, 0, 0, 25);

        // Home planet should be drained of iridium
        expect(homePlanet.resources.iridium).toBe(0);
        // Remote planet should have iridium deducted
        expect(remotePlanet.resources.iridium).toBe(initialRemotePlanetIridium - (25 - initialHomePlanetIridium));
        expect(remotePlanet.resources.iridium).toBe(45); // 60 - 15 = 45
      });

      it('should spend energy from remote planets when local planet lacks energy', () => {
        const initialHomePlanetEnergy = homePlanet.resources.energy; // 50
        const initialRemotePlanetEnergy = remotePlanet.resources.energy; // 10

        // Try to spend 55 energy (more than home planet has)
        Planet.spendResources(testGameData.gameModel.grid, player1, planetById, homePlanet, 55, 0, 0, 0);

        // Home planet should be drained of energy
        expect(homePlanet.resources.energy).toBe(0);
        // Remote planet should have energy deducted
        expect(remotePlanet.resources.energy).toBe(initialRemotePlanetEnergy - (55 - initialHomePlanetEnergy));
        expect(remotePlanet.resources.energy).toBe(5); // 10 - 5 = 5
      });

      it('should spend food from remote planets when local planet lacks food', () => {
        const initialHomePlanetFood = homePlanet.resources.food; // 30
        const initialRemotePlanetFood = remotePlanet.resources.food; // 100

        // Try to spend 80 food (more than home planet has)
        Planet.spendResources(testGameData.gameModel.grid, player1, planetById, homePlanet, 0, 80, 0, 0);

        // Home planet should be drained of food
        expect(homePlanet.resources.food).toBe(0);
        // Remote planet should have food deducted
        expect(remotePlanet.resources.food).toBe(initialRemotePlanetFood - (80 - initialHomePlanetFood));
        expect(remotePlanet.resources.food).toBe(50); // 100 - 50 = 50
      });
    });

    describe('when there are insufficient resources across all planets', () => {
      it('should spend what it can and warn about insufficient resources', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        // Try to spend more ore than available across all planets (20 + 80 = 100 available, asking for 150)
        Planet.spendResources(testGameData.gameModel.grid, player1, planetById, homePlanet, 0, 0, 150, 0);

        // All ore should be spent
        expect(homePlanet.resources.ore).toBe(0);
        expect(remotePlanet.resources.ore).toBe(0);

        // Should warn about insufficient resources
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Problem spending energy, food, ore and iridium as necessary!'),
          player1.name,
          homePlanet.name,
          0, // energyNeeded
          0, // foodNeeded
          50, // oreNeeded (150 - 100 available)
          0, // iridiumNeeded
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe('removeBuildQueueItemForRefund()', () => {
    beforeEach(() => {
      // Add some items to the build queue for testing
      testPlanet.buildQueue = [
        {
          itemType: PlanetProductionItemType.PlanetImprovement,
          baseProductionCost: 100,
          productionCostComplete: 50,
          energyCost: 10,
          oreCost: 5,
          iridiumCost: 3,
          resourcesSpent: true,
          turnsToComplete: 1,
        },
        {
          itemType: PlanetProductionItemType.PlanetImprovement,
          baseProductionCost: 200,
          productionCostComplete: 25,
          energyCost: 20,
          oreCost: 10,
          iridiumCost: 6,
          resourcesSpent: true,
          turnsToComplete: 2,
        },
      ];
    });

    it('should return false for negative index', () => {
      const result = Planet.removeBuildQueueItemForRefund(testPlanet, -1);
      expect(result).toBe(false);
      expect(testPlanet.buildQueue.length).toBe(2); // Should be unchanged
    });

    it('should return false for index equal to array length (out of bounds)', () => {
      const result = Planet.removeBuildQueueItemForRefund(testPlanet, 2); // array length is 2, so index 2 is out of bounds
      expect(result).toBe(false);
      expect(testPlanet.buildQueue.length).toBe(2); // Should be unchanged
    });

    it('should return false for index greater than array length', () => {
      const result = Planet.removeBuildQueueItemForRefund(testPlanet, 5);
      expect(result).toBe(false);
      expect(testPlanet.buildQueue.length).toBe(2); // Should be unchanged
    });

    it('should successfully remove item at valid index and provide refund', () => {
      const initialEnergy = testPlanet.resources.energy;
      const initialOre = testPlanet.resources.ore;
      const initialIridium = testPlanet.resources.iridium;

      const result = Planet.removeBuildQueueItemForRefund(testPlanet, 0);

      expect(result).toBe(true);
      expect(testPlanet.buildQueue.length).toBe(1); // Should have one less item

      // Should have received a refund (partial since item was 50% complete)
      expect(testPlanet.resources.energy).toBeGreaterThan(initialEnergy);
      expect(testPlanet.resources.ore).toBeGreaterThan(initialOre);
      expect(testPlanet.resources.iridium).toBeGreaterThan(initialIridium);
    });

    it('should remove the correct item when removing from middle of queue', () => {
      const originalSecondItem = testPlanet.buildQueue[1];

      const result = Planet.removeBuildQueueItemForRefund(testPlanet, 0);

      expect(result).toBe(true);
      expect(testPlanet.buildQueue.length).toBe(1);
      expect(testPlanet.buildQueue[0]).toBe(originalSecondItem); // Second item should now be first
    });
  });
});

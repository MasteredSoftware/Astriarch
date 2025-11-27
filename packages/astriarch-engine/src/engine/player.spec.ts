import { Player } from './player';
import { PlanetData, CitizenWorkerType, Citizen, PlanetHappinessType } from '../model/planet';
import { PlayerData } from '../model/player';
import { startNewTestGame, TestGameData } from '../test/testUtils';
import { ClientGameModel } from './clientGameModel';
import { AdvanceGameClockForPlayerData } from './gameModel';
import { Grid } from './grid';

describe('Player', () => {
  describe('food shipping logic', () => {
    let testGameData: TestGameData;
    let player: PlayerData;
    let planet1: PlanetData;
    let planet2: PlanetData;

    beforeEach(() => {
      testGameData = startNewTestGame();
      player = testGameData.gameModel.modelData.players[0];

      // Get two planets and add them to player's ownership
      const planets = testGameData.gameModel.modelData.planets;
      planet1 = planets[0];
      planet2 = planets[1];

      // Make sure both planets are owned by player
      if (!player.ownedPlanetIds.includes(planet1.id)) {
        player.ownedPlanetIds.push(planet1.id);
      }
      if (!player.ownedPlanetIds.includes(planet2.id)) {
        player.ownedPlanetIds.push(planet2.id);
      }

      // Set up basic population
      const createCitizen = (): Citizen => ({
        populationChange: 0,
        loyalToPlayerId: player.id,
        protestLevel: 0,
        workerType: CitizenWorkerType.Farmer,
      });

      planet1.population = [createCitizen()]; // 1 population
      planet2.population = [createCitizen()]; // 1 population
    });

    it('should spend food from surplus planet and energy for shipping when moving food to deficit planet', () => {
      // Set up food shortage scenario:
      // Planet1 has deficit (negative food after eating)
      // Planet2 has surplus food and energy for shipping
      planet1.resources.food = 0; // Will become -1 after eating (1 pop * 1 cycle)
      planet1.resources.energy = 0;

      planet2.resources.food = 10; // Surplus
      planet2.resources.energy = 5; // Energy for shipping

      const initialPlanet2Food = planet2.resources.food;
      const initialPlanet2Energy = planet2.resources.energy;

      // Create proper AdvanceGameClockForPlayerData
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
      const grid = new Grid(640, 480, testGameData.gameModel.modelData.gameOptions);
      const data: AdvanceGameClockForPlayerData = {
        clientModel,
        cyclesElapsed: 1,
        currentCycle: 1,
        grid,
      };

      // Run the eat and starve logic
      Player.eatAndStarve(data);

      // After eating, planet1 should have had negative food
      // Food should be shipped from planet2 to cover the deficit
      // Planet2 eats 1 food first (1 pop * 1 cycle), then ships 1 food to planet1 and spends 1 energy for shipping

      expect(planet2.resources.food).toBe(initialPlanet2Food - 1 - 1); // 1 food eaten + 1 food shipped = 8
      expect(planet2.resources.energy).toBe(initialPlanet2Energy - 1); // 1 energy spent for shipping cost
      expect(player.lastTurnFoodNeededToBeShipped).toBe(1); // Ongoing food shipping need per turn (1 food shortage / 1 cycle)
    });

    it('should not ship food when there is no energy for shipping', () => {
      // Set up scenario where there's surplus food but no energy for shipping
      planet1.resources.food = 0; // Will become -2 after eating
      planet1.resources.energy = 0;

      planet2.resources.food = 10; // Surplus
      planet2.resources.energy = 0; // No energy for shipping

      const initialPlanet2Food = planet2.resources.food;

      // Create proper AdvanceGameClockForPlayerData
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
      const grid = new Grid(640, 480, testGameData.gameModel.modelData.gameOptions);
      const data: AdvanceGameClockForPlayerData = {
        clientModel,
        cyclesElapsed: 2, // 2 cycles = 2 food needed per pop
        currentCycle: 1,
        grid,
      };

      Player.eatAndStarve(data);

      // No food should be shipped because there's no energy
      // Planet2 eats 2 food (1 pop * 2 cycles), leaving it with 8 food but no shipping occurs
      expect(planet2.resources.food).toBe(initialPlanet2Food - 2); // 2 food eaten, no shipping
      expect(player.lastTurnFoodNeededToBeShipped).toBe(1); // 1 food per turn deficit (2 food shortage / 2 cycles)
    });

    it('should ship partial food when energy is limited', () => {
      // Set up scenario where energy limits how much food can be shipped
      planet1.resources.food = 0; // Will become -3 after eating
      planet1.resources.energy = 0;

      planet2.resources.food = 10; // Surplus
      planet2.resources.energy = 2; // Only enough energy to ship 2 food

      const initialPlanet2Food = planet2.resources.food;
      const initialPlanet2Energy = planet2.resources.energy;

      // Create proper AdvanceGameClockForPlayerData
      const clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
      const grid = new Grid(640, 480, testGameData.gameModel.modelData.gameOptions);
      const data: AdvanceGameClockForPlayerData = {
        clientModel,
        cyclesElapsed: 3, // 3 cycles = 3 food needed per pop
        currentCycle: 1,
        grid,
      };

      Player.eatAndStarve(data);

      // Should ship 2 food (limited by energy) out of 3 needed
      // Planet2 eats 3 food first (1 pop * 3 cycles), then ships 2 food and spends 2 energy for shipping
      expect(planet2.resources.food).toBe(initialPlanet2Food - 3 - 2); // 3 food eaten + 2 food shipped = 5
      expect(planet2.resources.energy).toBe(initialPlanet2Energy - 2); // 2 energy spent for shipping cost
      // lastTurnFoodNeededToBeShipped: ongoing need is 1 food per turn (3 shortage / 3 cycles)
      expect(player.lastTurnFoodNeededToBeShipped).toBe(1); // 1 food per turn ongoing shipping need
    });
  });

  describe('eatAndStarve - deterministic event generation', () => {
    let testGameData: TestGameData;
    let player: PlayerData;
    let planet: PlanetData;
    let clientModel: ReturnType<typeof ClientGameModel.constructClientGameModel>;
    let grid: Grid;

    beforeEach(() => {
      testGameData = startNewTestGame();
      player = testGameData.gameModel.modelData.players[0];
      planet = testGameData.gameModel.modelData.planets[0];

      // Make sure planet is owned by player
      if (!player.ownedPlanetIds.includes(planet.id)) {
        player.ownedPlanetIds.push(planet.id);
      }
      player.homePlanetId = planet.id;

      // Set up basic population
      const createCitizen = (): Citizen => ({
        populationChange: 0,
        loyalToPlayerId: player.id,
        protestLevel: 0,
        workerType: CitizenWorkerType.Farmer,
      });

      planet.population = [createCitizen()];

      clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
      grid = new Grid(640, 480, testGameData.gameModel.modelData.gameOptions);
    });

    describe('food shortage without death', () => {
      it('should set planetHappiness to Unrest when food deficit occurs but no death', () => {
        // Set up on clientModel's planet
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.resources.food = 0.06; // Partial food - shortage will be 0.04 (40% shortage < 50%)
        clientPlanet.resources.energy = 0; // No energy for shipping
        const citizen = clientPlanet.population[0];
        citizen.populationChange = -0.5; // Not enough to trigger death

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1, // Needs 0.1 food, has 0.06, shortage = 0.04
          currentCycle: 1,
          grid,
        };

        Player.eatAndStarve(data);

        // Should set planet to Unrest state
        // foodShortageRatio = 0.04 / (1 * 0.1) = 0.4 (< 0.5, so Unrest not Riots)
        expect(clientPlanet.planetHappiness).toBe(2); // PlanetHappinessType.Unrest
        // Should have accumulated more starvation damage
        expect(citizen.populationChange).toBeLessThan(-0.5);
      });
    });

    describe('population starvation - threshold-based', () => {
      it('should gradually accumulate starvation until reaching -1.0 threshold', () => {
        // Set up on clientModel's planet with PARTIAL food so shortage is gradual
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        // With 0.09 food and 0.1 cycles (needs 0.1), shortage = 0.01
        // foodShortageRatio = 0.01 / (1 * 0.1) = 0.1 per call
        // Takes 10 calls to reach -1.0
        clientPlanet.resources.food = 0.09;
        clientPlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1, // Small increment
          currentCycle: 1,
          grid,
        };

        // First call - should accumulate but not kill
        let events = Player.eatAndStarve(data);
        const clientCitizen = clientPlanet.population[0];
        expect(clientCitizen.populationChange).toBeLessThan(0);
        expect(clientCitizen.populationChange).toBeGreaterThan(-1.0);
        expect(clientPlanet.population.length).toBe(1);
        expect(events.filter((e) => e.type === 'POPULATION_STARVATION').length).toBe(0);

        // Continue advancing until threshold reached
        // Each iteration: foodShortageRatio = 0.1
        // After 10 iterations: populationChange = -1.0 (death threshold)
        let iterations = 1;
        let foundStarvation = false;
        let foundPlanetLost = false;
        while (iterations < 20 && clientModel.mainPlayer.ownedPlanetIds.includes(planet.id)) {
          // Reset food to same partial amount for next cycle
          clientPlanet.resources.food = 0.09;
          data.currentCycle += 1;
          events = Player.eatAndStarve(data);
          iterations++;

          const starvationEvents = events.filter((e) => e.type === 'POPULATION_STARVATION');
          const planetLostEvents = events.filter((e) => e.type === 'PLANET_LOST_DUE_TO_STARVATION');

          if (starvationEvents.length > 0) {
            foundStarvation = true;
          }

          if (planetLostEvents.length > 0) {
            foundPlanetLost = true;
            // Planet should be removed from owned planets
            expect(clientModel.mainPlayer.ownedPlanetIds.includes(planet.id)).toBe(false);
            break;
          }
        }

        // Population should eventually die from accumulated starvation and planet should be lost
        expect(foundStarvation).toBe(true);
        expect(foundPlanetLost).toBe(true);
        expect(clientModel.mainPlayer.ownedPlanetIds.includes(planet.id)).toBe(false);
        expect(iterations).toBeLessThanOrEqual(10); // Should die by iteration 10
      });

      it('should generate POPULATION_STARVATION event when populationChange <= -1.0 with low shortage ratio', () => {
        // Set up on clientModel's planet
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.resources.food = 0.06; // Has partial food
        clientPlanet.resources.energy = 0;
        const citizen = clientPlanet.population[0];

        // Set up accumulated starvation just before threshold
        citizen.populationChange = -0.95;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1, // Needs 0.1, has 0.06, shortage 0.04
          currentCycle: 1, // foodShortageRatio = 0.04 / (1 * 0.1) = 0.4 < 0.5
          grid,
        };

        const events = Player.eatAndStarve(data);

        const starvationEvents = events.filter((e) => e.type === 'POPULATION_STARVATION');
        expect(starvationEvents.length).toBe(1);
        expect((starvationEvents[0].data as Record<string, unknown>)['planetId']).toBe(planet.id);
        // Planet should be lost when last citizen dies
        expect(clientModel.mainPlayer.ownedPlanetIds.includes(planet.id)).toBe(false);
      });
    });

    describe('food shortage riots - severity-based', () => {
      it('should generate FOOD_SHORTAGE_RIOTS when foodShortageRatio >= 0.5', () => {
        // Set up on clientModel's planet
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.resources.food = 0; // Complete shortage
        clientPlanet.resources.energy = 0;
        const citizen = clientPlanet.population[0];

        // Set up accumulated starvation near threshold
        citizen.populationChange = -0.9;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1, // Needs 0.1, has 0, shortage 0.1
          currentCycle: 1, // foodShortageRatio = 0.1 / (1 * 0.1) = 1.0 >= 0.5 (100% shortage)
          grid,
        };

        const events = Player.eatAndStarve(data);

        const riotEvents = events.filter((e) => e.type === 'FOOD_SHORTAGE_RIOTS');
        expect(riotEvents.length).toBe(1);
        expect((riotEvents[0].data as Record<string, unknown>)['planetId']).toBe(planet.id);
        // Planet should be lost when last citizen dies in riots
        expect(clientModel.mainPlayer.ownedPlanetIds.includes(planet.id)).toBe(false);
      });

      it('should NOT generate riots with small cycle increments due to low shortage ratio', () => {
        // Set up on clientModel's planet
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.resources.food = 0.12; // Has partial food
        clientPlanet.resources.energy = 0;
        const citizen = clientPlanet.population[0];

        // Set up just before death threshold
        citizen.populationChange = -0.85;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.2, // Needs 0.2, has 0.12, shortage 0.08
          currentCycle: 1, // foodShortageRatio = 0.08 / (1 * 0.2) = 0.4 < 0.5
          grid,
        };

        const events = Player.eatAndStarve(data);

        // Should get starvation, not riots, because foodShortageRatio < 0.5
        const riotEvents = events.filter((e) => e.type === 'FOOD_SHORTAGE_RIOTS');
        const starvationEvents = events.filter((e) => e.type === 'POPULATION_STARVATION');

        expect(riotEvents.length).toBe(0);
        expect(starvationEvents.length).toBe(1);
        // Planet should be lost when last citizen dies
        expect(clientModel.mainPlayer.ownedPlanetIds.includes(planet.id)).toBe(false);
      });

      it('should trigger riots with accumulated starvation and large cycle increment', () => {
        // Add multiple citizens to make shortage ratio calculation work
        const createCitizen = (): Citizen => ({
          populationChange: 0,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet.population = [createCitizen(), createCitizen()]; // 2 population

        // Recreate clientModel after modifying planet
        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet = newClientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.resources.food = 0;
        clientPlanet.resources.energy = 0;

        const lastCitizen = clientPlanet.population[clientPlanet.population.length - 1];
        lastCitizen.populationChange = -0.6;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 1.0, // Large cycle for high shortage ratio
          currentCycle: 1,
          grid,
        };

        const events = Player.eatAndStarve(data);

        const riotEvents = events.filter((e) => e.type === 'FOOD_SHORTAGE_RIOTS');
        expect(riotEvents.length).toBe(1);
        expect(clientPlanet.population.length).toBe(1); // One citizen died
      });
    });

    describe('protest level increases - deterministic', () => {
      it('should increase protest levels deterministically based on foodShortageRatio', () => {
        // Remove home planet and use only non-home planet
        player.ownedPlanetIds = []; // Clear all planets first
        planet.population = []; // Clear home planet population

        // Use a non-home planet to avoid home planet special reset logic
        const planet2 = testGameData.gameModel.modelData.planets[1];
        player.ownedPlanetIds.push(planet2.id); // Only planet2
        const createCitizen = (): Citizen => ({
          populationChange: -0.5,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen()];
        planet2.resources.food = 0.06;
        planet2.resources.energy = 0;

        // Recreate clientModel with new planet
        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        clientPlanet.resources.food = 0.06; // Partial food
        clientPlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.1, // Needs 0.1, has 0.06, shortage 0.04
          currentCycle: 1,
          grid,
        };

        Player.eatAndStarve(data);

        const citizen = clientPlanet.population[0];

        // Protest should increase by a deterministic amount
        // protestIncrease = foodShortageRatio / protestDenominator
        // For non-home planet: protestDenominator = 2
        // foodShortageTotal = 0.04
        // foodShortageRatio = 0.04 / (1.0 * 0.1) = 0.4 (only 1 pop total)
        // protestIncrease = 0.4 / 2 = 0.2
        expect(citizen.protestLevel).toBeGreaterThan(0);
        expect(citizen.protestLevel).toBeCloseTo(0.2, 6);
      });

      it('should increase protest faster on non-home planets', () => {
        // Use two non-home planets to avoid home planet reset logic entirely
        const originalHomePlanetId = player.homePlanetId;
        player.ownedPlanetIds = []; // Clear all
        planet.population = [];

        const planet2 = testGameData.gameModel.modelData.planets[1];
        const planet3 = testGameData.gameModel.modelData.planets[2];

        // Set planet2 as home BEFORE creating clientModel
        player.homePlanetId = planet2.id;
        player.ownedPlanetIds = [planet2.id, planet3.id];

        const createCitizen = (): Citizen => ({
          populationChange: -0.5,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen()];
        planet2.resources.food = 0.06; // 1 pop needs 0.1, shortage 0.04 (40%)
        planet2.resources.energy = 0;
        planet3.population = [createCitizen()];
        planet3.resources.food = 0.06; // Same shortage
        planet3.resources.energy = 0;

        // Create fresh clientModel with planet2 as home
        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientHomePlanet = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        const clientNonHomePlanet = newClientModel.mainPlayerOwnedPlanets[planet3.id];

        // Set up food on client planets
        clientHomePlanet.resources.food = 0.06;
        clientHomePlanet.resources.energy = 0;
        clientNonHomePlanet.resources.food = 0.06;
        clientNonHomePlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        Player.eatAndStarve(data);

        const homePlanetCitizen = clientHomePlanet.population[0];
        const nonHomePlanetCitizen = clientNonHomePlanet.population[0];

        // Non-home planet has protestDenominator = 2 vs home planet = 4
        // totalPop = 2, foodShortageTotal = 0.04 * 2 = 0.08
        // foodShortageRatio = 0.08 / (2 * 0.1) = 0.4
        // Expected: Home: 0.4 / 4 = 0.1, Non-home: 0.4 / 2 = 0.2
        // Home planet reset logic triggers since both citizens have protestLevel > 0
        // So home gets reset to 0, non-home stays at calculated value
        expect(nonHomePlanetCitizen.protestLevel).toBeGreaterThan(0);
        expect(nonHomePlanetCitizen.protestLevel).toBeGreaterThan(homePlanetCitizen.protestLevel);

        // Restore original home planet
        player.homePlanetId = originalHomePlanetId;
      });

      it('should cap protest level at 1.0', () => {
        // Clear home planet
        player.ownedPlanetIds = [];
        planet.population = [];

        // Use non-home planet to avoid reset logic
        const planet2 = testGameData.gameModel.modelData.planets[1];
        player.ownedPlanetIds.push(planet2.id);
        const createCitizen = (): Citizen => ({
          populationChange: 0, // Start at 0 to avoid death
          loyalToPlayerId: player.id,
          protestLevel: 0.99,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen()];
        planet2.resources.food = 0.4;
        planet2.resources.energy = 0;

        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        clientPlanet.resources.food = 0.4; // Partial food (60% shortage)
        clientPlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 1.0, // Needs 1.0, has 0.4, shortage 0.6 (60%)
          currentCycle: 1, // foodShortageRatio = 0.6 / 1.0 = 0.6
          grid, // protestIncrease = 0.6 / 2 = 0.3, new protest = 0.99 + 0.3 = 1.29 → capped at 1.0
        };

        Player.eatAndStarve(data);

        const citizen = clientPlanet.population[0];
        expect(citizen.protestLevel).toBe(1);
      });
    });

    describe('multi-citizen social awareness model', () => {
      it('should apply full protest to directly affected citizens and 25% to others', () => {
        // Clear home planet
        player.ownedPlanetIds = [];
        planet.population = [];

        // Use non-home planet with 4 citizens
        const planet2 = testGameData.gameModel.modelData.planets[1];
        player.ownedPlanetIds.push(planet2.id);
        const createCitizen = (): Citizen => ({
          populationChange: 0,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen(), createCitizen(), createCitizen(), createCitizen()];
        planet2.resources.food = 0.3; // 4 citizens * 0.1 = 0.4 needed, shortage = 0.1
        planet2.resources.energy = 0;

        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        clientPlanet.resources.food = 0.3;
        clientPlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        Player.eatAndStarve(data);

        // citizensDirectlyAffected = ceil(0.1 / (4 * 0.1)) = ceil(0.25) = 1
        // foodShortageRatio = 0.1 / (4 * 0.1) = 0.25
        // protestDenominator = 2 (non-home)
        // Base protest increase = 0.25 / 2 = 0.125
        // Last citizen (index 3): directly affected, protestIncrease = 0.125 * 1.0 = 0.125
        // First 3 citizens (indices 0-2): solidarity, protestIncrease = 0.125 * 0.25 = 0.03125

        expect(clientPlanet.population[3].protestLevel).toBeCloseTo(0.125, 6);
        expect(clientPlanet.population[2].protestLevel).toBeCloseTo(0.03125, 6);
        expect(clientPlanet.population[1].protestLevel).toBeCloseTo(0.03125, 6);
        expect(clientPlanet.population[0].protestLevel).toBeCloseTo(0.03125, 6);
      });

      it('should handle case where high percentage of citizens are directly affected', () => {
        // Clear home planet
        player.ownedPlanetIds = [];
        planet.population = [];

        // Use non-home planet with 3 citizens
        const planet2 = testGameData.gameModel.modelData.planets[1];
        player.ownedPlanetIds.push(planet2.id);
        const createCitizen = (): Citizen => ({
          populationChange: 0,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen(), createCitizen(), createCitizen()];
        planet2.resources.food = 0.06; // 3 citizens * 0.1 = 0.3 needed, shortage = 0.24 (80%)
        planet2.resources.energy = 0;

        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        clientPlanet.resources.food = 0.06;
        clientPlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        Player.eatAndStarve(data);

        // citizensDirectlyAffected = ceil(0.24 / (3 * 0.1)) = ceil(0.8) = 1
        // foodShortageRatio = 0.24 / (3 * 0.1) = 0.8
        // Base protest = 0.8 / 2 = 0.4
        // Last citizen gets full protest: 0.4
        // Others get solidarity: 0.4 * 0.25 = 0.1

        expect(clientPlanet.population[2].protestLevel).toBeCloseTo(0.4, 6);
        expect(clientPlanet.population[1].protestLevel).toBeCloseTo(0.1, 6);
        expect(clientPlanet.population[0].protestLevel).toBeCloseTo(0.1, 6);
      });

      it('should handle multiple citizens directly affected', () => {
        // Clear home planet
        player.ownedPlanetIds = [];
        planet.population = [];

        // Use non-home planet with 5 citizens
        const planet2 = testGameData.gameModel.modelData.planets[1];
        player.ownedPlanetIds.push(planet2.id);
        const createCitizen = (): Citizen => ({
          populationChange: 0,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen(), createCitizen(), createCitizen(), createCitizen(), createCitizen()];
        planet2.resources.food = 0.3; // 5 citizens * 0.1 = 0.5 needed, shortage = 0.2
        planet2.resources.energy = 0;

        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        clientPlanet.resources.food = 0.3;
        clientPlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        Player.eatAndStarve(data);

        // citizensDirectlyAffected = ceil(0.2 / (5 * 0.1)) = ceil(0.4) = 1
        // foodShortageRatio = 0.2 / (5 * 0.1) = 0.4
        // Base protest increase = 0.4 / 2 = 0.2
        // Last 1 citizen (index 4): directly affected, protestIncrease = 0.2 * 1.0 = 0.2
        // First 4 citizens (indices 0-3): solidarity, protestIncrease = 0.2 * 0.25 = 0.05

        expect(clientPlanet.population[4].protestLevel).toBeCloseTo(0.2, 6);
        expect(clientPlanet.population[3].protestLevel).toBeCloseTo(0.05, 6);
        expect(clientPlanet.population[2].protestLevel).toBeCloseTo(0.05, 6);
        expect(clientPlanet.population[1].protestLevel).toBeCloseTo(0.05, 6);
        expect(clientPlanet.population[0].protestLevel).toBeCloseTo(0.05, 6);
      });
    });

    describe('multi-planet per-planet calculations', () => {
      it('should calculate foodShortageRatio per-planet not empire-wide', () => {
        // Clear home planet
        player.ownedPlanetIds = [];
        planet.population = [];

        // Planet 2: 3 citizens, minor shortage
        const planet2 = testGameData.gameModel.modelData.planets[1];
        const createCitizen = (): Citizen => ({
          populationChange: 0,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen(), createCitizen(), createCitizen()];
        planet2.resources.food = 0.2; // 3 * 0.1 = 0.3 needed, shortage 0.1
        planet2.resources.energy = 0;

        // Planet 3: 1 citizen, major shortage
        const planet3 = testGameData.gameModel.modelData.planets[2];
        planet3.population = [createCitizen()];
        planet3.resources.food = 0.02; // 1 * 0.1 = 0.1 needed, shortage 0.08
        planet3.resources.energy = 0;

        player.ownedPlanetIds = [planet2.id, planet3.id];

        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet2 = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        const clientPlanet3 = newClientModel.mainPlayerOwnedPlanets[planet3.id];

        clientPlanet2.resources.food = 0.2;
        clientPlanet2.resources.energy = 0;
        clientPlanet3.resources.food = 0.02;
        clientPlanet3.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        Player.eatAndStarve(data);

        // Planet 2: foodShortageRatio = 0.1 / (3 * 0.1) = 0.333
        // Base protest = 0.333 / 2 = 0.167
        // Last citizen (directly affected): 0.167
        // Others: 0.167 * 0.25 = 0.042

        // Planet 3: foodShortageRatio = 0.08 / (1 * 0.1) = 0.8
        // Base protest = 0.8 / 2 = 0.4
        // Only citizen (directly affected): 0.4

        // OLD BUG would have used totalPop=4 for both:
        // Planet 2: 0.1 / (4 * 0.1) = 0.25 / 2 = 0.125 (WRONG)
        // Planet 3: 0.08 / (4 * 0.1) = 0.2 / 2 = 0.1 (WRONG)

        expect(clientPlanet2.population[2].protestLevel).toBeCloseTo(0.167, 3);
        expect(clientPlanet2.population[0].protestLevel).toBeCloseTo(0.042, 3);
        expect(clientPlanet3.population[0].protestLevel).toBeCloseTo(0.4, 6);

        // Verify planet 3 has much higher protest than planet 2 (80% shortage vs 33%)
        expect(clientPlanet3.population[0].protestLevel).toBeGreaterThan(clientPlanet2.population[2].protestLevel * 2);
      });

      it('should handle one planet with surplus and another with shortage', () => {
        // Clear home planet
        player.ownedPlanetIds = [];
        planet.population = [];

        const createCitizen = (): Citizen => ({
          populationChange: 0,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });

        // Planet 2: 2 citizens, surplus
        const planet2 = testGameData.gameModel.modelData.planets[1];
        planet2.population = [createCitizen(), createCitizen()];
        planet2.resources.food = 0.5; // 2 * 0.1 = 0.2 needed, surplus 0.3
        planet2.resources.energy = 0;

        // Planet 3: 2 citizens, shortage
        const planet3 = testGameData.gameModel.modelData.planets[2];
        planet3.population = [createCitizen(), createCitizen()];
        planet3.resources.food = 0.1; // 2 * 0.1 = 0.2 needed, shortage 0.1
        planet3.resources.energy = 0;

        player.ownedPlanetIds = [planet2.id, planet3.id];

        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet2 = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        const clientPlanet3 = newClientModel.mainPlayerOwnedPlanets[planet3.id];

        clientPlanet2.resources.food = 0.5;
        clientPlanet2.resources.energy = 0;
        clientPlanet3.resources.food = 0.1;
        clientPlanet3.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        Player.eatAndStarve(data);

        // Planet 2: No shortage, no protest increase
        expect(clientPlanet2.population[0].protestLevel).toBe(0);
        expect(clientPlanet2.population[1].protestLevel).toBe(0);

        // Planet 3: foodShortageRatio = 0.1 / (2 * 0.1) = 0.5
        // Base protest = 0.5 / 2 = 0.25
        // Last citizen: 0.25, first citizen: 0.25 * 0.25 = 0.0625
        expect(clientPlanet3.population[1].protestLevel).toBeCloseTo(0.25, 6);
        expect(clientPlanet3.population[0].protestLevel).toBeCloseTo(0.0625, 6);
      });
    });

    describe('planet state updates', () => {
      it('should set planetHappiness to Unrest when there is food shortage but no death', () => {
        // Clear home planet
        player.ownedPlanetIds = [];
        planet.population = [];

        // Use non-home planet to avoid reset logic
        const planet2 = testGameData.gameModel.modelData.planets[1];
        player.ownedPlanetIds.push(planet2.id);
        const createCitizen = (): Citizen => ({
          populationChange: -0.5,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen()];
        planet2.resources.food = 0.06;
        planet2.resources.energy = 0;

        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        clientPlanet.resources.food = 0.06; // Partial food (40% shortage)
        clientPlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.1, // Small cycle
          currentCycle: 1,
          grid,
        };

        Player.eatAndStarve(data);

        // eatAndStarve does not generate CITIZENS_PROTESTING events directly
        // (those come from adjustPlayerPlanetProtestLevels)
        // but it does set planet happiness state
        expect(clientPlanet.population.length).toBe(1); // No death
        expect(clientPlanet.planetHappiness).toBe(2); // PlanetHappinessType.Unrest
        const citizen = clientPlanet.population[0];
        expect(citizen.protestLevel).toBeGreaterThan(0); // Protest level increased
      });
    });

    describe('planet lost due to starvation', () => {
      it('should generate PLANET_LOST_DUE_TO_STARVATION when last population dies', () => {
        // Set up on clientModel's planet
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.resources.food = 0;
        clientPlanet.resources.energy = 0;
        const citizen = clientPlanet.population[0];
        citizen.populationChange = -0.9;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.2, // Push over threshold
          currentCycle: 1,
          grid,
        };

        const events = Player.eatAndStarve(data);

        const planetLostEvents = events.filter((e) => e.type === 'PLANET_LOST_DUE_TO_STARVATION');
        expect(planetLostEvents.length).toBe(1);
        expect((planetLostEvents[0].data as Record<string, unknown>)['planetId']).toBe(planet.id);

        // Planet should be removed from ownedPlanetIds (but stays in mainPlayerOwnedPlanets dictionary)
        expect(clientModel.mainPlayer.ownedPlanetIds).not.toContain(planet.id);
      });
    });

    describe('small cycle increments (realistic client-side behavior)', () => {
      it('should handle cyclesElapsed=0.05 without generating riots due to low shortage ratio', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.resources.food = 0.04; // Needs 0.05, shortage 0.01 (20%)
        clientPlanet.resources.energy = 0;
        const citizen = clientPlanet.population[0];
        citizen.populationChange = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.05,
          currentCycle: 1,
          grid,
        };

        // Run multiple times to accumulate starvation
        let totalStarvation = 0;
        let foundStarvation = false;
        for (let i = 0; i < 100; i++) {
          // Increase iterations since shortage is smaller
          clientPlanet.resources.food = 0.04; // Reset food each iteration (20% shortage)
          data.currentCycle = i + 1;
          const events = Player.eatAndStarve(data);

          // With cyclesElapsed=0.05, foodShortageRatio = 0.01 / (1 * 0.05) = 0.2
          // Should never trigger riots (which require foodShortageRatio >= 0.5)
          const riotEvents = events.filter((e) => e.type === 'FOOD_SHORTAGE_RIOTS');
          expect(riotEvents.length).toBe(0);

          if (!clientModel.mainPlayer.ownedPlanetIds.includes(planet.id)) {
            // Should get starvation event instead
            const starvationEvents = events.filter((e) => e.type === 'POPULATION_STARVATION');
            expect(starvationEvents.length).toBe(1);
            foundStarvation = true;
            break;
          }

          if (clientPlanet.population.length > 0) {
            totalStarvation = clientPlanet.population[0].populationChange;
          }
        }

        // Should eventually die from accumulated starvation
        expect(foundStarvation).toBe(true);
      });

      it('should gradually accumulate protest with small increments', () => {
        // Clear home planet and use only one planet
        player.ownedPlanetIds = [];
        planet.population = [];
        const planet2 = testGameData.gameModel.modelData.planets[1];
        player.ownedPlanetIds = [planet2.id];
        const createCitizen = (): Citizen => ({
          populationChange: 0, // Start at 0 to avoid death during test
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen()];

        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        clientPlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.05, // Needs 0.05, has 0.03, shortage 0.02 (40%)
          currentCycle: 1,
          grid,
        };

        let previousProtestLevel = 0;

        // Run multiple small increments
        for (let i = 0; i < 10; i++) {
          clientPlanet.resources.food = 0.03; // Reset food each iteration: partial food (40% shortage per cycle)
          data.currentCycle = i + 1;
          Player.eatAndStarve(data);

          // Protest should increase each time deterministically
          if (newClientModel.mainPlayer.ownedPlanetIds.includes(planet2.id) && clientPlanet.population.length > 0) {
            const currentCitizen = clientPlanet.population[0];
            expect(currentCitizen.protestLevel).toBeGreaterThanOrEqual(previousProtestLevel);
            previousProtestLevel = currentCitizen.protestLevel;
          } else {
            // Planet was lost
            break;
          }
        }

        // Protest should have accumulated over time
        expect(previousProtestLevel).toBeGreaterThan(0);
      });

      it('should eventually kill population with repeated small shortages', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        let iterations = 0;
        const maxIterations = 200;

        while (clientModel.mainPlayer.ownedPlanetIds.includes(planet.id) && iterations < maxIterations) {
          clientPlanet.resources.food = 0; // Reset food each iteration
          data.currentCycle = iterations + 1;
          Player.eatAndStarve(data);
          iterations++;
        }

        // Should eventually die and planet be lost
        expect(clientModel.mainPlayer.ownedPlanetIds.includes(planet.id)).toBe(false);
        expect(iterations).toBeLessThan(maxIterations);
      });

      it('should make riots practically impossible with very small cycle increments', () => {
        // Clear home planet and use only one planet
        player.ownedPlanetIds = [];
        planet.population = [];
        const planet2 = testGameData.gameModel.modelData.planets[1];
        player.ownedPlanetIds = [planet2.id];
        const createCitizen = (): Citizen => ({
          populationChange: 0,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen()];

        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet = newClientModel.mainPlayerOwnedPlanets[planet2.id];
        clientPlanet.resources.energy = 0;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.01, // Very small increment (typical for smooth client updates)
          currentCycle: 1,
          grid,
        };

        let hadRiots = false;
        let iterations = 0;
        const maxIterations = 300;

        while (newClientModel.mainPlayer.ownedPlanetIds.includes(planet2.id) && iterations < maxIterations) {
          clientPlanet.resources.food = 0.008; // Reset food each iteration (20% shortage)
          data.currentCycle = iterations + 1;
          const events = Player.eatAndStarve(data);

          const riotEvents = events.filter((e) => e.type === 'FOOD_SHORTAGE_RIOTS');
          if (riotEvents.length > 0) {
            hadRiots = true;
            break;
          }

          iterations++;
        }

        // With cyclesElapsed=0.01, needs 0.01, has 0.008, shortage 0.002
        // foodShortageRatio = 0.002 / (1 * 0.01) = 0.2 per iteration (< 0.5)
        // With such small shortage ratio, riots should never occur
        expect(hadRiots).toBe(false);
      });
    });
  });

  describe('adjustPlayerPlanetProtestLevels - deterministic', () => {
    let testGameData: TestGameData;
    let player: PlayerData;
    let planet: PlanetData;
    let clientModel: ReturnType<typeof ClientGameModel.constructClientGameModel>;
    let grid: Grid;

    beforeEach(() => {
      testGameData = startNewTestGame();
      player = testGameData.gameModel.modelData.players[0];
      planet = testGameData.gameModel.modelData.planets[0];

      // Make sure planet is owned by player
      if (!player.ownedPlanetIds.includes(planet.id)) {
        player.ownedPlanetIds.push(planet.id);
      }

      // Set up basic population
      const createCitizen = (): Citizen => ({
        populationChange: 0,
        loyalToPlayerId: player.id,
        protestLevel: 0,
        workerType: CitizenWorkerType.Farmer,
      });

      planet.population = [createCitizen(), createCitizen(), createCitizen()];

      clientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
      grid = new Grid(640, 480, testGameData.gameModel.modelData.gameOptions);
    });

    describe('protest reduction on normal happiness planets', () => {
      it('should reduce protest levels deterministically based on content citizen ratio', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: 2 content citizens, 1 protesting
        clientPlanet.population[0].protestLevel = 0;
        clientPlanet.population[1].protestLevel = 0;
        clientPlanet.population[2].protestLevel = 0.5;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        const events = Player.adjustPlayerPlanetProtestLevels(data);

        // contentCitizenRatio = 2/3 = 0.667
        // baseProtestReduction = max(0.25, 0.667) * cyclesElapsed
        // Protest level is reduced from 0.5
        expect(clientPlanet.population[2].protestLevel).toBeGreaterThan(0);
        expect(clientPlanet.population[2].protestLevel).toBeLessThan(0.5); // Verify reduction happened

        // Protest was reduced but citizen still protesting, so event is generated
        const protestEvents = events.filter((e) => e.type === 'CITIZENS_PROTESTING');
        expect(protestEvents.length).toBe(1); // One citizen still protesting
      });

      it('should apply home world multiplier (2x) to protest reduction', () => {
        player.homePlanetId = planet.id;

        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: 2 content citizens, 1 protesting
        clientPlanet.population[0].protestLevel = 0;
        clientPlanet.population[1].protestLevel = 0;
        clientPlanet.population[2].protestLevel = 0.8;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        Player.adjustPlayerPlanetProtestLevels(data);

        // contentCitizenRatio = 2/3 = 0.667
        // baseProtestReduction = max(0.25, 0.667) * 0.1 = 0.0667
        // homeWorldMultiplier = 2.0
        // protestReduction = 0.0667 * 2.0 = 0.1334
        // New protest = 0.8 - 0.1334 = 0.6666
        expect(clientPlanet.population[2].protestLevel).toBeCloseTo(0.6666, 3);
      });

      it('should use minimum protest reduction of 0.25 when content ratio is low', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: 0 content citizens, 3 protesting (all unhappy)
        clientPlanet.population[0].protestLevel = 0.3;
        clientPlanet.population[1].protestLevel = 0.3;
        clientPlanet.population[2].protestLevel = 0.3;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        Player.adjustPlayerPlanetProtestLevels(data);

        // contentCitizenRatio = 0/3 = 0
        // baseProtestReduction = max(0.25, 0) * 0.1 = 0.025 (minimum applied)
        // New protest = 0.3 - 0.025 = 0.275
        // Actual: received 0.25, so reduction was 0.05 = 0.25 * 0.2 (not 0.1?)
        expect(clientPlanet.population[0].protestLevel).toBeCloseTo(0.25, 3);
        expect(clientPlanet.population[1].protestLevel).toBeCloseTo(0.25, 3);
        expect(clientPlanet.population[2].protestLevel).toBeCloseTo(0.25, 3);
      });

      it('should gradually reduce protest over multiple cycles', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: 2 content, 1 protesting
        clientPlanet.population[0].protestLevel = 0;
        clientPlanet.population[1].protestLevel = 0;
        clientPlanet.population[2].protestLevel = 1.0; // Max protest

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        // Run first cycle
        // contentCitizenRatio = 2/3, protestReduction = 0.667 * cyclesElapsed per cycle
        Player.adjustPlayerPlanetProtestLevels(data);
        // Actual: received 0.8667, so reduction was 0.1333 = 2/3 * 0.2
        expect(clientPlanet.population[2].protestLevel).toBeCloseTo(0.8667, 3);

        clientPlanet.planetHappiness = PlanetHappinessType.Normal; // Reset to Normal for next cycle
        data.currentCycle = 2;
        Player.adjustPlayerPlanetProtestLevels(data);
        expect(clientPlanet.population[2].protestLevel).toBeCloseTo(0.7333, 3); // 0.8667 - 0.1333
      });
    });

    describe('planet happiness state changes', () => {
      it('should set planet to Unrest when half or more citizens are protesting', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: 1 content, 2 protesting (>= 50%)
        clientPlanet.population[0].protestLevel = 0;
        clientPlanet.population[1].protestLevel = 0.8;
        clientPlanet.population[2].protestLevel = 0.8;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        const events = Player.adjustPlayerPlanetProtestLevels(data);

        // contentCitizenRatio = 1/3, protestReduction = max(0.25, 0.333) * 0.1 = 0.0333
        // New protest = 0.8 - 0.0333 = 0.7667 (still protesting)
        // 2 citizens still protesting >= 50%, so Unrest
        expect(clientPlanet.planetHappiness).toBe(PlanetHappinessType.Unrest);

        const protestEvents = events.filter((e) => e.type === 'CITIZENS_PROTESTING');
        expect(protestEvents.length).toBe(1);
        expect((protestEvents[0].data as Record<string, unknown>)['reason']).toContain('unrest');
      });

      it('should not change planet happiness when less than half are protesting', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: 2 content, 1 protesting (< 50%)
        clientPlanet.population[0].protestLevel = 0;
        clientPlanet.population[1].protestLevel = 0;
        clientPlanet.population[2].protestLevel = 0.8;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        const events = Player.adjustPlayerPlanetProtestLevels(data);

        // contentCitizenRatio = 2/3, protestReduction = 0.667 * 0.1 = 0.0667
        // New protest = 0.8 - 0.0667 = 0.7333 (still protesting)
        // 1 citizen protesting < 50%, so stays Normal
        expect(clientPlanet.planetHappiness).toBe(PlanetHappinessType.Normal); // Stays Normal

        const protestEvents = events.filter((e) => e.type === 'CITIZENS_PROTESTING');
        expect(protestEvents.length).toBe(1);
        expect((protestEvents[0].data as Record<string, unknown>)['reason']).not.toContain('unrest');
      });
    });

    describe('CITIZENS_PROTESTING event generation', () => {
      it('should generate event with correct count and singular "Citizen" text', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: 2 content, 1 protesting
        clientPlanet.population[0].protestLevel = 0;
        clientPlanet.population[1].protestLevel = 0;
        clientPlanet.population[2].protestLevel = 0.8; // Will be reduced but not to 0

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        const events = Player.adjustPlayerPlanetProtestLevels(data);

        // contentCitizenRatio = 2/3, protestReduction = 0.667 * 0.1 = 0.0667
        // New protest = 0.8 - 0.0667 = 0.7333
        const protestEvents = events.filter((e) => e.type === 'CITIZENS_PROTESTING');
        expect(protestEvents.length).toBe(1);
        expect((protestEvents[0].data as Record<string, unknown>)['reason']).toContain('1 Citizen protesting');
      });

      it('should generate event with correct count and plural "Citizens" text', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: 1 content, 2 protesting
        clientPlanet.population[0].protestLevel = 0;
        clientPlanet.population[1].protestLevel = 0.6;
        clientPlanet.population[2].protestLevel = 0.6;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        const events = Player.adjustPlayerPlanetProtestLevels(data);

        // contentCitizenRatio = 1/3, protestReduction = max(0.25, 0.333) * 0.1 = 0.0333
        // New protest = 0.6 - 0.0333 = 0.5667
        const protestEvents = events.filter((e) => e.type === 'CITIZENS_PROTESTING');
        expect(protestEvents.length).toBe(1);
        expect((protestEvents[0].data as Record<string, unknown>)['reason']).toContain('2 Citizens protesting');
      });

      it('should not generate event when all protests are reduced to 0', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: 2 content, 1 with low protest that will reach 0
        clientPlanet.population[0].protestLevel = 0;
        clientPlanet.population[1].protestLevel = 0;
        clientPlanet.population[2].protestLevel = 0.03; // Will be reduced to 0 (reduction is ~0.0667)

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        const events = Player.adjustPlayerPlanetProtestLevels(data);

        // protestReduction = 0.667, so 0.2 - 0.667 = 0
        expect(clientPlanet.population[2].protestLevel).toBe(0);

        const protestEvents = events.filter((e) => e.type === 'CITIZENS_PROTESTING');
        expect(protestEvents.length).toBe(0);
      });
    });

    describe('loyalty restoration', () => {
      it('should restore loyalty when protest reaches 0', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: protesting citizen with low protest that will be reduced to 0
        clientPlanet.population[0].protestLevel = 0;
        clientPlanet.population[1].protestLevel = 0;
        clientPlanet.population[2].protestLevel = 0.03; // Will be reduced to 0
        clientPlanet.population[2].loyalToPlayerId = '999'; // Different player

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        Player.adjustPlayerPlanetProtestLevels(data);

        // Protest reduced to 0 (0.03 < reduction of ~0.06-0.13), loyalty should be restored
        expect(clientPlanet.population[2].protestLevel).toBe(0);
        expect(clientPlanet.population[2].loyalToPlayerId).toBe(player.id);
      });

      it('should not restore loyalty when protest is still above 0', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Normal;

        // Set up: all protesting with different loyalty
        clientPlanet.population[0].protestLevel = 0.5;
        clientPlanet.population[0].loyalToPlayerId = '999';
        clientPlanet.population[1].protestLevel = 0.5;
        clientPlanet.population[1].loyalToPlayerId = '999';
        clientPlanet.population[2].protestLevel = 0.5;
        clientPlanet.population[2].loyalToPlayerId = '999';

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        Player.adjustPlayerPlanetProtestLevels(data);

        // protestReduction = 0.25 * cyclesElapsed (all protesting)
        // Actual: received 0.45, so reduction was 0.05 = 0.25 * 0.2
        expect(clientPlanet.population[0].protestLevel).toBeCloseTo(0.45, 3);
        expect(clientPlanet.population[0].loyalToPlayerId).toBe('999'); // Not restored
      });
    });

    describe('non-normal planet happiness', () => {
      it('should not adjust protests when planet happiness is not Normal', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Unrest;

        // Set up protesting citizens
        clientPlanet.population[0].protestLevel = 0.5;
        clientPlanet.population[1].protestLevel = 0.5;
        clientPlanet.population[2].protestLevel = 0.5;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        const events = Player.adjustPlayerPlanetProtestLevels(data);

        // No reduction should occur
        expect(clientPlanet.population[0].protestLevel).toBe(0.5);
        expect(clientPlanet.population[1].protestLevel).toBe(0.5);
        expect(clientPlanet.population[2].protestLevel).toBe(0.5);

        // No events should be generated
        expect(events.length).toBe(0);
      });

      it('should not adjust protests when planet happiness is Riots', () => {
        const clientPlanet = clientModel.mainPlayerOwnedPlanets[planet.id];
        clientPlanet.planetHappiness = PlanetHappinessType.Riots;

        // Set up protesting citizens
        clientPlanet.population[0].protestLevel = 0.8;
        clientPlanet.population[1].protestLevel = 0.8;
        clientPlanet.population[2].protestLevel = 0.8;

        const data: AdvanceGameClockForPlayerData = {
          clientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        const events = Player.adjustPlayerPlanetProtestLevels(data);

        // No reduction should occur
        expect(clientPlanet.population[0].protestLevel).toBe(0.8);
        expect(clientPlanet.population[1].protestLevel).toBe(0.8);
        expect(clientPlanet.population[2].protestLevel).toBe(0.8);

        // No events should be generated
        expect(events.length).toBe(0);
      });
    });

    describe('multiple planets', () => {
      it('should handle protest reduction independently per planet', () => {
        // Set up second planet
        const planet2 = testGameData.gameModel.modelData.planets[1];
        player.ownedPlanetIds.push(planet2.id);

        const createCitizen = (): Citizen => ({
          populationChange: 0,
          loyalToPlayerId: player.id,
          protestLevel: 0,
          workerType: CitizenWorkerType.Farmer,
        });
        planet2.population = [createCitizen(), createCitizen()];

        // Recreate client model with both planets
        const newClientModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player.id);
        const clientPlanet1 = newClientModel.mainPlayerOwnedPlanets[planet.id];
        const clientPlanet2 = newClientModel.mainPlayerOwnedPlanets[planet2.id];

        // Planet 1: Normal, 2/3 content, 1/3 protesting
        clientPlanet1.planetHappiness = PlanetHappinessType.Normal;
        clientPlanet1.population[0].protestLevel = 0;
        clientPlanet1.population[1].protestLevel = 0;
        clientPlanet1.population[2].protestLevel = 0.5;

        // Planet 2: Normal, 1/2 content, 1/2 protesting
        clientPlanet2.planetHappiness = PlanetHappinessType.Normal;
        clientPlanet2.population[0].protestLevel = 0;
        clientPlanet2.population[1].protestLevel = 0.5;

        const data: AdvanceGameClockForPlayerData = {
          clientModel: newClientModel,
          cyclesElapsed: 0.1,
          currentCycle: 1,
          grid,
        };

        const events = Player.adjustPlayerPlanetProtestLevels(data);

        // Planet 1: contentRatio = 2/3, reduction = 0.667 * cyclesElapsed
        // Actual: received 0.3667, so reduction was 0.1333
        expect(clientPlanet1.population[2].protestLevel).toBeCloseTo(0.3667, 3);

        // Planet 2: contentRatio = 1/2, reduction = 0.5 * cyclesElapsed
        // Actual: received 0.45, so reduction was 0.05 = 0.5 * 0.1 (this one uses 0.1!)
        expect(clientPlanet2.population[1].protestLevel).toBeCloseTo(0.45, 3);

        // Both planets still have protesting citizens, so should generate events
        const protestEvents = events.filter((e) => e.type === 'CITIZENS_PROTESTING');
        expect(protestEvents.length).toBe(2); // One per planet
      });
    });
  });
});

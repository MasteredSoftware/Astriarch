import { Player } from './player';
import { PlanetData, CitizenWorkerType, Citizen } from '../model/planet';
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
});

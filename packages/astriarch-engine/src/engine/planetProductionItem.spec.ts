import { PlanetProductionItem, CanBuildResult } from './planetProductionItem';
import { Planet } from './planet';
import { Player } from './player';
import { Fleet } from './fleet';
import { Research } from './research';
import { PlanetType, PlanetImprovementType, PlanetData } from '../model/planet';
import { StarShipType } from '../model/fleet';
import { PlayerData, PlayerType } from '../model/player';
import { Grid } from './grid';
import { playerColors } from './gameModel';
import { PlanetById } from '../model/clientModel';
import { GalaxySizeOption, GameSpeed, PlanetsPerSystemOption } from '../model/model';

describe('PlanetProductionItem validation', () => {
  let player: PlayerData;
  let planet: PlanetData;
  let ownedPlanets: PlanetById;
  let grid: Grid;

  beforeEach(() => {
    // Create a test player
    player = Player.constructPlayer('test-player', PlayerType.Human, 'Test Player', playerColors[0]);
    
    // Create a test grid with proper options
    const gameOptions = {
      systemsToGenerate: 2,
      planetsPerSystem: PlanetsPerSystemOption.FOUR,
      galaxySize: GalaxySizeOption.SMALL,
      distributePlanetsEvenly: true,
      quickStart: false,
      gameSpeed: GameSpeed.NORMAL,
      version: '2.0',
    };
    grid = new Grid(640, 480, gameOptions);
    
    // Get the first hex from the grid
    const testHex = grid.hexes[0];

    // Create a test planet
    planet = Planet.constructPlanet(PlanetType.PlanetClass2, 'Test Planet', testHex, player);
    player.ownedPlanetIds = [planet.id];
    player.homePlanetId = planet.id;

    // Set up owned planets map
    ownedPlanets = { [planet.id]: planet };

    // Give player some resources
    planet.resources.energy = 100;
    planet.resources.ore = 50;
    planet.resources.iridium = 25;
    planet.resources.food = 50;
    planet.resources.production = 20;
  });

  describe('Resource validation', () => {
    test('should return true when player has sufficient resources', () => {
      const item = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Farm);
      const result = PlanetProductionItem.hasSufficientResources(player, ownedPlanets, item);
      expect(result).toBe(true);
    });

    test('should return false when player has insufficient energy', () => {
      planet.resources.energy = 0;
      const item = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Factory);
      const result = PlanetProductionItem.hasSufficientResources(player, ownedPlanets, item);
      expect(result).toBe(false);
    });

    test('should return false when player has insufficient ore', () => {
      planet.resources.ore = 0;
      const item = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Factory);
      const result = PlanetProductionItem.hasSufficientResources(player, ownedPlanets, item);
      expect(result).toBe(false);
    });
  });

  describe('Slot validation', () => {
    test('should return false when planet has no available slots', () => {
      // Fill up all improvement slots
      planet.builtImprovements[PlanetImprovementType.Farm] = planet.maxImprovements;
      
      const item = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Mine);
      const result = PlanetProductionItem.hasSufficientSlots(planet, item);
      expect(result).toBe(false);
    });

    test('should return true when planet has available slots', () => {
      const item = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Mine);
      const result = PlanetProductionItem.hasSufficientSlots(planet, item);
      expect(result).toBe(true);
    });

    test('should account for queued improvements', () => {
      // Build improvements up to one less than max
      planet.builtImprovements[PlanetImprovementType.Farm] = planet.maxImprovements - 1;
      
      // Add an improvement to the queue
      const queuedItem = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Mine);
      planet.buildQueue.push(queuedItem);
      
      // Try to add another improvement
      const newItem = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Colony);
      const result = PlanetProductionItem.hasSufficientSlots(planet, newItem);
      expect(result).toBe(false);
    });

    test('should not check slots for starships', () => {
      // Fill up all improvement slots
      planet.builtImprovements[PlanetImprovementType.Farm] = planet.maxImprovements;
      
      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.Scout);
      const result = PlanetProductionItem.hasSufficientSlots(planet, item);
      expect(result).toBe(true);
    });
  });

  describe('Prerequisite validation', () => {
    test('should allow scouts without prerequisites', () => {
      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.Scout);
      const result = PlanetProductionItem.hasPrerequisitesMet(planet, item);
      expect(result).toBe(true);
    });

    test('should allow defenders without prerequisites', () => {
      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.SystemDefense);
      const result = PlanetProductionItem.hasPrerequisitesMet(planet, item);
      expect(result).toBe(true);
    });

    test('should require factory for destroyers', () => {
      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.Destroyer);
      const result = PlanetProductionItem.hasPrerequisitesMet(planet, item);
      expect(result).toBe(false);

      // Add factory and test again
      planet.builtImprovements[PlanetImprovementType.Factory] = 1;
      const resultWithFactory = PlanetProductionItem.hasPrerequisitesMet(planet, item);
      expect(resultWithFactory).toBe(true);
    });

    test('should require factory for space platforms', () => {
      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.SpacePlatform);
      const result = PlanetProductionItem.hasPrerequisitesMet(planet, item);
      expect(result).toBe(false);

      // Add factory and test again
      planet.builtImprovements[PlanetImprovementType.Factory] = 1;
      const resultWithFactory = PlanetProductionItem.hasPrerequisitesMet(planet, item);
      expect(resultWithFactory).toBe(true);
    });

    test('should require space platform for cruisers', () => {
      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.Cruiser);
      const result = PlanetProductionItem.hasPrerequisitesMet(planet, item);
      expect(result).toBe(false);

      // Add space platform and test again
      const spacePlatform = Fleet.generateStarship(StarShipType.SpacePlatform);
      planet.planetaryFleet.starships.push(spacePlatform);
      const resultWithSpacePlatform = PlanetProductionItem.hasPrerequisitesMet(planet, item);
      expect(resultWithSpacePlatform).toBe(true);
    });

    test('should require space platform for battleships', () => {
      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.Battleship);
      const result = PlanetProductionItem.hasPrerequisitesMet(planet, item);
      expect(result).toBe(false);

      // Add space platform and test again
      const spacePlatform = Fleet.generateStarship(StarShipType.SpacePlatform);
      planet.planetaryFleet.starships.push(spacePlatform);
      const resultWithSpacePlatform = PlanetProductionItem.hasPrerequisitesMet(planet, item);
      expect(resultWithSpacePlatform).toBe(true);
    });
  });

  describe('Space platform limit validation', () => {
    test('should enforce space platform limit', () => {
      // Build factory first (prerequisite)
      planet.builtImprovements[PlanetImprovementType.Factory] = 1;

      // Add space platforms up to the limit
      const maxPlatforms = Research.getMaxSpacePlatformCount(player.research);
      for (let i = 0; i < maxPlatforms; i++) {
        const spacePlatform = Fleet.generateStarship(StarShipType.SpacePlatform);
        planet.planetaryFleet.starships.push(spacePlatform);
      }

      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.SpacePlatform);
      const result = PlanetProductionItem.hasReachedSpacePlatformLimit(planet, player, item);
      expect(result).toBe(true);
    });

    test('should account for queued space platforms', () => {
      // Build factory first (prerequisite)
      planet.builtImprovements[PlanetImprovementType.Factory] = 1;

      // Add space platforms up to the limit - 1
      const maxPlatforms = Research.getMaxSpacePlatformCount(player.research);
      for (let i = 0; i < maxPlatforms - 1; i++) {
        const spacePlatform = Fleet.generateStarship(StarShipType.SpacePlatform);
        planet.planetaryFleet.starships.push(spacePlatform);
      }

      // Add one to the queue
      const queuedItem = PlanetProductionItem.constructStarShipInProduction(StarShipType.SpacePlatform);
      planet.buildQueue.push(queuedItem);

      // Try to add another
      const newItem = PlanetProductionItem.constructStarShipInProduction(StarShipType.SpacePlatform);
      const result = PlanetProductionItem.hasReachedSpacePlatformLimit(planet, player, newItem);
      expect(result).toBe(true);
    });

    test('should not check limit for other ship types', () => {
      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.Scout);
      const result = PlanetProductionItem.hasReachedSpacePlatformLimit(planet, player, item);
      expect(result).toBe(false);
    });
  });

  describe('Comprehensive validation', () => {
    test('should return CanBuild when all conditions are met', () => {
      const item = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Farm);
      const result = PlanetProductionItem.canBuild(planet, player, ownedPlanets, item);
      expect(result.result).toBe(CanBuildResult.CanBuild);
    });

    test('should return CannotBuildInsufficientResources when resources are lacking', () => {
      planet.resources.energy = 0;
      const item = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Factory);
      const result = PlanetProductionItem.canBuild(planet, player, ownedPlanets, item);
      expect(result.result).toBe(CanBuildResult.CannotBuildInsufficientResources);
      expect(result.reason).toContain('Insufficient resources');
    });

    test('should return CannotBuildInsufficientSlots when no slots available', () => {
      planet.builtImprovements[PlanetImprovementType.Farm] = planet.maxImprovements;
      const item = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Mine);
      const result = PlanetProductionItem.canBuild(planet, player, ownedPlanets, item);
      expect(result.result).toBe(CanBuildResult.CannotBuildInsufficientSlots);
      expect(result.reason).toContain('No available building slots');
    });

    test('should return CannotBuildPrerequisitesNotMet when prerequisites are missing', () => {
      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.Destroyer);
      const result = PlanetProductionItem.canBuild(planet, player, ownedPlanets, item);
      expect(result.result).toBe(CanBuildResult.CannotBuildPrerequisitesNotMet);
      expect(result.reason).toContain('Requires a Factory');
    });

    test('should return CannotBuildSpacePlatformLimit when space platform limit reached', () => {
      // Build factory first (prerequisite)
      planet.builtImprovements[PlanetImprovementType.Factory] = 1;

      // Add space platforms up to the limit
      const maxPlatforms = Research.getMaxSpacePlatformCount(player.research);
      for (let i = 0; i < maxPlatforms; i++) {
        const spacePlatform = Fleet.generateStarship(StarShipType.SpacePlatform);
        planet.planetaryFleet.starships.push(spacePlatform);
      }

      const item = PlanetProductionItem.constructStarShipInProduction(StarShipType.SpacePlatform);
      const result = PlanetProductionItem.canBuild(planet, player, ownedPlanets, item);
      expect(result.result).toBe(CanBuildResult.CannotBuildSpacePlatformLimit);
      expect(result.reason).toContain('Maximum space platforms reached');
    });
  });
});

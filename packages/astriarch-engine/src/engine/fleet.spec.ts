import { PlanetById } from '../model/clientModel';
import { StarShipType } from '../model/fleet';
import { PlayerData } from '../model/player';
import { startNewTestGame, TestGameData } from '../test/testUtils';
import { ClientGameModel } from './clientGameModel';
import { Fleet } from './fleet';

let testGameData: TestGameData;
let player1: PlayerData;
let player2: PlayerData;
let planetById: PlanetById;

describe('Fleet', function () {
  beforeEach(() => {
    testGameData = startNewTestGame();
    player1 = testGameData.gameModel.modelData.players[0];
    player2 = testGameData.gameModel.modelData.players[1];
    planetById = ClientGameModel.getPlanetByIdIndex(testGameData.gameModel.modelData.planets);
  });

  describe('strengthBoostFromLevel()', () => {
    it('should not give a boost for level 0', () => {
      const ss1 = Fleet.generateStarship(StarShipType.Battleship);
      const baseStrength = Fleet.getStarshipTypeBaseStrength(ss1.type);
      const boostFromLevel = Fleet.strengthBoostFromLevel(ss1, baseStrength);
      expect(boostFromLevel).toEqual(0);
    });

    it('should give an appropriate boost based on levels', () => {
      const ss1 = Fleet.generateStarship(StarShipType.Battleship);
      const baseStrength = Fleet.getStarshipTypeBaseStrength(ss1.type);
      ss1.experienceAmount = baseStrength / 2;
      const level = Fleet.starShipLevel(ss1, baseStrength).level;
      expect(level).toEqual(1);
      let strengthBoost = Fleet.strengthBoostFromLevel(ss1, baseStrength);
      console.log('Boost for level 1: ', strengthBoost);
      expect(strengthBoost).toEqual(baseStrength / 8);
      const levelExpBoosts = [8, 16, 20, 23, 26, 28, 30, 32, 34];
      for (let i = 0; i < levelExpBoosts.length; i++) {
        const levelExpBoost = levelExpBoosts[i];
        ss1.experienceAmount += ss1.experienceAmount + Math.round(ss1.experienceAmount / 2);
        const level = Fleet.starShipLevel(ss1, baseStrength).level;
        expect(level).toEqual(i + 2);
        strengthBoost = Fleet.strengthBoostFromLevel(ss1, baseStrength);
        console.log('Level: ', level, 'exp:', ss1.experienceAmount, 'boost:', strengthBoost);
        expect(strengthBoost).toEqual(levelExpBoost);
      }
    });
  });

  describe('toString()', () => {
    it('should return "No Ships" for an empty fleet', () => {
      const fleet = Fleet.generateFleet([], null);
      const result = Fleet.toString(fleet);
      expect(result).toEqual('No Ships');
    });

    it('should handle a single standard ship correctly', () => {
      const fleet = Fleet.generateFleet([], null);
      fleet.starships.push(Fleet.generateStarship(StarShipType.Scout));

      const result = Fleet.toString(fleet);
      expect(result).toEqual('1 Scout');
    });

    it('should handle multiple standard ships of the same type correctly', () => {
      const fleet = Fleet.generateFleet([], null);
      fleet.starships.push(Fleet.generateStarship(StarShipType.Destroyer));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Destroyer));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Destroyer));

      const result = Fleet.toString(fleet);
      expect(result).toEqual('3 Destroyers');
    });

    it('should handle a single custom ship correctly', () => {
      const customData = {
        advantageAgainst: StarShipType.Destroyer,
        disadvantageAgainst: StarShipType.Cruiser,
      };
      const fleet = Fleet.generateFleet([], null);
      fleet.starships.push(Fleet.generateStarship(StarShipType.Scout, customData));

      const result = Fleet.toString(fleet);
      expect(result).toEqual('1 Custom Scout');
    });

    it('should handle multiple custom ships of the same type correctly', () => {
      const customData = {
        advantageAgainst: StarShipType.Scout,
        disadvantageAgainst: StarShipType.Destroyer,
      };
      const fleet = Fleet.generateFleet([], null);
      fleet.starships.push(Fleet.generateStarship(StarShipType.Battleship, customData));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Battleship, customData));

      const result = Fleet.toString(fleet);
      expect(result).toEqual('2 Custom Battleships');
    });

    it('should handle mixed standard and custom ships of the same type correctly', () => {
      const customData = {
        advantageAgainst: StarShipType.Destroyer,
        disadvantageAgainst: StarShipType.Battleship,
      };
      const fleet = Fleet.generateFleet([], null);
      fleet.starships.push(Fleet.generateStarship(StarShipType.Cruiser)); // standard
      fleet.starships.push(Fleet.generateStarship(StarShipType.Cruiser)); // standard
      fleet.starships.push(Fleet.generateStarship(StarShipType.Cruiser, customData)); // custom

      const result = Fleet.toString(fleet);
      expect(result).toEqual('2 Cruisers, 1 Custom Cruiser');
    });

    it('should handle multiple different ship types correctly', () => {
      const fleet = Fleet.generateFleet([], null);
      fleet.starships.push(Fleet.generateStarship(StarShipType.Scout));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Scout));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Destroyer));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Battleship));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Battleship));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Battleship));

      const result = Fleet.toString(fleet);
      expect(result).toEqual('2 Scouts, 1 Destroyer, 3 Battleships');
    });

    it('should handle complex mixed fleet with standard and custom ships correctly', () => {
      const scoutCustomData = {
        advantageAgainst: StarShipType.SystemDefense,
        disadvantageAgainst: StarShipType.Destroyer,
      };
      const battleshipCustomData = {
        advantageAgainst: StarShipType.Cruiser,
        disadvantageAgainst: StarShipType.SystemDefense,
      };

      const fleet = Fleet.generateFleet([], null);
      fleet.starships.push(Fleet.generateStarship(StarShipType.SystemDefense)); // 1 standard defender
      fleet.starships.push(Fleet.generateStarship(StarShipType.Scout)); // 1 standard scout
      fleet.starships.push(Fleet.generateStarship(StarShipType.Scout, scoutCustomData)); // 1 custom scout
      fleet.starships.push(Fleet.generateStarship(StarShipType.Scout, scoutCustomData)); // 2nd custom scout
      fleet.starships.push(Fleet.generateStarship(StarShipType.Destroyer)); // 1 standard destroyer
      fleet.starships.push(Fleet.generateStarship(StarShipType.Battleship, battleshipCustomData)); // 1 custom battleship
      fleet.starships.push(Fleet.generateStarship(StarShipType.SpacePlatform)); // 1 standard space platform

      const result = Fleet.toString(fleet);
      expect(result).toEqual(
        '1 Defender, 1 Scout, 2 Custom Scouts, 1 Destroyer, 1 Custom Battleship, 1 Space Platform',
      );
    });

    it('should handle all ship types correctly', () => {
      const fleet = Fleet.generateFleet([], null);
      fleet.starships.push(Fleet.generateStarship(StarShipType.SystemDefense));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Scout));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Destroyer));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Cruiser));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Battleship));
      fleet.starships.push(Fleet.generateStarship(StarShipType.SpacePlatform));

      const result = Fleet.toString(fleet);
      expect(result).toEqual('1 Defender, 1 Scout, 1 Destroyer, 1 Cruiser, 1 Battleship, 1 Space Platform');
    });

    it('should handle only custom ships of different types correctly', () => {
      const customData = {
        advantageAgainst: StarShipType.Scout,
        disadvantageAgainst: StarShipType.Destroyer,
      };

      const fleet = Fleet.generateFleet([], null);
      fleet.starships.push(Fleet.generateStarship(StarShipType.Scout, customData));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Destroyer, customData));
      fleet.starships.push(Fleet.generateStarship(StarShipType.Cruiser, customData));

      const result = Fleet.toString(fleet);
      expect(result).toEqual('1 Custom Scout, 1 Custom Destroyer, 1 Custom Cruiser');
    });

    it('should properly pluralize ship names', () => {
      const fleet = Fleet.generateFleet([], null);
      // Test that plural forms are correct
      fleet.starships.push(Fleet.generateStarship(StarShipType.SystemDefense));
      fleet.starships.push(Fleet.generateStarship(StarShipType.SystemDefense));

      const result = Fleet.toString(fleet);
      expect(result).toEqual('2 Defenders');
    });

    it('should handle space platforms plural correctly', () => {
      const fleet = Fleet.generateFleet([], null);
      fleet.starships.push(Fleet.generateStarship(StarShipType.SpacePlatform));
      fleet.starships.push(Fleet.generateStarship(StarShipType.SpacePlatform));

      const result = Fleet.toString(fleet);
      expect(result).toEqual('2 Space Platforms');
    });
  });
});

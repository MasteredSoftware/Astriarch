import { PlanetById } from "../model/clientModel";
import { StarShipType } from "../model/fleet";
import { PlayerData } from "../model/player";
import { startNewTestGame, TestGameData } from "../test/testUtils";
import { ClientGameModel } from "./clientGameModel";
import { Fleet } from "./fleet";

let testGameData: TestGameData;
let player1: PlayerData;
let player2: PlayerData;
let planetById: PlanetById;

describe("Fleet", function () {
  beforeEach(() => {
    testGameData = startNewTestGame();
    player1 = testGameData.gameModel.modelData.players[0];
    player2 = testGameData.gameModel.modelData.players[1];
    planetById = ClientGameModel.getPlanetByIdIndex(testGameData.gameModel.modelData.planets);
  });

  describe("strengthBoostFromLevel()", () => {
    it("should not give a boost for level 0", () => {
      const ss1 = Fleet.generateStarship(StarShipType.Battleship);
      const baseStrength = Fleet.getStarshipTypeBaseStrength(ss1.type);
      const boostFromLevel = Fleet.strengthBoostFromLevel(ss1, baseStrength);
      expect(boostFromLevel).toEqual(0);
    });

    it("should give an appropriate boost based on levels", () => {
      const ss1 = Fleet.generateStarship(StarShipType.Battleship);
      const baseStrength = Fleet.getStarshipTypeBaseStrength(ss1.type);
      ss1.experienceAmount = baseStrength / 2;
      const level = Fleet.starShipLevel(ss1, baseStrength).level;
      expect(level).toEqual(1);
      let strengthBoost = Fleet.strengthBoostFromLevel(ss1, baseStrength);
      console.log("Boost for level 1: ", strengthBoost);
      expect(strengthBoost).toEqual(baseStrength / 8);
      const levelExpBoosts = [8, 16, 20, 23, 26, 28, 30, 32, 34];
      for (let i = 0; i < levelExpBoosts.length; i++) {
        const levelExpBoost = levelExpBoosts[i];
        ss1.experienceAmount += ss1.experienceAmount + Math.round(ss1.experienceAmount / 2);
        const level = Fleet.starShipLevel(ss1, baseStrength).level;
        expect(level).toEqual(i + 2);
        strengthBoost = Fleet.strengthBoostFromLevel(ss1, baseStrength);
        console.log("Level: ", level, "exp:", ss1.experienceAmount, "boost:", strengthBoost);
        expect(strengthBoost).toEqual(levelExpBoost);
      }
    });
  });
});

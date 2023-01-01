import { PlanetById } from "../model/clientModel";
import { FleetData, StarShipType } from "../model/fleet";
import { PlayerData } from "../model/player";
import { ResearchType } from "../model/research";
import { startNewTestGame, TestGameData } from "../test/testUtils";
import { BattleSimulator, FleetDamagePending } from "./battleSimulator";
import { ClientGameModel } from "./clientGameModel";
import { Fleet } from "./fleet";
import { Research } from "./research";

let testGameData: TestGameData;
let player1: PlayerData;
let player2: PlayerData;
let planetById: PlanetById;

const checkFleetWinCount = (fleet1: FleetData, fleet1Owner: PlayerData, fleet2:FleetData, fleet2Owner: PlayerData, battleTries:number) => {
  const winLoseDraw = {w:0, l: 0, d: 0};

  //try the battle multiple times to account for randomness/luck
  for (let i = 0; i < battleTries; i++) {
    const f1 = Fleet.cloneFleet(fleet1);
    const f2 = Fleet.cloneFleet(fleet2);
    const fleet1Wins = BattleSimulator.simulateFleetBattle(f1, fleet1Owner, f2, fleet2Owner);
    if (fleet1Wins === null) {
      winLoseDraw.d++;
    } else if(fleet1Wins) {
      winLoseDraw.w++;
    } else {
      winLoseDraw.l++;
    }
  }
  return winLoseDraw;
}

describe("BattleSimulator", () => {
  beforeEach(() => {
    testGameData = startNewTestGame();
    player1 = testGameData.gameModel.modelData.players[0];
    player2 = testGameData.gameModel.modelData.players[1];
    planetById = ClientGameModel.getPlanetByIdIndex(testGameData.gameModel.modelData.planets);
  });

  describe("SimulateFleetBattle", () => {
    //here are the advantages (-> means has an advantage over):
    // battleships -> cruisers -> destroyers -> scouts -> defenders (-> battleships)
    it("should allow the fleet with the advantage to win given the fleets have the same strength", (done) => {
      const battleTries = 100;

      //scouts over defenders
      let f1 = Fleet.generateFleetWithShipCount(0, 1, 0, 0, 0, 0, null);
      let f2 = Fleet.generateFleetWithShipCount(2, 0, 0, 0, 0, 0, null);
      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      let fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      if (fleet1WinCount < battleTries * 0.9) {
        return done("Scout didn't win against two defenders!");
      }

      //destroyers over scouts
      f1 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, null);
      f2 = Fleet.generateFleetWithShipCount(0, 2, 0, 0, 0, 0, null);
      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      if (fleet1WinCount < battleTries * 0.9) {
        return done("Destroyer didn't win against two scouts!");
      }

      //cruisers over destroyers
      f1 = Fleet.generateFleetWithShipCount(0, 0, 0, 1, 0, 0, null);
      f2 = Fleet.generateFleetWithShipCount(0, 0, 2, 0, 0, 0, null);
      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      if (fleet1WinCount < battleTries * 0.9) {
        return done("Cruiser didn't win against two destroyers!");
      }

      //battleships over cruisers
      f1 = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 1, 0, null);
      f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 2, 0, 0, null);
      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      if (fleet1WinCount < battleTries * 0.9) {
        return done("Battleship didn't win against two cruisers!");
      }

      //defenders over battleships
      f1 = Fleet.generateFleetWithShipCount(16, 0, 0, 0, 0, 0, null);
      f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 1, 0, null);
      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      if (fleet1WinCount < battleTries * 0.9) {
        return done("Sixteen defenders didn't win against one battleship!");
      }
      done();
    });

    it("should allow the fleet with the disadvantage to win given the disadvantaged fleet has sufficiently more power (4x)", (done) => {
      const battleTries = 1000;

      //scouts over destroyers
      let f1 = Fleet.generateFleetWithShipCount(0, 4, 0, 0, 0, 0, null);
      let f2 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, null);
      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2) * 2);
      let fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      //console.log("f1: ", f1.DetermineFleetStrength(), "f2:", f2.DetermineFleetStrength());
      console.log("Scout fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount < battleTries * 0.5) {
        return done("Four scouts won less than 50% of the time against a Destroyer!");
      }

      //destroyers over cruisers
      f1 = Fleet.generateFleetWithShipCount(0, 0, 4, 0, 0, 0, null);
      f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 1, 0, 0, null);
      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2) * 2);
      fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      console.log("Destroyer fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount < battleTries * 0.5) {
        return done("Four Destroyers won less than 50% of the time against a Cruiser!");
      }

      //cruisers over battleships
      f1 = Fleet.generateFleetWithShipCount(0, 0, 0, 4, 0, 0, null);
      f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 1, 0, null);
      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2) * 2);
      fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      console.log("Cruiser fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount < battleTries * 0.5) {
        return done("Four Cruisers won less than 50% of the time against a Battleship!");
      }

      //battleships over defenders
      f1 = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 1, 0, null);
      f2 = Fleet.generateFleetWithShipCount(8, 0, 0, 0, 0, 0, null);
      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2) * 2);
      fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      console.log("Battleship fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount < battleTries * 0.5) {
        return done("A Battleship won less than 50% of the time against 4 Scouts!");
      }

      done();
    });

    it("StarshipFireWeapons should evenly assign damage between 0, 1, and two for each gun", (done) => {
      const battleTries = 10000;
      let totalDamage = 0;

      for(let i = 0; i < battleTries; i++) {
        const f2 = Fleet.generateFleetWithShipCount(1, 0, 0, 0, 0, 0, null);
        const f1 = Fleet.generateFleetWithShipCount(1, 0, 0, 0, 0, 0, null);
        expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));

        const f1BonusChance = { attack: 0, defense: 0 };
        const f2BonusChance = { attack: 0, defense: 0 };
        const f1StarShips = f1.starships;
        const f2StarShips = f2.starships;
        const fleet1DamagePending:FleetDamagePending = {};
        const s = f2StarShips[0];
        BattleSimulator.starshipFireWeapons(
          f2BonusChance.attack,
          f1BonusChance.defense,
          s,
          f1StarShips,
          fleet1DamagePending
        );
        if(f1StarShips[0].id in fleet1DamagePending) {
          totalDamage += BattleSimulator.getTotalPendingDamage(fleet1DamagePending[f1StarShips[0].id].hits);
        }

      }

      console.log("StarshipFireWeapons test totalDamage:", totalDamage);
      if (totalDamage > battleTries * 1.05) {
        return done("totalDamage > 105%!");
      } else if (totalDamage < battleTries * 0.95) {
        return done("totalDamage < 95%!");
      }

      done();
    });

    it("should give even odds to identical fleets independent of if attacking or defending", (done) => {
      const battleTries = 1000;

      const f1 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, null);

      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      const winLoseDraw = checkFleetWinCount(f1, player1, f2, player2, battleTries);
      console.log("Fleet 1 (identical fleet) Win Count:", winLoseDraw);
      if (winLoseDraw.w > battleTries * 0.55) {
        return done("Fleet1 won more than 55% of the time!");
      } else if (winLoseDraw.w < battleTries * 0.45) {
        return done("Fleet1 won less than 45% of the time!");
      }
      done();
    });

    it("should give a slight home system advantage to ships defending on a planet", (done) => {
      const battleTries = 1000;

      const f1 = Fleet.generateFleetWithShipCount(0, 1, 0, 0, 0, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 1, 0, 0, 0, 0, null);
      f2.locationHexMidPoint = {x: 0, y: 0};

      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      const winLoseDraw = checkFleetWinCount(f1, player1, f2, player2, battleTries);
      console.log("System Attacking fleet Win Count:", winLoseDraw);
      if (winLoseDraw.w > battleTries * 0.45) {
        return done("System Attacking Fleet won more than 45% of the time!");
      }
      done();
    });

    it("should allow defenders to win against another fleet with the same power about 50% of the time", (done) => {
      const battleTries = 1000;

      const f1 = Fleet.generateFleetWithShipCount(4, 0, 0, 0, 0, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 1, 0, 0, 0, null);

      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      const fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      console.log("Defender fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.56) {
        return done("Defender Fleet won more than 56% of the time!");
      } else if (fleet1WinCount < battleTries * 0.44) {
        return done("Defender Fleet won less than 44% of the time!");
      }
      done();
    });

    it("should allow more defenders to win against another fleet with the same power about 50% of the time", (done) => {
      const battleTries = 1000;

      const f1 = Fleet.generateFleetWithShipCount(16, 0, 0, 0, 0, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 2, 1, 0, 0, null);

      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      const fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      //Note: when there are lots of little ships like scouts and defenders without advantages or disadvantages against a fleet with the same power, the fleet with lots of little ships wins about 60% of the time
      //	This is caused by "overkill" since each gun has 2 power, each time a ship has one strength left it's possible that the gun will damage 2, leaving an extra damage that could have been assigned to another ship
      //  this side effect actually seems realistic and is a reason to keep tougher ships relative costs the same, even though they can repair
      console.log("Defender fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.66) {
        return done("Defender Fleet won more than 66% of the time!");
      } else if (fleet1WinCount < battleTries * 0.4) {
        return done("Defender Fleet won less than 40% of the time!");
      }
      done();
    });

    it("should allow spaceplatforms to win against any other fleet, even if the other fleet has slightly more power", (done) => {
      const battleTries = 1000;

      const f1 = Fleet.generateFleetWithShipCount(0, 8, 4, 2, 0, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 1, null);

      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2) * 1.5);
      const fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      console.log("fleet1WinCount against Space Platform:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.15) {
        return done("Fleet won more than 15% of the time against a Space Platform!");
      }
      done();
    });

    it("should allow spaceplatforms to win against a 1.5x strength fleet of battleships most of the time", (done) => {
      const battleTries = 1000;

      const f1 = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 3, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 1, null);

      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2) * 1.5);
      const fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;
      console.log("Battleship fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.15) {
        return done("Battleship Fleet won more than 15% of the time against a Space Platform!");
      }
      done();
    });

    it("should not allow the disadvantaged fleet to win", (done) => {
      const f1 = Fleet.generateFleetWithShipCount(16, 2, 0, 0, 0, 1, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 1, 4, 1, 0, null);
      console.log("f1: ", Fleet.determineFleetStrength(f1), "f2:", Fleet.determineFleetStrength(f2));
      const fleet1Wins = BattleSimulator.simulateFleetBattle(f1, player1, f2, player2);
      console.log("f1: ", Fleet.determineFleetStrength(f1), "f2:", Fleet.determineFleetStrength(f2));
      if (!fleet1Wins) {
        return done("The disadvantaged fleet won!");
      }
      done();
    });

    it("should allow identical fleets to win about 50% of the time", (done) => {
      const battleTries = 1000;

      const f1 = Fleet.generateFleetWithShipCount(0, 2, 5, 4, 1, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 2, 5, 4, 1, 0, null);

      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      const fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;

      console.log("fleet1WinCount:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.53) {
        return done("Attacking Fleet won more than 53% of the time!");
      } else if (fleet1WinCount < battleTries * 0.47) {
        return done("Attacking Fleet won less than 47% of the time!");
      }
      done();
    });

    it("should allow a mixed fleet to win against another mixed fleet with the same power about 50% of the time", (done) => {
      const battleTries = 1000;

      const f1 = Fleet.generateFleetWithShipCount(0, 0, 4, 0, 0, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 1, 0, null);

      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      const fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;

      console.log("fleet1WinCount:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.58) {
        return done("Attacking Fleet won more than 58% of the time!");
      } else if (fleet1WinCount < battleTries * 0.42) {
        return done("Attacking Fleet won less than 42% of the time!");
      }
      done();
    });

    it("should properly account for customized starship advantages and disadvantages", (done) => {
      const battleTries = 1000;

      const f1 = Fleet.generateFleetWithShipCount(0, 0, 4, 0, 0, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 2, 0, 0, null);

      f1.starships.forEach((s) => {
        if(s.type === StarShipType.Destroyer) {
          s.customShipData = {advantageAgainst:StarShipType.Cruiser, disadvantageAgainst: StarShipType.SystemDefense};
        }
      });

      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      const fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;

      console.log("fleet1WinCount:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.58) {
        return done("Attacking Fleet won more than 58% of the time!");
      } else if (fleet1WinCount < battleTries * 0.42) {
        return done("Attacking Fleet won less than 42% of the time!");
      }
      done();
    });

    it("should properly account for starship research bonuses", (done) => {
      const battleTries = 1000;

      Research.setResearchPointsCompleted(player1.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_ATTACK], 1000);
      Research.setResearchPointsCompleted(player1.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_DEFENSE], 1000);

      const f1 = Fleet.generateFleetWithShipCount(0, 0, 4, 0, 0, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 2, 0, 0, null);

      expect(Fleet.determineFleetStrength(f1)).toEqual(Fleet.determineFleetStrength(f2));
      const fleet1WinCount = checkFleetWinCount(f1, player1, f2, player2, battleTries).w;

      console.log("fleet1WinCount:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.58) {
        return done("Attacking Fleet won more than 58% of the time!");
      } else if (fleet1WinCount < battleTries * 0.42) {
        return done("Attacking Fleet won less than 42% of the time!");
      }
      done();
    });

    it("should properly assign experience points to the winning fleet", (done) => {
      const f1 = Fleet.generateFleetWithShipCount(6, 0, 0, 0, 0, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 2, 0, null);

      const f1Strength = Fleet.determineFleetStrength(f1);

      const fleet1wins = BattleSimulator.simulateFleetBattle(f1, player1, f2, player2);
      expect(fleet1wins).toEqual(false);
      //check total experience points for fleet2
      const ships = f2.starships;
      const experiencePointsTotal = f2.starships.reduce((accum, curr) => accum + curr.experienceAmount, 0);
      expect(experiencePointsTotal).toEqual(f1Strength);
      done();
    });

    it("should assign experience points to space platforms", (done) => {
      const f1 = Fleet.generateFleetWithShipCount(0, 2, 0, 0, 0, 0, null);
      const f2 = Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 1, null);

      const f1Strength = Fleet.determineFleetStrength(f1);

      const fleet1wins = BattleSimulator.simulateFleetBattle(f1, player1, f2, player2);
      expect(fleet1wins).toEqual(false);
      //check total experience points for fleet2
      const experiencePointsTotal = f2.starships.reduce((accum, curr) => accum + curr.experienceAmount, 0);
      expect(experiencePointsTotal).toEqual(f1Strength);
      done();
    });
  });
});
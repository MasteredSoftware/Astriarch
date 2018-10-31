var should = require("should");

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

var player1 = new Astriarch.Player(1, Astriarch.Player.PlayerType.Computer_Expert, "Player1");
var player2 = new Astriarch.Player(2, Astriarch.Player.PlayerType.Computer_Expert, "Player2");

function checkFleetWinCount(fleet1, fleet2, battleTries) {
  var i = 0;
  var f1 = null;
  var f2 = null;
  var fleet1WinCount = 0;
  //try the battle multiple times to account for randomness/luck
  for (i = 0; i < battleTries; i++) {
    f1 = fleet1.CloneFleet();
    f2 = fleet2.CloneFleet();
    if (Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2)) {
      fleet1WinCount++;
    }
  }
  return fleet1WinCount;
}

describe("#BattleSimulator", function() {
  describe("SimulateFleetBattle()", function() {
    //here are the advantages (-> means has an advantage over):
    // battleships -> cruisers -> destroyers -> scouts -> defenders (-> battleships)

    it("should allow the fleet with the advantage to win given the fleets have the same strength", function(done) {
      var battleTries = 100;

      //scouts over defenders
      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 1, 0, 0, 0, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 2, 0, 0, 0, 0, 0, null);
      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      if (fleet1WinCount < battleTries * 0.9) {
        return done("Scout didn't win against two defenders!");
      }

      //destroyers over scouts
      f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 1, 0, 0, 0, null);
      f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 2, 0, 0, 0, 0, null);
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      if (fleet1WinCount < battleTries * 0.9) {
        return done("Destroyer didn't win against two scouts!");
      }

      //cruisers over destroyers
      f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 1, 0, 0, null);
      f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 2, 0, 0, 0, null);
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      if (fleet1WinCount < battleTries * 0.9) {
        return done("Cruiser didn't win against two destroyers!");
      }

      //battleships over cruisers
      f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 0, 1, 0, null);
      f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 0, 2, 0, 0, null);
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      if (fleet1WinCount < battleTries * 0.9) {
        return done("Battleship didn't win against two cruisers!");
      }

      //defenders over battleships
      f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 16, 0, 0, 0, 0, 0, null);
      f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 0, 0, 1, 0, null);
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      if (fleet1WinCount < battleTries * 0.9) {
        return done("Sixteen defenders didn't win against one battleship!");
      }

      done();
    });

    it("should allow the fleet with the disadvantage to win given the disadvantaged fleet has sufficiently more power (4x)", function(done) {
      var battleTries = 1000;

      //scouts over destroyers
      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 4, 0, 0, 0, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 1, 0, 0, 0, null);
      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 2);
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      //console.log("f1: ", f1.DetermineFleetStrength(), "f2:", f2.DetermineFleetStrength());
      console.log("Scout fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount < battleTries * 0.5) {
        return done("Four scouts won less than 50% of the time against a Destroyer!");
      }

      //destroyers over cruisers
      f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 4, 0, 0, 0, null);
      f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 0, 1, 0, 0, null);
      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 2);
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      console.log("Destroyer fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount < battleTries * 0.5) {
        return done("Four Destroyers won less than 50% of the time against a Cruiser!");
      }

      //cruisers over battleships
      f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 4, 0, 0, null);
      f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 0, 0, 1, 0, null);
      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 2);
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      console.log("Cruiser fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount < battleTries * 0.5) {
        return done("Four Cruisers won less than 50% of the time against a Battleship!");
      }

      //battleships over defenders
      f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 0, 1, 0, null);
      f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 8, 0, 0, 0, 0, 0, null);
      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 2);
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      console.log("Battleship fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount < battleTries * 0.5) {
        return done("A Battleship won less than 50% of the time against 4 Scouts!");
      }

      done();
    });

    it("should allow defenders to win against another fleet with the same power about 50% of the time", function(done) {
      var battleTries = 1000;

      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 4, 0, 0, 0, 0, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 1, 0, 0, 0, null);

      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      console.log("Defender fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.56) {
        return done("Defender Fleet won more than 56% of the time!");
      } else if (fleet1WinCount < battleTries * 0.44) {
        return done("Defender Fleet won less than 44% of the time!");
      }
      done();
    });

    it("should allow more defenders to win against another fleet with the same power about 50% of the time", function(done) {
      var battleTries = 1000;

      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 16, 0, 0, 0, 0, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 2, 1, 0, 0, null);

      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
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

    it("should allow spaceplatforms to win against any other fleet, even if the other fleet has slightly more power", function(done) {
      var battleTries = 1000;

      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 8, 4, 2, 0, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 0, 0, 1, null);

      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 1.5);
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      console.log("fleet1WinCount against Space Platform:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.15) {
        return done("Fleet won more than 15% of the time against a Space Platform!");
      }
      done();
    });

    it("should allow spaceplatforms to win against a 1.5x strength fleet of battleships most of the time", function(done) {
      var battleTries = 1000;

      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 0, 0, 3, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 0, 0, 1, null);

      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 1.5);
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);
      console.log("Battleship fleet Win Count:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.15) {
        return done("Battleship Fleet won more than 15% of the time against a Space Platform!");
      }
      done();
    });

    it("should not allow the disadvantaged fleet to win", function(done) {
      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 16, 2, 0, 0, 0, 1, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 1, 4, 1, 0, null);
      console.log("f1: ", f1.DetermineFleetStrength(), "f2:", f2.DetermineFleetStrength());
      var fleet1Wins = Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2);
      console.log("f1: ", f1.DetermineFleetStrength(), "f2:", f2.DetermineFleetStrength());
      if (!fleet1Wins) {
        return done("The disadvantaged fleet won!");
      }
      done();
    });

    it("should allow identical fleets to win about 50% of the time", function(done) {
      var battleTries = 1000;

      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 2, 5, 4, 1, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 2, 5, 4, 1, 0, null);

      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);

      console.log("fleet1WinCount:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.53) {
        return done("Attacking Fleet won more than 53% of the time!");
      } else if (fleet1WinCount < battleTries * 0.47) {
        return done("Attacking Fleet won less than 47% of the time!");
      }
      done();
    });

    it("should allow a mixed fleet to win against another mixed fleet with the same power about 50% of the time", function(done) {
      var battleTries = 1000;

      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 4, 0, 0, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 0, 1, 0, null);

      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);

      console.log("fleet1WinCount:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.58) {
        return done("Attacking Fleet won more than 58% of the time!");
      } else if (fleet1WinCount < battleTries * 0.42) {
        return done("Attacking Fleet won less than 42% of the time!");
      }
      done();
    });

    it("should properly account for customized starship advantages and disadvantages", function(done) {
      var battleTries = 1000;

      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 4, 0, 0, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 2, 0, 0, null);

      f1.StarShips[Astriarch.Fleet.StarShipType.Destroyer].forEach(function(s) {
        s.CustomShip = true;
        s.AdvantageAgainstType = Astriarch.Fleet.StarShipType.Cruiser;
      });

      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);

      console.log("fleet1WinCount:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.58) {
        return done("Attacking Fleet won more than 58% of the time!");
      } else if (fleet1WinCount < battleTries * 0.42) {
        return done("Attacking Fleet won less than 42% of the time!");
      }
      done();
    });

    it("should properly account for starship research bonuses", function(done) {
      var battleTries = 1000;

      var playerNew = new Astriarch.Player(2, Astriarch.Player.PlayerType.Computer_Expert, "PlayerNew");
      playerNew.Research.researchProgressByType[
        Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK
      ].setResearchPointsCompleted(1000);
      playerNew.Research.researchProgressByType[
        Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE
      ].setResearchPointsCompleted(1000);

      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(playerNew, 0, 0, 4, 0, 0, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 2, 0, 0, null);

      f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
      var fleet1WinCount = checkFleetWinCount(f1, f2, battleTries);

      console.log("fleet1WinCount:", fleet1WinCount);
      if (fleet1WinCount > battleTries * 0.58) {
        return done("Attacking Fleet won more than 58% of the time!");
      } else if (fleet1WinCount < battleTries * 0.42) {
        return done("Attacking Fleet won less than 42% of the time!");
      }
      done();
    });

    it("should properly assign experience points to the winning fleet", function(done) {
      var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 6, 0, 0, 0, 0, 0, null);
      var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 0, 2, 0, null);

      var f1Strength = f1.DetermineFleetStrength();

      var fleet1wins = Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2);
      fleet1wins.should.equal(false);
      //check total experience points for fleet2
      var ships = f2.GetAllStarShips();
      var experiencePointsTotal = 0;
      ships.forEach(function(ship) {
        experiencePointsTotal += ship.ExperienceAmount;
      });
      experiencePointsTotal.should.equal(f1Strength);
      done();
    });
  });
});

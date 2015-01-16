var should = require('should');

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

var player1 = new Astriarch.Player(Astriarch.Player.PlayerType.Computer_Expert, "Player1");
var player2 = new Astriarch.Player(Astriarch.Player.PlayerType.Computer_Expert, "Player2");

describe('#BattleSimulator', function () {

	describe('SimulateFleetBattle()', function () {
		//here are the advantages (-> means has an advantage over):
		// battleships -> cruisers -> destroyers -> scouts (-> battleships)

		it('should allow the fleet with the advantage to win given the fleets have the same strength', function (done) {

			//destroyers over scouts
			var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 1, 0, 0, null);
			var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 2, 0, 0, 0, null);
			var fleet1Wins = Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2);
			if(!fleet1Wins){
				return done("Destroyer didn't win against two scouts!")
			}

			//cruisers over destroyers
			f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 1, 0, null);
			f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 2, 0, 0, null);
			fleet1Wins = Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2);
			if(!fleet1Wins){
				return done("Cruiser didn't win against two destroyers!")
			}

			//battleships over cruisers
			f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 0, 1, null);
			f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 0, 2, 0, null);
			fleet1Wins = Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2);
			if(!fleet1Wins){
				return done("Battleship didn't win against two cruisers!")
			}

			//scouts over battleships
			f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 8, 0, 0, 0, null);
			f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 0, 0, 1, null);
			fleet1Wins = Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2);
			if(!fleet1Wins){
				return done("Eight Scouts didn't win against one battleship!")
			}

			done();
		});

		it('should allow the fleet with the disadvantage to win given the disadvantaged fleet has sufficiently more power (2x)', function(done) {
			var battleTries = 100;

			//scouts over destroyers
			var i = 0;
			var f1 = null;
			var f2 = null;
			var fleet1WinCount = 0;
			//try the battle multiple times to account for randomness/luck
			for (i = 0; i < battleTries; i++) {

				f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 4, 0, 0, 0, null);
				f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 1, 0, 0, null);
				f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 2);
				if(Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2)){
					fleet1WinCount++;
				}
			}
			//console.log("f1: ", f1.DetermineFleetStrength(), "f2:", f2.DetermineFleetStrength());
			console.log("fleet1WinCount:", fleet1WinCount);
			if(fleet1WinCount < (battleTries * .5)){
				return done("Four scouts won less than 50% of the time against a Destroyer!")
			}

			//destroyers over cruisers
			fleet1WinCount = 0;
			//try the battle multiple times to account for randomness/luck
			for (i = 0; i < battleTries; i++) {

				f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 4, 0, 0, null);
				f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 0, 1, 0, null);
				f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 2);
				if(Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2)){
					fleet1WinCount++;
				}
			}
			console.log("fleet1WinCount:", fleet1WinCount);
			if(fleet1WinCount < (battleTries * .5)){
				return done("Four Destroyers won less than 50% of the time against a Cruiser!");
			}

			//cruisers over battleships
			fleet1WinCount = 0;
			//try the battle multiple times to account for randomness/luck
			for (i = 0; i < battleTries; i++) {

				f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 4, 0, null);
				f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 0, 0, 1, null);
				f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 2);
				if(Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2)){
					fleet1WinCount++;
				}
			}
			console.log("fleet1WinCount:", fleet1WinCount);
			if(fleet1WinCount < (battleTries * .5)){
				return done("Four Cruisers won less than 50% of the time against a Battleship!");
			}

			//battleships over scouts
			fleet1WinCount = 0;
			//try the battle multiple times to account for randomness/luck
			for (i = 0; i < battleTries; i++) {

				f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 0, 1, null);
				f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 4, 0, 0, 0, null);
				f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 2);
				if(Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2)){
					fleet1WinCount++;
				}
			}
			console.log("fleet1WinCount:", fleet1WinCount);
			if(fleet1WinCount < (battleTries * .5)){
				return done("A Battleship won less than 50% of the time against 4 Scouts!");
			}

			done();
		});

		it('should allow defenders to win against another fleet with the same power about 50% of the time', function(done) {
			var battleTries = 1000;

			var i = 0;
			var f1 = null;
			var f2 = null;
			var fleet1WinCount = 0;
			//try the battle multiple times to account for randomness/luck
			for (i = 0; i < battleTries; i++) {
				f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 4, 0, 0, 0, 0, null);
				f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 2, 0, 0, 0, null);

				f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
				if(Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2)){
					fleet1WinCount++;
				}
			}
			console.log("fleet1WinCount:", fleet1WinCount);
			if(fleet1WinCount > (battleTries * .53)){
				return done("Defender Fleet won more than 53% of the time!");
			} else if(fleet1WinCount < (battleTries * .47)){
				return done("Defender Fleet won less than 47% of the time!");
			}
			done();
		});

		it('should allow more defenders to win against another fleet with the same power about 50% of the time', function(done) {
			var battleTries = 1000;

			var i = 0;
			var f1 = null;
			var f2 = null;
			var fleet1WinCount = 0;
			//try the battle multiple times to account for randomness/luck
			for (i = 0; i < battleTries; i++) {
				f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 16, 0, 0, 0, 0, null);
				f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 4, 2, 0, 0, null);

				f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
				if(Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2)){
					fleet1WinCount++;
				}
			}
			//Note: when there are lots of little ships like scouts and defenders without advantages or disadvantages against a fleet with the same power, the fleet with lots of little ships wins about 60% of the time
			//	This is caused by "overkill" since each gun has 2 power, each time a ship has one strength left it's possible that the gun will damage 2, leaving an extra damage that could have been assigned to another ship
			//  this side effect actually seems realistic and is a reason to keep tougher ships relative costs the same, even though they can repair
			console.log("fleet1WinCount:", fleet1WinCount);
			if(fleet1WinCount > (battleTries * .65)){
				return done("Defender Fleet won more than 65% of the time!");
			} else if(fleet1WinCount < (battleTries * .40)){
				return done("Defender Fleet won less than 40% of the time!");
			}
			done();
		});


		it('should allow spaceplatforms to win against any other fleet, even if the other fleet has slightly more power', function(done) {
			var battleTries = 100;

			var i = 0;
			var f1 = null;
			var f2 = null;
			var fleet1WinCount = 0;
			//try the battle multiple times to account for randomness/luck
			for (i = 0; i < battleTries; i++) {

				f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 8, 4, 2, 0, null);
				f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 0, 0, 0, 0, null);
				f2.HasSpacePlatform = true;

				f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength() * 1.5);
				if(Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2)){
					fleet1WinCount++;
				}
			}
			console.log("fleet1WinCount:", fleet1WinCount);
			if(fleet1WinCount > (battleTries * .15)){
				return done("Fleet won more than 15% of the time against a Space Platform!")
			}
			done();
		});

		it('should not allow the disadvantaged fleet to win', function(done){

			var f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 16, 2, 0, 0, 0, null);
			f1.HasSpacePlatform = true;
			var f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 0, 1, 4, 1, null);
			console.log("f1: ", f1.DetermineFleetStrength(), "f2:", f2.DetermineFleetStrength());
			var fleet1Wins = Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2);
			console.log("f1: ", f1.DetermineFleetStrength(), "f2:", f2.DetermineFleetStrength());
			if(!fleet1Wins){
				return done("The disadvantaged fleet won!")
			}
			done();
		});

		it('should allow identical fleets to win about 50% of the time', function(done) {
			var battleTries = 1000;

			var i = 0;
			var f1 = null;
			var f2 = null;
			var fleet1WinCount = 0;
			//try the battle multiple times to account for randomness/luck
			for (i = 0; i < battleTries; i++) {
				f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 2, 5, 4, 1, null);
				f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 2, 5, 4, 1, null);

				f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
				if(Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2)){
					fleet1WinCount++;
				}
			}

			console.log("fleet1WinCount:", fleet1WinCount);
			if(fleet1WinCount > (battleTries * .53)){
				return done("Defender Fleet won more than 53% of the time!");
			} else if(fleet1WinCount < (battleTries * .47)){
				return done("Defender Fleet won less than 47% of the time!");
			}
			done();
		});

		it('should allow a mixed fleet to win against another mixed fleet with the same power about 50% of the time', function(done) {
			var battleTries = 100;

			var i = 0;
			var f1 = null;
			var f2 = null;
			var fleet1WinCount = 0;
			//try the battle multiple times to account for randomness/luck
			for (i = 0; i < battleTries; i++) {
				f1 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player2, 0, 16, 4, 4, 1, null);
				f2 = Astriarch.Fleet.StarShipFactoryHelper.GenerateFleetWithShipCount(player1, 0, 8, 8, 2, 2, null);

				f1.DetermineFleetStrength().should.equal(f2.DetermineFleetStrength());
				if(Astriarch.BattleSimulator.SimulateFleetBattle(f1, f2)){
					fleet1WinCount++;
				}
			}

			console.log("fleet1WinCount:", fleet1WinCount);
			if(fleet1WinCount > (battleTries * .65)){
				return done("Defender Fleet won more than 65% of the time!");
			} else if(fleet1WinCount < (battleTries * .45)){
				return done("Defender Fleet won less than 45% of the time!");
			}
			done();
		});

	});
});

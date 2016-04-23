var Astriarch = Astriarch || require('./astriarch_base');

//new simulate fleet battle logic:
//this will support choosing a target and allowing ships to have an advantage over other types
//here are the advantages (-> means has an advantage over):
//defenders -> destroyers -> battleships -> cruisers -> spaceplatforms -> scouts (-> defenders)
//target decisions:
//if there is an enemy ship that this ship has an advantage over, choose that one
//otherwise go for the weakest ship to shoot at

Astriarch.BattleSimulator = {
	STARSHIP_WEAPON_POWER: 2,//defenders have one gun and battleships have 16
	STARSHIP_WEAPON_POWER_HALF: 1,

	SimulateFleetBattle: function(/*Fleet*/ f1, /*Fleet*/ f2){//returns bool?
		var fleet1Wins = null;//bool?

		//fleet damage pending structures are so we can have both fleets fire simultaneously without damaging each-other till the end of each round
		var fleet1DamagePending = {}; //Dictionary<StarShipId, {Starship:starshipObject, Damage:int}>
		var fleet1SpacePlatformDamagePendingObject = null;
		var fleet2DamagePending = {}; //Dictionary<StarShipId, {Starship:starshipObject, Damage:int}>
		var fleet2SpacePlatformDamagePendingObject = null;

		//We don't award experience points until the end of battle so that ships can't level up in the heat of conflict
		var experiencedGainedByStarShipId = {};

		while (f1.DetermineFleetStrength(true) > 0 && f2.DetermineFleetStrength(true) > 0) {
			fleet1SpacePlatformDamagePendingObject = {'enemyFleetSpacePlatformDamagePending': 0};
			fleet2SpacePlatformDamagePendingObject = {'enemyFleetSpacePlatformDamagePending': 0};

			var f1StarShips = f1.GetAllStarShips();//List<StarShip>
			var f2StarShips = f2.GetAllStarShips();//List<StarShip>

			for (var i in f1StarShips) {
				var s = f1StarShips[i];//StarShip
				if(!(experiencedGainedByStarShipId[s.id])) {
					experiencedGainedByStarShipId[s.id] = 0;
				}
				experiencedGainedByStarShipId[s.id] += Astriarch.BattleSimulator.StarshipFireWeapons(s.Strength(), s.Type, false, f2StarShips, f2.HasSpacePlatform, fleet2DamagePending, fleet2SpacePlatformDamagePendingObject);
			}
			if (f1.HasSpacePlatform) {
				Astriarch.BattleSimulator.StarshipFireWeapons(Astriarch.Fleet.Static.SPACE_PLATFORM_STRENGTH - f1.SpacePlatformDamage, Astriarch.Fleet.StarShipType.SystemDefense, true, f2StarShips, f2.HasSpacePlatform, fleet1DamagePending, fleet2SpacePlatformDamagePendingObject);
			}

			for (var i in f2StarShips) {
				var s = f2StarShips[i];
				if(!(experiencedGainedByStarShipId[s.id])) {
					experiencedGainedByStarShipId[s.id] = 0;
				}
				experiencedGainedByStarShipId[s.id] += Astriarch.BattleSimulator.StarshipFireWeapons(s.Strength(), s.Type, false, f1StarShips, f1.HasSpacePlatform, fleet1DamagePending, fleet1SpacePlatformDamagePendingObject);
			}
			if (f2.HasSpacePlatform) {
				Astriarch.BattleSimulator.StarshipFireWeapons(Astriarch.Fleet.Static.SPACE_PLATFORM_STRENGTH - f2.SpacePlatformDamage, Astriarch.Fleet.StarShipType.SystemDefense, true, f1StarShips, f1.HasSpacePlatform, fleet1DamagePending, fleet1SpacePlatformDamagePendingObject);
			}

			//deal damage
			for(var i in fleet1DamagePending) {
				var f1KVP = fleet1DamagePending[i];//KeyValuePair<StarShipId, {Starship:starshipObject, Damage:int}>
				f1KVP['Starship'].DamageAmount += f1KVP['Damage'];
				//assign points
				if(f2.Owner){
					f2.Owner.Points += Astriarch.ServerController.POINTS_PER_DAMAGED_STARSHIP_STRENGTH * f1KVP['Damage'];
				}
			}
			fleet1DamagePending = {};

			for (var i in fleet2DamagePending) {
				var f2KVP = fleet2DamagePending[i];//KeyValuePair<StarShipId, {Starship:starshipObject, Damage:int}>
				f2KVP['Starship'].DamageAmount += f2KVP['Damage'];
				//assign points
				if(f1.Owner){
					f1.Owner.Points += Astriarch.ServerController.POINTS_PER_DAMAGED_STARSHIP_STRENGTH * f2KVP['Damage'];
				}
			}
			fleet2DamagePending = {};

			f1.ReduceFleet(fleet1SpacePlatformDamagePendingObject['enemyFleetSpacePlatformDamagePending']);
			f2.ReduceFleet(fleet2SpacePlatformDamagePendingObject['enemyFleetSpacePlatformDamagePending']);
			//assign points
			if(f1.Owner){
				f1.Owner.Points += Astriarch.ServerController.POINTS_PER_DAMAGED_STARSHIP_STRENGTH * fleet2SpacePlatformDamagePendingObject['enemyFleetSpacePlatformDamagePending'];
			}
			//assign points
			if(f2.Owner){
				f2.Owner.Points += Astriarch.ServerController.POINTS_PER_DAMAGED_STARSHIP_STRENGTH * fleet1SpacePlatformDamagePendingObject['enemyFleetSpacePlatformDamagePending'];
			}
		}

		if (f1.DetermineFleetStrength(true) > 0) {
			fleet1Wins = true;
			//assign experience to fleet1
			f1.GetAllStarShips().forEach(function(s) {
				if(experiencedGainedByStarShipId[s.id]) {
					s.ExperienceAmount += experiencedGainedByStarShipId[s.id];
				}
			});
		} else if (f2.DetermineFleetStrength(true) > 0) {
			fleet1Wins = false;
			//assign experience to fleet2
			f2.GetAllStarShips().forEach(function(s) {
				if(experiencedGainedByStarShipId[s.id]) {
					s.ExperienceAmount += experiencedGainedByStarShipId[s.id];
				}
			});
		}

		return fleet1Wins;
	},

	//enemyFleetSpacePlatformDamagePendingObject is just for the ref (in/out) parm wich is simply: {enemyFleetSpacePlatformDamagePending: 0}
	StarshipFireWeapons: function(/*int*/ strength, /*StarShipType*/ type, /*bool*/ isSpacePlatform, /*List<StarShip>*/ enemyFleet, /*bool*/ enemyHasSpacePlatform, /*Dictionary<StarShipId, {Starship:starshipObject, Damage:int}>*/ fleetDamagePending, /*ref int*/ enemyFleetSpacePlatformDamagePendingObject) {
		var totalDamage = 0;
		var damage = 0;
		var maxDamage = 0;
		var workingEnemyFleet = [];// List<StarShip>(enemyFleet.Count);
		workingEnemyFleet = workingEnemyFleet.concat(enemyFleet);
		var strengthComparer = new Astriarch.Fleet.StarShipAdvantageStrengthComparer(type, isSpacePlatform, fleetDamagePending);
		workingEnemyFleet.sort(strengthComparer.sortFunction);

		for (var iGun = 0; iGun < strength; iGun += Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER) {
			//remove any in the enemy fleet with strength - pending damage <= 0 so that they aren't a target
			for (var i = workingEnemyFleet.length - 1; i >= 0 ; i--) {
				var enemy = workingEnemyFleet[i];//StarShip
				var pendingDamage = {'Starship':enemy, 'Damage':0};
				if(fleetDamagePending[enemy.id]) {
					pendingDamage = fleetDamagePending[enemy.id];
				}
				if(workingEnemyFleet[i].Strength() - pendingDamage['Damage'] <= 0) {
					workingEnemyFleet.splice(i, 1);
				}
			}

			//calculate starship max damage
			maxDamage = Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER;

			//choose target
			if (enemyHasSpacePlatform && workingEnemyFleet.length == 0) {
				//shoot at the space platform

				//add/remove additional max damage for advantages/disadvantages
				if (Astriarch.BattleSimulator.StarshipHasAdvantageBasedOnType(isSpacePlatform, type, true, null)) {
					maxDamage += Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER_HALF;
				} else if (Astriarch.BattleSimulator.StarshipHasDisadvantageBasedOnType(isSpacePlatform, type, true, null)) {
					maxDamage -= Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER_HALF;
				}

				damage = Astriarch.NextRandom(0, maxDamage + 1);
				totalDamage += damage;

				enemyFleetSpacePlatformDamagePendingObject['enemyFleetSpacePlatformDamagePending'] += damage;
			} else if (workingEnemyFleet.length > 0) {
				var target = workingEnemyFleet[0];//StarShip

				//add/remove additional max damage for advantages/disadvantages
				if (Astriarch.BattleSimulator.StarshipHasAdvantageBasedOnType(isSpacePlatform, type, false, target.Type)) {
					maxDamage += Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER_HALF;
				} else if (Astriarch.BattleSimulator.StarshipHasDisadvantageBasedOnType(isSpacePlatform, type, false, target.Type)) {
					maxDamage -= Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER_HALF;
				}

				damage = Astriarch.NextRandom(0, maxDamage + 1);
				totalDamage += damage;

				if (damage != 0) {
					if (!fleetDamagePending[target.id]) {
						fleetDamagePending[target.id] = {'Starship': target, 'Damage': 0};
					}
					fleetDamagePending[target.id]['Damage'] += damage;
				}
			}
		}
		return totalDamage;
	},

	StarshipHasAdvantageBasedOnType: function(/*bool*/ attackerIsSpacePlatform, /*StarShipType*/ sstAttacker, /*bool*/ defenderIsSpacePlatform, /*StarShipType*/ sstDefender) {
		//space platforms have advantages over everything
		if (attackerIsSpacePlatform){
			return true;
		} else if(defenderIsSpacePlatform){
			return false;
		} else if (sstAttacker == Astriarch.Fleet.StarShipType.SystemDefense && sstDefender == Astriarch.Fleet.StarShipType.Battleship){
			return true;
		} else if (sstAttacker == Astriarch.Fleet.StarShipType.Scout && sstDefender == Astriarch.Fleet.StarShipType.SystemDefense){
			return true;
		} else if (sstAttacker == Astriarch.Fleet.StarShipType.Destroyer && sstDefender == Astriarch.Fleet.StarShipType.Scout) {
			return true;
		} else if (sstAttacker == Astriarch.Fleet.StarShipType.Cruiser && sstDefender == Astriarch.Fleet.StarShipType.Destroyer){
			return true;
		}  else if (sstAttacker == Astriarch.Fleet.StarShipType.Battleship && sstDefender == Astriarch.Fleet.StarShipType.Cruiser){
			return true;
		}
		return false;
	},

	StarshipHasDisadvantageBasedOnType: function(/*bool*/ attackerIsSpacePlatform, /*StarShipType*/ sstAttacker, /*bool*/ defenderIsSpacePlatform, /*StarShipType*/ sstDefender) {
		if (attackerIsSpacePlatform){
			return false;
		} else if(defenderIsSpacePlatform){
			return true;
		} else if (sstAttacker == Astriarch.Fleet.StarShipType.SystemDefense && sstDefender == Astriarch.Fleet.StarShipType.Scout){
			return true;
		} else if (sstAttacker == Astriarch.Fleet.StarShipType.Scout && sstDefender == Astriarch.Fleet.StarShipType.Destroyer){
			return true;
		} else if (sstAttacker == Astriarch.Fleet.StarShipType.Destroyer && sstDefender == Astriarch.Fleet.StarShipType.Cruiser){
			return true;
		} else if (sstAttacker == Astriarch.Fleet.StarShipType.Cruiser && sstDefender == Astriarch.Fleet.StarShipType.Battleship){
			return true;
		} else if (sstAttacker == Astriarch.Fleet.StarShipType.Battleship && sstDefender == Astriarch.Fleet.StarShipType.SystemDefense){
			return true;
		}


		return false;
	}
};//Astriarch.BattleSimulator

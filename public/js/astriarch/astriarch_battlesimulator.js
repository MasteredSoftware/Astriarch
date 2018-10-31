var Astriarch = Astriarch || require("./astriarch_base");

//new simulate fleet battle logic:
//this will support choosing a target and allowing ships to have an advantage over other types
//here are the advantages (-> means has an advantage over):
//defenders -> destroyers -> battleships -> cruisers -> spaceplatforms -> scouts (-> defenders)
//target decisions:
//if there is an enemy ship that this ship has an advantage over, choose that one
//otherwise go for the weakest ship to shoot at

Astriarch.BattleSimulator = {
  STARSHIP_WEAPON_POWER: 2, //defenders have one gun and battleships have 16
  STARSHIP_WEAPON_POWER_HALF: 1,

  SimulateFleetBattle: function(/*Fleet*/ f1, /*Fleet*/ f2) {
    //returns bool?
    var fleet1Wins = null; //bool?

    var f1BonusChance = { attack: 0, defense: 0 };
    var f2BonusChance = { attack: 0, defense: 0 };

    //fleet damage pending structures are so we can have both fleets fire simultaneously without damaging each-other till the end of each round
    var fleet1DamagePending = {}; //Dictionary<StarShipId, {Starship:starshipObject, Damage:int}>
    var fleet2DamagePending = {}; //Dictionary<StarShipId, {Starship:starshipObject, Damage:int}>

    //We don't award experience points until the end of battle so that ships can't level up in the heat of conflict
    var experiencedGainedByStarShipId = {};

    if (f1.Owner) {
      f1BonusChance.attack = f1.Owner.Research.getResearchData(
        Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK
      ).chance;
      f1BonusChance.defense = f1.Owner.Research.getResearchData(
        Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE
      ).chance;
    }

    if (f2.Owner) {
      f2BonusChance.attack = f2.Owner.Research.getResearchData(
        Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK
      ).chance;
      f2BonusChance.defense = f2.Owner.Research.getResearchData(
        Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE
      ).chance;
    }

    while (f1.DetermineFleetStrength() > 0 && f2.DetermineFleetStrength() > 0) {
      var f1StarShips = f1.GetAllStarShips(); //List<StarShip>
      var f2StarShips = f2.GetAllStarShips(); //List<StarShip>

      for (var i in f1StarShips) {
        var s = f1StarShips[i]; //StarShip
        if (!experiencedGainedByStarShipId[s.id]) {
          experiencedGainedByStarShipId[s.id] = 0;
        }
        experiencedGainedByStarShipId[s.id] += Astriarch.BattleSimulator.StarshipFireWeapons(
          f1BonusChance.attack,
          f2BonusChance.defense,
          s,
          f2StarShips,
          fleet2DamagePending
        );
      }

      for (var i in f2StarShips) {
        var s = f2StarShips[i];
        if (!experiencedGainedByStarShipId[s.id]) {
          experiencedGainedByStarShipId[s.id] = 0;
        }
        experiencedGainedByStarShipId[s.id] += Astriarch.BattleSimulator.StarshipFireWeapons(
          f2BonusChance.attack,
          f1BonusChance.defense,
          s,
          f1StarShips,
          fleet1DamagePending
        );
      }

      //deal damage
      for (var i in fleet1DamagePending) {
        var f1KVP = fleet1DamagePending[i]; //KeyValuePair<StarShipId, {Starship:starshipObject, Damage:int}>
        f1KVP["Starship"].Health -= f1KVP["Damage"];
        //assign points
        if (f2.Owner) {
          f2.Owner.IncreasePoints(Astriarch.Player.EarnedPointsType.DAMAGED_STARSHIP_STRENGTH, f1KVP["Damage"]);
        }
      }
      fleet1DamagePending = {};

      for (var i in fleet2DamagePending) {
        var f2KVP = fleet2DamagePending[i]; //KeyValuePair<StarShipId, {Starship:starshipObject, Damage:int}>
        f2KVP["Starship"].Health -= f2KVP["Damage"];
        //assign points
        if (f1.Owner) {
          f1.Owner.IncreasePoints(Astriarch.Player.EarnedPointsType.DAMAGED_STARSHIP_STRENGTH, f2KVP["Damage"]);
        }
      }
      fleet2DamagePending = {};

      f1.ReduceFleet();
      f2.ReduceFleet();
    }

    if (f1.DetermineFleetStrength() > 0) {
      fleet1Wins = true;
      //assign experience to fleet1
      f1.GetAllStarShips().forEach(function(s) {
        if (experiencedGainedByStarShipId[s.id]) {
          s.ExperienceAmount += experiencedGainedByStarShipId[s.id];
        }
      });
    } else if (f2.DetermineFleetStrength() > 0) {
      fleet1Wins = false;
      //assign experience to fleet2
      f2.GetAllStarShips().forEach(function(s) {
        if (experiencedGainedByStarShipId[s.id]) {
          s.ExperienceAmount += experiencedGainedByStarShipId[s.id];
        }
      });
    }

    return fleet1Wins;
  },

  //enemyFleetSpacePlatformDamagePendingObject is just for the ref (in/out) parm wich is simply: {enemyFleetSpacePlatformDamagePending: 0}
  StarshipFireWeapons: function(
    attackBonusChance,
    defenseBonusChance,
    /*StarShip*/ ship,
    /*List<StarShip>*/ enemyFleet,
    /*Dictionary<StarShipId, {Starship:starshipObject, Damage:int}>*/ fleetDamagePending
  ) {
    var totalDamage = 0;
    var damage = 0;
    var maxDamage = 0;
    var workingEnemyFleet = []; // List<StarShip>(enemyFleet.Count);
    workingEnemyFleet = workingEnemyFleet.concat(enemyFleet);
    var strengthComparer = new Astriarch.Fleet.StarShipAdvantageStrengthComparer(ship, fleetDamagePending);
    workingEnemyFleet.sort(strengthComparer.sortFunction);

    for (var iGun = 0; iGun < ship.Strength(); iGun += Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER) {
      //remove any in the enemy fleet with strength - pending damage <= 0 so that they aren't a target
      for (var i = workingEnemyFleet.length - 1; i >= 0; i--) {
        var enemy = workingEnemyFleet[i]; //StarShip
        var pendingDamage = { Starship: enemy, Damage: 0 };
        if (fleetDamagePending[enemy.id]) {
          pendingDamage = fleetDamagePending[enemy.id];
        }
        if (workingEnemyFleet[i].Strength() - pendingDamage["Damage"] <= 0) {
          workingEnemyFleet.splice(i, 1);
        }
      }

      //calculate starship max damage
      maxDamage = Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER;

      //add/remove additional max damage for research advancement
      if (attackBonusChance && Math.random() < attackBonusChance) {
        maxDamage += Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER_HALF;
      }

      if (defenseBonusChance && Math.random() < defenseBonusChance) {
        maxDamage -= Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER_HALF;
      }

      //choose target
      if (workingEnemyFleet.length > 0) {
        var target = workingEnemyFleet[0]; //StarShip

        //add/remove additional max damage for advantages/disadvantages
        if (Astriarch.BattleSimulator.StarshipHasAdvantage(ship, target)) {
          maxDamage += Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER_HALF;
        } else if (Astriarch.BattleSimulator.StarshipHasDisadvantage(ship, target)) {
          maxDamage -= Astriarch.BattleSimulator.STARSHIP_WEAPON_POWER_HALF;
        }

        damage = Astriarch.NextRandom(0, maxDamage + 1);
        totalDamage += damage;

        if (damage != 0) {
          if (!fleetDamagePending[target.id]) {
            fleetDamagePending[target.id] = { Starship: target, Damage: 0 };
          }
          fleetDamagePending[target.id]["Damage"] += damage;
        }
      }
    }
    return totalDamage;
  },

  StarshipHasAdvantage: function(/*StarShip*/ ssAttacker, /*StarShip*/ ssDefender) {
    //space platforms have advantages over everything
    if (ssAttacker.Type == Astriarch.Fleet.StarShipType.SpacePlatform) {
      return true;
    } else if (ssDefender.Type == Astriarch.Fleet.StarShipType.SpacePlatform) {
      return false;
    } else if (ssAttacker.AdvantageAgainstType == ssDefender.Type) {
      return true;
    }
    return false;
  },

  StarshipHasDisadvantage: function(/*StarShip*/ ssAttacker, /*StarShip*/ ssDefender) {
    if (ssAttacker.Type == Astriarch.Fleet.StarShipType.SpacePlatform) {
      return false;
    } else if (ssDefender.Type == Astriarch.Fleet.StarShipType.SpacePlatform) {
      return true;
    } else if (ssAttacker.DisadvantageAgainstType == ssDefender.Type) {
      return true;
    }
    return false;
  }
}; //Astriarch.BattleSimulator

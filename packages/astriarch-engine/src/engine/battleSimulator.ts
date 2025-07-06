import { FleetData, StarshipData, StarShipType } from "../model/fleet";
import { PlayerData } from "../model/player";
import { ResearchType } from "../model/research";
import { Utils } from "../utils/utils";
import { Fleet } from "./fleet";
import { StarShipAdvantageStrengthComparer } from "./starShipAdvantageStrengthComparer";

interface FleetBonusChance {
  attack: number;
  defense: number;
}

interface PendingHit {
  damage: number;
  source: StarshipData;
}

export type FleetDamagePending = Record<number, { starship: StarshipData; hits: PendingHit[] }>;
type ExperiencePending = Record<number, { starship: StarshipData; damageDealt: number }>;

//new simulate fleet battle logic:
//this will support choosing a target and allowing ships to have an advantage over other types
//here are the advantages (-> means has an advantage over):
//defenders -> destroyers -> battleships -> cruisers -> spaceplatforms -> scouts (-> defenders)
//target decisions:
//if there is an enemy ship that this ship has an advantage over, choose that one
//otherwise go for the weakest ship to shoot at
export class BattleSimulator {
  private static STARSHIP_WEAPON_POWER = 2; //defenders have one gun and battleships have 16
  private static STARSHIP_WEAPON_POWER_HALF = 1;
  private static HOME_SYSTEM_ADVANTAGE = 0.05;
  private static BATTLE_RANDOMNESS_FACTOR: 4.0; //the amount randomness (chance) when determining fleet conflict outcomes, it is the strength multiplyer where the winner is guaranteed to win

  public static simulateFleetBattle(
    f1: FleetData,
    f1Owner: PlayerData,
    f2: FleetData,
    f2Owner?: PlayerData
  ): boolean | null {
    let fleet1Wins = null; // null means draw which shouldn't happen unless two fleets meet in mid-space (neither has locationHex)

    const f1BonusChance: FleetBonusChance = { attack: 0, defense: 0 };
    const f2BonusChance: FleetBonusChance = { attack: 0, defense: 0 };

    //fleet damage pending structures are so we can have both fleets fire simultaneously without damaging each-other till the end of each round
    let fleet1DamagePending: FleetDamagePending = {};
    let fleet2DamagePending: FleetDamagePending = {};

    //We don't award experience points until the end of battle so that ships can't level up in the heat of conflict
    const experiencedGainedByStarShipId: ExperiencePending = {};

    f1BonusChance.attack =
      f1Owner.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_ATTACK].data.chance! +
      (f1.locationHexMidPoint ? this.HOME_SYSTEM_ADVANTAGE : 0);
    f1BonusChance.defense =
      f1Owner.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_DEFENSE].data.chance! +
      (f1.locationHexMidPoint ? this.HOME_SYSTEM_ADVANTAGE : 0);

    f2BonusChance.attack =
      (f2Owner?.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_ATTACK].data.chance || 0) +
      (f2.locationHexMidPoint ? this.HOME_SYSTEM_ADVANTAGE : 0);
    f2BonusChance.defense =
      (f2Owner?.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_DEFENSE].data.chance || 0) +
      (f2.locationHexMidPoint ? this.HOME_SYSTEM_ADVANTAGE : 0);

    while (Fleet.determineFleetStrength(f1) > 0 && Fleet.determineFleetStrength(f2) > 0) {
      // fire weapons
      for (const s of f1.starships) {
        this.starshipFireWeapons(f1BonusChance.attack, f2BonusChance.defense, s, f2.starships, fleet2DamagePending);
      }

      for (const s of f2.starships) {
        this.starshipFireWeapons(f2BonusChance.attack, f1BonusChance.defense, s, f1.starships, fleet1DamagePending);
      }

      // deal damage
      this.dealDamage(f1Owner, fleet1DamagePending, experiencedGainedByStarShipId);
      this.dealDamage(f2Owner, fleet2DamagePending, experiencedGainedByStarShipId);
      fleet1DamagePending = {};
      fleet2DamagePending = {};

      Fleet.reduceFleet(f1);
      Fleet.reduceFleet(f2);
    }

    // if both fleets are destroyed, choose fleet with a planet on the hex
    const f1Strength = Fleet.determineFleetStrength(f1);
    const f2Strength = Fleet.determineFleetStrength(f2);
    if (f1Strength <= 0 && f2Strength <= 0) {
      if (f1.locationHexMidPoint) {
        fleet1Wins = true;
      }
      if (f2.locationHexMidPoint) {
        fleet1Wins = false;
      }
    } else if (f1Strength > 0) {
      fleet1Wins = true;
    } else if (f2Strength > 0) {
      fleet1Wins = false;
    }

    if (fleet1Wins != null) {
      //assign experience
      (fleet1Wins ? f1 : f2).starships.forEach((s) => {
        if (s.id in experiencedGainedByStarShipId) {
          s.experienceAmount += experiencedGainedByStarShipId[s.id].damageDealt;
        }
      });
    }

    return fleet1Wins;
  }

  public static dealDamage(
    owner: PlayerData | undefined,
    fleetDamagePending: FleetDamagePending,
    experiencedGainedByStarShipId: ExperiencePending
  ) {
    for (const dp of Object.values(fleetDamagePending)) {
      for (const hit of dp.hits) {
        const sourceId = hit.source.id;
        if (!(sourceId in experiencedGainedByStarShipId)) {
          experiencedGainedByStarShipId[sourceId] = { starship: hit.source, damageDealt: 0 };
        }
        experiencedGainedByStarShipId[sourceId].damageDealt += Fleet.damageStarship(owner, dp.starship, hit.damage);
      }
    }
  }

  public static starshipFireWeapons(
    attackBonusChance: number,
    defenseBonusChance: number,
    ship: StarshipData,
    enemyFleet: StarshipData[],
    fleetDamagePending: FleetDamagePending
  ) {
    let damage = 0;
    let maxDamage = 0;
    let workingEnemyFleet: StarshipData[] = [];
    workingEnemyFleet = workingEnemyFleet.concat(enemyFleet);
    const strengthComparer = new StarShipAdvantageStrengthComparer(ship, fleetDamagePending);
    workingEnemyFleet.sort((a, b) => strengthComparer.sortFunction(a, b));

    for (let iGun = 0; iGun < ship.health; iGun += this.STARSHIP_WEAPON_POWER) {
      //remove any in the enemy ship with strength - pending damage <= 0 so that they aren't a target
      for (let i = workingEnemyFleet.length - 1; i >= 0; i--) {
        const enemy = workingEnemyFleet[i]; //StarShip
        let pendingDamage = 0;
        if (enemy.id in fleetDamagePending) {
          pendingDamage = this.getTotalPendingDamage(fleetDamagePending[enemy.id].hits);
        }
        if (workingEnemyFleet[i].health - pendingDamage <= 0) {
          workingEnemyFleet.splice(i, 1);
        }
      }

      //calculate starship max damage
      maxDamage = this.STARSHIP_WEAPON_POWER;

      //add/remove additional max damage for research advancement
      if (attackBonusChance && Math.random() < attackBonusChance) {
        maxDamage += this.STARSHIP_WEAPON_POWER_HALF;
      }

      if (defenseBonusChance && Math.random() < defenseBonusChance) {
        maxDamage -= this.STARSHIP_WEAPON_POWER_HALF;
      }

      //choose target
      if (workingEnemyFleet.length > 0) {
        const target = workingEnemyFleet[0]; //StarShip

        //add/remove additional max damage for advantages/disadvantages
        if (this.starshipHasAdvantage(ship, target)) {
          maxDamage += this.STARSHIP_WEAPON_POWER_HALF;
        } else if (this.starshipHasDisadvantage(ship, target)) {
          maxDamage -= this.STARSHIP_WEAPON_POWER_HALF;
        }

        damage = Utils.nextRandom(0, maxDamage + 1);

        if (damage != 0) {
          if (!(target.id in fleetDamagePending)) {
            fleetDamagePending[target.id] = { starship: target, hits: [] };
          }
          fleetDamagePending[target.id].hits.push({ damage, source: ship });
        }
      }
    }
  }

  public static starshipHasAdvantage(ssAttacker: StarshipData, ssDefender: StarshipData) {
    //space platforms have advantages over everything
    const attackerAdvantage = ssAttacker.customShipData
      ? ssAttacker.customShipData.advantageAgainst
      : Fleet.getStarshipStandardAdvantageByType(ssAttacker.type)?.advantageAgainst;
    if (ssAttacker.type == StarShipType.SpacePlatform) {
      return true;
    } else if (ssDefender.type == StarShipType.SpacePlatform) {
      return false;
    } else if (attackerAdvantage == ssDefender.type) {
      return true;
    }
    return false;
  }

  public static starshipHasDisadvantage(ssAttacker: StarshipData, ssDefender: StarshipData) {
    const attackerDisadvantage = ssAttacker.customShipData
      ? ssAttacker.customShipData.disadvantageAgainst
      : Fleet.getStarshipStandardAdvantageByType(ssAttacker.type)?.disadvantageAgainst;
    if (ssAttacker.type == StarShipType.SpacePlatform) {
      return false;
    } else if (ssDefender.type == StarShipType.SpacePlatform) {
      return true;
    } else if (attackerDisadvantage == ssDefender.type) {
      return true;
    }
    return false;
  }

  public static getTotalPendingDamage(hits: PendingHit[]) {
    return hits.reduce((accum, curr) => accum + curr.damage, 0);
  }

  public static getAttackingFleetChances(playerFleetStrength: number, enemyFleetStrength: number): number {
    let attackingFleetChances = 0;
    if (enemyFleetStrength > playerFleetStrength * this.BATTLE_RANDOMNESS_FACTOR) {
      attackingFleetChances = 1;
    } else if (playerFleetStrength > enemyFleetStrength * this.BATTLE_RANDOMNESS_FACTOR) {
      attackingFleetChances = enemyFleetStrength == 0 ? 100 : 99;
    } else {
      //algorithm for estimated chance: BATTLE_RANDOMNESS_FACTOR here = 4
      // % chance = 50 + LOG base 4(greater fleet strength / lesser fleet strength)
      let randomnessUpperBounds = 0;
      if (playerFleetStrength > enemyFleetStrength) {
        //prefer player
        const extraPercentageChance =
          (Math.log(playerFleetStrength / (enemyFleetStrength * 1.0)) /
            Math.log(Math.pow(this.BATTLE_RANDOMNESS_FACTOR, 2))) *
          100; //((playerFleetStrength - enemyFleetStrength) / (double)enemyFleetStrength) * 50;
        randomnessUpperBounds = 50 + Math.round(extraPercentageChance);
        attackingFleetChances = randomnessUpperBounds;
      } else {
        //prefer enemy
        const extraPercentageChanceEnemy =
          (Math.log(enemyFleetStrength / (playerFleetStrength * 1.0)) /
            Math.log(Math.pow(this.BATTLE_RANDOMNESS_FACTOR, 2))) *
          100; //((enemyFleetStrength - playerFleetStrength) / (double)playerFleetStrength) * 50;
        randomnessUpperBounds = 50 + Math.round(extraPercentageChanceEnemy);
        attackingFleetChances = 100 - randomnessUpperBounds;
      }
    }
    return attackingFleetChances;
  }
}

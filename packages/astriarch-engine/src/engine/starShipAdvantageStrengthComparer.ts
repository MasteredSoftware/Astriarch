import { StarshipData } from '../model/fleet';
import { BattleSimulator, FleetDamagePending } from './battleSimulator';

/**
 * StarShipAdvantageStrengthComparer is an object that allows array sorting of starships
 * @constructor
 */
export class StarShipAdvantageStrengthComparer {
  ship: StarshipData;
  fleetDamagePending: FleetDamagePending;
  constructor(ship: StarshipData, fleetDamagePending: FleetDamagePending) {
    this.ship = ship;
    this.fleetDamagePending = fleetDamagePending;
  }

  public sortFunction(a: StarshipData, b: StarshipData): number {
    let ret = 0;
    const strengthA = this.getStarShipAdvantageDisadvantageAdjustedStrength(a);
    const strengthB = this.getStarShipAdvantageDisadvantageAdjustedStrength(b);

    if (strengthA === strengthB) {
      // When strengths are equal, use ID as a tiebreaker to ensure stable sorting
      // This prevents damage from spreading across multiple identical ships
      ret = a.id.localeCompare(b.id);
    } else if (strengthA < strengthB) {
      ret = -1;
    } else {
      ret = 1;
    }

    return ret;
  }

  /**
   * Adjusts the starships relative strength for sorting based on starship advantages
   */
  public getStarShipAdvantageDisadvantageAdjustedStrength(enemy: StarshipData) {
    let adjustedStrength = enemy.health;
    if (enemy.id in this.fleetDamagePending) {
      adjustedStrength -= BattleSimulator.getTotalPendingDamage(this.fleetDamagePending[enemy.id].hits);
    }

    if (BattleSimulator.starshipHasAdvantage(this.ship, enemy)) adjustedStrength *= 1;
    //this just ensures we're always attaking the enemy we have an advantage over
    else if (BattleSimulator.starshipHasDisadvantage(this.ship, enemy)) adjustedStrength *= 10000;
    else adjustedStrength *= 100;

    return adjustedStrength;
  }
}

import { PlanetData, PlanetType } from '../model/planet';
import { LastKnownPlanetFleetStrength } from '../model/player';
import { Fleet } from './fleet';
import { Grid, GridHex } from './grid';

/**
 * A sort function object to prefer planets with less distance
 */
export class PlanetDistanceComparer {
  grid: Grid;
  source: PlanetData;
  sourceHex: GridHex;
  lastKnownPlanetFleetStrength: LastKnownPlanetFleetStrength | undefined;

  constructor(grid: Grid, source: PlanetData, lastKnownPlanetFleetStrength?: LastKnownPlanetFleetStrength) {
    this.grid = grid;
    this.source = source;
    this.lastKnownPlanetFleetStrength = lastKnownPlanetFleetStrength;
    const hex = this.grid.getHexAt(source.boundingHexMidPoint);
    if (!hex) {
      throw new Error(`PlanetDistanceComparer could not find hex for source planet: ${source.id}`);
    }
    this.sourceHex = hex;
  }

  /**
   * sort function for planet distances
   * @param a
   * @param b
   * @returns
   */
  public sortFunction(a: PlanetData, b: PlanetData): number {
    //TODO: this could be slow, we could just have an index for all distances instead of calculating it each time
    let ret = 0;
    let distanceA = 0;
    let distanceB = 0;
    const hexA = this.grid.getHexAt(a.boundingHexMidPoint);
    if (hexA && a !== this.source) {
      //just to be sure
      distanceA = Grid.getHexDistance(this.sourceHex, hexA);
      ret = 1;
    }
    const hexB = this.grid.getHexAt(b.boundingHexMidPoint);
    if (hexB && b !== this.source) {
      //just to be sure
      distanceB = Grid.getHexDistance(this.sourceHex, hexB);
      ret = -1;
    }

    if (ret !== 0) {
      //NOTE: this sorts in decending order or distance because we start at the end of the list
      if (this.lastKnownPlanetFleetStrength) {
        distanceA += this.increasedDistanceBasedOnPlanetValueAndFleetStrength(a);
        distanceB += this.increasedDistanceBasedOnPlanetValueAndFleetStrength(b);
      }

      if (distanceA === distanceB) ret = 0;
      else if (distanceA < distanceB) ret = 1;
      else ret = -1;
    }

    return ret;
  }

  /**
   * returns the distance to increase a planet for sorting based on strength
   */
  private increasedDistanceBasedOnPlanetValueAndFleetStrength(p: PlanetData) {
    //to normalize distance, value and strength we increase the distance as follows
    //Based on Value (could eventually base this on what we need so if we need more minerals we prefer asteroids:
    // Class 2 planets add +0 distance
    // Class 1 planets add +1 distance
    // Dead planets add +2 distance
    // Asteroids add +3 distance
    //Based on last known fleet strength:
    // Strength < 20 add + 0
    // Strength 20 to 39 + 1
    // Strength 40 to 79 + 2
    // Strength > 80 + 3

    let distance = 0;
    switch (p.type) {
      case PlanetType.AsteroidBelt:
        distance += 3;
        break;
      case PlanetType.DeadPlanet:
        distance += 2;
        break;
      case PlanetType.PlanetClass1:
        distance += 1;
        break;
    }

    if (this.lastKnownPlanetFleetStrength && p.id in this.lastKnownPlanetFleetStrength) {
      const strength = Fleet.determineFleetStrength(this.lastKnownPlanetFleetStrength[p.id].fleetData);

      if (strength >= 20 && strength < 40) {
        distance += 1;
      } else if (strength >= 40 && strength < 80) {
        distance += 2;
      } else if (strength >= 80) {
        distance += 3;
      }
    }

    return distance;
  }
}

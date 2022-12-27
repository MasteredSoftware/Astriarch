import { PlanetData } from "../model/planet";
import { GameModelData } from "./gameModel";
import {Grid, GridHex} from "./grid";

/**
 * A sort function object to prefer planets with less distance
 */
export class PlanetDistanceComparer {
  gameModel: GameModelData;
  source: PlanetData;
  sourceHex: GridHex;
  
  constructor(gameModel: GameModelData, source: PlanetData) {
    this.gameModel = gameModel;
    this.source = source;
    const hex = gameModel.grid.getHexAt(source.boundingHexMidPoint);
    if(!hex) {
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
  public sortFunction(a:PlanetData, b:PlanetData):number {
    //TODO: this could be slow, we could just have an index for all distances instead of calculating it each time
    let ret = 0;
    let distanceA = 0;
    let distanceB = 0;
    const hexA = this.gameModel.grid.getHexAt(a.boundingHexMidPoint);
    if (hexA && a !== this.source) {
      //just to be sure
      distanceA = Grid.getHexDistance(this.sourceHex, hexA);
      ret = 1;
    }
    const hexB = this.gameModel.grid.getHexAt(b.boundingHexMidPoint);
    if (hexB && b !== this.source) {
      //just to be sure
      distanceB = Grid.getHexDistance(this.sourceHex, hexB);
      ret = -1;
    }

    if (ret !== 0) {
      //NOTE: this sorts in decending order or distance because we start at the end of the list
      if (distanceA === distanceB) ret = 0;
      else if (distanceA < distanceB) ret = 1;
      else ret = -1;
    }

    return ret;
  };
};
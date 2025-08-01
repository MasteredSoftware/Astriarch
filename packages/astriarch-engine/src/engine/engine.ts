import { GameModelData } from './gameModel';

export class Engine {
  serverGameModels: GameModelData[] = [];
  constructor(data: GameModelData[]) {
    this.serverGameModels = data;
  }
}

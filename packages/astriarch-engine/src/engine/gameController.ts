import { ClientModelData, PlanetById } from "../model/clientModel";
import { ModelBase, ModelData } from "../model/model";
import { PlanetData } from "../model/planet";
import { PlayerData } from "../model/player";
import { ClientGameModel } from "./clientGameModel";
import { GameModel } from "./gameModel";
import { Planet } from "./planet";

export class GameController {
  private static BATTLE_RANDOMNESS_FACTOR: 4.0; //the amount randomness (chance) when determining fleet conflict outcomes, it is the strength multiplyer where the winner is guaranteed to win

  public static MS_PER_CYCLE = 30 * 1000; // Time per cycle (or "turn")

  public static startModelSnapshot(modelBase: ModelBase) {
    const newSnapshotTime = new Date().getTime();
    const lastSnapshotTime = modelBase.lastSnapshotTime;

    const elapsedSinceLastSnapshot = newSnapshotTime - lastSnapshotTime;
    const cyclesElapsed = elapsedSinceLastSnapshot / GameController.MS_PER_CYCLE;

    const elapsedSinceStart = newSnapshotTime - modelBase.gameStartedAtTime;
    const advancedCyclesTotal = elapsedSinceStart / GameController.MS_PER_CYCLE;

    return {
      newSnapshotTime,
      cyclesElapsed,
      currentCycle: Math.trunc(advancedCyclesTotal),
    };
  }

  public static advanceGameClock(model: ModelData) {
    const { cyclesElapsed, newSnapshotTime, currentCycle } = GameController.startModelSnapshot(model);
    const planetById = ClientGameModel.getPlanetByIdIndex(model.planets);

    for (const p of model.players) {
      GameController.generatePlayerResources(p, planetById, cyclesElapsed);
    }

    model.lastSnapshotTime = newSnapshotTime;
    model.currentCycle = currentCycle;
  }

  public static advanceClientGameClock(clientModel: ClientModelData) {
    const { cyclesElapsed, newSnapshotTime, currentCycle } = GameController.startModelSnapshot(clientModel);

    GameController.generatePlayerResources(clientModel.mainPlayer, clientModel.mainPlayerOwnedPlanets, cyclesElapsed);

    clientModel.lastSnapshotTime = newSnapshotTime;
    clientModel.currentCycle = currentCycle;
  }

  public static generatePlayerResources(p: PlayerData, planetById: PlanetById, cyclesElapsed: number) {
    for (const planetId of p.ownedPlanetIds) {
      const planet = planetById[planetId];
      Planet.generateResources(planet, cyclesElapsed, p);
    }
  }
}
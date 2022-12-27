import { ClientModelData, PlanetById } from "../model/clientModel";
import { ModelBase, ModelData } from "../model/model";
import { PlanetData } from "../model/planet";
import { PlayerData } from "../model/player";
import { ClientGameModel } from "./clientGameModel";
import { Events } from "./events";
import { GameModel } from "./gameModel";
import { Planet } from "./planet";
import { Player } from "./player";

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
    //const planetById = ClientGameModel.getPlanetByIdIndex(model.planets);

    // TODO: server side operations prior to advancing game clock for the player
    // ComputerTakeTurn
    // executeCurrentTrades
    // moveShips

    for (const p of model.players) {
      const ownedPlanets = ClientGameModel.getOwnedPlanets(p.ownedPlanetIds, model.planets);
      Player.advanceGameClockForPlayer(p, ownedPlanets, cyclesElapsed);
    }

    // TODO: server side operations after advancing game clock for player
    // repair fleets on planets
    // resolvePlanetaryConflicts

    model.lastSnapshotTime = newSnapshotTime;
    model.currentCycle = currentCycle;
    Events.publish();
  }

  public static advanceClientGameClock(clientModel: ClientModelData) {
    const { cyclesElapsed, newSnapshotTime, currentCycle } = GameController.startModelSnapshot(clientModel);

    Player.advanceGameClockForPlayer(clientModel.mainPlayer, clientModel.mainPlayerOwnedPlanets, cyclesElapsed);

    clientModel.lastSnapshotTime = newSnapshotTime;
    clientModel.currentCycle = currentCycle;
    Events.publish();
  }
}

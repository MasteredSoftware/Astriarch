import { ClientModelData } from "../model/clientModel";
import { ModelBase } from "../model/model";
import { ClientGameModel } from "./clientGameModel";
import { Events } from "./events";
import { GameModelData } from "./gameModel";
import { Player } from "./player";
import { TradingCenter } from "./tradingCenter";

export class GameController {
  private static BATTLE_RANDOMNESS_FACTOR: 4.0; //the amount randomness (chance) when determining fleet conflict outcomes, it is the strength multiplyer where the winner is guaranteed to win

  public static MS_PER_CYCLE = 30 * 1000; // Time per cycle (or "turn")

  public static startModelSnapshot(modelDataBase: ModelBase) {
    const newSnapshotTime = new Date().getTime();
    const lastSnapshotTime = modelDataBase.lastSnapshotTime;

    const elapsedSinceLastSnapshot = newSnapshotTime - lastSnapshotTime;
    const cyclesElapsed = elapsedSinceLastSnapshot / GameController.MS_PER_CYCLE;

    const elapsedSinceStart = newSnapshotTime - modelDataBase.gameStartedAtTime;
    const advancedCyclesTotal = elapsedSinceStart / GameController.MS_PER_CYCLE;

    return {
      newSnapshotTime,
      cyclesElapsed,
      currentCycle: Math.trunc(advancedCyclesTotal),
    };
  }

  public static advanceGameClock(gameModel: GameModelData) {
    const { modelData } = gameModel;
    const { cyclesElapsed, newSnapshotTime, currentCycle } = GameController.startModelSnapshot(modelData);
    const planetById = ClientGameModel.getPlanetByIdIndex(modelData.planets);

    // TODO: server side operations prior to advancing game clock for the player
    // ComputerTakeTurn
    TradingCenter.executeCurrentTrades(gameModel, planetById);
    // moveShips

    for (const p of modelData.players) {
      const ownedPlanets = ClientGameModel.getOwnedPlanets(p.ownedPlanetIds, modelData.planets);
      Player.advanceGameClockForPlayer(p, ownedPlanets, cyclesElapsed);
    }

    // TODO: server side operations after advancing game clock for player
    // repair fleets on planets
    // resolvePlanetaryConflicts

    modelData.lastSnapshotTime = newSnapshotTime;
    modelData.currentCycle = currentCycle;
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

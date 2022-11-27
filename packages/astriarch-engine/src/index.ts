import { Engine } from "./engine/engine";
import { GameController } from "./engine/gameController";
import { GameModel, GameModelData, playerColors } from "./engine/gameModel";
import { Player } from "./engine/player";
import { GalaxySizeOption, GameSpeed, PlanetsPerSystemOption } from "./model/model";
import { PlayerType } from "./model/player";

export const MS_PER_TICK = 200; // Time for client side refreshes
export const MS_PER_CYCLE = 30 * 1000; // Time per "turn"

const engine = new Engine([]);

export const startNewGame = () => {
  const players = [];
  players.push(Player.constructPlayer("me", PlayerType.Human, "Matt", playerColors[0]));
  players.push(Player.constructPlayer("c1", PlayerType.Computer_Hard, "Computer1", playerColors[1]));

  const gameOptions = {
    systemsToGenerate: 2,
    planetsPerSystem: PlanetsPerSystemOption.FIVE,
    galaxySize: GalaxySizeOption.SMALL,
    distributePlanetsEvenly: true,
    quickStart: true,
    gameSpeed: GameSpeed.NORMAL,
    version: "2.0",
  };

  const gameModel = GameModel.constructData(players, gameOptions);

  engine.serverGameModels.push(gameModel);
  return gameModel;
};

export const advanceGameModelTime = (gameModel: GameModelData) => {
  // this is all just for testing / POC right now
  GameController.advanceGameClock(gameModel.modelData);

  return gameModel;
};

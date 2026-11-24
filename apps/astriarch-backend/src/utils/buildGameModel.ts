import * as engine from "astriarch-engine";
import { logger } from "./logger";
import { getTestGalaxySeed } from "./testGalaxySeed";

/**
 * Builds the engine game model for a game that is starting.
 *
 * Missing options fall back to the defaults the lobby has always used. In
 * NODE_ENV=test a galaxy seed may be set (POST /api/test/galaxy-seed) so
 * benchmarks get a reproducible galaxy; otherwise generation uses Math.random.
 */
export function buildStartingGameModel(
  enginePlayers: engine.PlayerData[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stored lobby options are untyped
  gameOptions: any,
): engine.GameModelData {
  const buildGameModel = () =>
    engine.GameModel.constructData(enginePlayers, {
      systemsToGenerate: gameOptions?.systemsToGenerate || 4,
      planetsPerSystem: gameOptions?.planetsPerSystem || 4,
      galaxySize: gameOptions?.galaxySize || engine.GalaxySizeOption.SMALL,
      distributePlanetsEvenly: gameOptions?.distributePlanetsEvenly ?? true,
      quickStart: gameOptions?.quickStart ?? false,
      gameSpeed: gameOptions?.gameSpeed || engine.GameSpeed.NORMAL,
      version: "2.0",
    });
  const galaxySeed = getTestGalaxySeed();
  if (galaxySeed === null) return buildGameModel();
  const gameModel = engine.Utils.withRandomSeed(galaxySeed, buildGameModel);
  logger.info(`Game galaxy generated with test seed ${galaxySeed}`);
  return gameModel;
}

import { PlayerType } from '../model/player';
import { startNewTestGameWithOptions } from '../test/testUtils';
import { ClientGameModel } from './clientGameModel';
import { GameController } from './gameController';

const assertPointsBasedOnGameOptions = (
  expectedPoints: number,
  turnNumber: number,
  points: number,
  systemsToGenerate: number,
  planetsPerSystem: number,
  ownedPlanetCount: number,
  playerCount: number,
  playerWins: boolean,
  playerType: PlayerType = PlayerType.Computer_Expert,
) => {
  const testGameData = startNewTestGameWithOptions(
    turnNumber,
    points,
    systemsToGenerate,
    planetsPerSystem,
    ownedPlanetCount,
    playerCount,
    playerType,
  );
  const { modelData } = testGameData.gameModel;
  const [player] = modelData.players;
  const ownedPlanets = ClientGameModel.getOwnedPlanets(player.ownedPlanetIds, modelData.planets);
  const calculatedPoints = GameController.calculateEndGamePoints(modelData, player, ownedPlanets, playerWins);
  expect(calculatedPoints).toEqual(expectedPoints);
};

describe('GameController', () => {
  beforeEach(() => {});

  describe('CalculateEndGamePoints()', () => {
    it('should base points on total points at the end of the game', () => {
      assertPointsBasedOnGameOptions(436, 100, 100, 4, 4, 8, 4, true);
    });

    it('should award less points if the player loses', () => {
      assertPointsBasedOnGameOptions(404, 100, 100, 4, 4, 8, 4, false);
    });

    it('should handle awarding points even if the player owns no planets', () => {
      assertPointsBasedOnGameOptions(400, 100, 100, 4, 4, 0, 4, false);
    });

    it('should give bonus points for a quick game', () => {
      assertPointsBasedOnGameOptions(472, 50, 100, 4, 4, 8, 4, true);
    });

    it('should give less points for an easier game', () => {
      assertPointsBasedOnGameOptions(413, 100, 100, 2, 4, 8, 2, true, PlayerType.Human);
    });
  });
});

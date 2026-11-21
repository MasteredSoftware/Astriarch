/**
 * Engine micro-benchmark for the client game clock, which the frontend runs on
 * every animation frame. Separates engine cost from rendering cost in the
 * browser perf harness (see performance_improvements_plan.md).
 *
 *   pnpm --filter astriarch-engine bench
 *
 * Uses the same pinned galaxy as the browser benchmark (seed, Medium galaxy,
 * 4 systems, 6 planets per system, quick start) so the numbers are comparable.
 */

import { bench, describe, vi } from 'vitest';
import { advanceClientGameModelTime, constructClientGameModel } from '../index';
import { GameModel, playerColors } from './gameModel';
import { Player } from './player';
import { Utils } from '../utils/utils';
import { GalaxySizeOption, GameSpeed, PlanetsPerSystemOption } from '../model/model';
import { PlayerData, PlayerType } from '../model/player';

const GALAXY_SEED = 20261120; // keep in sync with BENCHMARK_GAME in the frontend perf harness

function setup() {
  const players: PlayerData[] = [
    Player.constructPlayer('me', PlayerType.Human, 'PerfPlayer', playerColors[0]),
    Player.constructPlayer('c1', PlayerType.Computer_Normal, 'Computer1', playerColors[1]),
    Player.constructPlayer('c2', PlayerType.Computer_Normal, 'Computer2', playerColors[2]),
    Player.constructPlayer('c3', PlayerType.Computer_Normal, 'Computer3', playerColors[3]),
  ];
  const gameModel = Utils.withRandomSeed(GALAXY_SEED, () =>
    GameModel.constructData(players, {
      systemsToGenerate: 4,
      planetsPerSystem: PlanetsPerSystemOption.SIX,
      galaxySize: GalaxySizeOption.MEDIUM,
      distributePlanetsEvenly: true,
      quickStart: true,
      gameSpeed: GameSpeed.NORMAL,
      version: '2.0',
    }),
  );
  const clientModel = constructClientGameModel(gameModel.modelData, 'me');
  return { grid: gameModel.grid, clientModel };
}

describe('advanceClientGameModelTime', () => {
  // Mimic the frontend's per-frame call: ~16.7ms of game time per call.
  const frame = setup();
  let now = frame.clientModel.lastSnapshotTime;
  bench(
    'one 60fps frame (16.7ms of game time)',
    () => {
      now += 1000 / 60;
      vi.setSystemTime(now);
      advanceClientGameModelTime(frame.clientModel, frame.grid);
    },
    {
      setup: () => {
        vi.useFakeTimers({ toFake: ['Date'] });
      },
      teardown: () => {
        vi.useRealTimers();
      },
    },
  );

  // A fixed 200ms tick (MS_PER_TICK), the cadence Phase 2 proposes.
  const tick = setup();
  let tickNow = tick.clientModel.lastSnapshotTime;
  bench(
    'one 200ms tick (MS_PER_TICK)',
    () => {
      tickNow += 200;
      vi.setSystemTime(tickNow);
      advanceClientGameModelTime(tick.clientModel, tick.grid);
    },
    {
      setup: () => {
        vi.useFakeTimers({ toFake: ['Date'] });
      },
      teardown: () => {
        vi.useRealTimers();
      },
    },
  );
});

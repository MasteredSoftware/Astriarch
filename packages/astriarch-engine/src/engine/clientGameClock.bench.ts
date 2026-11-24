/**
 * Engine micro-benchmark for the client game clock, which the frontend runs on
 * every animation frame. Separates engine cost from rendering cost in the
 * browser perf harness (see performance_improvements_plan.md).
 *
 *   pnpm --filter astriarch-engine bench
 *
 * Uses the same pinned galaxy as the browser benchmark (seed, Medium galaxy,
 * 4 systems, 6 planets per system, quick start) so the numbers are comparable.
 *
 * Each call advances the model's clock, so without a reset tinybench's many
 * iterations would run the model through hours of game time and measure a
 * drifting state. The benches therefore measure a steady state: before the
 * simulated time reaches the end of the first cycle they restore a pristine
 * copy of the client model and rewind the fake clock. The copy is made inside
 * the timed function, so its cost is spread over the calls between restores;
 * the "restore only" bench shows that cost per restore.
 */

import { bench, describe, vi } from 'vitest';
import { advanceClientGameModelTime, constructClientGameModel } from '../index';
import { GameModel, playerColors } from './gameModel';
import { GameController } from './gameController';
import { Player } from './player';
import { Utils } from '../utils/utils';
import { GalaxySizeOption, GameSpeed, PlanetsPerSystemOption } from '../model/model';
import { PlayerData, PlayerType } from '../model/player';
import { ClientModelData } from '../model/clientModel';

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

const MS_PER_CYCLE = GameController.GAME_SPEED_MS_PER_CYCLE[GameSpeed.NORMAL] || GameController.MS_PER_CYCLE_DEFAULT;

/**
 * A client model whose clock advances by `stepMs` per call and is restored to
 * the pinned starting state before the simulated time passes one cycle.
 */
function steadyClock(stepMs: number) {
  const { grid, clientModel } = setup();
  const pristine = structuredClone(clientModel);
  const baseTime = pristine.lastSnapshotTime;
  const callsPerRestore = Math.max(1, Math.ceil(MS_PER_CYCLE / stepMs) - 1);
  let model: ClientModelData = clientModel;
  let now = baseTime;
  let calls = 0;

  const restore = () => {
    model = structuredClone(pristine);
    now = baseTime;
    calls = 0;
  };

  return {
    callsPerRestore,
    restore,
    step() {
      if (calls >= callsPerRestore) restore();
      calls++;
      now += stepMs;
      vi.setSystemTime(now);
      advanceClientGameModelTime(model, grid);
    },
  };
}

const fakeDate = {
  setup: () => {
    vi.useFakeTimers({ toFake: ['Date'] });
  },
  teardown: () => {
    vi.useRealTimers();
  },
};

describe('advanceClientGameModelTime', () => {
  // Mimic the frontend's per-frame call: ~16.7ms of game time per call.
  const frame = steadyClock(1000 / 60);
  bench('one 60fps frame (16.7ms of game time)', frame.step, {
    ...fakeDate,
    setup: () => {
      fakeDate.setup();
      frame.restore();
    },
  });

  // A fixed 200ms tick (MS_PER_TICK), the cadence Phase 2 proposes.
  const tick = steadyClock(200);
  bench('one 200ms tick (MS_PER_TICK)', tick.step, {
    ...fakeDate,
    setup: () => {
      fakeDate.setup();
      tick.restore();
    },
  });

  // The cost the two benches above pay once every callsPerRestore calls.
  const restoreOnly = steadyClock(200);
  bench(
    `restore only (structuredClone of the pinned model; amortised over ${frame.callsPerRestore} frame / ${tick.callsPerRestore} tick calls)`,
    restoreOnly.restore,
  );
});

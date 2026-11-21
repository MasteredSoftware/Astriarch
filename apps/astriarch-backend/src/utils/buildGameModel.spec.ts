import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as engine from "astriarch-engine";

import { buildStartingGameModel } from "./buildGameModel";
import { setTestGalaxySeed } from "./testGalaxySeed";
import { logger } from "./logger";

function players(): engine.PlayerData[] {
  return [
    engine.Player.constructPlayer("p1", engine.PlayerType.Human, "Host", engine.playerColors[0]),
    engine.Player.constructPlayer("p2", engine.PlayerType.Computer_Normal, "Computer 1", engine.playerColors[1]),
  ];
}

const options = {
  systemsToGenerate: 2,
  planetsPerSystem: 6,
  galaxySize: engine.GalaxySizeOption.MEDIUM,
  distributePlanetsEvenly: true,
  quickStart: true,
  gameSpeed: engine.GameSpeed.NORMAL,
};

/** Planet names and positions (ids come from a process-wide counter, so they differ per build). */
function layout(model: engine.GameModelData) {
  return model.modelData.planets.map((p) => ({ name: p.name, origin: p.originPoint }));
}

describe("buildStartingGameModel", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    setTestGalaxySeed(null);
    vi.spyOn(logger, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    setTestGalaxySeed(null);
    vi.restoreAllMocks();
  });

  it("builds the same planet layout twice while a seed is set", () => {
    setTestGalaxySeed(20261120);
    const seeded = vi.spyOn(engine.Utils, "withRandomSeed");
    const a = buildStartingGameModel(players(), options);
    const b = buildStartingGameModel(players(), options);

    expect(seeded).toHaveBeenCalledTimes(2);
    expect(seeded.mock.calls[0]![0]).toBe(20261120);
    expect(layout(a).length).toBeGreaterThan(0);
    expect(layout(b)).toEqual(layout(a));
  });

  it("builds an unseeded galaxy when the seed is cleared", () => {
    setTestGalaxySeed(20261120);
    setTestGalaxySeed(null);
    const seeded = vi.spyOn(engine.Utils, "withRandomSeed");
    const random = vi.spyOn(Math, "random");

    const model = buildStartingGameModel(players(), options);

    expect(seeded).not.toHaveBeenCalled();
    expect(random).toHaveBeenCalled();
    expect(layout(model).length).toBeGreaterThan(0);
  });

  it("ignores a seed outside NODE_ENV=test", () => {
    setTestGalaxySeed(20261120);
    process.env.NODE_ENV = "production";
    const seeded = vi.spyOn(engine.Utils, "withRandomSeed");

    buildStartingGameModel(players(), options);

    expect(seeded).not.toHaveBeenCalled();
  });

  it("applies the lobby defaults for missing options", () => {
    const model = buildStartingGameModel(players(), undefined);
    const opts = model.modelData.gameOptions;
    expect(opts).toMatchObject({
      systemsToGenerate: 4,
      planetsPerSystem: 4,
      galaxySize: engine.GalaxySizeOption.SMALL,
      distributePlanetsEvenly: true,
      quickStart: false,
      gameSpeed: engine.GameSpeed.NORMAL,
      version: "2.0",
    });
  });
});

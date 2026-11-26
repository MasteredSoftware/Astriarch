import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../models/Game", () => ({ ServerGameModel: { findOne: vi.fn(), deleteMany: vi.fn() } }));
vi.mock("../database/DocumentPersistence", () => ({ saveGameWithConcurrencyProtection: vi.fn() }));
vi.mock("../utils/testScenarios", () => ({ grantNearestPlanetWithScout: vi.fn() }));

import { testRoutes } from "./testRoutes";
import { getTestGalaxySeed, setTestGalaxySeed } from "../utils/testGalaxySeed";
import { ServerGameModel } from "../models/Game";
import { saveGameWithConcurrencyProtection } from "../database/DocumentPersistence";
import { grantNearestPlanetWithScout } from "../utils/testScenarios";
import { logger } from "../utils/logger";

function getPostHandler(path: string) {
  const routeLayer = (testRoutes as any).stack.find(
    (layer: any) => layer.route?.path === path && layer.route?.methods?.post,
  );
  if (!routeLayer) {
    throw new Error(`Test route POST ${path} handler not found`);
  }
  return routeLayer.route.stack[0].handle as (req: Request, res: Response) => void | Promise<void>;
}

function mockResponse() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };
  res.status.mockReturnValue(res);
  return res;
}

describe("testRoutes /galaxy-seed", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    setTestGalaxySeed(null);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    setTestGalaxySeed(null);
    vi.restoreAllMocks();
  });

  it("sets an integer seed", () => {
    const res = mockResponse();
    getPostHandler("/galaxy-seed")({ body: { seed: 1234 } } as Request, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, seed: 1234 });
    expect(getTestGalaxySeed()).toBe(1234);
  });

  it("clears the seed with null", () => {
    setTestGalaxySeed(99);
    const res = mockResponse();
    getPostHandler("/galaxy-seed")({ body: { seed: null } } as Request, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, seed: null });
    expect(getTestGalaxySeed()).toBeNull();
  });

  it.each([["abc"], [1.5], [undefined]])("rejects invalid seed %s", (seed) => {
    const res = mockResponse();
    getPostHandler("/galaxy-seed")({ body: { seed } } as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(getTestGalaxySeed()).toBeNull();
  });

  it("never returns a seed outside NODE_ENV=test", () => {
    setTestGalaxySeed(5);
    process.env.NODE_ENV = "production";
    expect(getTestGalaxySeed()).toBeNull();
  });
});

describe("testRoutes /grant-planet", () => {
  const findOne = vi.mocked(ServerGameModel.findOne);
  const save = vi.mocked(saveGameWithConcurrencyProtection);
  const grant = vi.mocked(grantNearestPlanetWithScout);

  beforeEach(() => {
    vi.spyOn(logger, "info").mockImplementation(() => logger);
    vi.spyOn(logger, "error").mockImplementation(() => logger);
  });

  afterEach(() => {
    findOne.mockReset();
    save.mockReset();
    grant.mockReset();
    vi.restoreAllMocks();
  });

  it.each([["my-game"], [undefined], [42]])("rejects game name %s without the __e2e__ prefix", async (gameName) => {
    const res = mockResponse();
    await getPostHandler("/grant-planet")({ body: { gameName } } as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("returns 404 when the in-progress game is missing", async () => {
    findOne.mockResolvedValue(null as never);
    const res = mockResponse();
    await getPostHandler("/grant-planet")({ body: { gameName: "__e2e__missing" } } as Request, res);
    expect(findOne).toHaveBeenCalledWith({ name: "__e2e__missing", status: "in_progress" });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(save).not.toHaveBeenCalled();
  });

  it("grants the planet through the concurrency-protected save and returns the result", async () => {
    const gameState = { players: [], planets: [] };
    findOne.mockResolvedValue({ _id: "game-1" } as never);
    const helperResult = { playerId: "p1", homePlanetId: 1, grantedPlanetId: 2, hexDistance: 3 };
    grant.mockReturnValue(helperResult);
    let update: unknown;
    save.mockImplementation((async (_model: unknown, id: string, transform: (doc: unknown) => Promise<unknown>) => {
      expect(id).toBe("game-1");
      update = await transform({ gameState });
      return {};
    }) as never);

    const res = mockResponse();
    await getPostHandler("/grant-planet")({ body: { gameName: "__e2e__ok" } } as Request, res);

    expect(grant).toHaveBeenCalledWith(gameState, { minHexDistance: undefined });
    expect(update).toEqual({ gameState });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, ...helperResult });
  });

  it("passes minHexDistance 3 through to the helper", async () => {
    const gameState = { players: [], planets: [] };
    findOne.mockResolvedValue({ _id: "game-1" } as never);
    const helperResult = { playerId: "p1", homePlanetId: 1, grantedPlanetId: 2, hexDistance: 3 };
    grant.mockReturnValue(helperResult);
    save.mockImplementation((async (_m: unknown, _id: string, transform: (doc: unknown) => Promise<unknown>) =>
      transform({ gameState })) as never);

    const res = mockResponse();
    await getPostHandler("/grant-planet")({ body: { gameName: "__e2e__far", minHexDistance: 3 } } as Request, res);

    expect(grant).toHaveBeenCalledWith(gameState, { minHexDistance: 3 });
    expect(res.json).toHaveBeenCalledWith({ ok: true, ...helperResult });
  });

  it.each([[0], [-1], [1.5], ["3"], [51]])("rejects minHexDistance %s with 400", async (minHexDistance) => {
    const res = mockResponse();
    await getPostHandler("/grant-planet")({ body: { gameName: "__e2e__bad", minHexDistance } } as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("returns 500 when the helper throws", async () => {
    findOne.mockResolvedValue({ _id: "game-1" } as never);
    grant.mockImplementation(() => {
      throw new Error("no unowned planet");
    });
    save.mockImplementation((async (_m: unknown, _id: string, transform: (doc: unknown) => Promise<unknown>) =>
      transform({ gameState: {} })) as never);

    const res = mockResponse();
    await getPostHandler("/grant-planet")({ body: { gameName: "__e2e__err" } } as Request, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Grant planet failed", detail: "no unowned planet" });
  });
});

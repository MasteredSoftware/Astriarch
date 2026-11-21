import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";

import { testRoutes } from "./testRoutes";
import { getTestGalaxySeed, setTestGalaxySeed } from "../utils/testGalaxySeed";

function getPostHandler(path: string) {
  const routeLayer = (testRoutes as any).stack.find(
    (layer: any) => layer.route?.path === path && layer.route?.methods?.post,
  );
  if (!routeLayer) {
    throw new Error(`Test route POST ${path} handler not found`);
  }
  return routeLayer.route.stack[0].handle as (req: Request, res: Response) => void;
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

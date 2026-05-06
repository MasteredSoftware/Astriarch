import type { Request, Response } from "express";

import { healthRoutes } from "./healthRoutes";

function getHealthRouteHandler() {
  const routeLayer = (healthRoutes as any).stack.find(
    (layer: any) => layer.route?.path === "/" && layer.route?.methods?.get,
  );

  if (!routeLayer) {
    throw new Error("Health route GET / handler not found");
  }

  return routeLayer.route.stack[0].handle as (req: Request, res: Response) => void;
}

describe("healthRoutes", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the expected health payload and initializes session state", () => {
    const handler = getHealthRouteHandler();
    const json = jest.fn();

    const req = {
      session: {},
      sessionID: "test-session-id",
    } as unknown as Request;
    const res = {
      json,
    } as unknown as Response;

    handler(req, res);

    expect((req.session as any).created).toEqual(expect.any(String));
    expect(json).toHaveBeenCalledTimes(1);

    const payload = json.mock.calls[0][0];
    expect(payload).toMatchObject({
      status: "OK",
      version: "2.0.0",
    });
    expect(typeof payload.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
    expect(typeof payload.uptime).toBe("number");
  });
});

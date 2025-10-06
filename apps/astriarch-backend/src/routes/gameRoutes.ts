import { Router, Request, Response, type Router as ExpressRouter } from "express";
import { logger } from "../utils/logger";
import * as engine from "astriarch-engine";

const router: ExpressRouter = Router();

// Get available games list
router.get("/", async (req: Request, res: Response) => {
  return res.json({
    engineVersion: engine.getEngineVersion(),
  });
});

export { router as gameRoutes };

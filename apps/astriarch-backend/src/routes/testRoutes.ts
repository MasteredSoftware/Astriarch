/**
 * Test-only routes for the E2E suite and the perf benchmark.
 *
 * These routes are ONLY registered when NODE_ENV=test and should NEVER
 * be reachable in production or staging environments.
 *
 * POST /api/test/cleanup
 *   Removes games and sessions whose name starts with the given prefix
 *   (default "__e2e__") so that E2E test runs start from a clean state.
 *
 * POST /api/test/galaxy-seed  { "seed": <integer> | null }
 *   Sets (or, with null, clears) the galaxy seed used to generate new games,
 *   so the perf benchmark always draws the same map. The seed is process-wide:
 *   it applies to EVERY game started on this backend while it is set, until it
 *   is cleared or the process exits. Only galaxy generation is seeded; gameplay
 *   randomness after that is unaffected.
 */

import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { ServerGameModel } from "../models/Game";
import { logger } from "../utils/logger";
import { setTestGalaxySeed } from "../utils/testGalaxySeed";

const router: Router = Router();

router.post("/cleanup", async (req: Request, res: Response) => {
  const prefix: string = (req.body?.prefix as string) || "__e2e__";

  // Extra safety guard — only allow the e2e prefix pattern.
  if (!prefix.startsWith("__e2e__")) {
    res.status(400).json({ error: "Invalid prefix: must start with '__e2e__'" });
    return;
  }

  try {
    // Remove games whose name starts with the prefix.
    const gameResult = await ServerGameModel.deleteMany({
      name: { $regex: `^${escapeRegex(prefix)}` },
    });

    // Remove all sessions — safe because this route only exists in NODE_ENV=test.
    const db = mongoose.connection.db;
    let sessionCount = 0;
    if (db) {
      try {
        const sessionResult = await db.collection("sessions").deleteMany({});
        sessionCount = sessionResult.deletedCount ?? 0;
      } catch {
        // Sessions collection may not exist yet — not a fatal error.
      }
    }

    logger.info(
      `[test/cleanup] Deleted ${gameResult.deletedCount} game(s) and ${sessionCount} session(s) with prefix "${prefix}"`,
    );

    res.json({
      ok: true,
      gamesDeleted: gameResult.deletedCount,
      sessionsDeleted: sessionCount,
    });
  } catch (error) {
    logger.error("[test/cleanup] Cleanup failed:", error);
    res.status(500).json({ error: "Cleanup failed" });
  }
});

router.post("/galaxy-seed", (req: Request, res: Response) => {
  const seed: unknown = req.body?.seed;
  if (seed !== null && !(typeof seed === "number" && Number.isInteger(seed))) {
    res.status(400).json({ error: "seed must be an integer or null" });
    return;
  }
  setTestGalaxySeed(seed);
  logger.info(`[test/galaxy-seed] Galaxy seed ${seed === null ? "cleared" : `set to ${seed}`}`);
  res.json({ ok: true, seed });
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { router as testRoutes };

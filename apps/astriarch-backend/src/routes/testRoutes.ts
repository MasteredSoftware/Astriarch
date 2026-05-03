/**
 * Test-only cleanup routes.
 *
 * These routes are ONLY registered when NODE_ENV=test and should NEVER
 * be reachable in production or staging environments.
 *
 * POST /api/test/cleanup
 *   Removes games and sessions whose name starts with the given prefix
 *   (default "__e2e__") so that E2E test runs start from a clean state.
 */

import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { ServerGameModel } from "../models/Game";
import { logger } from "../utils/logger";

const router = Router();

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

    // Remove connect-mongo sessions (stored in the 'sessions' collection).
    const db = mongoose.connection.db;
    let sessionCount = 0;
    if (db) {
      try {
        const sessionResult = await db
          .collection("sessions")
          .deleteMany({ "session.e2eTestMarker": prefix });
        sessionCount = sessionResult.deletedCount ?? 0;
      } catch {
        // Sessions collection may not exist yet — not a fatal error.
      }
    }

    logger.info(
      `[test/cleanup] Deleted ${gameResult.deletedCount} game(s) and ${sessionCount} session(s) with prefix "${prefix}"`
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { router as testRoutes };

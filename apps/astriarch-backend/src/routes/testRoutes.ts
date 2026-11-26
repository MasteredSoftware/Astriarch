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
 *
 * POST /api/test/grant-planet  { "gameName": "__e2e__..." }
 *   Gives the human player of the named in-progress game the unowned planet
 *   nearest its home planet, plus one Scout on that planet, by editing the
 *   stored game state directly (no events, no event-checksum update). Responds
 *   with { ok, playerId, homePlanetId, grantedPlanetId, hexDistance }. Connected
 *   clients only see the change after they send SYNC_STATE. Only game names
 *   starting with "__e2e__" are accepted.
 */

import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import type * as engine from "astriarch-engine";
import { ServerGameModel } from "../models/Game";
import { saveGameWithConcurrencyProtection } from "../database/DocumentPersistence";
import { logger } from "../utils/logger";
import { setTestGalaxySeed } from "../utils/testGalaxySeed";
import { grantNearestPlanetWithScout, GrantPlanetResult } from "../utils/testScenarios";

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

router.post("/grant-planet", async (req: Request, res: Response) => {
  const gameName: unknown = req.body?.gameName;
  if (typeof gameName !== "string" || !gameName.startsWith("__e2e__")) {
    res.status(400).json({ error: "Invalid gameName: must start with '__e2e__'" });
    return;
  }

  try {
    const game = await ServerGameModel.findOne({ name: gameName, status: "in_progress" });
    if (!game) {
      res.status(404).json({ error: `In-progress game not found: ${gameName}` });
      return;
    }

    let result: GrantPlanetResult | null = null;
    await saveGameWithConcurrencyProtection(ServerGameModel, String(game._id), async (doc) => {
      result = grantNearestPlanetWithScout(doc.gameState as engine.ModelData);
      return { gameState: doc.gameState };
    });
    if (!result) {
      throw new Error("grant-planet transform did not run");
    }
    const granted: GrantPlanetResult = result;

    logger.info(
      `[test/grant-planet] Game "${gameName}": granted planet ${granted.grantedPlanetId} (+1 Scout) to player ${granted.playerId}, ${granted.hexDistance} hex(es) from home planet ${granted.homePlanetId}`,
    );
    res.json({ ok: true, ...granted });
  } catch (error) {
    logger.error("[test/grant-planet] Grant failed:", error);
    res.status(500).json({ error: "Grant planet failed" });
  }
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { router as testRoutes };

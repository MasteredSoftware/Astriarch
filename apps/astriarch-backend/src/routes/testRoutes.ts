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
 * POST /api/test/grant-planet  { "gameName": "__e2e__...", "minHexDistance"?: <integer 1-50> }
 *   Gives the human player of the named in-progress game the unowned planet
 *   nearest its home planet (with minHexDistance: the nearest one at least that
 *   many hexes away), plus one Scout on that planet, by editing the stored game
 *   state directly (no events, no event-checksum update). Responds with
 *   { ok, playerId, homePlanetId, grantedPlanetId, hexDistance }. Connected
 *   clients only see the change after they send SYNC_STATE. Only game names
 *   starting with "__e2e__" are accepted; an invalid minHexDistance gets a 400.
 *   If no planet qualifies, responds 500 with { error, detail } where detail is
 *   the helper's error message.
 *
 * POST /api/test/setup-fleet-attack  { "gameName": "__e2e__...", "scouts"?, "destroyers"?, "cruisers"?, "battleships"? }
 *   Issue #83 scenario: with the first AI's home planet T, gives the human planets
 *   T+2 (staging, holding a large mixed fleet; default 10/10/15/12 ships, strength 744)
 *   and T-2 (every citizen protesting), and gives the AI planet T+1, by editing the stored
 *   game state directly (no events). Each count must be an integer from 0 to 200 when
 *   given, otherwise 400. Responds with { ok, ...FleetAttackSetupResult }. Connected
 *   clients only see the change after SYNC_STATE. Only "__e2e__" game names are
 *   accepted. If the helper throws, responds 500 with { error, detail }.
 */

import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import type * as engine from "astriarch-engine";
import { ServerGameModel } from "../models/Game";
import { saveGameWithConcurrencyProtection } from "../database/DocumentPersistence";
import { logger } from "../utils/logger";
import { setTestGalaxySeed } from "../utils/testGalaxySeed";
import { grantNearestPlanetWithScout, GrantPlanetResult } from "../utils/testScenarios";
import { setupFleetAttack, FleetAttackCounts, FleetAttackSetupResult } from "../utils/testFleetAttackScenario";

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
  const minHexDistance: unknown = req.body?.minHexDistance;
  if (
    minHexDistance !== undefined &&
    !(
      typeof minHexDistance === "number" &&
      Number.isInteger(minHexDistance) &&
      minHexDistance >= 1 &&
      minHexDistance <= 50
    )
  ) {
    res.status(400).json({ error: "minHexDistance must be an integer from 1 to 50 when given" });
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
      result = grantNearestPlanetWithScout(doc.gameState as engine.ModelData, { minHexDistance });
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
    // Test-only route: include the cause so the e2e failure names it.
    res
      .status(500)
      .json({ error: "Grant planet failed", detail: error instanceof Error ? error.message : String(error) });
  }
});

const FLEET_ATTACK_COUNT_KEYS = ["scouts", "destroyers", "cruisers", "battleships"] as const;

router.post("/setup-fleet-attack", async (req: Request, res: Response) => {
  const gameName: unknown = req.body?.gameName;
  if (typeof gameName !== "string" || !gameName.startsWith("__e2e__")) {
    res.status(400).json({ error: "Invalid gameName: must start with '__e2e__'" });
    return;
  }
  const counts: FleetAttackCounts = {};
  for (const key of FLEET_ATTACK_COUNT_KEYS) {
    const value: unknown = req.body?.[key];
    if (value === undefined) continue;
    if (!(typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 200)) {
      res.status(400).json({ error: `${key} must be an integer from 0 to 200 when given` });
      return;
    }
    counts[key] = value;
  }

  try {
    const game = await ServerGameModel.findOne({ name: gameName, status: "in_progress" });
    if (!game) {
      res.status(404).json({ error: `In-progress game not found: ${gameName}` });
      return;
    }

    let result: FleetAttackSetupResult | null = null;
    await saveGameWithConcurrencyProtection(ServerGameModel, String(game._id), async (doc) => {
      result = setupFleetAttack(doc.gameState as engine.ModelData, counts);
      return { gameState: doc.gameState };
    });
    if (!result) {
      throw new Error("setup-fleet-attack transform did not run");
    }
    const setup: FleetAttackSetupResult = result;

    logger.info(
      `[test/setup-fleet-attack] Game "${gameName}": ${setup.shipIds.length} ships (strength ${setup.fleetStrength}) on planet ${setup.stagingPlanetId}, target ${setup.targetPlanetId}, AI spare ${setup.aiSparePlanetId}, protesting planet ${setup.collisionPlanetId}`,
    );
    res.json({ ok: true, ...setup });
  } catch (error) {
    logger.error("[test/setup-fleet-attack] Setup failed:", error);
    res
      .status(500)
      .json({ error: "Setup fleet attack failed", detail: error instanceof Error ? error.message : String(error) });
  }
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { router as testRoutes };

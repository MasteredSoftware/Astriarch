import { Router, Request, Response, type Router as ExpressRouter } from "express";
import { HighScoreModel } from "../models/HighScore";
import { logger } from "../utils/logger";

const router: ExpressRouter = Router();

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;
const RECENT_DAYS = 7;

interface HighScoreEntry {
  playerName: string;
  playerId: string;
  playerPoints: number;
  playerWon: boolean;
  createdAt: Date;
}

interface HighScoresResponse {
  allTime: HighScoreEntry[];
  recent: HighScoreEntry[];
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const recentCutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

    const selectFields = "playerName playerId playerPoints playerWon createdAt -_id";

    const [allTime, recent] = await Promise.all([
      HighScoreModel.find({})
        .select(selectFields)
        .sort({ playerPoints: -1 })
        .limit(limit)
        .lean<HighScoreEntry[]>(),
      HighScoreModel.find({ createdAt: { $gt: recentCutoff } })
        .select(selectFields)
        .sort({ playerPoints: -1 })
        .limit(limit)
        .lean<HighScoreEntry[]>(),
    ]);

    const response: HighScoresResponse = { allTime, recent };
    res.json(response);
  } catch (error) {
    logger.error("Error fetching high scores:", error);
    res.status(500).json({ error: "Failed to fetch high scores" });
  }
});

export { router as highScoreRoutes };

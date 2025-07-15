import { Router, Request, Response, type Router as ExpressRouter } from 'express';
import { GameController } from '../controllers/GameController';
import { logger } from '../utils/logger';

const router: ExpressRouter = Router();

// Create a new game
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { playerName, gameSettings } = req.body;
    
    if (!playerName) {
      return res.status(400).json({ error: 'Player name is required' });
    }

    const game = await GameController.createGame(playerName, gameSettings);
    return res.json(game);
  } catch (error) {
    logger.error('Error creating game:', error);
    return res.status(500).json({ error: 'Failed to create game' });
  }
});

// Join an existing game
router.post('/join', async (req: Request, res: Response) => {
  try {
    const { gameId, playerName } = req.body;
    
    if (!gameId || !playerName) {
      return res.status(400).json({ error: 'Game ID and player name are required' });
    }

    const result = await GameController.joinGame(gameId, playerName);
    return res.json(result);
  } catch (error) {
    logger.error('Error joining game:', error);
    return res.status(500).json({ error: 'Failed to join game' });
  }
});

// Get game state
router.get('/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const game = await GameController.getGame(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    return res.json(game);
  } catch (error) {
    logger.error('Error getting game:', error);
    return res.status(500).json({ error: 'Failed to get game' });
  }
});

// Enqueue production item
router.post('/:gameId/enqueue-production', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { planetId, productionItem, sessionId } = req.body;
    
    if (!planetId || !productionItem || !sessionId) {
      return res.status(400).json({ 
        error: 'Planet ID, production item, and session ID are required' 
      });
    }

    const result = await GameController.enqueueProductionItem(
      gameId, 
      planetId, 
      productionItem, 
      sessionId
    );
    
    return res.json(result);
  } catch (error) {
    logger.error('Error enqueuing production item:', error);
    return res.status(500).json({ error: 'Failed to enqueue production item' });
  }
});

// Get available games list
router.get('/', async (req: Request, res: Response) => {
  try {
    const games = await GameController.getAvailableGames();
    return res.json(games);
  } catch (error) {
    logger.error('Error getting available games:', error);
    return res.status(500).json({ error: 'Failed to get available games' });
  }
});

export { router as gameRoutes };

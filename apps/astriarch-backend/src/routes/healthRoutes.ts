import { Router, Request, Response, type Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();

interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
}

router.get('/', (req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'OK',
    version: process.env.npm_package_version || '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
  
  res.json(response);
});

export { router as healthRoutes };

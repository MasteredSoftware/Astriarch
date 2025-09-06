import { Router, Request, Response, type Router as ExpressRouter } from "express";

const router: ExpressRouter = Router();

interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
  sessionId?: string;
}

router.get("/", (req: Request, res: Response) => {
  // Force session creation by setting a value
  // This ensures that a session cookie will be created
  if (req.session) {
    (req.session as any).created = new Date().toISOString();
  }
  console.log("Request session id: ", req.sessionID);
  const response: HealthResponse = {
    status: "OK",
    version: process.env.npm_package_version || "2.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    sessionId: req.sessionID, // Include session ID for debugging
  };

  res.json(response);
});

export { router as healthRoutes };

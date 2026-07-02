export type NodeEnv = "development" | "production" | "test";
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
export type WsProtocol = "ws" | "wss";

export interface BackendConfig {
  nodeEnv: NodeEnv;
  loglevel: LogLevel;
  mongodb: {
    connectionString?: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
    gameDbName: string;
    sessionDbName: string;
  };
  cookie: {
    secret: string;
  };
  server: {
    host: string;
    port: number;
  };
  websocket: {
    port: number;
    protocol: WsProtocol;
    pingFrequencyMs: number;
  };
  cors: {
    origin: string[];
    credentials: boolean;
  };
  game: {
    cleanupOldGames: {
      enabled: boolean;
      checkIntervalSeconds: number;
      maxAgeHours: number;
    };
  };
}

const DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"];
const DEFAULT_COOKIE_SECRET = "astriarch-v2-node-secret";

let cachedConfig: BackendConfig | null = null;

function parseInteger(value: string | undefined, key: string, fallback: number): number {
  if (!value || value.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer for ${key}: ${value}`);
  }

  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }

  throw new Error(`Invalid boolean value: ${value}`);
}

function parseCsvList(value: string | undefined, fallback: string[]): string[] {
  if (!value || value.trim() === "") {
    return fallback;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : fallback;
}

function normalizeNodeEnv(value: string | undefined): NodeEnv {
  if (value === "production" || value === "test") {
    return value;
  }
  return "development";
}

function normalizeLogLevel(value: string | undefined): LogLevel {
  const normalized = (value || "").toUpperCase();
  if (normalized === "DEBUG" || normalized === "INFO" || normalized === "WARN" || normalized === "ERROR") {
    return normalized;
  }

  return "INFO";
}

function normalizeWsProtocol(value: string | undefined): WsProtocol {
  const normalized = (value || "").toLowerCase();
  return normalized === "wss" ? "wss" : "ws";
}

function buildBackendConfig(): BackendConfig {
  const nodeEnv = normalizeNodeEnv(process.env.NODE_ENV);
  const defaultDbName = nodeEnv === "development" ? "astriarch_v2_dev" : "astriarch_v2";

  return {
    nodeEnv,
    loglevel: normalizeLogLevel(process.env.LOGLEVEL),
    mongodb: {
      connectionString: process.env.MONGODB_CONNECTION_STRING || undefined,
      host: process.env.MONGODB_HOST || "127.0.0.1",
      port: parseInteger(process.env.MONGODB_PORT, "MONGODB_PORT", 27017),
      username: process.env.MONGODB_USERNAME || undefined,
      password: process.env.MONGODB_PASSWORD || undefined,
      gameDbName: process.env.MONGODB_DATABASE || defaultDbName,
      sessionDbName: process.env.SESSION_DATABASE || defaultDbName,
    },
    cookie: {
      secret: process.env.COOKIE_SECRET || DEFAULT_COOKIE_SECRET,
    },
    server: {
      host: process.env.HOST || "localhost",
      port: parseInteger(process.env.PORT, "PORT", 8001),
    },
    websocket: {
      port: parseInteger(process.env.WS_PORT, "WS_PORT", 8001),
      protocol: normalizeWsProtocol(process.env.WS_PROTOCOL),
      pingFrequencyMs: parseInteger(process.env.WS_PING_FREQUENCY_MS, "WS_PING_FREQUENCY_MS", 30000),
    },
    cors: {
      origin: parseCsvList(process.env.CORS_ORIGIN_LIST, DEFAULT_CORS_ORIGINS),
      credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
    },
    game: {
      cleanupOldGames: {
        enabled: parseBoolean(process.env.GAME_CLEANUP_ENABLED, true),
        checkIntervalSeconds: parseInteger(
          process.env.GAME_CLEANUP_INTERVAL_SECONDS,
          "GAME_CLEANUP_INTERVAL_SECONDS",
          7200,
        ),
        maxAgeHours: parseInteger(process.env.GAME_CLEANUP_MAX_AGE_HOURS, "GAME_CLEANUP_MAX_AGE_HOURS", 24),
      },
    },
  };
}

export function getBackendConfig(): BackendConfig {
  if (!cachedConfig) {
    cachedConfig = buildBackendConfig();
  }
  return cachedConfig;
}

function validateRequiredConfig(config: BackendConfig): void {
  if (config.nodeEnv === "production") {
    if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET.trim() === "") {
      throw new Error("Missing required environment variable in production: COOKIE_SECRET");
    }

    if (
      (!config.mongodb.connectionString || config.mongodb.connectionString.trim() === "") &&
      (!config.mongodb.host || !config.mongodb.gameDbName)
    ) {
      throw new Error(
        "MongoDB configuration is incomplete. Set MONGODB_CONNECTION_STRING or provide MONGODB_HOST and MONGODB_DATABASE",
      );
    }
  }
}

export function validateBackendConfig(): BackendConfig {
  const config = getBackendConfig();
  validateRequiredConfig(config);
  return config;
}

export function resetBackendConfigCacheForTests(): void {
  cachedConfig = null;
}

import { getBackendConfig, resetBackendConfigCacheForTests, validateBackendConfig } from "./environment";

describe("backend environment config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetBackendConfigCacheForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetBackendConfigCacheForTests();
  });

  it("uses expected defaults when optional env vars are missing", () => {
    delete process.env.NODE_ENV;
    delete process.env.LOGLEVEL;
    delete process.env.HOST;
    delete process.env.PORT;
    delete process.env.WS_PORT;
    delete process.env.WS_PROTOCOL;
    delete process.env.WS_PING_FREQUENCY_MS;
    delete process.env.CORS_ORIGIN_LIST;
    delete process.env.CORS_CREDENTIALS;
    delete process.env.GAME_CLEANUP_ENABLED;
    delete process.env.GAME_CLEANUP_INTERVAL_SECONDS;
    delete process.env.GAME_CLEANUP_MAX_AGE_HOURS;
    delete process.env.MONGODB_DATABASE;
    delete process.env.SESSION_DATABASE;
    delete process.env.MONGODB_CONNECTION_STRING;

    const config = getBackendConfig();

    expect(config.nodeEnv).toBe("development");
    expect(config.loglevel).toBe("INFO");
    expect(config.server).toEqual({ host: "localhost", port: 8001 });
    expect(config.websocket).toEqual({
      port: 8001,
      protocol: "ws",
      pingFrequencyMs: 30000,
    });
    expect(config.cors.origin).toEqual(["http://localhost:5173", "http://localhost:3000"]);
    expect(config.cors.credentials).toBe(true);
    expect(config.mongodb.gameDbName).toBe("astriarch_v2_dev");
    expect(config.mongodb.sessionDbName).toBe("astriarch_v2_dev");
    expect(config.game.cleanupOldGames).toEqual({
      enabled: true,
      checkIntervalSeconds: 7200,
      maxAgeHours: 24,
    });
  });

  it("parses and applies env overrides", () => {
    process.env.NODE_ENV = "test";
    process.env.LOGLEVEL = "debug";
    process.env.HOST = "0.0.0.0";
    process.env.PORT = "9001";
    process.env.WS_PORT = "9002";
    process.env.WS_PROTOCOL = "wss";
    process.env.WS_PING_FREQUENCY_MS = "15000";
    process.env.CORS_ORIGIN_LIST = "https://one.example.com, https://two.example.com";
    process.env.CORS_CREDENTIALS = "false";
    process.env.MONGODB_CONNECTION_STRING = "mongodb://mongo:27017/custom";
    process.env.MONGODB_DATABASE = "custom_game";
    process.env.SESSION_DATABASE = "custom_session";
    process.env.GAME_CLEANUP_ENABLED = "0";
    process.env.GAME_CLEANUP_INTERVAL_SECONDS = "120";
    process.env.GAME_CLEANUP_MAX_AGE_HOURS = "48";

    const config = getBackendConfig();

    expect(config.nodeEnv).toBe("test");
    expect(config.loglevel).toBe("DEBUG");
    expect(config.server).toEqual({ host: "0.0.0.0", port: 9001 });
    expect(config.websocket).toEqual({
      port: 9002,
      protocol: "wss",
      pingFrequencyMs: 15000,
    });
    expect(config.cors.origin).toEqual(["https://one.example.com", "https://two.example.com"]);
    expect(config.cors.credentials).toBe(false);
    expect(config.mongodb.connectionString).toBe("mongodb://mongo:27017/custom");
    expect(config.mongodb.gameDbName).toBe("custom_game");
    expect(config.mongodb.sessionDbName).toBe("custom_session");
    expect(config.game.cleanupOldGames).toEqual({
      enabled: false,
      checkIntervalSeconds: 120,
      maxAgeHours: 48,
    });
  });

  it("throws on invalid integer env values", () => {
    process.env.PORT = "not-a-number";

    expect(() => getBackendConfig()).toThrow("Invalid integer for PORT");
  });

  it("fails production validation when COOKIE_SECRET is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.COOKIE_SECRET;

    expect(() => validateBackendConfig()).toThrow("Missing required environment variable in production: COOKIE_SECRET");
  });
});

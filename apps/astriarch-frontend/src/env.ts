import { defineEnvVars } from '@sveltejs/kit/env';

// Optional public variables: each falls back to a default in src/lib/config/environment.ts
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	PUBLIC_BACKEND_HTTP_URL: { public: true, schema: optional },
	PUBLIC_BACKEND_WS_URL: { public: true, schema: optional },
	PUBLIC_NODE_ENV: { public: true, schema: optional },
	PUBLIC_ENABLE_CHECKSUM_VALIDATION: { public: true, schema: optional },
	PUBLIC_LOG_EVENT_CHAIN_DESYNCS: { public: true, schema: optional }
});

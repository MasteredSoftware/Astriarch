import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

// Environment configuration for the frontend application
export interface EnvironmentConfig {
	backend: {
		httpUrl: string;
		wsUrl: string;
	};
	isDev: boolean;
	isProd: boolean;
	enableClientModelChecksumValidation: boolean;
}

// Default configuration values
const DEFAULT_BACKEND_HTTP_URL = 'http://localhost:8001';
const DEFAULT_BACKEND_WS_URL = 'ws://localhost:8001';

/**
 * Get the current environment configuration
 * This reads from environment variables and provides sensible defaults
 */
function createEnvironmentConfig(): EnvironmentConfig {
	// Get backend URLs from environment variables
	const backendHttpUrl = env['PUBLIC_BACKEND_HTTP_URL'] || DEFAULT_BACKEND_HTTP_URL;
	const backendWsUrl = env['PUBLIC_BACKEND_WS_URL'] || DEFAULT_BACKEND_WS_URL;

	// Determine environment
	const isDev = env['PUBLIC_NODE_ENV'] === 'development' || (!env['PUBLIC_NODE_ENV'] && browser);
	const isProd = env['PUBLIC_NODE_ENV'] === 'production';

	// Enable client model checksum validation (disabled by default, can be enabled for debugging)
	const enableClientModelChecksumValidation = env['PUBLIC_ENABLE_CHECKSUM_VALIDATION'] === 'true';

	return {
		backend: {
			httpUrl: backendHttpUrl,
			wsUrl: backendWsUrl
		},
		isDev,
		isProd,
		enableClientModelChecksumValidation
	};
}

// Export the configuration instance
export const config = createEnvironmentConfig();

// Helper functions for common URLs
export function getBackendHttpUrl(): string {
	return config.backend.httpUrl;
}

export function getBackendWsUrl(): string {
	return config.backend.wsUrl;
}

export function getApiUrl(path: string = ''): string {
	const baseUrl = getBackendHttpUrl();
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `${baseUrl}/api${normalizedPath}`;
}

export function getHealthCheckUrl(): string {
	return getApiUrl('/health');
}

// Debug function to log current configuration (only in development)
export function logConfiguration(): void {
	if (config.isDev && browser) {
		console.log('🔧 Environment Configuration:', {
			backend: config.backend,
			environment: config.isDev ? 'development' : config.isProd ? 'production' : 'unknown'
		});
	}
}

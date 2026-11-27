// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface ImportMetaEnv {
		/** 'true' builds the Playwright test hook (src/lib/testing/testHooks.ts) into a non-dev build. */
		readonly VITE_ASTRIARCH_TEST_HOOKS?: string;
	}
}

export {};

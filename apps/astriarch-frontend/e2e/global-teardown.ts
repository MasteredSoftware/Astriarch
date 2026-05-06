import { cleanupTestData } from './helpers/cleanup';

async function globalTeardown(): Promise<void> {
	await cleanupTestData();
}

export default globalTeardown;

import { cleanupTestData } from './helpers/cleanup';

async function globalSetup(): Promise<void> {
	await cleanupTestData();
}

export default globalSetup;

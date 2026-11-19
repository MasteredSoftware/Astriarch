import { describe, it, expect } from 'vitest';
import { getDefaultServerGameOptions, OpponentOptionType, type IGame } from 'astriarch-engine';
import { getMaxPlayers } from './lobby';

describe('getMaxPlayers', () => {
	it('returns 4 for default game options', () => {
		expect(getMaxPlayers({ gameOptions: getDefaultServerGameOptions({}) })).toBe(4);
	});

	it('excludes CLOSED slots in a two-system game', () => {
		const gameOptions = getDefaultServerGameOptions({
			systemsToGenerate: 2,
			opponentOptions: [
				{ name: '', type: OpponentOptionType.OPEN },
				{ name: '', type: OpponentOptionType.CLOSED },
				{ name: '', type: OpponentOptionType.CLOSED }
			]
		});
		expect(getMaxPlayers({ gameOptions })).toBe(2);
	});

	it('falls back to 4 when opponentOptions is missing', () => {
		const gameOptions = {
			...getDefaultServerGameOptions({}),
			opponentOptions: undefined
		} as unknown as IGame['gameOptions'];
		expect(getMaxPlayers({ gameOptions })).toBe(4);
	});

	it('falls back to 4 when gameOptions is missing', () => {
		expect(getMaxPlayers({} as Pick<IGame, 'gameOptions'>)).toBe(4);
	});

	it('counts human and computer slots as seats', () => {
		const gameOptions = getDefaultServerGameOptions({
			opponentOptions: [
				{ name: '', type: OpponentOptionType.HUMAN },
				{ name: '', type: OpponentOptionType.EASY_COMPUTER },
				{ name: '', type: OpponentOptionType.CLOSED }
			]
		});
		expect(getMaxPlayers({ gameOptions })).toBe(3);
	});
});

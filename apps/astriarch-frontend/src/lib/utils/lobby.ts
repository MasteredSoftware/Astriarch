import { OpponentOptionType, type IGame } from 'astriarch-engine';

/** Total seats: host plus every opponent slot that is not CLOSED. Falls back to 4 when options are missing. */
export function getMaxPlayers(game: Pick<IGame, 'gameOptions'>): number {
	const openSlots = game.gameOptions?.opponentOptions?.filter(
		(o) => o.type !== OpponentOptionType.CLOSED
	).length;
	return 1 + (openSlots ?? 3);
}

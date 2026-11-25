import {
	Fleet,
	GameCommandType,
	type ClientModelData,
	type SendShipsCommand
} from 'astriarch-engine';

/**
 * Builds the SEND_SHIPS command for the main player, picking the next unused fleet id.
 *
 * Must not mutate `cgm`: the optimistic SEND_SHIPS command reserves the fleet id on the
 * counter when it is processed, so advancing the counter here would make the client and
 * server fleet ids diverge (issue #75). `commandId` and `clientCycle` are set by sendCommand.
 */
export function buildSendShipsCommand(
	cgm: ClientModelData,
	fromPlanetId: number,
	toPlanetId: number,
	shipIds: SendShipsCommand['shipIds'],
	timestamp: number = Date.now()
): SendShipsCommand {
	const fleetId = Fleet.allocateFleetId(cgm.mainPlayer, cgm.mainPlayerOwnedPlanets);

	return {
		type: GameCommandType.SEND_SHIPS,
		playerId: cgm.mainPlayer.id,
		timestamp,
		fromPlanetId,
		toPlanetId,
		fleetId,
		shipIds: {
			scouts: shipIds.scouts,
			destroyers: shipIds.destroyers,
			cruisers: shipIds.cruisers,
			battleships: shipIds.battleships
		},
		commandId: '' // Will be set by sendCommand
	};
}

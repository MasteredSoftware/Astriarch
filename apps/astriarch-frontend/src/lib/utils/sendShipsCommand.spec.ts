import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	CommandProcessor,
	Fleet,
	GalaxySizeOption,
	GameCommandType,
	GameModel,
	GameSpeed,
	PlanetsPerSystemOption,
	Player,
	PlayerType,
	StarShipType,
	constructClientGameModel,
	playerColors,
	type ClientModelData,
	type Grid,
	type ModelData,
	type PlanetData,
	type PlayerData,
	type SendShipsCommand
} from 'astriarch-engine';
import { buildSendShipsCommand } from './sendShipsCommand';

const PLAYER_ID = 'me';

function scoutsOnly(scoutIds: string[]): SendShipsCommand['shipIds'] {
	return { scouts: scoutIds, destroyers: [], cruisers: [], battleships: [] };
}

describe('buildSendShipsCommand', () => {
	let serverModel: ModelData;
	let grid: Grid;
	let serverPlayer: PlayerData;
	let home: PlanetData;
	let dest: PlanetData;
	let s1: string;
	let s2: string;
	let client: ClientModelData;

	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => {});

		const players = [
			Player.constructPlayer(PLAYER_ID, PlayerType.Human, 'Host', playerColors[0]!),
			Player.constructPlayer('p2', PlayerType.Computer_Hard, 'Computer 1', playerColors[1]!)
		];
		const gameModel = GameModel.constructData(players, {
			systemsToGenerate: 2,
			planetsPerSystem: PlanetsPerSystemOption.FIVE,
			galaxySize: GalaxySizeOption.SMALL,
			distributePlanetsEvenly: true,
			quickStart: false,
			gameSpeed: GameSpeed.NORMAL,
			version: '2.0'
		});
		serverModel = gameModel.modelData;
		grid = gameModel.grid;
		serverPlayer = serverModel.players.find((p) => p.id === PLAYER_ID)!;
		home = serverModel.planets.find((p) => p.id === serverPlayer.homePlanetId)!;
		dest = serverModel.planets.find((p) => p.id !== home.id)!;

		const scouts = [0, 1, 2].map(() => Fleet.generateStarship(StarShipType.Scout, undefined, home));
		home.planetaryFleet.starships.push(...scouts);
		Fleet.recalculateFleetCompositionHash(home.planetaryFleet);
		s1 = scouts[0]!.id;
		s2 = scouts[1]!.id;

		serverPlayer.nextFleetId = 3;
		client = constructClientGameModel(structuredClone(serverModel), PLAYER_ID);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('builds the command without touching the model', () => {
		const before = structuredClone(client);

		const cmd = buildSendShipsCommand(client, home.id, dest.id, scoutsOnly([s1]), 1234);

		expect(client.mainPlayer.nextFleetId).toBe(3);
		expect(client).toEqual(before);
		expect(cmd).toEqual({
			type: GameCommandType.SEND_SHIPS,
			playerId: PLAYER_ID,
			timestamp: 1234,
			fromPlanetId: home.id,
			toPlanetId: dest.id,
			fleetId: 3,
			shipIds: scoutsOnly([s1]),
			commandId: ''
		});
		expect(cmd).not.toHaveProperty('clientCycle');
	});

	it('skips fleet ids already in use, still without mutating the counter', () => {
		client.mainPlayer.fleetsInTransit.push(Fleet.generateFleet([], null, undefined, 3));
		client.mainPlayerOwnedPlanets[home.id]!.outgoingFleets.push(
			Fleet.generateFleet([], null, undefined, 4)
		);

		const cmd = buildSendShipsCommand(client, home.id, dest.id, scoutsOnly([s1]));

		expect(cmd.fleetId).toBe(5);
		expect(client.mainPlayer.nextFleetId).toBe(3);
	});

	it('leaves the client and server counters equal after the optimistic process', () => {
		// Not a regression guard on its own: reserveFleetId takes max(counter, id + 1), so an
		// extra nextFleetId++ in the builder would still end in parity. The non-mutation tests guard that.
		const cmd = buildSendShipsCommand(client, home.id, dest.id, scoutsOnly([s1]), 0);
		cmd.commandId = 'send-1';

		expect(CommandProcessor.processCommand(client, grid, structuredClone(cmd)).success).toBe(true);
		expect(CommandProcessor.processCommand(serverModel, grid, structuredClone(cmd)).success).toBe(
			true
		);

		expect(client.mainPlayer.nextFleetId).toBe(cmd.fleetId + 1);
		expect(client.mainPlayer.nextFleetId).toBe(serverPlayer.nextFleetId);
		expect(client.mainPlayerOwnedPlanets[home.id]!.outgoingFleets.map((f) => f.id)).toContain(
			cmd.fleetId
		);
		expect(home.outgoingFleets.map((f) => f.id)).toContain(cmd.fleetId);
	});

	it('gives two consecutive sends distinct positive fleet ids', () => {
		const cmd1 = buildSendShipsCommand(client, home.id, dest.id, scoutsOnly([s1]), 0);
		cmd1.commandId = 'send-1';
		expect(CommandProcessor.processCommand(client, grid, structuredClone(cmd1)).success).toBe(true);

		const cmd2 = buildSendShipsCommand(client, home.id, dest.id, scoutsOnly([s2]), 0);
		cmd2.commandId = 'send-2';
		expect(CommandProcessor.processCommand(client, grid, structuredClone(cmd2)).success).toBe(true);

		expect(cmd1.fleetId).toBeGreaterThan(0);
		expect(cmd2.fleetId).toBe(cmd1.fleetId + 1);
		expect(cmd2.fleetId).not.toBe(cmd1.fleetId);
		expect(client.mainPlayer.nextFleetId).toBe(cmd2.fleetId + 1);

		expect(CommandProcessor.processCommand(serverModel, grid, structuredClone(cmd1)).success).toBe(
			true
		);
		expect(CommandProcessor.processCommand(serverModel, grid, structuredClone(cmd2)).success).toBe(
			true
		);
		expect(serverPlayer.nextFleetId).toBe(client.mainPlayer.nextFleetId);
	});

	it('uses no fleet id when the command is rejected', () => {
		const cmd = buildSendShipsCommand(client, home.id, dest.id, scoutsOnly([]), 0);
		cmd.commandId = 'send-empty';

		expect(CommandProcessor.processCommand(client, grid, structuredClone(cmd)).success).toBe(false);
		expect(client.mainPlayer.nextFleetId).toBe(3);
		expect(buildSendShipsCommand(client, home.id, dest.id, scoutsOnly([s1])).fleetId).toBe(3);
	});
});

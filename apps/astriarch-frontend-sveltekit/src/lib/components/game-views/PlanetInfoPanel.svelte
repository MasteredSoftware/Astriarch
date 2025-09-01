<script lang="ts">
	import { Text } from '$lib/components/astriarch';
	import { clientGameModel } from '$lib/stores/gameStore';
	import { selectedPlanet } from '$lib/stores/gameStore';
	import type { ClientPlanet } from 'astriarch-engine/src/model/clientModel';
	import type { PlanetData } from 'astriarch-engine/src/model/planet';
	import type { LastKnownFleetData } from 'astriarch-engine/src/model/fleet';
	import { Fleet } from 'astriarch-engine';

	// Reactive values from the store
	$: currentSelectedPlanet = $selectedPlanet;
	$: gameModel = $clientGameModel;

	// Helper function to get planet status
	function getPlanetStatus(planet: PlanetData | ClientPlanet | null) {
		if (!planet || !gameModel) return 'none';
		
		// Check if it's an owned planet (has full PlanetData structure)
		if ('planetaryFleet' in planet) {
			return 'owned';
		}
		
		// Check if we have last known fleet strength (explored but not owned)
		const lastKnownData = gameModel.mainPlayer.lastKnownPlanetFleetStrength[planet.id];
		if (lastKnownData) {
			return 'explored';
		}
		
		// It's a ClientPlanet that we know about but haven't explored
		return 'unexplored';
	}

	// Helper function to get last known fleet data
	function getLastKnownFleetData(planet: PlanetData | ClientPlanet | null): LastKnownFleetData | null {
		if (!planet || !gameModel) return null;
		return gameModel.mainPlayer.lastKnownPlanetFleetStrength[planet.id] || null;
	}

	// Helper function to format fleet strength display
	function formatFleetStrength(fleetData: any): string {
		if (!fleetData) return 'No Fleet';
		
		const fleet = fleetData.fleetData || fleetData;
		const counts = Fleet.countStarshipsByType(fleet);
		
		let parts: string[] = [];
		
		if (counts.defenders > 0) {
			parts.push(`${counts.defenders} Defenders`);
		}
		if (counts.scouts > 0) {
			parts.push(`${counts.scouts} Scouts`);
		}
		if (counts.destroyers > 0) {
			parts.push(`${counts.destroyers} Destroyers`);
		}
		if (counts.cruisers > 0) {
			parts.push(`${counts.cruisers} Cruisers`);
		}
		if (counts.battleships > 0) {
			parts.push(`${counts.battleships} Battleships`);
		}
		if (counts.spaceplatforms > 0) {
			parts.push(`${counts.spaceplatforms} Space Platforms`);
		}
		
		return parts.length > 0 ? parts.join(', ') : 'No Ships';
	}

	// Helper function to get planet type display name
	function getPlanetTypeDisplay(type: number | null): string {
		if (type === null) return 'Unknown';
		
		switch (type) {
			case 0: return 'Asteroid Belt';
			case 1: return 'Dead Planet';
			case 2: return 'Class 1 Planet';
			default: return 'Unknown';
		}
	}

	// Helper function to get turns since exploration
	function getTurnsSinceExploration(lastKnownData: LastKnownFleetData | null): string {
		if (!lastKnownData || !gameModel) return '';
		
		const turnsSince = gameModel.currentCycle - lastKnownData.cycleLastExplored;
		if (turnsSince === 0) return 'Explored this cycle';
		if (turnsSince === 1) return 'Explored last cycle';
		return `Explored ${turnsSince} cycles ago`;
	}

	$: planetStatus = getPlanetStatus(currentSelectedPlanet);
	$: lastKnownData = getLastKnownFleetData(currentSelectedPlanet);
</script>

<!-- Info Panel -->
{#if currentSelectedPlanet}
	<div class="space-y-3 p-4">
		<!-- Planet Name -->
		<div class="border-b border-cyan-500/30 pb-2">
			<Text style="font-size: 18px; color: #00FFFF; font-weight: 600;">
				{currentSelectedPlanet.name}
			</Text>
		</div>

		<!-- Planet Type (if known) -->
		{#if currentSelectedPlanet.type !== null}
			<div>
				<Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">Type</Text>
				<Text style="font-size: 14px; color: #E2E8F0;">
					{getPlanetTypeDisplay(currentSelectedPlanet.type)}
				</Text>
			</div>
		{/if}

		<!-- Owned Planet Details -->
		{#if planetStatus === 'owned' && 'planetaryFleet' in currentSelectedPlanet}
			<div>
				<Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">Status</Text>
				<Text style="font-size: 14px; color: #10B981;">Owned</Text>
			</div>

			<!-- Population -->
			{#if currentSelectedPlanet.population && currentSelectedPlanet.population.length > 0}
				<div>
					<Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">Population</Text>
					<Text style="font-size: 14px; color: #E2E8F0;">
						{currentSelectedPlanet.population.length.toLocaleString()}
					</Text>
				</div>
			{/if}

			<!-- Resources -->
			{#if currentSelectedPlanet.resources}
				<div>
					<Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">Resources</Text>
					<div class="space-y-1">
						<Text style="font-size: 12px; color: #FCD34D;">
							Energy: {currentSelectedPlanet.resources.energy}
						</Text>
						<Text style="font-size: 12px; color: #34D399;">
							Food: {currentSelectedPlanet.resources.food}
						</Text>
						<Text style="font-size: 12px; color: #A78BFA;">
							Ore: {currentSelectedPlanet.resources.ore}
						</Text>
						<Text style="font-size: 12px; color: #F472B6;">
							Iridium: {currentSelectedPlanet.resources.iridium}
						</Text>
					</div>
				</div>
			{/if}

			<!-- Fleet Strength -->
			{#if currentSelectedPlanet.planetaryFleet}
				<div>
					<Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">Fleet</Text>
					<Text style="font-size: 12px; color: #E2E8F0;">
						{formatFleetStrength(currentSelectedPlanet.planetaryFleet)}
					</Text>
				</div>
			{/if}

		<!-- Explored but not owned -->
		{:else if planetStatus === 'explored' && lastKnownData}
			<div>
				<Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">Status</Text>
				<Text style="font-size: 14px; color: #F59E0B;">Explored</Text>
			</div>

			<!-- Last Known Owner -->
			{#if lastKnownData.lastKnownOwnerId && gameModel}
				{@const owner = gameModel.clientPlayers.find(p => p.id === lastKnownData.lastKnownOwnerId)}
				<div>
					<Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">Owner</Text>
					<Text style="font-size: 14px; color: #EF4444;">
						{owner ? owner.name : 'Unknown Player'}
					</Text>
				</div>
			{/if}

			<!-- Exploration Info -->
			<div>
				<Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">Last Explored</Text>
				<Text style="font-size: 12px; color: #64748B;">
					{getTurnsSinceExploration(lastKnownData)}
				</Text>
			</div>

			<!-- Last Known Fleet -->
			<div>
				<Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">Last Known Fleet</Text>
				<Text style="font-size: 12px; color: #E2E8F0;">
					{formatFleetStrength(lastKnownData)}
				</Text>
			</div>

		<!-- Unexplored planet -->
		{:else if planetStatus === 'unexplored'}
			<div>
				<Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">Status</Text>
				<Text style="font-size: 14px; color: #6B7280;">Unexplored</Text>
			</div>

			<div>
				<Text style="font-size: 12px; color: #64748B;">
					Send a scout to explore this planet and discover its resources and defenses.
				</Text>
			</div>
		{/if}
	</div>
{:else}
	<!-- No planet selected -->
	<div class="p-4">
		<Text style="font-size: 14px; color: #64748B; text-align: center;">
			Select a planet to view information
		</Text>
	</div>
{/if}

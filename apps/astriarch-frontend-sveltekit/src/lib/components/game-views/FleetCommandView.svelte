<script lang="ts">
	import {
		clientGameModel,
		selectedPlanet,
		selectedPlanetId,
		gameActions
	} from '$lib/stores/gameStore';
	import { fleetCommandStore } from '$lib/stores/fleetCommandStore';
	import { webSocketService } from '$lib/services/websocket';
	import { multiplayerGameStore } from '$lib/stores/multiplayerGameStore';
	import { StarShipType, type StarshipData } from 'astriarch-engine/src/model/fleet';
	import { Fleet } from 'astriarch-engine/src/engine/fleet';
	import ShipCard from './ShipCard.svelte';

	let selectedShipType: StarShipType | 'all' = 'all'; // ALL SHIPS tab selected by default
	let selectedShipIds = new Set<number>();

	$: planets = $clientGameModel?.mainPlayerOwnedPlanets || {};
	$: planetList = Object.values(planets);
	$: currentSelectedPlanet = $selectedPlanetId ? planets[$selectedPlanetId] : null;

	let hasInitializedDestinationSelection = false;

	// Auto-start destination selection when the view loads and no destination is set
	$: if (
		currentSelectedPlanet &&
		!$fleetCommandStore.isSelectingDestination &&
		!$fleetCommandStore.destinationPlanetId &&
		!hasInitializedDestinationSelection
	) {
		fleetCommandStore.startSelectingDestination(currentSelectedPlanet.id, selectedShipIds);
		hasInitializedDestinationSelection = true;
	}

	// Get ships of the selected type from the selected planet (excluding defenders and space platforms which can't leave)
	$: ships =
		currentSelectedPlanet?.planetaryFleet.starships.filter((ship: StarshipData) => {
			// Exclude System Defense ships and Space Platforms as they can't leave the planet
			if (ship.type === StarShipType.SystemDefense || ship.type === StarShipType.SpacePlatform)
				return false;
			// If "all" is selected, show all mobile ships
			if (selectedShipType === 'all') return true;
			// Otherwise filter by specific type
			return ship.type === selectedShipType;
		}) || [];

	// Ship type tabs configuration (excluding defenders)
	const shipTypeTabs = [
		{ type: 'all' as const, label: 'ALL SHIPS' },
		{ type: StarShipType.Scout, label: 'SCOUT' },
		{ type: StarShipType.Destroyer, label: 'DESTROYER' },
		{ type: StarShipType.Cruiser, label: 'CRUISER' },
		{ type: StarShipType.Battleship, label: 'BATTLESHIP' }
	];

	function toggleShipSelection(shipId: number) {
		if (selectedShipIds.has(shipId)) {
			selectedShipIds.delete(shipId);
		} else {
			selectedShipIds.add(shipId);
		}
		selectedShipIds = new Set(selectedShipIds); // Trigger reactivity
	}

	function selectAllShips() {
		selectedShipIds = new Set(ships.map((ship: StarshipData) => ship.id));
	}

	function sendShips() {
		if (
			!currentSelectedPlanet ||
			selectedShipIds.size === 0 ||
			!$fleetCommandStore.destinationPlanetId
		) {
			console.warn('Cannot send ships: missing planet, ships, or destination');
			return;
		}

		// Send ships immediately since we have everything we need
		actuallyPSendShips($fleetCommandStore.destinationPlanetId);

		// Clear selection but keep destination for potential additional fleets
		selectedShipIds.clear();
		selectedShipIds = new Set();
	}

	function actuallyPSendShips(destinationPlanetId: number) {
		if (!currentSelectedPlanet || selectedShipIds.size === 0) return;

		// Group selected ships by type
		const shipsByType = {
			scouts: [] as number[],
			destroyers: [] as number[],
			cruisers: [] as number[],
			battleships: [] as number[]
		};

		ships.forEach((ship: StarshipData) => {
			if (selectedShipIds.has(ship.id)) {
				switch (ship.type) {
					case StarShipType.Scout:
						shipsByType.scouts.push(ship.id);
						break;
					case StarShipType.Destroyer:
						shipsByType.destroyers.push(ship.id);
						break;
					case StarShipType.Cruiser:
						shipsByType.cruisers.push(ship.id);
						break;
					case StarShipType.Battleship:
						shipsByType.battleships.push(ship.id);
						break;
				}
			}
		});

		// Send ships via WebSocket
		webSocketService.sendShips(currentSelectedPlanet.id, destinationPlanetId, shipsByType);

		console.log(
			'Ships sent from planet',
			currentSelectedPlanet.id,
			'to planet',
			destinationPlanetId,
			shipsByType
		);

		// Clear selection
		selectedShipIds.clear();
		selectedShipIds = new Set();
	}

	function handlePlanetChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const planetId = parseInt(target.value);
		gameActions.selectPlanet(planetId);
	}

	// Get destination planet name if one is selected
	$: destinationPlanet = $fleetCommandStore.destinationPlanetId
		? $clientGameModel?.mainPlayerOwnedPlanets[$fleetCommandStore.destinationPlanetId] ||
			$clientGameModel?.clientPlanets.find((p) => p.id === $fleetCommandStore.destinationPlanetId)
		: null;
</script>

<!-- Fleet Command Interface -->
<div
	class="relative h-full w-full bg-gradient-to-b from-[#1B1F25] to-[#0a0d12] font-['Orbitron'] text-white"
>
	<!-- Header -->
	<div class="flex items-center justify-between p-8">
		<div>
			<h1 class="text-[32px] leading-[40px] font-bold tracking-[0.64px] text-white">
				Send available ships from Planet {currentSelectedPlanet?.name || 'Unknown'}
			</h1>
			<p class="mt-2 text-[14px] leading-[28px] tracking-[0.14px] text-white/75 opacity-80">
				Select one or multiple ships from your fleet to explore or attack the planet
			</p>
		</div>

		<!-- Destination Selection Status -->
		<div class="px-4">
			{#if $fleetCommandStore.destinationPlanetId}
				<!-- Destination Selected -->
				<div class="rounded border border-green-500/40 bg-green-600/20 p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm text-green-200">
								Destination: <strong>{destinationPlanet?.name || 'Unknown Planet'}</strong>
							</p>
							<p class="mt-1 text-xs text-green-300/80">
								Select ships above and click "Send Ships" to launch your fleet
							</p>
						</div>
						<button
							class="rounded bg-gray-600 px-3 py-1 text-sm hover:bg-gray-500"
							onclick={() => {
								if (currentSelectedPlanet) {
									fleetCommandStore.startSelectingDestination(currentSelectedPlanet.id, selectedShipIds);
								}
							}}
						>
							Change Destination
						</button>
					</div>
				</div>
			{:else}
				<!-- No Destination Selected -->
				<div class="rounded border border-cyan-500/40 bg-cyan-600/20 p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-cyan-200">
								Select a destination planet on the galaxy map
							</p>
							<p class="mt-1 text-xs text-cyan-300/80">
								Click on any planet in the galaxy view to set your fleet's destination
							</p>
						</div>
						<div class="text-cyan-400">
							<svg class="h-6 w-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Action Buttons -->
		<div class="flex gap-3">
			<button
				class="h-12 rounded-[4px] bg-gradient-to-b from-[#00FFFF] to-[#00CCCC] px-8 text-[14px] font-extrabold tracking-[2px] text-[#1B1F25] uppercase shadow-[0px_0px_8px_rgba(0,0,0,0.15)] transition-all hover:from-[#00DDDD] hover:to-[#00AAAA] disabled:cursor-not-allowed disabled:opacity-50"
				onclick={sendShips}
				disabled={selectedShipIds.size === 0 || !$fleetCommandStore.destinationPlanetId}
			>
				Send Ships
			</button>
			<button
				class="h-12 rounded-[4px] bg-gradient-to-b from-[#888888] to-[#666666] px-8 text-[14px] font-extrabold tracking-[2px] text-white uppercase shadow-[0px_0px_8px_rgba(0,0,0,0.15)] transition-all hover:from-[#999999] hover:to-[#777777]"
				onclick={selectAllShips}
			>
				Select All
			</button>
		</div>
	</div>

	<!-- Planet Selector -->
	{#if planetList.length > 1}
		<div class="mb-4 px-8">
			<select
				onchange={handlePlanetChange}
				value={$selectedPlanetId}
				class="rounded border border-white/20 bg-[#1B1F25] px-3 py-1 text-sm text-white"
			>
				{#each planetList as planet}
					<option value={planet.id}>{planet.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	<!-- Ship Type Tabs -->
	<div class="relative mb-6 px-8">
		<div class="flex h-[35px] items-end">
			{#each shipTypeTabs as tab}
				<button
					class="relative mr-1 h-[33px] w-[200px] {selectedShipType === tab.type
						? 'border-b-2 border-[#00FFFF] bg-gradient-to-b from-[#313E46] to-[#1B1F25]'
						: 'border-b border-white/20 bg-transparent'}"
					onclick={() => {
						selectedShipType = tab.type;
						selectedShipIds.clear();
						selectedShipIds = new Set();
					}}
				>
					<span
						class="text-[14px] font-extrabold tracking-[2px] uppercase {selectedShipType ===
						tab.type
							? 'text-white'
							: 'text-white/70'}"
					>
						{tab.label}
					</span>
				</button>
			{/each}
		</div>
		<!-- Base line -->
		<div class="absolute right-0 bottom-0 left-0 h-[1px] bg-white/20"></div>
	</div>

	<!-- Ships Grid -->
	<div class="px-8 pb-8">
		{#if ships.length === 0}
			<div class="flex h-32 items-center justify-center text-white/60">
				{#if selectedShipType === 'all'}
					No mobile ships available on this planet
				{:else}
					No {shipTypeTabs.find((t) => t.type === selectedShipType)?.label?.toLowerCase() ||
						'ships'} available on this planet
				{/if}
			</div>
		{:else}
			<div class="overflow-x-auto pb-6">
				<div class="flex min-w-max gap-4">
					{#each ships as ship, index}
						<ShipCard
							{ship}
							isSelected={selectedShipIds.has(ship.id)}
							onToggleSelection={() => toggleShipSelection(ship.id)}
						/>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { clientGameModel, selectedPlanetId, gameActions } from '$lib/stores/gameStore';
	import { fleetCommandStore } from '$lib/stores/fleetCommandStore';
	import { webSocketService } from '$lib/services/websocket';
	import { StarShipType, type StarshipData } from 'astriarch-engine/src/model/fleet';
	import { PlanetSelector, Button } from '$lib/components/astriarch';
	import ShipCard from './ShipCard.svelte';

	let selectedShipType: StarShipType | 'all' = 'all'; // ALL SHIPS tab selected by default

	$: planets = $clientGameModel?.mainPlayerOwnedPlanets || {};
	$: planetList = Object.values(planets);
	$: currentSelectedPlanet = $selectedPlanetId ? planets[$selectedPlanetId] : null;

	// Auto-select first ship and start destination selection when appropriate
	$: if (currentSelectedPlanet && ships.length > 0) {
		const selectedShipIds = Array.from($fleetCommandStore.selectedShipIds);
		const currentShipIds = ships.map((s) => s.id);
		const validSelections = selectedShipIds.filter((id) => currentShipIds.includes(id));

		// Clear invalid selections (ships that no longer exist)
		if (validSelections.length !== selectedShipIds.length) {
			fleetCommandStore.setSelectedShips(validSelections);
		}

		// Auto-select first ship if no valid ships are currently selected
		if (validSelections.length === 0) {
			fleetCommandStore.toggleShipSelection(ships[0].id);
		}

		// Start destination selection if we have ships selected and no destination
		if ($fleetCommandStore.selectedShipIds.size > 0 && !$fleetCommandStore.destinationPlanetId) {
			fleetCommandStore.startSelectingDestination(
				currentSelectedPlanet.id,
				$fleetCommandStore.selectedShipIds
			);
		}
	}

	// Cancel destination selection when no ships are available in current tab
	$: if (currentSelectedPlanet && ships.length === 0 && $fleetCommandStore.isSelectingDestination) {
		fleetCommandStore.cancelDestinationSelection();
		fleetCommandStore.clearSelectedShips();
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
		fleetCommandStore.toggleShipSelection(shipId);
	}

	function selectAllShips() {
		fleetCommandStore.setSelectedShips(ships.map((ship: StarshipData) => ship.id));
		// Start destination selection if we have ships and no destination
		if (
			currentSelectedPlanet &&
			$fleetCommandStore.selectedShipIds.size > 0 &&
			!$fleetCommandStore.destinationPlanetId
		) {
			fleetCommandStore.startSelectingDestination(
				currentSelectedPlanet.id,
				$fleetCommandStore.selectedShipIds
			);
		}
	}

	async function sendShips() {
		if (
			!currentSelectedPlanet ||
			$fleetCommandStore.selectedShipIds.size === 0 ||
			!$fleetCommandStore.destinationPlanetId
		) {
			console.warn('Cannot send ships: missing planet, ships, or destination');
			return;
		}

		const destinationPlanetId = $fleetCommandStore.destinationPlanetId;

		// Group selected ships by type
		const shipsByType = {
			scouts: [] as number[],
			destroyers: [] as number[],
			cruisers: [] as number[],
			battleships: [] as number[]
		};

		ships.forEach((ship: StarshipData) => {
			if ($fleetCommandStore.selectedShipIds.has(ship.id)) {
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

		// Clear destination selection after sending ships
		fleetCommandStore.clearDestination();

		// Clear ship selection
		fleetCommandStore.clearSelectedShips();
	}

	function handlePlanetChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const planetId = parseInt(target.value);
		gameActions.selectPlanet(planetId);
	}

	async function setWaypoint() {
		if (!currentSelectedPlanet || !$fleetCommandStore.destinationPlanetId) {
			console.warn('Cannot set waypoint: no planet or destination selected');
			return;
		}

		console.log(
			'Setting waypoint for planet:',
			currentSelectedPlanet.id,
			'to destination:',
			$fleetCommandStore.destinationPlanetId
		);

		webSocketService.setWaypoint(currentSelectedPlanet.id, $fleetCommandStore.destinationPlanetId);
	}

	async function clearWaypoint() {
		if (!currentSelectedPlanet) {
			console.warn('Cannot clear waypoint: no planet selected');
			return;
		}

		console.log(
			'Clearing waypoint for planet:',
			currentSelectedPlanet.id,
			currentSelectedPlanet.name
		);

		webSocketService.clearWaypoint(currentSelectedPlanet.id);
	}

	// Get destination planet name if one is selected
	$: destinationPlanet = $fleetCommandStore.destinationPlanetId
		? $clientGameModel?.mainPlayerOwnedPlanets[$fleetCommandStore.destinationPlanetId] ||
			$clientGameModel?.clientPlanets.find((p) => p.id === $fleetCommandStore.destinationPlanetId)
		: null;

	// Activate view when component mounts
	onMount(() => {
		fleetCommandStore.activateView();
		// Note: Auto-selection will happen via reactive statement
	});

	// Cleanup when component is destroyed (user switches views)
	onDestroy(() => {
		fleetCommandStore.deactivateView();
		fleetCommandStore.cancelDestinationSelection();
	});
</script>

<!-- Fleet Command Interface -->
<div
	class="relative h-full w-full bg-gradient-to-b from-[#1B1F25] to-[#0a0d12] font-['Orbitron'] text-white"
>
	<!-- Header -->
	<div class="flex items-center justify-between p-8 pb-0">
		<div>
			<h1 class="text-[32px] leading-[40px] font-bold tracking-[0.64px] text-white">
				Send ships from {currentSelectedPlanet?.name || 'Unknown'}
			</h1>
			<p class="mt-2 text-[14px] leading-[28px] tracking-[0.14px] text-white/75 opacity-80">
				Select ships from to explore or attack
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
							<p class="mt-1 text-xs text-green-300/80">Send Ships to launch selected fleet</p>
						</div>
						<button
							class="rounded bg-gray-600 px-3 py-1 text-sm hover:bg-gray-500"
							onclick={() => {
								if (currentSelectedPlanet) {
									fleetCommandStore.startSelectingDestination(
										currentSelectedPlanet.id,
										$fleetCommandStore.selectedShipIds
									);
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
								Click on any planet in the galaxy view to set a destination
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
			<!-- Waypoint Buttons - only show when planet and destination are selected -->
			{#if currentSelectedPlanet?.waypointBoundingHexMidPoint}
				<Button
					label="Clear Waypoint"
					hotkey="c"
					hotkeyContext="fleet-command"
					variant="danger"
					size="md"
					onclick={clearWaypoint}
				/>
			{/if}
			{#if currentSelectedPlanet && $fleetCommandStore.destinationPlanetId}
				<Button
					label="Set Waypoint"
					hotkey="w"
					hotkeyContext="fleet-command"
					variant="warning"
					size="md"
					onclick={setWaypoint}
				/>
			{/if}
			<Button
				label="Select All"
				hotkey="a"
				hotkeyContext="fleet-command"
				variant="secondary"
				size="md"
				onclick={selectAllShips}
			/>
			<Button
				label="Send Ships"
				hotkey="s"
				hotkeyContext="fleet-command"
				size="md"
				onclick={sendShips}
				disabled={$fleetCommandStore.selectedShipIds.size === 0 ||
					!$fleetCommandStore.destinationPlanetId}
			/>
		</div>
	</div>

	<!-- Planet Selector -->
	{#if planetList.length > 1}
		<div class="mb-4 px-8">
			<PlanetSelector
				planets={planetList}
				selectedPlanetId={$selectedPlanetId}
				onSelectPlanet={(planetId) => gameActions.selectPlanet(planetId)}
			/>
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
						fleetCommandStore.clearSelectedShips();
						// The reactive statements will handle auto-selection and destination logic
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
							isSelected={$fleetCommandStore.selectedShipIds.has(ship.id)}
							onToggleSelection={() => toggleShipSelection(ship.id)}
						/>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

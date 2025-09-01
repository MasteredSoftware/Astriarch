<script lang="ts">
	import {
		clientGameModel,
		selectedPlanet,
		selectedPlanetId,
		gameActions
	} from '$lib/stores/gameStore';
	import { fleetCommandStore } from '$lib/stores/fleetCommandStore';
	import { webSocketService, multiplayerGameStore } from '$lib/services/websocket';
	import { StarShipType, type StarshipData } from 'astriarch-engine/src/model/fleet';

	let selectedShipType: StarShipType | 'all' = 'all'; // ALL SHIPS tab selected by default
	let selectedShipIds = new Set<number>();

	$: planets = $clientGameModel?.mainPlayerOwnedPlanets || {};
	$: planetList = Object.values(planets);
	$: currentSelectedPlanet = $selectedPlanet;

	// Get ships of the selected type from the selected planet (excluding defenders which can't leave)
	$: ships =
		currentSelectedPlanet?.planetaryFleet.starships.filter((ship) => {
			// Exclude System Defense ships as they can't leave the planet
			if (ship.type === StarShipType.SystemDefense) return false;
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
		selectedShipIds = new Set(ships.map((ship) => ship.id));
	}

	function getHealthPercentage(ship: StarshipData): number {
		// For now, assuming all ships are at full health
		// In the future, this would be calculated from ship.health / ship.maxHealth
		return 100;
	}

	function getExperiencePercentage(ship: StarshipData): number {
		// Calculate experience percentage based on experienceAmount
		// This is a simplified calculation - in reality it would depend on level thresholds
		return Math.min(ship.experienceAmount * 2, 100);
	}

	function sendShips() {
		if (!currentSelectedPlanet || selectedShipIds.size === 0) {
			console.warn('No ships selected to send');
			return;
		}

		// Check if we have a destination selected
		const fleetState = $fleetCommandStore;
		if (fleetState.destinationPlanetId) {
			// We have a destination, proceed with sending
			actuallyPSendShips(fleetState.destinationPlanetId);
			fleetCommandStore.reset();
		} else {
			// Start destination selection mode
			fleetCommandStore.startSelectingDestination(currentSelectedPlanet.id, selectedShipIds);
		}
	}

	function actuallyPSendShips(destinationPlanetId: number) {
		if (!currentSelectedPlanet || selectedShipIds.size === 0) return;

		// Get game ID from multiplayer store
		let gameId = '';
		const unsubscribe = multiplayerGameStore.subscribe((state) => {
			gameId = state.gameId || '';
		});
		unsubscribe();

		// Check if we're in a multiplayer game
		if (!gameId) {
			console.error('No game ID available');
			return;
		}

		// Group selected ships by type
		const shipsByType = {
			scouts: [] as number[],
			destroyers: [] as number[],
			cruisers: [] as number[],
			battleships: [] as number[]
		};

		ships.forEach((ship) => {
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
		webSocketService.sendShips(gameId, currentSelectedPlanet.id, destinationPlanetId, shipsByType);

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

	function cancelSendShips() {
		fleetCommandStore.cancelDestinationSelection();
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

		<!-- Action Buttons -->
		<div class="flex gap-3">
			<button
				class="h-12 rounded-[4px] bg-gradient-to-b from-[#00FFFF] to-[#00CCCC] px-8 text-[14px] font-extrabold tracking-[2px] text-[#1B1F25] uppercase shadow-[0px_0px_8px_rgba(0,0,0,0.15)] transition-all hover:from-[#00DDDD] hover:to-[#00AAAA] disabled:cursor-not-allowed disabled:opacity-50"
				onclick={sendShips}
				disabled={selectedShipIds.size === 0}
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

	<!-- Destination Selection UI -->
	{#if $fleetCommandStore.isSelectingDestination}
		<div class="mb-4 px-8">
			<div class="rounded border border-yellow-500/40 bg-yellow-600/20 p-3">
				<p class="text-sm text-yellow-200">
					Click on a planet in the galaxy to select destination for your fleet
				</p>
				<button
					class="mt-2 rounded bg-gray-600 px-4 py-1 text-sm hover:bg-gray-500"
					onclick={cancelSendShips}
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<!-- Destination Confirmed UI -->
	{#if $fleetCommandStore.destinationPlanetId && !$fleetCommandStore.isSelectingDestination}
		<div class="mb-4 px-8">
			<div class="rounded border border-green-500/40 bg-green-600/20 p-3">
				<p class="mb-2 text-sm text-green-200">
					Destination: <strong>{destinationPlanet?.name || 'Unknown Planet'}</strong>
				</p>
				<div class="flex gap-2">
					<button
						class="rounded bg-green-600 px-4 py-1 text-sm font-bold hover:bg-green-500"
						onclick={() => actuallyPSendShips($fleetCommandStore.destinationPlanetId!)}
					>
						Confirm Send Ships
					</button>
					<button
						class="rounded bg-gray-600 px-4 py-1 text-sm hover:bg-gray-500"
						onclick={cancelSendShips}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

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
			<div class="grid grid-cols-12 gap-4">
				{#each ships as ship, index}
					<button
						type="button"
						class="relative h-[72px] w-[90px] cursor-pointer transition-all hover:scale-105 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
						onclick={() => toggleShipSelection(ship.id)}
						aria-label="Toggle selection of ship {ship.id}"
						aria-pressed={selectedShipIds.has(ship.id)}
					>
						<!-- Frame with selection border -->
						<div
							class="absolute inset-0 rounded-[4px] border-[3.6px] bg-black/15 {selectedShipIds.has(
								ship.id
							)
								? 'border-[#00FFFF]'
								: 'border-[#313E46]'}"
						></div>

						<!-- Ship Icon -->
						<div
							class="absolute top-[-7.2px] left-[14.4px] flex h-[61.2px] w-[61.2px] items-center justify-center"
						>
							<div class="h-[61.2px] w-[61.2px] scale-y-[-100%] rotate-90">
								<!-- Ship SVG placeholder - in reality this would be the actual ship image -->
								<div class="h-full w-full">
									<svg
										viewBox="0 0 100 100"
										class="h-full w-full {selectedShipIds.has(ship.id)
											? 'fill-[#00FFFF]'
											: 'fill-white'}"
									>
										<!-- Simple ship shape -->
										<polygon points="50,10 80,40 80,60 50,90 20,60 20,40" />
									</svg>
								</div>
							</div>
						</div>

						<!-- Experience Bars -->
						<div class="absolute top-[75%] right-[4%] bottom-[5%] left-[4%]">
							<div
								class="absolute inset-0 rounded-br-[3.6px] rounded-bl-[3.6px] bg-[rgba(27,31,37,0.65)]"
							></div>
							<!-- Experience bars (4 segments) -->
							{#each Array(4) as _, i}
								<div
									class="absolute top-[25%] bottom-[25%] w-[20%] rounded-[1px] bg-[#23BDFF] shadow-[0px_0px_25.2px_0px_rgba(255,255,255,0.24)]"
									style="left: {2.63 + i * 24.35}%; opacity: {getExperiencePercentage(ship) >
									(i + 1) * 25
										? 1
										: 0.3}"
								></div>
							{/each}
						</div>

						<!-- Health Bar -->
						<div
							class="absolute top-[60%] right-[4%] bottom-[20%] left-[4%] flex items-center justify-center"
						>
							<div class="h-[14.4px] w-[82.8px] scale-y-[-100%] rotate-180">
								<div class="relative h-full w-full">
									<div class="absolute inset-0 bg-[rgba(27,31,37,0.65)]"></div>
									<!-- Health bars (4 segments) -->
									{#each Array(4) as _, i}
										<div
											class="absolute top-[25%] bottom-[25%] w-[20%] rounded-[1px] bg-[#00FF38] shadow-[0px_0px_25.2px_0px_rgba(255,255,255,0.24)]"
											style="left: {2.63 + i * 24.35}%; opacity: {getHealthPercentage(ship) >
											(i + 1) * 25
												? 1
												: 0.3}"
										></div>
									{/each}
								</div>
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

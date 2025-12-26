<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { keyboardShortcutService } from '$lib/services/keyboardShortcuts';
	import * as Select from '$lib/components/ui/select';
	import type { PlanetData } from 'astriarch-engine/src/model/planet';
	import type { ClientPlanet } from 'astriarch-engine/src/model/clientModel';

	interface Props {
		planets: (PlanetData | ClientPlanet)[];
		selectedPlanetId: number | null;
		onSelectPlanet: (planetId: number) => void;
		disabled?: boolean;
	}

	let { planets, selectedPlanetId, onSelectPlanet, disabled = false }: Props = $props();

	const CONTEXT = 'planet-selector';

	// Derived values
	let selectedPlanet = $derived(planets.find((p) => p.id === selectedPlanetId));
	let selectedIndex = $derived(planets.findIndex((p) => p.id === selectedPlanetId));
	let canNavigate = $derived(planets.length > 1 && !disabled);

	function selectNext() {
		if (!canNavigate) return;

		const currentIndex = selectedIndex;
		const nextIndex = currentIndex >= planets.length - 1 ? 0 : currentIndex + 1;
		const nextPlanet = planets[nextIndex];

		if (nextPlanet) {
			onSelectPlanet(nextPlanet.id);
		}
	}

	function selectPrevious() {
		if (!canNavigate) return;

		const currentIndex = selectedIndex;
		const prevIndex = currentIndex <= 0 ? planets.length - 1 : currentIndex - 1;
		const prevPlanet = planets[prevIndex];

		if (prevPlanet) {
			onSelectPlanet(prevPlanet.id);
		}
	}

	onMount(() => {
		// Register keyboard shortcuts
		keyboardShortcutService.registerShortcut('n', selectNext, CONTEXT);
		keyboardShortcutService.registerShortcut('b', selectPrevious, CONTEXT);
	});

	onDestroy(() => {
		// Unregister shortcuts when component is destroyed
		keyboardShortcutService.unregisterContext(CONTEXT);
	});
</script>

<div class="flex items-center gap-2">
	<!-- Previous Button (B) -->
	<button
		class="flex h-8 items-center gap-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
		onclick={selectPrevious}
		disabled={!canNavigate}
		title="Previous planet (B)"
	>
		<span class="text-cyan-400">←</span>
		<span class="font-orbitron">B</span>
	</button>

	<!-- Planet Selector Dropdown -->
	<Select.Root
		type="single"
		value={selectedPlanetId?.toString()}
		onValueChange={(value) => {
			if (value) {
				onSelectPlanet(parseInt(value));
			}
		}}
		disabled={disabled || planets.length === 0}
	>
		<Select.Trigger
			class="font-orbitron min-w-[40px] border-slate-600 bg-slate-700 text-xs text-white hover:bg-slate-600"
		>
			{selectedPlanet?.name || 'Select planet'}
		</Select.Trigger>
		<Select.Content class="font-orbitron border-slate-600 bg-slate-800">
			{#each planets as planet}
				<Select.Item
					value={planet.id.toString()}
					class="text-xs text-white hover:bg-slate-700 focus:bg-slate-700"
				>
					{planet.name}
				</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>

	<!-- Next Button (N) -->
	<button
		class="flex h-8 items-center gap-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
		onclick={selectNext}
		disabled={!canNavigate}
		title="Next planet (N)"
	>
		<span class="font-orbitron">N</span>
		<span class="text-cyan-400">→</span>
	</button>
</div>

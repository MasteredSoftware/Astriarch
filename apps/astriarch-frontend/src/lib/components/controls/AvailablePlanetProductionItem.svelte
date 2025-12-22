<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Card } from '$lib/components/astriarch';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { keyboardShortcutService } from '$lib/services/keyboardShortcuts';

	let {
		name,
		description = '',
		cost = {},
		enabled = true,
		onClick = undefined,
		hotkey = undefined,
		hotkeyContext = 'planet-overview'
	}: {
		name: string;
		description?: string;
		cost?: Record<string, number>;
		enabled?: boolean;
		onClick?: (() => void) | undefined;
		hotkey?: string | undefined;
		hotkeyContext?: string;
	} = $props();

	// Resource color mapping based on our design system (removed food)
	const resourceColors: Record<string, string> = {
		energy: 'var(--astriarch-energy)', // Yellow
		ore: 'var(--astriarch-ore)', // Orange
		iridium: 'var(--astriarch-iridium)' // Purple
	};

	// Filter out zero costs and sort for consistent display order
	let displayCosts = $derived(
		Object.entries(cost)
			.filter(([_, amount]) => amount > 0)
			.sort(([a], [b]) => {
				const order = ['energy', 'ore', 'iridium'];
				return order.indexOf(a) - order.indexOf(b);
			})
	);

	function handleClick() {
		if (enabled && onClick) {
			onClick();
		}
	}

	// Generate underlined text for hotkey display
	function getUnderlinedText(text: string, hotkey: string): string {
		const index = text.toLowerCase().indexOf(hotkey.toLowerCase());
		if (index === -1) return text;

		return (
			text.substring(0, index) +
			'<u class="underline decoration-2">' +
			text.substring(index, index + 1) +
			'</u>' +
			text.substring(index + 1)
		);
	}

	let displayName = $derived(hotkey ? getUnderlinedText(name, hotkey) : name);

	// Register hotkey on mount
	onMount(() => {
		if (hotkey && onClick) {
			keyboardShortcutService.registerShortcut(
				hotkey.toLowerCase(),
				(event: KeyboardEvent) => {
					event.preventDefault();
					if (enabled) {
						onClick();
					}
				},
				hotkeyContext
			);
		}
	});

	// Unregister hotkey on destroy
	onDestroy(() => {
		if (hotkey) {
			keyboardShortcutService.unregisterShortcut(hotkey.toLowerCase(), hotkeyContext);
		}
	});
</script>

<!-- Card content that's shared between tooltip and non-tooltip versions -->
{#snippet cardContent()}
	<Card
		class="group relative w-full cursor-pointer text-left transition-all duration-200
           {enabled ? 'hover:bg-astriarch-ui-dark-blue/20' : 'cursor-not-allowed'}"
		size="md"
		{enabled}
		onclick={handleClick}
	>
		<div class="p-3">
			<!-- Item name -->
			<div
				class="text-astriarch-body-14-semibold text-astriarch-ui-white mb-1
                  {enabled ? '' : 'text-astriarch-ui-medium-grey'}"
			>
				{#if hotkey}
					{@html displayName}
				{:else}
					{name}
				{/if}
			</div>

			<!-- Resource costs -->
			{#if displayCosts.length > 0}
				<div class="flex items-center gap-2">
					{#each displayCosts as [resource, amount]}
						<div class="flex items-center gap-1">
							<!-- Colored resource circle -->
							<div
								class="h-2.5 w-2.5 flex-shrink-0 rounded-full
                       {enabled ? '' : 'opacity-50'}"
								style="background-color: {resourceColors[resource] ||
									'var(--astriarch-ui-medium-grey)'}"
							></div>
							<!-- Resource amount -->
							<span
								class="text-astriarch-caption-12-semibold
                           {enabled ? 'text-astriarch-ui-white' : 'text-astriarch-ui-medium-grey'}"
							>
								{amount}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</Card>
{/snippet}

{#if description}
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger class="w-full">
				{@render cardContent()}
			</Tooltip.Trigger>
			<Tooltip.Content>
				<div
					class="bg-astriarch-ui-dark-blue/95 border-astriarch-primary/60 text-astriarch-ui-white text-astriarch-caption-12-medium max-w-xs rounded-md border px-3 py-2 backdrop-blur-sm"
					style="box-shadow: 0 10px 15px -3px rgba(0, 255, 255, 0.2), 0 4px 6px -2px rgba(0, 255, 255, 0.1);"
				>
					{description}
				</div>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{:else}
	{@render cardContent()}
{/if}

<script lang="ts">
	import { currentView } from '$lib/stores/navigationStore';

	// Props
	interface TabItem {
		id: string;
		label: string;
		component: any; // Use any for Svelte component compatibility
		icon?: string;
	}

	interface Props {
		tabs: TabItem[];
	}

	let { tabs }: Props = $props();

	// Active tab management
	let activeTabId = $state($currentView);

	// Subscribe to navigation store changes
	$effect(() => {
		activeTabId = $currentView;
	});

	function handleTabClick(tabId: string) {
		activeTabId = tabId as any; // Cast for compatibility
	}

	// Get active tab component
	const activeTab = $derived(tabs.find((tab) => tab.id === activeTabId) || tabs[0]);
</script>

<div class="flex h-full flex-col">
	<!-- Tab Navigation -->
	<div class="flex-shrink-0 border-b border-cyan-500/30 bg-black/60">
		<div class="flex flex-col">
			{#each tabs as tab}
				<button
					class="group relative px-4 py-3 text-left text-sm font-medium transition-all duration-200 {activeTabId ===
					tab.id
						? 'bg-cyan-500/20 text-cyan-400'
						: 'text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-300'}"
					onclick={() => handleTabClick(tab.id)}
				>
					<!-- Active indicator bar -->
					{#if activeTabId === tab.id}
						<div class="absolute top-0 bottom-0 left-0 w-1 bg-cyan-400"></div>
					{/if}

					<div class="flex items-center space-x-2">
						{#if tab.icon}
							<span class="text-lg">{tab.icon}</span>
						{/if}
						<span>{tab.label}</span>
					</div>

					<!-- Hover effect -->
					<div
						class="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					></div>
				</button>
			{/each}
		</div>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 overflow-x-hidden overflow-y-auto">
		{#if activeTab}
			{@const Component = activeTab.component}
			<div class="h-full">
				<Component />
			</div>
		{/if}
	</div>
</div>

<style>
	/* Custom scrollbar styling for the content area */
	div::-webkit-scrollbar {
		width: 8px;
	}

	div::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.3);
	}

	div::-webkit-scrollbar-thumb {
		background: rgba(6, 182, 212, 0.3);
		border-radius: 4px;
	}

	div::-webkit-scrollbar-thumb:hover {
		background: rgba(6, 182, 212, 0.5);
	}
</style>

<script lang="ts">
	import { Text, Button } from '$lib/components/astriarch';
	import { multiplayerGameStore } from '$lib/stores/multiplayerGameStore';
	import { activityLog, importantActivities, generalActivities, activityStore } from '$lib/stores/activityStore';
	import { onMount } from 'svelte';

	// State for tab selection
	let selectedTab = 'all';
	let chatMessage = '';

	// Filter activities based on selected tab
	$: filteredActivities = (() => {
		switch (selectedTab) {
			case 'important':
				return $importantActivities;
			case 'general':
				return $generalActivities;
			default:
				return $activityLog;
		}
	})();

	// Chat messages (mock data for now)
	let chatMessages = [
		{ id: 1, sender: 'Player1', message: 'Hey what\'s up', timestamp: Date.now() - 60000 },
		{ id: 2, sender: 'Player2', message: 'What\'ssssss uuuuuuuuuuppp!! I just logged in I\'m killing it. How is it going?', timestamp: Date.now() - 30000 },
		{ id: 3, sender: 'System', message: 'Your planet is done!', timestamp: Date.now() - 15000 },
	];

	function setTab(tab: string) {
		selectedTab = tab;
	}

	function sendChatMessage() {
		if (chatMessage.trim()) {
			const newMessage = {
				id: Date.now(),
				sender: 'You',
				message: chatMessage.trim(),
				timestamp: Date.now()
			};
			
			chatMessages = [...chatMessages, newMessage];
			
			// Also add to activity log
			activityStore.addActivity({
				type: 'info',
				message: `Chat: ${chatMessage.trim()}`,
				timestamp: Date.now(),
				category: 'chat'
			});
			
			chatMessage = '';
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			sendChatMessage();
		}
	}

	// Mark activities as read when they're viewed in this tab
	$: if (filteredActivities.length > 0) {
		const unreadIds = filteredActivities.filter(a => !a.read).map(a => a.id);
		if (unreadIds.length > 0) {
			// Mark as read after a short delay to allow user to see them
			setTimeout(() => {
				activityStore.markAsRead(unreadIds);
			}, 1000);
		}
	}

	// Add some sample activities when component mounts for testing
	onMount(() => {
		// Add some test activities if the log is empty
		if ($activityLog.length === 0) {
			activityStore.addActivity({
				type: 'research',
				message: 'Research completed: Advanced Propulsion Systems',
				timestamp: Date.now() - 300000 // 5 minutes ago
			});

			activityStore.addActivity({
				type: 'construction',
				message: 'Construction finished on planet Kepler-442b: Orbital Shipyard',
				timestamp: Date.now() - 180000 // 3 minutes ago
			});

			activityStore.addActivity({
				type: 'battle',
				message: 'Fleet under attack at sector 7-G! Shields at 65%',
				timestamp: Date.now() - 120000 // 2 minutes ago
			});

			activityStore.addActivity({
				type: 'planet',
				message: 'Planet productivity increased: New mining operations online',
				timestamp: Date.now() - 60000 // 1 minute ago
			});

			activityStore.addActivity({
				type: 'fleet',
				message: 'Fleet has arrived at destination: Alpha Centauri system',
				timestamp: Date.now() - 30000 // 30 seconds ago
			});
		}
	});

	function formatTimestamp(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / (1000 * 60));
		if (minutes < 1) return 'now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function getNotificationIcon(type: string): string {
		switch (type) {
			case 'error':
			case 'warning':
				return '⚠';
			case 'battle':
				return '⚔';
			case 'research':
				return '🔬';
			case 'construction':
				return '🏗';
			case 'planet':
				return '🌍';
			case 'fleet':
				return '🚀';
			case 'diplomacy':
				return '🤝';
			default:
				return '●';
		}
	}

	function getNotificationTypeLabel(type: string): string {
		switch (type) {
			case 'research':
				return 'RESEARCH';
			case 'construction':
				return 'CONSTRUCTION';
			case 'battle':
				return 'BATTLE';
			case 'planet':
				return 'PLANET';
			case 'fleet':
				return 'FLEET';
			case 'warning':
				return 'WARNING';
			case 'error':
				return 'ERROR';
			case 'success':
				return 'SUCCESS';
			case 'diplomacy':
				return 'DIPLOMACY';
			default:
				return 'INFO';
		}
	}
</script>

<div class="relative h-full w-full bg-gradient-to-b from-slate-900/50 to-black/90 backdrop-blur-sm">
	<!-- Background blur overlay -->
	<div class="absolute inset-0 bg-gradient-to-b from-white/10 to-slate-800/0 opacity-20"></div>
	
	<!-- Main content container -->
	<div class="relative z-10 flex h-full">
		<!-- Left Panel - Activity Feed -->
		<div class="flex-1 flex flex-col">
			<!-- Header -->
			<div class="p-8 pb-4">
				<h1 class="text-[32px] font-bold text-white tracking-[0.64px] leading-[40px] font-['Orbitron']">
					Activity Center
				</h1>
			</div>

			<!-- Tab Controller -->
			<div class="px-8 mb-4">
				<div class="relative h-[35px] w-full max-w-[903px]">
					<!-- Base line -->
					<div class="absolute bottom-[2.86%] left-[0.33%] right-0 top-[97.14%] bg-gradient-to-r from-cyan-500/30 to-cyan-300/30 h-px"></div>
					
					<!-- Tabs -->
					<div class="absolute h-[33px] left-[3px] top-0 flex space-x-0">
						<!-- All Tab -->
						<button
							class="relative h-[33px] w-[200px] group"
							on:click={() => setTab('all')}
						>
							{#if selectedTab === 'all'}
								<div class="absolute inset-0 bg-gradient-to-b from-cyan-400/20 to-cyan-600/10 border border-cyan-400/40 rounded-sm"></div>
								<span class="absolute inset-[21.21%_24%_18.18%_24.5%] flex items-center justify-center font-['Orbitron'] font-extrabold text-[14px] text-white tracking-[2px] uppercase">
									all
								</span>
							{:else}
								<div class="absolute inset-0 bg-slate-700/30 border border-slate-600/30 rounded-sm opacity-70"></div>
								<span class="absolute inset-[21.21%_28.5%_18.18%_39%] flex items-center justify-center font-['Orbitron'] font-extrabold text-[14px] text-white/70 tracking-[2px] uppercase">
									all
								</span>
							{/if}
						</button>

						<!-- Important Tab -->
						<button
							class="relative h-[33px] w-[200px] group"
							on:click={() => setTab('important')}
						>
							{#if selectedTab === 'important'}
								<div class="absolute inset-0 bg-gradient-to-b from-cyan-400/20 to-cyan-600/10 border border-cyan-400/40 rounded-sm"></div>
								<span class="absolute inset-[21.21%_28.5%_18.18%_39%] flex items-center justify-center font-['Orbitron'] font-extrabold text-[14px] text-white tracking-[2px] uppercase">
									important
								</span>
							{:else}
								<div class="absolute inset-0 bg-slate-700/30 border border-slate-600/30 rounded-sm opacity-70"></div>
								<span class="absolute inset-[21.21%_28.5%_18.18%_39%] flex items-center justify-center font-['Orbitron'] font-extrabold text-[14px] text-white/70 tracking-[2px] uppercase">
									important
								</span>
							{/if}
						</button>

						<!-- General Tab -->
						<button
							class="relative h-[33px] w-[200px] group"
							on:click={() => setTab('general')}
						>
							{#if selectedTab === 'general'}
								<div class="absolute inset-0 bg-gradient-to-b from-cyan-400/20 to-cyan-600/10 border border-cyan-400/40 rounded-sm"></div>
								<span class="absolute inset-[21.21%_28.5%_18.18%_39%] flex items-center justify-center font-['Orbitron'] font-extrabold text-[14px] text-white tracking-[2px] uppercase">
									general
								</span>
							{:else}
								<div class="absolute inset-0 bg-slate-700/30 border border-slate-600/30 rounded-sm opacity-70"></div>
								<span class="absolute inset-[21.21%_28.5%_18.18%_39%] flex items-center justify-center font-['Orbitron'] font-extrabold text-[14px] text-white tracking-[2px] uppercase">
									general
								</span>
							{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Activity Feed -->
			<div class="flex-1 px-8 pb-4 overflow-y-auto">
				<div class="space-y-2 max-h-[268px] overflow-y-auto pr-2">
					{#each filteredActivities as activity (activity.id)}
						<div class="bg-[rgba(27,31,37,0.5)] rounded-[4px] p-4 w-full max-w-[950px]">
							<!-- Header -->
							<div class="flex items-center gap-2 mb-1 text-[12px]">
								<div class="w-2.5 h-2.5 text-cyan-400">
									{getNotificationIcon(activity.type)}
								</div>
								<span class="font-['Orbitron'] font-semibold text-white/75 tracking-[0.5px]">
									{getNotificationTypeLabel(activity.type)}
								</span>
								<span class="font-['Orbitron'] font-normal text-white/50 tracking-[3px] uppercase">
									|
								</span>
								<span class="font-['Orbitron'] font-normal text-white/75 tracking-[0.5px]">
									{formatTimestamp(activity.timestamp)}
								</span>
							</div>
							<!-- Content -->
							<div class="font-['Orbitron'] font-normal text-[14px] text-white tracking-[0.14px] leading-[28px]">
								{activity.message}
							</div>
						</div>
					{:else}
						<div class="bg-[rgba(27,31,37,0.5)] rounded-[4px] p-4 w-full max-w-[950px]">
							<div class="font-['Orbitron'] font-normal text-[14px] text-white/50 tracking-[0.14px] leading-[28px] text-center">
								No {selectedTab === 'all' ? '' : selectedTab + ' '}activities yet
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Scrollbar indicator -->
			<div class="absolute right-4 top-[158px] h-[260px] w-1 bg-gradient-to-b from-cyan-500/40 to-cyan-300/20 rounded-full"></div>
		</div>

		<!-- Right Panel - Chat -->
		<div class="w-[554px] h-full relative">
			<!-- Chat background -->
			<div class="absolute inset-0 bg-gradient-to-b from-white/10 to-slate-800/0 backdrop-blur-[6px] opacity-50"></div>
			
			<!-- Chat content -->
			<div class="relative z-10 h-full flex flex-col p-[18px]">
				<!-- Chat messages -->
				<div class="flex-1 space-y-4 overflow-y-auto mb-4">
					{#each chatMessages as message (message.id)}
						<div class="bg-[rgba(27,31,37,0.5)] rounded-[4px] p-4 max-w-[331px] {message.sender === 'You' ? 'ml-auto bg-slate-700/50' : ''}">
							<!-- Message header -->
							<div class="flex items-center gap-2 mb-1 text-[12px]">
								<span class="font-['Orbitron'] font-semibold text-white/75 tracking-[0.5px]">
									{message.sender}
								</span>
								<span class="font-['Orbitron'] font-normal text-white/50 tracking-[3px] uppercase">
									|
								</span>
								<span class="font-['Orbitron'] font-normal text-white/75 tracking-[0.5px]">
									{formatTimestamp(message.timestamp)}
								</span>
							</div>
							<!-- Message content -->
							<div class="font-['Orbitron'] font-normal text-[14px] text-white tracking-[0.14px] leading-[28px]">
								{message.message}
							</div>
						</div>
					{/each}
				</div>

				<!-- Chat input -->
				<div class="flex gap-2">
					<div class="flex-1 relative">
						<input
							bind:value={chatMessage}
							on:keypress={handleKeyPress}
							placeholder="Type something here..."
							class="w-full h-12 bg-black/40 border border-slate-600/30 rounded-[4px] px-2 py-3 font-['Orbitron'] font-normal text-[14px] text-white tracking-[0.14px] placeholder-white/50 focus:outline-none focus:border-cyan-400/40"
						/>
						<div class="absolute right-2 top-3 text-white font-['Orbitron']">|</div>
					</div>
					<button
						on:click={sendChatMessage}
						class="h-12 w-[87px] bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-[4px] font-['Orbitron'] font-extrabold text-[14px] text-black tracking-[2px] uppercase shadow-[0px_0px_8px_rgba(0,0,0,0.15)] hover:from-cyan-300 hover:to-cyan-500 transition-colors"
					>
						send
					</button>
				</div>

				<!-- Chat scrollbar indicator -->
				<div class="absolute right-2 top-8 h-[285px] w-1 bg-gradient-to-b from-cyan-500/40 to-cyan-300/20 rounded-full"></div>
			</div>
		</div>
	</div>
</div>

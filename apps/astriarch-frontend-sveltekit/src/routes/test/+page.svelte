<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	// Destructure Card components
	const {
		Root: ShadcnCard,
		Header: CardHeader,
		Title: CardTitle,
		Description: CardDescription,
		Content: CardContent,
		Footer: CardFooter
	} = Card;

	// Destructure Dialog components
	const {
		Dialog: ShadcnDialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} = Dialog;

	// Import Astriarch components
	import {
		Button as AstriarchButton,
		Card as AstriarchCard,
		IconImage,
		Text,
		Box,
		TopOverview,
		TopOverviewItem,
		Dialog as AstriarchDialog,
		Notification,
		NavigationController,
		NavigationTab,
		TabController,
		Tab,
		AvailablePlanetProductionItem,
		Dropdown
	} from '$lib/components/astriarch';
	import Logo from '$lib/components/atoms/Logo.svelte';
	import WindowFrame from '$lib/components/atoms/WindowFrame.svelte';
	import type { IconImageType, TabControllerTab } from '$lib/components/astriarch';

	let showDialog = $state(false);
	let showAstriarchDialog = $state(false);

	// Sample data for TopOverview
	const resourceData = {
		total: {
			food: 1250,
			energy: 890,
			research: 340,
			ore: 670,
			iridium: 45,
			production: 125
		},
		perTurn: {
			food: 45,
			energy: -20,
			research: 125,
			ore: 78,
			iridium: 5,
			production: 35
		}
	};

	// Sample navigation items
	const navigationItems = [
		{
			label: 'Fleet',
			content: () => `<div class="p-4 text-white">Fleet management content here</div>`,
			onclick: () => console.log('Fleet clicked')
		},
		{
			label: 'Research',
			content: () => `<div class="p-4 text-white">Research content here</div>`,
			onclick: () => console.log('Research clicked')
		},
		{
			label: 'Planets',
			content: () => `<div class="p-4 text-white">Planets content here</div>`,
			onclick: () => console.log('Planets clicked')
		}
	];

	// Sample tab data
	const tabData: TabControllerTab[] = [
		{
			label: 'Ships'
		},
		{
			label: 'Buildings'
		},
		{
			label: 'Resources'
		}
	];

	// Sample dropdown data
	const shipTypeOptions = [
		{ value: 'scout', label: 'Scout' },
		{ value: 'destroyer', label: 'Destroyer' },
		{ value: 'cruiser', label: 'Cruiser' },
		{ value: 'battleship', label: 'Battleship' },
		{ value: 'disabled', label: 'Disabled Option', disabled: true }
	];

	const researchOptions = [
		{ value: 'propulsion', label: 'Propulsion' },
		{ value: 'weapons', label: 'Weapons' },
		{ value: 'shields', label: 'Shields' },
		{ value: 'mining', label: 'Mining Tech' }
	];

	let selectedShipType = $state('');
	let selectedResearch = $state('propulsion');
</script>

<div class="font-orbitron min-h-screen bg-gradient-to-b from-slate-900 to-black p-8 text-white">
	<div class="mx-auto max-w-6xl">
		<h1 class="font-orbitron mb-8 text-center text-4xl font-bold text-cyan-400">
			Astriarch - Ruler of the Stars
		</h1>

		<!-- Logo Component Demo -->
		<div class="mb-12">
			<h2 class="mb-6 text-center text-2xl font-bold text-cyan-300">🎨 Logo Atom Component</h2>

			<div class="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
				<!-- Text Logo Variations -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-6">
					<h3 class="mb-4 text-lg font-semibold text-cyan-400">Text Logos</h3>
					<div class="space-y-4">
						<div class="flex items-center space-x-4">
							<span class="w-16 text-sm text-cyan-300">Small:</span>
							<Logo size="sm" variant="white" />
						</div>
						<div class="flex items-center space-x-4">
							<span class="w-16 text-sm text-cyan-300">Medium:</span>
							<Logo size="md" variant="white" />
						</div>
						<div class="flex items-center space-x-4">
							<span class="w-16 text-sm text-cyan-300">Large:</span>
							<Logo size="lg" variant="primary" />
						</div>
						<div class="flex items-center space-x-4">
							<span class="w-16 text-sm text-cyan-300">XL:</span>
							<Logo size="xl" variant="primary" />
						</div>
					</div>
				</div>

				<!-- Image Logo Variations -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-6">
					<h3 class="mb-4 text-lg font-semibold text-cyan-400">Image Logos</h3>
					<div class="space-y-4">
						<div class="flex items-center space-x-4">
							<span class="w-16 text-sm text-cyan-300">Small:</span>
							<Logo type="image" size="sm" variant="default" />
						</div>
						<div class="flex items-center space-x-4">
							<span class="w-16 text-sm text-cyan-300">Medium:</span>
							<Logo type="image" size="md" variant="white" />
						</div>
						<div class="flex items-center space-x-4">
							<span class="w-16 text-sm text-cyan-300">Large:</span>
							<Logo type="image" size="lg" variant="primary" />
						</div>
						<div class="flex items-center space-x-4">
							<span class="w-16 text-sm text-cyan-300">XL:</span>
							<Logo type="image" size="xl" variant="white" />
						</div>
					</div>
				</div>
			</div>

			<!-- Usage Examples -->
			<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
				<!-- Header Example -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-6">
					<h3 class="mb-4 text-lg font-semibold text-cyan-400">Header Usage</h3>
					<div class="bg-astriarch-ui-dark-blue flex items-center justify-between rounded p-4">
						<Logo size="md" variant="primary" />
						<div class="text-astriarch-ui-light-grey text-sm">Navigation Menu</div>
					</div>
				</div>

				<!-- Login Card Example -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-6">
					<h3 class="mb-4 text-lg font-semibold text-cyan-400">Login Card Usage</h3>
					<div class="bg-astriarch-glass rounded p-6 text-center">
						<Logo size="lg" variant="white" className="mx-auto mb-4" />
						<p class="text-astriarch-ui-light-grey text-sm">Welcome back to the galaxy</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Window Frame Component Demo -->
		<div class="mb-12">
			<h2 class="mb-6 text-center text-2xl font-bold text-cyan-300">
				🖼️ Window Frame Atom Component
			</h2>

			<div class="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
				<!-- Basic Window Frame -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-6">
					<h3 class="mb-4 text-lg font-semibold text-cyan-400">Basic Window Frame</h3>
					<div class="h-64 w-full">
						<WindowFrame>
							<div
								class="bg-astriarch-glass flex h-full w-full items-center justify-center rounded"
							>
								<p class="text-astriarch-body-16 text-astriarch-ui-white">Window Content Area</p>
							</div>
						</WindowFrame>
					</div>
				</div>

				<!-- Window Frame with Game Content -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-6">
					<h3 class="mb-4 text-lg font-semibold text-cyan-400">SVG Components Mode</h3>
					<div class="h-64 w-full">
						<WindowFrame useFallback={false} strokeColor="var(--astriarch-primary)">
							<div
								class="from-astriarch-ui-dark-blue h-full w-full rounded bg-gradient-to-br to-black p-4"
							>
								<h4 class="text-astriarch-headline-24 text-astriarch-primary mb-2">
									Planet Overview
								</h4>
								<div class="grid grid-cols-2 gap-2 text-sm">
									<div class="text-astriarch-food">Food: 1,250</div>
									<div class="text-astriarch-energy">Energy: 890</div>
									<div class="text-astriarch-ore">Ore: 670</div>
									<div class="text-astriarch-research">Research: 340</div>
								</div>
							</div>
						</WindowFrame>
					</div>
				</div>
			</div>

			<!-- Different Window Frame Variations with Custom Colors -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
				<!-- Orange Theme Frame -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-4">
					<h3 class="text-md mb-3 font-semibold text-cyan-400">Orange Theme</h3>
					<div class="h-32 w-full">
						<WindowFrame
							showLogo={false}
							useFallback={false}
							strokeColor="var(--astriarch-orange-theme)"
						>
							<div
								class="bg-astriarch-bg-glass flex h-full w-full items-center justify-center rounded"
							>
								<p class="text-astriarch-caption-12 text-astriarch-orange-theme">Orange Panel</p>
							</div>
						</WindowFrame>
					</div>
				</div>

				<!-- Green Theme Frame -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-4">
					<h3 class="text-md mb-3 font-semibold text-cyan-400">Green Theme</h3>
					<div class="h-32 w-full">
						<WindowFrame
							version="v2.1"
							useFallback={false}
							strokeColor="var(--astriarch-green-theme)"
						>
							<div
								class="bg-astriarch-bg-glass flex h-full w-full items-center justify-center rounded"
							>
								<p class="text-astriarch-body-14 text-astriarch-green-theme">Green Panel</p>
							</div>
						</WindowFrame>
					</div>
				</div>

				<!-- Purple Theme Frame -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-4">
					<h3 class="text-md mb-3 font-semibold text-cyan-400">Purple Theme</h3>
					<div class="h-32 w-full">
						<WindowFrame useFallback={false} strokeColor="var(--astriarch-purple-theme)">
							<div
								class="bg-astriarch-ui-dark-blue flex h-full w-full items-center justify-center rounded"
							>
								<p class="text-astriarch-body-16-semibold text-astriarch-purple-theme">
									Purple Panel
								</p>
							</div>
						</WindowFrame>
					</div>
				</div>
			</div>

			<!-- Fallback vs SVG Comparison -->
			<div class="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
				<!-- CSS Fallback -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-6">
					<h3 class="mb-4 text-lg font-semibold text-cyan-400">CSS Fallback Mode</h3>
					<div class="h-48 w-full">
						<WindowFrame useFallback={true}>
							<div
								class="bg-astriarch-glass flex h-full w-full items-center justify-center rounded"
							>
								<p class="text-astriarch-body-16 text-astriarch-ui-white">Simple CSS Styling</p>
							</div>
						</WindowFrame>
					</div>
				</div>

				<!-- SVG Components -->
				<div class="bg-astriarch-ui-dark-grey rounded-lg p-6">
					<h3 class="mb-4 text-lg font-semibold text-cyan-400">SVG Components Mode</h3>
					<div class="h-48 w-full">
						<WindowFrame useFallback={false} strokeColor="var(--astriarch-primary)">
							<div
								class="bg-astriarch-glass flex h-full w-full items-center justify-center rounded"
							>
								<p class="text-astriarch-body-16 text-astriarch-primary">
									Pixel-Perfect Figma Design
								</p>
							</div>
						</WindowFrame>
					</div>
				</div>
			</div>
		</div>

		<!-- Astriarch Custom Components Demo -->
		<div class="mb-12">
			<h2 class="mb-6 text-center text-2xl font-bold text-cyan-300">
				🚀 Astriarch Custom SVG Components
			</h2>

			<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
				<!-- Astriarch Button Examples -->
				<div class="flex flex-col items-center space-y-4">
					<h3 class="text-lg font-semibold text-cyan-400">Buttons</h3>
					<AstriarchButton label="Large Primary" size="lg" variant="primary" />
					<AstriarchButton label="Medium Primary" size="md" variant="primary" />
					<AstriarchButton label="Small" size="sm" variant="primary" />
					<AstriarchButton label="Large Outline" size="lg" variant="outline" />
				</div>

				<!-- Astriarch Card Examples -->
				<div class="flex flex-col items-center space-y-4">
					<h3 class="text-lg font-semibold text-cyan-400">Cards</h3>
					<AstriarchCard label="Planet Alpha" size="lg" enabled={true} />
					<AstriarchCard label="Station Beta" size="md" enabled={true} />
					<AstriarchCard label="Disabled" size="lg" enabled={false} />
				</div>

				<!-- Icon Examples -->
				<div class="flex flex-col items-center space-y-4">
					<h3 class="text-lg font-semibold text-cyan-400">Resource Icons</h3>
					<div class="grid grid-cols-2 gap-4">
						<div class="flex flex-col items-center">
							<IconImage type="energy" size={32} />
							<span class="mt-1 text-xs text-cyan-200">Energy</span>
						</div>
						<div class="flex flex-col items-center">
							<IconImage type="population" size={32} />
							<span class="mt-1 text-xs text-cyan-200">Population</span>
						</div>
						<div class="flex flex-col items-center">
							<IconImage type="research" size={32} />
							<span class="mt-1 text-xs text-cyan-200">Research</span>
						</div>
						<div class="flex flex-col items-center">
							<IconImage type="ore" size={32} />
							<span class="mt-1 text-xs text-cyan-200">Ore</span>
						</div>
					</div>
				</div>

				<!-- Mixed Example -->
				<div class="flex flex-col items-center space-y-4">
					<h3 class="text-lg font-semibold text-cyan-400">Game UI Sample</h3>
					<div class="relative">
						<AstriarchCard label="Mining Station" size="lg" enabled={true} />
						<div class="absolute top-12 left-4 flex space-x-2">
							<IconImage type="ore" size={20} />
							<span class="text-xs text-yellow-400">+50/turn</span>
						</div>
					</div>
					<AstriarchButton label="Upgrade" size="md" variant="outline" />
				</div>
			</div>

			<!-- TopOverview Component Demo -->
			<div class="mb-8">
				<h3 class="mb-4 text-center text-lg font-semibold text-cyan-400">TopOverview Component</h3>
				<div class="flex justify-center">
					<TopOverview {resourceData} population={1250000} />
				</div>
			</div>

			<!-- Individual TopOverviewItem Demo -->
			<div class="mb-8">
				<h3 class="mb-4 text-center text-lg font-semibold text-cyan-400">
					Individual TopOverviewItem Components
				</h3>
				<div class="flex flex-wrap justify-center gap-6">
					<TopOverviewItem
						type="food"
						amount={resourceData.total.food}
						amountPerTurn={45}
						onClick={() => console.log('Food clicked')}
					/>
					<TopOverviewItem type="energy" amount={resourceData.total.energy} amountPerTurn={-20} />
					<TopOverviewItem
						type="research"
						amount={resourceData.total.research}
						amountPerTurn={125}
					/>
					<TopOverviewItem type="ore" amount={resourceData.total.ore} amountPerTurn={78} />
					<TopOverviewItem type="iridium" amount={resourceData.total.iridium} amountPerTurn={5} />
				</div>
			</div>

			<!-- Text and Box Components Demo -->
			<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
				<div class="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-6">
					<h3 class="mb-4 text-xl font-bold text-cyan-400">Text Component</h3>
					<div class="space-y-4">
						<Text style="color: #FFF; font-size: 24px; font-weight: bold;">Large Bold Title</Text>
						<Text style="color: #00FFFF; font-size: 18px; font-weight: 600;">
							Cyan Subtitle Text
						</Text>
						<Text style="color: #94A3B8; font-size: 14px; line-height: 1.6;">
							This is regular body text that demonstrates the Text component's ability to render
							styled content with proper spacing and readability.
						</Text>
						<Text
							style="color: #FDE047; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;"
						>
							Small Caps Warning Text
						</Text>
					</div>
				</div>

				<div class="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-6">
					<h3 class="mb-4 text-xl font-bold text-cyan-400">Box Component</h3>
					<div class="space-y-4">
						<Box
							style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 16px; border-radius: 8px; border: 1px solid #00FFFF;"
						>
							<Text style="color: #FFF; font-size: 16px; font-weight: 600;">
								Styled Box Container
							</Text>
							<Text style="color: #94A3B8; font-size: 14px; margin-top: 8px;">
								This Box component can contain any content and be styled with custom CSS.
							</Text>
						</Box>

						<Box
							style="background: #1f2937; padding: 12px; border-radius: 6px; border-left: 4px solid #10b981;"
						>
							<Text style="color: #10b981; font-size: 14px; font-weight: 600;">
								Success Message Box
							</Text>
						</Box>

						<Box
							style="background: #7c2d12; padding: 12px; border-radius: 6px; border-left: 4px solid #ef4444;"
						>
							<Text style="color: #fca5a5; font-size: 14px; font-weight: 600;">
								Warning Message Box
							</Text>
						</Box>
					</div>
				</div>
			</div>

			<!-- Navigation Tab Components Demo -->
			<div class="mb-8">
				<h3 class="mb-4 text-center text-lg font-semibold text-cyan-400">
					Navigation Tab Components
				</h3>
				<div class="flex justify-center space-x-2 rounded-lg bg-black/60 p-4">
					<NavigationTab
						label="Fleet Command"
						selected={true}
						onclick={() => console.log('Fleet Command clicked')}
					/>
					<NavigationTab
						label="Planet Overview"
						selected={false}
						onclick={() => console.log('Planet Overview clicked')}
					/>
					<NavigationTab
						label="Research Lab"
						selected={false}
						onclick={() => console.log('Research Lab clicked')}
					/>
				</div>
			</div>

			<!-- Individual Tab Components Demo -->
			<div class="mb-8">
				<h3 class="mb-4 text-center text-lg font-semibold text-cyan-400">
					Individual Tab Components
				</h3>
				<div class="flex justify-center space-x-4">
					<Tab
						label="Fleet Management"
						selected={true}
						onclick={() => console.log('Fleet tab clicked')}
					/>
					<Tab
						label="Research Lab"
						selected={false}
						onclick={() => console.log('Research tab clicked')}
					/>
					<Tab
						label="Planet Overview"
						selected={false}
						onclick={() => console.log('Planet tab clicked')}
					/>
				</div>
			</div>

			<!-- Dropdown Components Demo -->
			<div class="mb-8">
				<h3 class="mb-4 text-center text-lg font-semibold text-cyan-400">Dropdown Components</h3>
				<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
					<!-- Ship Type Dropdown -->
					<div class="flex flex-col items-center space-y-4">
						<h4 class="text-md font-semibold text-cyan-300">Ship Type</h4>
						<Dropdown
							options={shipTypeOptions}
							value={selectedShipType}
							placeholder="Select Ship"
							variant="secondary"
							onSelect={(value) => {
								selectedShipType = value;
								console.log('Selected ship:', value);
							}}
						/>
						<p class="text-xs text-cyan-200">Selected: {selectedShipType || 'None'}</p>
					</div>

					<!-- Research Dropdown -->
					<div class="flex flex-col items-center space-y-4">
						<h4 class="text-md font-semibold text-cyan-300">Research</h4>
						<Dropdown
							options={researchOptions}
							value={selectedResearch}
							placeholder="Select Research"
							variant="secondary"
							onSelect={(value) => {
								selectedResearch = value;
								console.log('Selected research:', value);
							}}
						/>
						<p class="text-xs text-cyan-200">Selected: {selectedResearch}</p>
					</div>

					<!-- Primary Variant -->
					<div class="flex flex-col items-center space-y-4">
						<h4 class="text-md font-semibold text-cyan-300">Primary Variant</h4>
						<Dropdown
							options={researchOptions}
							value="weapons"
							variant="primary"
							onSelect={(value) => console.log('Primary dropdown:', value)}
						/>
						<Dropdown
							options={shipTypeOptions.slice(0, 3)}
							placeholder="Disabled"
							variant="secondary"
							disabled={true}
							onSelect={(value) => console.log('Disabled dropdown:', value)}
						/>
					</div>
				</div>
			</div>
		</div>

		<h2 class="mb-6 text-center text-2xl font-bold text-cyan-300">
			🎨 shadcn-svelte Components Integration
		</h2>

		<!-- Demo UI Components -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			<!-- Planet Card Example -->
			<ShadcnCard class="border-cyan-500/20 bg-slate-800">
				<CardHeader>
					<CardTitle class="flex items-center justify-between text-cyan-400">
						Planet Xerion
						<Badge variant="outline" class="border-green-500 text-green-400">Inhabited</Badge>
					</CardTitle>
					<CardDescription class="text-slate-300">
						A thriving world in the outer rim
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-2">
						<div class="flex justify-between">
							<span class="text-slate-400">Population:</span>
							<span class="text-yellow-400">12.5M</span>
						</div>
						<div class="flex justify-between">
							<span class="text-slate-400">Production:</span>
							<span class="text-green-400">+450/turn</span>
						</div>
						<div class="flex justify-between">
							<span class="text-slate-400">Energy:</span>
							<span class="text-blue-400">+120/turn</span>
						</div>
					</div>
				</CardContent>
				<CardFooter>
					<Button class="w-full bg-cyan-600 hover:bg-cyan-700">Manage Planet</Button>
				</CardFooter>
			</ShadcnCard>

			<!-- Ship Card Example -->
			<ShadcnCard class="border-cyan-500/20 bg-slate-800">
				<CardHeader>
					<CardTitle class="flex items-center justify-between text-cyan-400">
						Battleship Alpha
						<Badge variant="destructive">Combat Ready</Badge>
					</CardTitle>
					<CardDescription class="text-slate-300">Heavy assault vessel</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-2">
						<div class="flex justify-between">
							<span class="text-slate-400">Attack:</span>
							<span class="text-red-400">85</span>
						</div>
						<div class="flex justify-between">
							<span class="text-slate-400">Defense:</span>
							<span class="text-blue-400">67</span>
						</div>
						<div class="flex justify-between">
							<span class="text-slate-400">Health:</span>
							<span class="text-green-400">100%</span>
						</div>
					</div>
				</CardContent>
				<CardFooter class="gap-2">
					<Button
						variant="outline"
						class="flex-1 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
					>
						Move
					</Button>
					<Button variant="destructive" class="flex-1">Attack</Button>
				</CardFooter>
			</ShadcnCard>

			<!-- Dialog Example -->
			<ShadcnCard class="border-cyan-500/20 bg-slate-800">
				<CardHeader>
					<CardTitle class="text-cyan-400">Game Controls</CardTitle>
					<CardDescription class="text-slate-300">Interact with the galaxy</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					<Button class="w-full bg-green-600 hover:bg-green-700">End Turn</Button>

					<ShadcnDialog>
						<DialogTrigger
							class="w-full rounded bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
						>
							Research Tech
						</DialogTrigger>
						<DialogContent class="border-cyan-500/20 bg-slate-800">
							<DialogHeader>
								<DialogTitle class="text-cyan-400">Research Laboratory</DialogTitle>
								<DialogDescription class="text-slate-300">
									Choose your next technological advancement
								</DialogDescription>
							</DialogHeader>
							<div class="grid gap-4 py-4">
								<div class="grid grid-cols-4 items-center gap-4">
									<Label for="tech" class="text-right text-slate-300">Technology</Label>
									<Input
										id="tech"
										placeholder="Advanced Propulsion"
										class="col-span-3 border-cyan-500/20 bg-slate-700 text-white"
									/>
								</div>
								<div class="grid grid-cols-4 items-center gap-4">
									<Label for="cost" class="text-right text-slate-300">Research Cost</Label>
									<Input
										id="cost"
										placeholder="1,250 RP"
										class="col-span-3 border-cyan-500/20 bg-slate-700 text-white"
									/>
								</div>
							</div>
							<DialogFooter>
								<Button class="bg-cyan-600 hover:bg-cyan-700">Begin Research</Button>
							</DialogFooter>
						</DialogContent>
					</ShadcnDialog>

					<Button
						variant="outline"
						class="w-full border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
					>
						Galaxy Map
					</Button>
				</CardContent>
			</ShadcnCard>
		</div>

		<!-- Status Bar -->
		<div class="mt-8 rounded-lg border border-cyan-500/20 bg-slate-800 p-4">
			<div class="flex flex-wrap justify-center gap-6">
				<div class="flex items-center gap-2">
					<Badge variant="outline" class="border-yellow-500 text-yellow-400">Credits</Badge>
					<span class="font-bold text-yellow-400">15,750</span>
				</div>
				<div class="flex items-center gap-2">
					<Badge variant="outline" class="border-green-500 text-green-400">Energy</Badge>
					<span class="font-bold text-green-400">+450/turn</span>
				</div>
				<div class="flex items-center gap-2">
					<Badge variant="outline" class="border-blue-500 text-blue-400">Research</Badge>
					<span class="font-bold text-blue-400">+125/turn</span>
				</div>
				<div class="flex items-center gap-2">
					<Badge variant="outline" class="border-purple-500 text-purple-400">Turn</Badge>
					<span class="font-bold text-purple-400">42</span>
				</div>
			</div>
		</div>

		<!-- New Astriarch Components Section -->
		<h2 class="mt-12 mb-6 text-center text-2xl font-bold text-cyan-300">
			🚀 New Astriarch Components
		</h2>

		<div class="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
			<!-- Astriarch Dialog Component -->
			<div class="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-6">
				<h3 class="mb-4 text-xl font-bold text-cyan-400">Astriarch Dialog</h3>
				<p class="mb-4 text-slate-300">Custom game-themed dialog with SVG styling.</p>
				<button
					class="rounded bg-cyan-600 px-4 py-2 text-white transition-colors hover:bg-cyan-700"
					onclick={() => {
						showAstriarchDialog = true;
					}}
				>
					Open Astriarch Dialog
				</button>

				{#if showAstriarchDialog}
					<AstriarchDialog
						title="Fleet Command"
						open={showAstriarchDialog}
						onCancel={() => {
							showAstriarchDialog = false;
						}}
					>
						<div class="p-4 text-white">
							<p class="mb-4">Your fleet is ready for deployment, Admiral.</p>
							<div class="space-y-2">
								<div class="flex justify-between">
									<span>Battleships:</span>
									<span class="text-cyan-400">12</span>
								</div>
								<div class="flex justify-between">
									<span>Cruisers:</span>
									<span class="text-cyan-400">25</span>
								</div>
								<div class="flex justify-between">
									<span>Fighters:</span>
									<span class="text-cyan-400">150</span>
								</div>
							</div>
						</div>
					</AstriarchDialog>
				{/if}
			</div>

			<!-- Notification Component -->
			<div class="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-6">
				<h3 class="mb-4 text-xl font-bold text-cyan-400">Notifications</h3>
				<p class="mb-4 text-slate-300">Game notifications with different sizes.</p>
				<div class="space-y-3">
					<Notification label="Research completed: Advanced Propulsion" size="sm" />
					<Notification label="New planet discovered in sector 7" size="md" />
					<Notification label="Warning: Enemy fleet detected approaching!" size="lg" />
				</div>
			</div>

			<!-- Navigation Controller -->
			<div class="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-6">
				<h3 class="mb-4 text-xl font-bold text-cyan-400">Navigation Controller</h3>
				<p class="mb-4 text-slate-300">Game navigation with custom styling.</p>
				<NavigationController items={navigationItems} />
			</div>

			<!-- Tab Controller -->
			<div class="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-6">
				<h3 class="mb-4 text-xl font-bold text-cyan-400">Tab Controller</h3>
				<p class="mb-4 text-slate-300">Tabbed interface for game sections.</p>
				<TabController tabs={tabData} size="md">
					<div class="rounded-b-lg bg-slate-700/50 p-4">
						<div class="text-white">
							<p class="mb-2">Selected tab content:</p>
							<div class="grid grid-cols-3 gap-4 text-center">
								<div class="rounded bg-slate-600 p-3">
									<div class="font-bold text-cyan-400">Ships</div>
									<div class="text-sm">42 vessels</div>
								</div>
								<div class="rounded bg-slate-600 p-3">
									<div class="font-bold text-green-400">Buildings</div>
									<div class="text-sm">15 structures</div>
								</div>
								<div class="rounded bg-slate-600 p-3">
									<div class="font-bold text-yellow-400">Resources</div>
									<div class="text-sm">Abundant</div>
								</div>
							</div>
						</div>
					</div>
				</TabController>
			</div>
		</div>

		<!-- AvailablePlanetProductionItem Test Section -->
		<div class="mt-8">
			<h3 class="text-astriarch-headline-20 text-astriarch-primary mb-4">Production Items</h3>
			<div class="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				<!-- Building examples -->
				<AvailablePlanetProductionItem
					name="Farm"
					description="Increases food production"
					cost={{ energy: 2, ore: 1 }}
					onClick={() => console.log('Farm selected')}
				/>
				<AvailablePlanetProductionItem
					name="Mine"
					description="Increases ore and iridium production"
					cost={{ energy: 6, ore: 4, iridium: 2 }}
					enabled={false}
					onClick={() => console.log('Mine selected')}
				/>
				<AvailablePlanetProductionItem
					name="Factory"
					description="Increases production capacity"
					cost={{ energy: 12, ore: 8, iridium: 4 }}
					onClick={() => console.log('Factory selected')}
				/>

				<!-- Ship examples -->
				<AvailablePlanetProductionItem
					name="Scout"
					description="Fast exploration vessel"
					cost={{ energy: 3, ore: 2, iridium: 1 }}
					onClick={() => console.log('Scout selected')}
				/>
				<AvailablePlanetProductionItem
					name="Destroyer"
					description="Light combat vessel"
					cost={{ energy: 6, ore: 4, iridium: 2 }}
					onClick={() => console.log('Destroyer selected')}
				/>
				<AvailablePlanetProductionItem
					name="Battleship"
					description="Heavy combat vessel"
					cost={{ energy: 24, ore: 16, iridium: 8 }}
					enabled={false}
					onClick={() => console.log('Battleship selected')}
				/>
			</div>
		</div>

		<div class="mt-8 text-center">
			<p class="text-slate-400">
				✨ Built with <strong class="text-cyan-400">SvelteKit</strong> +
				<strong class="text-cyan-400">shadcn-svelte</strong>
			</p>
			<p class="mt-2 text-slate-500">
				No more SVG containment issues! Professional UI components out of the box.
			</p>
		</div>
	</div>
</div>

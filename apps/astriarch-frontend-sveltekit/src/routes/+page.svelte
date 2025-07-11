<script lang="ts">
  import "../app.css";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  // Destructure Card components
  const { Root: ShadcnCard, Header: CardHeader, Title: CardTitle, Description: CardDescription, Content: CardContent, Footer: CardFooter } = Card;
  
  // Destructure Dialog components
  const { Dialog: ShadcnDialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } = Dialog;
  
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
    TabController,
    Tab
  } from "$lib/components/astriarch";
  import type { IconImageType, TabControllerTab } from "$lib/components/astriarch";
  
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
    }
  };
  
  // Sample navigation items
  const navigationItems = [
    { 
      label: "Fleet", 
      content: () => `<div class="p-4 text-white">Fleet management content here</div>`,
      onclick: () => console.log("Fleet clicked")
    },
    { 
      label: "Research", 
      content: () => `<div class="p-4 text-white">Research content here</div>`,
      onclick: () => console.log("Research clicked")
    },
    { 
      label: "Planets", 
      content: () => `<div class="p-4 text-white">Planets content here</div>`,
      onclick: () => console.log("Planets clicked")
    }
  ];
  
  // Sample tab data
  const tabData: TabControllerTab[] = [
    {
      label: "Ships"
    },
    {
      label: "Buildings"
    },
    {
      label: "Resources"
    }
  ];
</script>

<div class="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-8">
  <div class="max-w-6xl mx-auto">
    <h1 class="text-4xl font-bold text-center mb-8 text-cyan-400">
      Astriarch - Ruler of the Stars
    </h1>

    <!-- Astriarch Custom Components Demo -->
    <div class="mb-12">
      <h2 class="text-2xl font-bold text-center mb-6 text-cyan-300">
        🚀 Astriarch Custom SVG Components
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
              <span class="text-xs text-cyan-200 mt-1">Energy</span>
            </div>
            <div class="flex flex-col items-center">
              <IconImage type="population" size={32} />
              <span class="text-xs text-cyan-200 mt-1">Population</span>
            </div>
            <div class="flex flex-col items-center">
              <IconImage type="research" size={32} />
              <span class="text-xs text-cyan-200 mt-1">Research</span>
            </div>
            <div class="flex flex-col items-center">
              <IconImage type="ore" size={32} />
              <span class="text-xs text-cyan-200 mt-1">Ore</span>
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
    </div>

    <h2 class="text-2xl font-bold text-center mb-6 text-cyan-300">
      🎨 shadcn-svelte Components Integration
    </h2>
    
    <!-- Demo UI Components -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      
      <!-- Planet Card Example -->
      <ShadcnCard class="bg-slate-800 border-cyan-500/20">
        <CardHeader>
          <CardTitle class="text-cyan-400 flex items-center justify-between">
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
          <Button class="w-full bg-cyan-600 hover:bg-cyan-700">
            Manage Planet
          </Button>
        </CardFooter>
      </ShadcnCard>

      <!-- Ship Card Example -->
      <ShadcnCard class="bg-slate-800 border-cyan-500/20">
        <CardHeader>
          <CardTitle class="text-cyan-400 flex items-center justify-between">
            Battleship Alpha
            <Badge variant="destructive">Combat Ready</Badge>
          </CardTitle>
          <CardDescription class="text-slate-300">
            Heavy assault vessel
          </CardDescription>
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
          <Button variant="outline" class="flex-1 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10">
            Move
          </Button>
          <Button variant="destructive" class="flex-1">
            Attack
          </Button>
        </CardFooter>
      </ShadcnCard>

      <!-- Dialog Example -->
      <ShadcnCard class="bg-slate-800 border-cyan-500/20">
        <CardHeader>
          <CardTitle class="text-cyan-400">Game Controls</CardTitle>
          <CardDescription class="text-slate-300">
            Interact with the galaxy
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <Button class="w-full bg-green-600 hover:bg-green-700">
            End Turn
          </Button>
          
          <ShadcnDialog>
            <DialogTrigger class="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors">
              Research Tech
            </DialogTrigger>
            <DialogContent class="bg-slate-800 border-cyan-500/20">
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
                    class="col-span-3 bg-slate-700 border-cyan-500/20 text-white"
                  />
                </div>
                <div class="grid grid-cols-4 items-center gap-4">
                  <Label for="cost" class="text-right text-slate-300">Research Cost</Label>
                  <Input
                    id="cost"
                    placeholder="1,250 RP"
                    class="col-span-3 bg-slate-700 border-cyan-500/20 text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button class="bg-cyan-600 hover:bg-cyan-700">
                  Begin Research
                </Button>
              </DialogFooter>
            </DialogContent>
          </ShadcnDialog>

          <Button variant="outline" class="w-full border-cyan-500 text-cyan-400 hover:bg-cyan-500/10">
            Galaxy Map
          </Button>
        </CardContent>
      </ShadcnCard>
    </div>

    <!-- Status Bar -->
    <div class="mt-8 p-4 bg-slate-800 rounded-lg border border-cyan-500/20">
      <div class="flex flex-wrap gap-6 justify-center">
        <div class="flex items-center gap-2">
          <Badge variant="outline" class="border-yellow-500 text-yellow-400">Credits</Badge>
          <span class="text-yellow-400 font-bold">15,750</span>
        </div>
        <div class="flex items-center gap-2">
          <Badge variant="outline" class="border-green-500 text-green-400">Energy</Badge>
          <span class="text-green-400 font-bold">+450/turn</span>
        </div>
        <div class="flex items-center gap-2">
          <Badge variant="outline" class="border-blue-500 text-blue-400">Research</Badge>
          <span class="text-blue-400 font-bold">+125/turn</span>
        </div>
        <div class="flex items-center gap-2">
          <Badge variant="outline" class="border-purple-500 text-purple-400">Turn</Badge>
          <span class="text-purple-400 font-bold">42</span>
        </div>
      </div>
    </div>

    <!-- New Astriarch Components Section -->
    <h2 class="text-2xl font-bold text-center mb-6 text-cyan-300 mt-12">
      🚀 New Astriarch Components
    </h2>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      
      <!-- Astriarch Dialog Component -->
      <div class="bg-slate-800/50 p-6 rounded-lg border border-cyan-500/20">
        <h3 class="text-xl font-bold text-cyan-400 mb-4">Astriarch Dialog</h3>
        <p class="text-slate-300 mb-4">Custom game-themed dialog with SVG styling.</p>
        <button 
          class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
          onclick={() => { showAstriarchDialog = true; }}
        >
          Open Astriarch Dialog
        </button>
        
        {#if showAstriarchDialog}
          <AstriarchDialog 
            title="Fleet Command" 
            open={showAstriarchDialog}
            onCancel={() => { showAstriarchDialog = false; }}
          >
            <div class="text-white p-4">
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
      <div class="bg-slate-800/50 p-6 rounded-lg border border-cyan-500/20">
        <h3 class="text-xl font-bold text-cyan-400 mb-4">Notifications</h3>
        <p class="text-slate-300 mb-4">Game notifications with different sizes.</p>
        <div class="space-y-3">
          <Notification 
            label="Research completed: Advanced Propulsion" 
            size="sm" 
          />
          <Notification 
            label="New planet discovered in sector 7" 
            size="md" 
          />
          <Notification 
            label="Warning: Enemy fleet detected approaching!" 
            size="lg" 
          />
        </div>
      </div>

      <!-- Navigation Controller -->
      <div class="bg-slate-800/50 p-6 rounded-lg border border-cyan-500/20">
        <h3 class="text-xl font-bold text-cyan-400 mb-4">Navigation Controller</h3>
        <p class="text-slate-300 mb-4">Game navigation with custom styling.</p>
        <NavigationController items={navigationItems} />
      </div>

      <!-- Tab Controller -->
      <div class="bg-slate-800/50 p-6 rounded-lg border border-cyan-500/20">
        <h3 class="text-xl font-bold text-cyan-400 mb-4">Tab Controller</h3>
        <p class="text-slate-300 mb-4">Tabbed interface for game sections.</p>
        <TabController 
          tabs={tabData} 
          size="md" 
        >
          <div class="p-4 bg-slate-700/50 rounded-b-lg">
            <div class="text-white">
              <p class="mb-2">Selected tab content:</p>
              <div class="grid grid-cols-3 gap-4 text-center">
                <div class="bg-slate-600 p-3 rounded">
                  <div class="text-cyan-400 font-bold">Ships</div>
                  <div class="text-sm">42 vessels</div>
                </div>
                <div class="bg-slate-600 p-3 rounded">
                  <div class="text-green-400 font-bold">Buildings</div>
                  <div class="text-sm">15 structures</div>
                </div>
                <div class="bg-slate-600 p-3 rounded">
                  <div class="text-yellow-400 font-bold">Resources</div>
                  <div class="text-sm">Abundant</div>
                </div>
              </div>
            </div>
          </div>
        </TabController>
      </div>
      
    </div>

    <div class="mt-8 text-center">
      <p class="text-slate-400">
        ✨ Built with <strong class="text-cyan-400">SvelteKit</strong> + <strong class="text-cyan-400">shadcn-svelte</strong>
      </p>
      <p class="text-slate-500 mt-2">
        No more SVG containment issues! Professional UI components out of the box.
      </p>
    </div>
  </div>
</div>

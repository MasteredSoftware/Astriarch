<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import GameInterface from '$lib/components/game/GameInterface.svelte';
  
  onMount(() => {
    console.log('Astriarch v2 realtime game loaded');
  });
</script>

<svelte:head>
  <title>Astriarch v2 - Realtime Space Empire</title>
  <meta name="description" content="Command your space empire in real-time. Build fleets, manage planets, research technology, and conquer the galaxy." />
</svelte:head>

<!-- Load the main game interface -->
<GameInterface />

<style>
  /* Global game styles */
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #0a0a0a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  :global(*) {
    box-sizing: border-box;
  }
  
  /* CSS Variables for theming */
  :global(:root) {
    --background: #0a0a0a;
    --foreground: #ffffff;
    --muted: #1a1a1a;
    --muted-foreground: #a0a0a0;
    --border: #333333;
    --primary: #0070f3;
    --primary-foreground: #ffffff;
    --primary-rgb: 0, 112, 243;
    --secondary: #24292e;
    --secondary-foreground: #ffffff;
    --success: #28a745;
    --success-foreground: #ffffff;
    --warning: #ffc107;
    --warning-foreground: #000000;
    --destructive: #dc3545;
    --destructive-foreground: #ffffff;
  }
</style>
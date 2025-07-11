<script lang="ts">
  import svelteLogo from './assets/svelte.svg'
  import viteLogo from '/vite.svg'
  import Counter from './lib/Counter.svelte'
  import ComponentsPage from './routes/components.svelte'
  import { currentRoute, navigate, initRouter } from './lib/router'
  
  // Initialize the router when the component is mounted
  import { onMount } from 'svelte';
  
  onMount(() => {
    initRouter();
  });
</script>

{#if $currentRoute === 'home'}
  <main>
    <div>
      <a href="https://vite.dev" target="_blank" rel="noreferrer">
        <img src={viteLogo} class="logo" alt="Vite Logo" />
      </a>
      <a href="https://svelte.dev" target="_blank" rel="noreferrer">
        <img src={svelteLogo} class="logo svelte" alt="Svelte Logo" />
      </a>
    </div>
    <h1>Astriarch - Svelte Migration</h1>

    <div class="card">
      <Counter />
    </div>

    <div class="links">
      <button on:click={() => navigate('components')} class="component-link">
        View Component Test Page
      </button>
    </div>

    <p>
      Check out <a href="https://github.com/sveltejs/kit#readme" target="_blank" rel="noreferrer">SvelteKit</a>, the official Svelte app framework powered by Vite!
    </p>

    <p class="read-the-docs">
      Click on the Vite and Svelte logos to learn more
    </p>
  </main>
{:else if $currentRoute === 'components'}
  <div class="components-wrapper">
    <button on:click={() => navigate('home')} class="home-link">
      ← Back to Home
    </button>
    <ComponentsPage />
  </div>
{/if}

<style>
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
  .read-the-docs {
    color: #888;
  }
  .component-link {
    display: inline-block;
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background-color: #ff3e00;
    color: white;
    border-radius: 4px;
    text-decoration: none;
    font-weight: bold;
    transition: background-color 0.3s;
    border: none;
    cursor: pointer;
  }
  .component-link:hover {
    background-color: #e03600;
  }
  .components-wrapper {
    padding: 1rem;
  }
  .home-link {
    display: inline-block;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    background-color: #333;
    color: white;
    border-radius: 4px;
    text-decoration: none;
    font-weight: bold;
    transition: background-color 0.3s;
    border: none;
    cursor: pointer;
  }
  .home-link:hover {
    background-color: #444;
  }
</style>

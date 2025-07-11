<script lang="ts">
  import type { Size } from '../../component.types';
  
  export let size: Size = 'lg';
  export let enabled: boolean = true;
</script>

<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
  {#if size === 'lg'}
    {#if enabled}
      <svg width="100%" height="100%" viewBox="0 0 130 158" preserveAspectRatio="none">
        <path
          d="M2 2C2 1.4477 2.4477 1 3 1H127C127.552 1 128 1.4477 128 2V118.606C128 118.859 127.904 119.103 127.731 119.288L121 126.5L111.793 135.707C111.605 135.895 111.351 136 111.086 136H3C2.4477 136 2 135.552 2 135V2Z"
          fill="#1B1F25"
          fill-opacity="0.5"
        />
        <path
          d="M121.293 127L121.301 126.991L121.309 126.983L127.54 120.236C127.849 119.905 128 119.464 128 119.106V2C128 1.1716 127.328 0.5 127 0.5H3C2.1716 0.5 1.5 1.1716 1.5 2V135C1.5 135.828 2.1716 136.5 3 136.5H111.086C111.485 136.5 111.866 136.342 112.147 136.06L121.293 127Z"
          stroke="#00FFFF"
          stroke-opacity="0.75"
          stroke-width="1"
        />
      </svg>
    {:else}
      <svg width="100%" height="100%" viewBox="0 0 130 158" preserveAspectRatio="none">
        <path
          d="M2 2C2 1.4477 2.4477 1 3 1H127C127.552 1 128 1.4477 128 2V118.606C128 118.859 127.904 119.103 127.731 119.288L121 126.5L111.793 135.707C111.605 135.895 111.351 136 111.086 136H3C2.4477 136 2 135.552 2 135V2Z"
          fill="#1B1F25"
          fill-opacity="0.3"
        />
      </svg>
    {/if}
  {:else}
    {#if enabled}
      <svg width="100%" height="100%" viewBox="0 0 136 96" preserveAspectRatio="none">
        <path
          d="M2 2C2 1.4477 2.4477 1 3 1H133C133.552 1 134 1.4477 134 2V58.606C134 58.859 133.904 59.103 133.731 59.288L128 64.5L118.793 73.707C118.605 73.895 118.351 74 118.086 74H3C2.4477 74 2 73.552 2 73V2Z"
          fill="#1B1F25"
          fill-opacity="0.5"
        />
        <path
          d="M128.293 65L128.301 64.991L128.309 64.983L133.54 59.236C133.849 58.905 134 58.464 134 58.106V2C134 1.1716 133.328 0.5 133 0.5H3C2.1716 0.5 1.5 1.1716 1.5 2V73C1.5 73.828 2.1716 74.5 3 74.5H118.086C118.485 74.5 118.866 74.342 119.147 74.06L128.293 65Z"
          stroke="#00FFFF"
          stroke-opacity="0.75"
          stroke-width="1"
        />
      </svg>
    {:else}
      <svg width="100%" height="100%" viewBox="0 0 136 96" preserveAspectRatio="none">
        <path
          d="M2 2C2 1.4477 2.4477 1 3 1H133C133.552 1 134 1.4477 134 2V58.606C134 58.859 133.904 59.103 133.731 59.288L128 64.5L118.793 73.707C118.605 73.895 118.351 74 118.086 74H3C2.4477 74 2 73.552 2 73V2Z"
          fill="#1B1F25"
          fill-opacity="0.3"
        />
      </svg>
    {/if}
  {/if}
</div>

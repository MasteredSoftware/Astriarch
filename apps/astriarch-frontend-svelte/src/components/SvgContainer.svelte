<script lang="ts">
  export let width: string = '100%';
  export let height: string = '100%';
  export let className: string = '';
</script>

<div 
  class="svg-container {className}"
  style="
    width: {width}; 
    height: {height}; 
    position: relative;
    overflow: hidden;
    display: inline-block;
  "
>
  <slot />
</div>

<style>
  .svg-container :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  
  .svg-container :global(*) {
    pointer-events: none;
  }
</style>

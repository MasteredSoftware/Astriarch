<script lang="ts">
  import type { Size } from '../component.types';
  import CardSvg from './svg/CardSvg.svelte';
  
  export let label: string;
  export let size: Size = 'lg';
  export let enabled: boolean = true;
  export let onClick: () => void = () => {};
  
  const cardWidth = size === 'lg' ? '128px' : '134px';
  const cardHeight = size === 'lg' ? '156px' : '94px';
  
  function handleKeyDown(event: KeyboardEvent) {
    if (enabled && (event.key === 'Enter' || event.key === ' ')) {
      onClick();
    }
  }
</script>

<div 
  role="button"
  tabindex={enabled ? 0 : -1}
  on:click={enabled ? onClick : null}
  on:keydown={handleKeyDown}
  style="
    width: {cardWidth}; 
    height: {cardHeight}; 
    background-color: transparent;
    position: relative;
    cursor: {enabled ? 'pointer' : 'default'};
    display: inline-flex;
    flex-direction: column;
    overflow: hidden;
  "
>
  <span
    style="
      position: absolute;
      top: 20px; 
      left: 16px; 
      z-index: 100; 
      color: #FFF;
      font-size: 14px;
      font-weight: 400;
      line-height: 28px;
      letter-spacing: 0.14px;
      display: block;
      pointer-events: none;
      max-width: calc(100% - 32px);
      word-wrap: break-word;
    "
  >
    {label}
  </span>
  <CardSvg {size} {enabled} />
  <slot></slot>
</div>

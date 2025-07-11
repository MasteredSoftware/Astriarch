<script lang="ts">
  import type { Size } from '../component.types';
  import ButtonSvg from './svg/ButtonSvg.svelte';
  
  export let label: string;
  export let size: Size = 'lg';
  export let variant: 'primary' | 'outline' = 'primary';
  export let onClick: () => void = () => {};
  export let disabled: boolean = false;
  
  const widthBySize = {
    lg: '207px',
    md: '157px',
    sm: '87px',
    xs: '87px',
  };
  
  $: buttonWidth = widthBySize[size];
  $: textColor = variant === 'outline' ? '#0FF' : '#1B1F25';
  
  function handleKeyDown(event: KeyboardEvent) {
    if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
      onClick();
      event.preventDefault();
    }
  }
</script>

<button 
  type="button"
  {disabled}
  on:click={!disabled ? onClick : null}
  on:keydown={handleKeyDown}
  style="
    width: {buttonWidth}; 
    height: 48px; 
    background-color: transparent; 
    border-radius: 0;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: {disabled ? 'not-allowed' : 'pointer'};
    border: none;
    outline: none;
    opacity: {disabled ? '0.6' : '1'};
    padding: 0;
  "
  class="button"
>
  <ButtonSvg {size} {variant} />
  <span 
    style="
      z-index: 100; 
      position: relative;
      color: {textColor};
      font-size: 14px;
      font-weight: 800;
      line-height: 20px;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-align: center;
    "
  >
    {label}
  </span>
  <slot></slot>
</button>

<style>
  .button:hover:not([disabled]) {
    opacity: 0.9;
  }
  
  .button:active:not([disabled]) {
    opacity: 1.0;
  }
  
  .button:focus-visible {
    outline: 2px solid #0FF;
    outline-offset: 2px;
  }
</style>

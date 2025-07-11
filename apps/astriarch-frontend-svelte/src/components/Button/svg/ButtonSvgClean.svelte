<script lang="ts">
  export let size: 'lg' | 'md' | 'sm' | 'xs' = 'lg';
  export let variant: 'primary' | 'outline' = 'primary';
  
  // Consistent dimensions for each size
  const dimensions = {
    lg: { width: 200, height: 48 },
    md: { width: 160, height: 40 },
    sm: { width: 120, height: 32 },
    xs: { width: 80, height: 24 }
  };
  
  const { width, height } = dimensions[size];
  
  // Calculate corner cut size based on height
  const cornerCut = height * 0.3;
</script>

<div class="button-svg" style="width: 100%; height: 100%; position: relative;">
  <svg 
    width="100%" 
    height="100%" 
    viewBox="0 0 {width} {height}" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- Background/Fill -->
    <path
      d="M4 4 L{width - cornerCut} 4 L{width - 4} {cornerCut} L{width - 4} {height - 4} L4 {height - 4} Z"
      fill={variant === 'primary' ? '#00FFFF' : 'transparent'}
      stroke="#00FFFF"
      stroke-width="2"
      stroke-opacity="0.75"
    />
    
    <!-- Optional gradient overlay for primary -->
    {#if variant === 'primary'}
      <defs>
        <linearGradient id="buttonGradient_{size}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:white;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:white;stop-opacity:0" />
        </linearGradient>
      </defs>
      <path
        d="M4 4 L{width - cornerCut} 4 L{width - 4} {cornerCut} L{width - 4} {height - 4} L4 {height - 4} Z"
        fill="url(#buttonGradient_{size})"
      />
    {/if}
  </svg>
</div>

<style>
  .button-svg {
    overflow: hidden;
  }
</style>

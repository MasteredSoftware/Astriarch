<script lang="ts">
  import Logo from '../atoms/Logo.svelte';
</script>

<div class="p-8 bg-astriarch-ui-dark-blue min-h-screen">
  <div class="space-y-8">
    <h1 class="text-astriarch-headline-32 text-astriarch-ui-white mb-8">Logo Variations</h1>
    
    <!-- Text Logo Variations -->
    <section class="space-y-4">
      <h2 class="text-astriarch-headline-24 text-astriarch-ui-light-grey">Text Logos</h2>
      <div class="grid grid-cols-2 gap-8">
        <!-- Sizes -->
        <div class="space-y-4">
          <h3 class="text-astriarch-body-16-semibold text-astriarch-ui-white">Different Sizes</h3>
          <div class="space-y-3 bg-astriarch-ui-dark-grey p-4 rounded">
            <Logo size="sm" variant="white" />
            <Logo size="md" variant="white" />
            <Logo size="lg" variant="white" />
            <Logo size="xl" variant="white" />
          </div>
        </div>
        
        <!-- Variants -->
        <div class="space-y-4">
          <h3 class="text-astriarch-body-16-semibold text-astriarch-ui-white">Different Variants</h3>
          <div class="space-y-3 bg-astriarch-ui-dark-grey p-4 rounded">
            <Logo size="lg" variant="default" />
            <Logo size="lg" variant="white" />
            <Logo size="lg" variant="primary" />
          </div>
        </div>
      </div>
    </section>

    <!-- Image Logo Variations -->
    <section class="space-y-4">
      <h2 class="text-astriarch-headline-24 text-astriarch-ui-light-grey">Image Logos</h2>
      <div class="grid grid-cols-2 gap-8">
        <!-- Sizes -->
        <div class="space-y-4">
          <h3 class="text-astriarch-body-16-semibold text-astriarch-ui-white">Different Sizes</h3>
          <div class="space-y-3 bg-astriarch-ui-dark-grey p-4 rounded">
            <Logo type="image" size="sm" />
            <Logo type="image" size="md" />
            <Logo type="image" size="lg" />
            <Logo type="image" size="xl" />
          </div>
        </div>
        
        <!-- Variants -->
        <div class="space-y-4">
          <h3 class="text-astriarch-body-16-semibold text-astriarch-ui-white">Different Variants</h3>
          <div class="space-y-3 bg-astriarch-ui-dark-grey p-4 rounded">
            <Logo type="image" size="lg" variant="default" />
            <Logo type="image" size="lg" variant="white" />
            <Logo type="image" size="lg" variant="primary" />
          </div>
        </div>
      </div>
    </section>

    <!-- Usage Examples -->
    <section class="space-y-4">
      <h2 class="text-astriarch-headline-24 text-astriarch-ui-light-grey">Usage in Context</h2>
      <div class="space-y-4">
        <!-- Header example -->
        <div class="bg-astriarch-ui-dark-grey p-4 rounded">
          <h3 class="text-astriarch-body-16-semibold text-astriarch-ui-white mb-3">Navigation Header</h3>
          <div class="flex items-center justify-between bg-astriarch-ui-dark-blue p-4 rounded">
            <Logo size="md" variant="primary" />
            <div class="text-astriarch-body-14 text-astriarch-ui-light-grey">Menu Items</div>
          </div>
        </div>
        
        <!-- Card example -->
        <div class="bg-astriarch-ui-dark-grey p-4 rounded">
          <h3 class="text-astriarch-body-16-semibold text-astriarch-ui-white mb-3">Login Card</h3>
          <div class="bg-astriarch-glass p-6 rounded text-center">
            <Logo size="lg" variant="white" className="mb-4" />
            <p class="text-astriarch-body-14 text-astriarch-ui-light-grey">Welcome back to the galaxy</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</div>

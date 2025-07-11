<script lang="ts">
  import Button from '../components/Button';
  import Card from '../components/Card';
</script>

<main class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6">Component Test Page</h1>
  
  <section class="mb-8">
    <h2 class="text-xl font-semibold mb-4">Buttons</h2>
    <div class="flex flex-wrap gap-4">
      <div>
        <h3 class="mb-2">Primary Buttons</h3>
        <div class="flex flex-wrap gap-4">
          <Button 
            label="Large Button" 
            size="lg" 
            variant="primary" 
            onClick={() => alert('Large Primary Button clicked!')} 
          />
          <Button 
            label="Medium Button" 
            size="md" 
            variant="primary" 
            onClick={() => alert('Medium Primary Button clicked!')} 
          />
          <Button 
            label="Small Button" 
            size="sm" 
            variant="primary" 
            onClick={() => alert('Small Primary Button clicked!')} 
          />
          <Button 
            label="Disabled" 
            size="lg" 
            variant="primary" 
            disabled={true}
            onClick={() => alert('This should not alert!')} 
          />
        </div>
      </div>
      
      <div>
        <h3 class="mb-2">Outline Buttons</h3>
        <div class="flex flex-wrap gap-4">
          <Button 
            label="Large Outline" 
            size="lg" 
            variant="outline" 
            onClick={() => alert('Large Outline Button clicked!')} 
          />
          <Button 
            label="Medium Outline" 
            size="md" 
            variant="outline" 
            onClick={() => alert('Medium Outline Button clicked!')} 
          />
          <Button 
            label="Small Outline" 
            size="sm" 
            variant="outline" 
            onClick={() => alert('Small Outline Button clicked!')} 
          />
          <Button 
            label="Disabled" 
            size="lg" 
            variant="outline" 
            disabled={true}
            onClick={() => alert('This should not alert!')} 
          />
        </div>
      </div>
    </div>
  </section>
  
  <section class="mb-8">
    <h2 class="text-xl font-semibold mb-4">Cards</h2>
    <div class="flex flex-wrap gap-4">
      <div>
        <h3 class="mb-2">Large Cards</h3>
        <div class="flex flex-wrap gap-4">
          <Card 
            label="Enabled Card" 
            size="lg" 
            enabled={true}
            onClick={() => alert('Large Card clicked!')} 
          />
          <Card 
            label="Disabled Card" 
            size="lg" 
            enabled={false}
            onClick={() => alert('This should not alert!')} 
          />
        </div>
      </div>
      
      <div>
        <h3 class="mb-2">Medium Cards</h3>
        <div class="flex flex-wrap gap-4">
          <Card 
            label="Enabled Card" 
            size="md" 
            enabled={true}
            onClick={() => alert('Medium Card clicked!')} 
          />
          <Card 
            label="Disabled Card" 
            size="md" 
            enabled={false}
            onClick={() => alert('This should not alert!')} 
          />
        </div>
      </div>
    </div>
  </section>
  
  <section class="mb-8">
    <h2 class="text-xl font-semibold mb-4">Dialogs</h2>
    <div class="flex flex-wrap gap-4">
      <!-- Dialog components will be added when they're migrated -->
    </div>
  </section>
  
  <!-- More component sections will be added as we migrate them -->
</main>

<style>
  /* Add global styles for the component page */
  :global(body) {
    background-color: #121212;
    color: white;
  }
  
  h1, h2, h3 {
    color: white;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }
</style>

<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  
  interface Props {
    title?: string;
    cancelButtonText?: string;
    saveButtonText?: string;
    open?: boolean;
    onCancel?: () => void;
    onSave?: () => void;
    children?: any;
  }
  
  let { 
    title = "Dialog Title",
    cancelButtonText = "Cancel", 
    saveButtonText = "Save",
    open = false,
    onCancel,
    onSave,
    children,
    ...restProps 
  }: Props = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
    </Dialog.Header>
    <Dialog.Description class="sr-only">
      Dialog content
    </Dialog.Description>
    
    <div class="py-4">
      {@render children?.()}
    </div>
    
    <Dialog.Footer class="flex gap-2">
      <Button variant="outline" onclick={onCancel}>
        {cancelButtonText}
      </Button>
      <Button onclick={onSave}>
        {saveButtonText}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

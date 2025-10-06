import { ReactNode } from "react";
import { Button, CloseButton, Dialog, Portal } from "@chakra-ui/react";

export interface DialogProps {
  onChange?: (index: number) => void;
  placement?: React.ComponentProps<typeof Dialog.Root>["placement"];
  title?: string;
  children?: ReactNode;
  onCancel?: () => void;
  onSave?: () => void;
  cancelButtonText?: string;
  saveButtonText?: string;
}

/**
 * Dialog component using Chakra UI v3 Dialog component
 */
const DialogComponent: React.FC<DialogProps> = ({
  placement = "top",
  title = "Dialog Title",
  cancelButtonText = "Cancel",
  saveButtonText = "Save",
  onChange,
  onCancel,
  onSave,
  ...rest
}) => {
  return (
    <Dialog.Root placement={placement} motionPreset="slide-in-bottom">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>{rest.children}</Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onCancel}>
                {cancelButtonText}
              </Button>
              <Button onClick={onSave}>{saveButtonText}</Button>
            </Dialog.Footer>
            <CloseButton position="absolute" top="3" right="3" size="sm" />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default DialogComponent;

// Export additional Dialog sub-components for more flexibility
export { Dialog };

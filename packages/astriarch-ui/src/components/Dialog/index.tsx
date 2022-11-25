import { forwardRef, ReactNode } from "react";
import { styled } from "../../stitches.config";
import { Cross1Icon } from "@radix-ui/react-icons";
import * as DialogPrimitive from "@radix-ui/react-dialog";

const StyledOverlay = styled(DialogPrimitive.Overlay, {
  // overlay styles
});

const StyledContent = styled(DialogPrimitive.Content, {
  backgroundColor: "white",
  borderRadius: 6,
  boxShadow: "hsl(206 22% 7% / 35%) 0px 10px 38px -10px, hsl(206 22% 7% / 20%) 0px 10px 20px -15px",
});

interface DialogProps extends React.ComponentProps<typeof StyledContent> {
  as?: React.ElementType;
}

const StyledCloseButton = styled(DialogPrimitive.Close, {
  // close button styles
});

export function Dialog({ children, ...props }: DialogProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <StyledOverlay />
      {children}
    </DialogPrimitive.Root>
  );
}

interface DialogContentProps extends React.ComponentProps<typeof StyledContent> {
  as?: React.ElementType;
}

export const DialogContent = forwardRef(({ children, ...props }: DialogContentProps, forwardedRef) => (
  <StyledContent {...props} ref={forwardedRef}>
    {children}
    <StyledCloseButton>
      <Cross1Icon />
    </StyledCloseButton>
  </StyledContent>
));

export const DialogTrigger = DialogPrimitive.Trigger;

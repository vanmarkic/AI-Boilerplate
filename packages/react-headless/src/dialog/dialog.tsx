import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useControllableState } from '../hooks/use-controllable-state';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useScrollLock } from '../hooks/use-scroll-lock';
import { Portal } from '../utilities/portal';
import { Slot } from '../utilities/slot';

// ─── Context ──────────────────────────────────────────────────────────────────

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modal: boolean;
  titleId: string | undefined;
  descriptionId: string | undefined;
  setTitleId: (id: string | undefined) => void;
  setDescriptionId: (id: string | undefined) => void;
  triggerId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('Dialog sub-components must be used inside <Dialog.Root>');
  }
  return ctx;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface DialogRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  children?: ReactNode;
}

function Root({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  modal = true,
  children,
}: DialogRootProps) {
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  const uid = useId();
  const triggerId = `dialog-trigger-${uid}`;

  const [titleId, setTitleId] = useState<string | undefined>(undefined);
  const [descriptionId, setDescriptionId] = useState<string | undefined>(undefined);

  return (
    <DialogContext
      value={{
        open,
        onOpenChange: setOpen,
        modal,
        titleId,
        descriptionId,
        setTitleId,
        setDescriptionId,
        triggerId,
      }}
    >
      {children}
    </DialogContext>
  );
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface DialogTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function Trigger({ asChild = false, children, ...rest }: DialogTriggerProps) {
  const { open, onOpenChange, triggerId } = useDialogContext();
  const dataState = open ? 'open' : 'closed';

  const handleClick = () => {
    onOpenChange(!open);
  };

  if (asChild) {
    return (
      <Slot
        id={triggerId}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-state={dataState}
        onClick={handleClick}
        {...(rest as HTMLAttributes<HTMLElement>)}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      id={triggerId}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      data-state={dataState}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── Portal ───────────────────────────────────────────────────────────────────

interface DialogPortalProps {
  children?: ReactNode;
  container?: HTMLElement;
}

function DialogPortal({ children, container }: DialogPortalProps) {
  return <Portal container={container}>{children}</Portal>;
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

interface DialogOverlayProps extends HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  forceMount?: boolean;
}

function Overlay({ asChild = false, forceMount = false, ...rest }: DialogOverlayProps) {
  const { open, onOpenChange } = useDialogContext();
  const dataState = open ? 'open' : 'closed';

  if (!open && !forceMount) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only close on direct click on the overlay itself
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
    rest.onPointerDown?.(e);
  };

  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      aria-hidden="true"
      data-state={dataState}
      onPointerDown={handlePointerDown}
      {...(rest as HTMLAttributes<HTMLElement>)}
    />
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  forceMount?: boolean;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
  onPointerDownOutside?: (e: PointerEvent) => void;
  onInteractOutside?: (e: Event) => void;
}

function Content({
  asChild = false,
  forceMount = false,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  children,
  ...rest
}: DialogContentProps) {
  const { open, onOpenChange, modal, titleId, descriptionId } = useDialogContext();
  const dataState = open ? 'open' : 'closed';
  const contentRef = useRef<HTMLDivElement>(null);

  // Focus trap (modal only)
  useFocusTrap(contentRef, { active: open && modal });

  // Scroll lock (modal only)
  useScrollLock(open && modal);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscapeKeyDown?.(e);
        onInteractOutside?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onEscapeKeyDown, onInteractOutside, onOpenChange]);

  // Dev warning when no title
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && open && !titleId) {
      console.warn('[Dialog] Dialog.Content is missing a Dialog.Title. Add one for accessibility.');
    }
  }, [open, titleId]);

  if (!open && !forceMount) return null;

  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      ref={contentRef as React.Ref<HTMLDivElement>}
      role="dialog"
      aria-modal={modal ? 'true' : undefined}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-state={dataState}
      {...(rest as HTMLAttributes<HTMLElement>)}
    >
      {children}
    </Comp>
  );
}

// ─── Title ────────────────────────────────────────────────────────────────────

interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  asChild?: boolean;
}

function Title({ asChild = false, children, ...rest }: DialogTitleProps) {
  const { setTitleId } = useDialogContext();
  const id = useId();

  useEffect(() => {
    setTitleId(id);
    return () => setTitleId(undefined);
  }, [id, setTitleId]);

  const Comp = asChild ? Slot : 'h2';

  return (
    <Comp id={id} {...(rest as HTMLAttributes<HTMLElement>)}>
      {children}
    </Comp>
  );
}

// ─── Description ─────────────────────────────────────────────────────────────

interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  asChild?: boolean;
}

function Description({ asChild = false, children, ...rest }: DialogDescriptionProps) {
  const { setDescriptionId } = useDialogContext();
  const id = useId();

  useEffect(() => {
    setDescriptionId(id);
    return () => setDescriptionId(undefined);
  }, [id, setDescriptionId]);

  const Comp = asChild ? Slot : 'p';

  return (
    <Comp id={id} {...(rest as HTMLAttributes<HTMLElement>)}>
      {children}
    </Comp>
  );
}

// ─── Close ────────────────────────────────────────────────────────────────────

interface DialogCloseProps extends HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function Close({ asChild = false, children, ...rest }: DialogCloseProps) {
  const { onOpenChange } = useDialogContext();

  const handleClick = () => {
    onOpenChange(false);
  };

  if (asChild) {
    return (
      <Slot onClick={handleClick} {...(rest as HTMLAttributes<HTMLElement>)}>
        {children}
      </Slot>
    );
  }

  return (
    <button type="button" onClick={handleClick} {...rest}>
      {children}
    </button>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const Dialog = {
  Root,
  Trigger,
  Portal: DialogPortal,
  Overlay,
  Content,
  Title,
  Description,
  Close,
};

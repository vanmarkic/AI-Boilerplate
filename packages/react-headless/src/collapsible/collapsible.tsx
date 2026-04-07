import { createContext, useContext, useId, type HTMLAttributes } from 'react';
import { useControllableState } from '../hooks/use-controllable-state';
import { Slot } from '../utilities/slot';

// ─── Context ────────────────────────────────────────────────────────────────

interface CollapsibleContextValue {
  open: boolean;
  onToggle: () => void;
  disabled: boolean;
  triggerId: string;
  contentId: string;
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext(): CollapsibleContextValue {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) {
    throw new Error('Collapsible sub-components must be used inside <Collapsible.Root>');
  }
  return ctx;
}

// ─── Root ────────────────────────────────────────────────────────────────────

interface CollapsibleRootProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  asChild?: boolean;
}

function Root({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  asChild = false,
  children,
  ...rest
}: CollapsibleRootProps) {
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  const uid = useId();
  const triggerId = `collapsible-trigger-${uid}`;
  const contentId = `collapsible-content-${uid}`;

  const onToggle = () => {
    if (!disabled) {
      setOpen(!open);
    }
  };

  const Comp = asChild ? Slot : 'div';
  const dataState = open ? 'open' : 'closed';

  return (
    <CollapsibleContext value={{ open, onToggle, disabled, triggerId, contentId }}>
      <Comp data-state={dataState} {...rest}>
        {children}
      </Comp>
    </CollapsibleContext>
  );
}

// ─── Trigger ─────────────────────────────────────────────────────────────────

interface CollapsibleTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function Trigger({ asChild = false, children, ...rest }: CollapsibleTriggerProps) {
  const { open, onToggle, disabled, triggerId, contentId } = useCollapsibleContext();
  const dataState = open ? 'open' : 'closed';

  if (asChild) {
    return (
      <Slot
        id={triggerId}
        aria-expanded={open}
        aria-controls={contentId}
        data-state={dataState}
        onClick={onToggle}
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
      aria-expanded={open}
      aria-controls={contentId}
      data-state={dataState}
      disabled={disabled}
      onClick={onToggle}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

interface CollapsibleContentProps extends HTMLAttributes<HTMLDivElement> {
  forceMount?: boolean;
  asChild?: boolean;
}

function Content({
  forceMount = false,
  asChild = false,
  children,
  ...rest
}: CollapsibleContentProps) {
  const { open, triggerId, contentId } = useCollapsibleContext();
  const dataState = open ? 'open' : 'closed';

  if (!open && !forceMount) {
    return null;
  }

  const Comp = asChild ? Slot : 'div';

  return (
    <Comp id={contentId} role="region" aria-labelledby={triggerId} data-state={dataState} {...rest}>
      {children}
    </Comp>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const Collapsible = { Root, Trigger, Content };

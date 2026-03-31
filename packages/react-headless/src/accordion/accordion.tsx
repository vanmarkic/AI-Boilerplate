import {
  createContext,
  useContext,
  useId,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../hooks/use-controllable-state';
import { Slot } from '../utilities/slot';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccordionSingleProps = {
  type: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  collapsible?: boolean;
} & HTMLAttributes<HTMLDivElement>;

type AccordionMultipleProps = {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
} & HTMLAttributes<HTMLDivElement>;

type AccordionRootProps = (AccordionSingleProps | AccordionMultipleProps) & {
  asChild?: boolean;
};

interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
  asChild?: boolean;
}

interface AccordionHeaderProps extends HTMLAttributes<HTMLHeadingElement> {
  asChild?: boolean;
}

interface AccordionTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

interface AccordionContentProps extends HTMLAttributes<HTMLDivElement> {
  forceMount?: boolean;
  asChild?: boolean;
}

// ─── Root Context ─────────────────────────────────────────────────────────────

interface AccordionContextValue {
  type: 'single' | 'multiple';
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
  getTriggerId: (value: string) => string;
  getContentId: (value: string) => string;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext(): AccordionContextValue {
  const ctx = useContext(AccordionContext);
  if (!ctx) {
    throw new Error('Accordion sub-components must be used inside <Accordion.Root>');
  }
  return ctx;
}

// ─── Item Context ─────────────────────────────────────────────────────────────

interface AccordionItemContextValue {
  value: string;
  isOpen: boolean;
  disabled: boolean;
  triggerId: string;
  contentId: string;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionItemContext(): AccordionItemContextValue {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) {
    throw new Error('Accordion sub-components must be used inside <Accordion.Item>');
  }
  return ctx;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function Root({ asChild = false, children, ...props }: AccordionRootProps) {
  const { type } = props;
  const collapsible = type === 'single' ? (props as AccordionSingleProps).collapsible ?? false : false;

  // Both hooks called unconditionally (React rules of hooks)
  const [singleValue, setSingleValue] = useControllableState<string>({
    value: (props as AccordionSingleProps).value,
    defaultValue: (props as AccordionSingleProps).defaultValue ?? '',
    onChange: type === 'single' ? (props as AccordionSingleProps).onValueChange : undefined,
  });

  const [multiValue, setMultiValue] = useControllableState<string[]>({
    value: (props as AccordionMultipleProps).value,
    defaultValue: (props as AccordionMultipleProps).defaultValue ?? [],
    onChange: type === 'multiple' ? (props as AccordionMultipleProps).onValueChange : undefined,
  });

  const rootId = useId();
  const getTriggerId = (val: string) => `${rootId}-trigger-${val}`;
  const getContentId = (val: string) => `${rootId}-content-${val}`;

  const isOpen = (val: string): boolean =>
    type === 'single' ? singleValue === val : multiValue.includes(val);

  const toggle = (val: string) => {
    if (type === 'single') {
      const currently = singleValue === val;
      if (currently) {
        if (collapsible) setSingleValue('');
        // non-collapsible: do nothing
      } else {
        setSingleValue(val);
      }
    } else {
      const currently = multiValue.includes(val);
      if (currently) {
        setMultiValue(multiValue.filter((v) => v !== val));
      } else {
        setMultiValue([...multiValue, val]);
      }
    }
  };

  // Strip accordion-specific props before passing to DOM
  const {
    type: _type,
    value: _value,
    defaultValue: _defaultValue,
    onValueChange: _onValueChange,
    collapsible: _collapsible,
    ...domProps
  } = props as AccordionSingleProps & AccordionMultipleProps & { collapsible?: boolean };

  const Comp = asChild ? Slot : 'div';

  return (
    <AccordionContext
      value={{ type, isOpen, toggle, getTriggerId, getContentId }}
    >
      <Comp {...domProps}>{children}</Comp>
    </AccordionContext>
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────────

function Item({
  value,
  disabled = false,
  asChild = false,
  children,
  ...rest
}: AccordionItemProps) {
  const { isOpen, getTriggerId, getContentId } = useAccordionContext();
  const open = isOpen(value);
  const dataState = open ? 'open' : 'closed';
  const triggerId = getTriggerId(value);
  const contentId = getContentId(value);

  const Comp = asChild ? Slot : 'div';

  return (
    <AccordionItemContext value={{ value, isOpen: open, disabled, triggerId, contentId }}>
      <Comp
        data-state={dataState}
        {...(disabled ? { 'data-disabled': '' } : {})}
        {...rest}
      >
        {children}
      </Comp>
    </AccordionItemContext>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ asChild = false, children, ...rest }: AccordionHeaderProps) {
  const Comp = asChild ? (Slot as unknown as 'h3') : 'h3';
  return <Comp {...rest}>{children}</Comp>;
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

function Trigger({ asChild = false, children, onClick, ...rest }: AccordionTriggerProps) {
  const { toggle } = useAccordionContext();
  const { value, isOpen: open, disabled, triggerId, contentId } = useAccordionItemContext();

  const dataState = open ? 'open' : 'closed';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    (onClick as React.MouseEventHandler<HTMLButtonElement> | undefined)?.(e);
    if (!disabled) {
      toggle(value);
    }
  };

  if (asChild) {
    return (
      <Slot
        id={triggerId}
        aria-expanded={open}
        aria-controls={contentId}
        aria-disabled={disabled ? 'true' : undefined}
        data-state={dataState}
        {...(disabled ? { 'data-disabled': '' } : {})}
        onClick={handleClick as React.MouseEventHandler<HTMLElement>}
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
      aria-disabled={disabled ? 'true' : undefined}
      data-state={dataState}
      {...(disabled ? { 'data-disabled': '' } : {})}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

function Content({
  forceMount = false,
  asChild = false,
  children,
  ...rest
}: AccordionContentProps) {
  const { isOpen: open, triggerId, contentId } = useAccordionItemContext();
  const dataState = open ? 'open' : 'closed';

  if (!open && !forceMount) {
    return null;
  }

  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      data-state={dataState}
      {...rest}
    >
      {children}
    </Comp>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const Accordion = { Root, Item, Header, Trigger, Content };

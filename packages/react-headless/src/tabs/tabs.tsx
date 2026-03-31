import {
  createContext,
  useContext,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../hooks/use-controllable-state';
import { useRovingFocus } from '../hooks/use-roving-focus';
import { Slot } from '../utilities/slot';

// ─── Root Context ─────────────────────────────────────────────────────────────

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
  activationMode: 'automatic' | 'manual';
  getTriggerIdForValue: (val: string) => string;
  getContentIdForValue: (val: string) => string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error('Tabs sub-components must be used inside <Tabs.Root>');
  }
  return ctx;
}

// ─── List Context (roving focus props per trigger) ────────────────────────────

interface TabsListContextValue {
  getRovingProps: (value: string) => {
    ref: (el: HTMLElement | null) => void;
    tabIndex: number;
    onKeyDown: React.KeyboardEventHandler;
    onFocus: React.FocusEventHandler;
  };
}

const TabsListContext = createContext<TabsListContextValue | null>(null);

function useTabsListContext(): TabsListContextValue {
  const ctx = useContext(TabsListContext);
  if (!ctx) {
    throw new Error('Tabs.Trigger must be used inside <Tabs.List>');
  }
  return ctx;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface TabsRootProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  activationMode?: 'automatic' | 'manual';
  asChild?: boolean;
}

function Root({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  orientation = 'horizontal',
  activationMode = 'automatic',
  asChild = false,
  children,
  ...rest
}: TabsRootProps) {
  const [value, setValue] = useControllableState({
    value: controlledValue,
    defaultValue,
    onChange: onValueChange,
  });

  const rootId = useId();
  const getTriggerIdForValue = (val: string) => `${rootId}-trigger-${val}`;
  const getContentIdForValue = (val: string) => `${rootId}-content-${val}`;

  const Comp = asChild ? Slot : 'div';

  return (
    <TabsContext
      value={{
        value,
        onValueChange: setValue,
        orientation,
        activationMode,
        getTriggerIdForValue,
        getContentIdForValue,
      }}
    >
      <Comp {...rest}>{children}</Comp>
    </TabsContext>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

function List({ asChild = false, children, ...rest }: TabsListProps) {
  const { orientation } = useTabsContext();

  // Track trigger registration order: value -> index
  const registrationMapRef = useRef<Map<string, number>>(new Map());
  const counterRef = useRef(0);

  const { getItemProps } = useRovingFocus({ orientation });

  const getRovingProps = (value: string) => {
    // Register on first access (mount order)
    if (!registrationMapRef.current.has(value)) {
      registrationMapRef.current.set(value, counterRef.current++);
    }
    const index = registrationMapRef.current.get(value)!;
    return getItemProps(index);
  };

  const Comp = asChild ? Slot : 'div';

  return (
    <TabsListContext value={{ getRovingProps }}>
      <Comp role="tablist" aria-orientation={orientation} {...rest}>
        {children}
      </Comp>
    </TabsListContext>
  );
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  asChild?: boolean;
  disabled?: boolean;
}

function Trigger({
  value,
  asChild = false,
  disabled = false,
  children,
  onClick,
  onKeyDown,
  ...rest
}: TabsTriggerProps) {
  const {
    value: activeValue,
    onValueChange,
    activationMode,
    getTriggerIdForValue,
    getContentIdForValue,
  } = useTabsContext();
  const { getRovingProps } = useTabsListContext();

  const isActive = activeValue === value;
  const dataState = isActive ? 'active' : 'inactive';
  const triggerId = getTriggerIdForValue(value);
  const contentId = getContentIdForValue(value);

  const rovingProps = getRovingProps(value);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (disabled) return;
    if (activationMode === 'automatic') {
      onValueChange(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    rovingProps.onKeyDown(e as React.KeyboardEvent<HTMLElement>);
    onKeyDown?.(e);
    if (disabled) return;
    if (activationMode === 'manual' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onValueChange(value);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    rovingProps.onFocus(e as React.FocusEvent<HTMLElement>);
    if (disabled) return;
    if (activationMode === 'automatic') {
      onValueChange(value);
    }
  };

  if (asChild) {
    return (
      <Slot
        id={triggerId}
        role="tab"
        aria-selected={isActive}
        aria-controls={contentId}
        aria-disabled={disabled ? 'true' : undefined}
        data-state={dataState}
        ref={rovingProps.ref as React.Ref<HTMLElement>}
        tabIndex={rovingProps.tabIndex}
        onClick={handleClick as unknown as React.MouseEventHandler<HTMLElement>}
        onKeyDown={handleKeyDown as unknown as React.KeyboardEventHandler<HTMLElement>}
        onFocus={handleFocus as unknown as React.FocusEventHandler<HTMLElement>}
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
      role="tab"
      aria-selected={isActive}
      aria-controls={contentId}
      aria-disabled={disabled ? 'true' : undefined}
      data-state={dataState}
      ref={rovingProps.ref as React.Ref<HTMLButtonElement>}
      tabIndex={rovingProps.tabIndex}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  asChild?: boolean;
  forceMount?: boolean;
}

function Content({
  value,
  asChild = false,
  forceMount = false,
  children,
  ...rest
}: TabsContentProps) {
  const { value: activeValue, getTriggerIdForValue, getContentIdForValue } =
    useTabsContext();

  const isActive = activeValue === value;
  const dataState = isActive ? 'active' : 'inactive';
  const contentId = getContentIdForValue(value);
  const triggerId = getTriggerIdForValue(value);

  if (!isActive && !forceMount) {
    return null;
  }

  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      id={contentId}
      role="tabpanel"
      aria-labelledby={triggerId}
      data-state={dataState}
      tabIndex={0}
      {...rest}
    >
      {children}
    </Comp>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const Tabs = { Root, List, Trigger, Content };

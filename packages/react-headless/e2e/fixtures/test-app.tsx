import { useState } from 'react';
import { Dialog, Tabs, Collapsible, Accordion } from '../../src/index';

function getHash() {
  return window.location.hash.slice(1);
}

export function TestApp() {
  const [hash, setHash] = useState(getHash());

  // Listen for hash changes
  if (typeof window !== 'undefined') {
    window.onhashchange = () => setHash(getHash());
  }

  switch (hash) {
    case 'dialog-basic': return <DialogBasic />;
    case 'dialog-nested': return <DialogNested />;
    case 'dialog-force-mount': return <DialogForceMount />;
    case 'tabs-auto': return <TabsAuto />;
    case 'tabs-manual': return <TabsManual />;
    case 'tabs-disabled': return <TabsDisabled />;
    case 'collapsible-basic': return <CollapsibleBasic />;
    case 'collapsible-disabled': return <CollapsibleDisabled />;
    case 'collapsible-force-mount': return <CollapsibleForceMount />;
    case 'accordion-single': return <AccordionSingle />;
    case 'accordion-multiple': return <AccordionMultiple />;
    case 'accordion-disabled': return <AccordionDisabled />;
    default: return <p>Navigate to a scenario via URL hash</p>;
  }
}

function DialogBasic() {
  return (
    <Dialog.Root>
      <Dialog.Trigger data-testid="trigger">Open Dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay data-testid="overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
        <Dialog.Content data-testid="dialog-content" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', padding: 24 }}>
          <Dialog.Title>Basic Dialog</Dialog.Title>
          <Dialog.Description>This is a basic dialog description.</Dialog.Description>
          <input data-testid="first-input" placeholder="First" />
          <input data-testid="second-input" placeholder="Second" />
          <Dialog.Close data-testid="close-btn">Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DialogNested() {
  return (
    <Dialog.Root>
      <Dialog.Trigger data-testid="outer-trigger">Open Outer</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
        <Dialog.Content data-testid="outer-dialog" style={{ position: 'fixed', top: '40%', left: '40%', background: 'white', padding: 24 }}>
          <Dialog.Title>Outer Dialog</Dialog.Title>
          <Dialog.Root>
            <Dialog.Trigger data-testid="inner-trigger">Open Inner</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
              <Dialog.Content data-testid="inner-dialog" style={{ position: 'fixed', top: '50%', left: '50%', background: 'white', padding: 24 }}>
                <Dialog.Title>Inner Dialog</Dialog.Title>
                <Dialog.Close data-testid="inner-close">Close Inner</Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <Dialog.Close data-testid="outer-close">Close Outer</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DialogForceMount() {
  return (
    <Dialog.Root>
      <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content forceMount data-testid="dialog-content">
          <Dialog.Title>Force Mount</Dialog.Title>
          <Dialog.Close data-testid="close-btn">Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TabsAuto() {
  return (
    <Tabs.Root defaultValue="tab1">
      <Tabs.List>
        <Tabs.Trigger value="tab1" data-testid="trigger-1">Tab 1</Tabs.Trigger>
        <Tabs.Trigger value="tab2" data-testid="trigger-2">Tab 2</Tabs.Trigger>
        <Tabs.Trigger value="tab3" data-testid="trigger-3">Tab 3</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="tab1" data-testid="panel-1">Panel 1 content</Tabs.Content>
      <Tabs.Content value="tab2" data-testid="panel-2">Panel 2 content</Tabs.Content>
      <Tabs.Content value="tab3" data-testid="panel-3">Panel 3 content</Tabs.Content>
    </Tabs.Root>
  );
}

function TabsManual() {
  return (
    <Tabs.Root defaultValue="tab1" activationMode="manual">
      <Tabs.List>
        <Tabs.Trigger value="tab1" data-testid="trigger-1">Tab 1</Tabs.Trigger>
        <Tabs.Trigger value="tab2" data-testid="trigger-2">Tab 2</Tabs.Trigger>
        <Tabs.Trigger value="tab3" data-testid="trigger-3">Tab 3</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="tab1" data-testid="panel-1">Panel 1</Tabs.Content>
      <Tabs.Content value="tab2" data-testid="panel-2">Panel 2</Tabs.Content>
      <Tabs.Content value="tab3" data-testid="panel-3">Panel 3</Tabs.Content>
    </Tabs.Root>
  );
}

function TabsDisabled() {
  return (
    <Tabs.Root defaultValue="tab1">
      <Tabs.List>
        <Tabs.Trigger value="tab1" data-testid="trigger-1">Tab 1</Tabs.Trigger>
        <Tabs.Trigger value="tab2" data-testid="trigger-2" disabled>Tab 2 (disabled)</Tabs.Trigger>
        <Tabs.Trigger value="tab3" data-testid="trigger-3">Tab 3</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="tab1">Panel 1</Tabs.Content>
      <Tabs.Content value="tab2">Panel 2</Tabs.Content>
      <Tabs.Content value="tab3">Panel 3</Tabs.Content>
    </Tabs.Root>
  );
}

function CollapsibleBasic() {
  return (
    <Collapsible.Root>
      <Collapsible.Trigger data-testid="trigger">Toggle</Collapsible.Trigger>
      <Collapsible.Content data-testid="content">Collapsible content</Collapsible.Content>
    </Collapsible.Root>
  );
}

function CollapsibleDisabled() {
  return (
    <Collapsible.Root disabled>
      <Collapsible.Trigger data-testid="trigger">Toggle</Collapsible.Trigger>
      <Collapsible.Content data-testid="content">Content</Collapsible.Content>
    </Collapsible.Root>
  );
}

function CollapsibleForceMount() {
  return (
    <Collapsible.Root>
      <Collapsible.Trigger data-testid="trigger">Toggle</Collapsible.Trigger>
      <Collapsible.Content forceMount data-testid="content">Force mounted content</Collapsible.Content>
    </Collapsible.Root>
  );
}

// Arrow-key handler for accordion triggers: queries all [data-accordion-trigger] siblings
function accordionKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const root = (e.currentTarget as HTMLElement).closest('[data-accordion-root]');
  if (!root) return;
  const triggers = Array.from(root.querySelectorAll<HTMLElement>('[data-accordion-trigger]:not([data-disabled])'));
  const idx = triggers.indexOf(e.currentTarget as HTMLElement);
  if (idx === -1) return;
  e.preventDefault();
  if (e.key === 'ArrowDown') {
    const next = triggers[(idx + 1) % triggers.length];
    next?.focus();
  } else {
    const prev = triggers[(idx - 1 + triggers.length) % triggers.length];
    prev?.focus();
  }
}

function AccordionSingle() {
  return (
    <Accordion.Root type="single" collapsible data-accordion-root>
      <Accordion.Item value="a">
        <Accordion.Header>
          <Accordion.Trigger data-testid="trigger-a" data-accordion-trigger onKeyDown={accordionKeyDown}>Item A</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content data-testid="content-a">Content A</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="b">
        <Accordion.Header>
          <Accordion.Trigger data-testid="trigger-b" data-accordion-trigger onKeyDown={accordionKeyDown}>Item B</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content data-testid="content-b">Content B</Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function AccordionMultiple() {
  return (
    <Accordion.Root type="multiple" data-accordion-root>
      <Accordion.Item value="a">
        <Accordion.Header>
          <Accordion.Trigger data-testid="trigger-a" data-accordion-trigger onKeyDown={accordionKeyDown}>Item A</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content data-testid="content-a">Content A</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="b">
        <Accordion.Header>
          <Accordion.Trigger data-testid="trigger-b" data-accordion-trigger onKeyDown={accordionKeyDown}>Item B</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content data-testid="content-b">Content B</Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function AccordionDisabled() {
  return (
    <Accordion.Root type="single" data-accordion-root>
      <Accordion.Item value="a" disabled>
        <Accordion.Header>
          <Accordion.Trigger data-testid="trigger-a" data-accordion-trigger onKeyDown={accordionKeyDown}>Disabled Item</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content data-testid="content-a">Content A</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="b">
        <Accordion.Header>
          <Accordion.Trigger data-testid="trigger-b" data-accordion-trigger onKeyDown={accordionKeyDown}>Enabled Item</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content data-testid="content-b">Content B</Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

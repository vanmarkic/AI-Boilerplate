# @aspect/design-system

Framework-agnostic CSS design system. No JavaScript, no preprocessors, no build step.

## Install

```bash
npm install @aspect/design-system
```

## Import

Full bundle (recommended):

```css
@import "@aspect/design-system";
```

Individual files for granular control:

```css
@import "@aspect/design-system/tokens.css";
@import "@aspect/design-system/reset.css";
@import "@aspect/design-system/utilities.css";
@import "@aspect/design-system/components.css";
```

## Layer Cascade

The system declares CSS layers in this order:

```css
@layer reset, tokens, utilities, components;
```

**Order matters.** Later layers override earlier ones. If you import individual files, declare this `@layer` line _before_ any `@import` statements in your stylesheet. The full bundle handles this automatically.

## Component Variant Contract

Components use `data-*` HTML attributes for variant and size logic, styled via CSS attribute selectors. No runtime class computation required.

| Attribute        | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `data-variant`   | Visual variant (`default`, `destructive`, `outline`, `ghost`, `secondary`) |
| `data-size`      | Size variant (`sm`, `default`, `lg`)                           |

Example:

```html
<button class="btn" data-variant="destructive" data-size="lg">Delete</button>
```

## Available Components

| Component  | CSS classes                                                                        |
| ---------- | ---------------------------------------------------------------------------------- |
| Button     | `.btn`                                                                             |
| Badge      | `.badge`                                                                           |
| Card       | `.card`, `.card-title`, `.card-content`                                            |
| Input      | `.input-wrapper`, `.input-label`, `.input-base`                                    |
| Form Error | `.form-error`                                                                      |
| Dialog     | `.dialog-backdrop`, `.dialog-panel`, `.dialog-title`, `.dialog-body`, `.dialog-footer` |

## Font Setup

The design tokens assume Inter (body) and JetBrains Mono (code). Install the variable font packages:

```bash
npm install @fontsource-variable/inter @fontsource-variable/jetbrains-mono
```

Import them in your application entry point (not via CSS `@import`):

```ts
// main.ts or equivalent
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
```

## Framework Recipes

- [Angular](recipes/angular.md)
- [React](recipes/react.md)
- [Vue](recipes/vue.md)

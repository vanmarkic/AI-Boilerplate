# Vue Recipe

Vue 3 with `<script setup>` and TypeScript.

## Setup

Import the design system and fonts in your entry file:

```ts
// main.ts
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@aspect/design-system";

import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

If using Vite, no additional config is needed.

## Components

All components are SFCs with `<template>` and `<script setup>`. No `<style>` block -- all styling comes from the design system.

### AppButton.vue

```vue
<template>
  <button class="btn" :data-variant="variant" :data-size="size">
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "default" | "destructive" | "outline" | "ghost";
    size?: "sm" | "default" | "lg";
  }>(),
  { variant: "default", size: "default" },
);
</script>
```

Usage:

```vue
<AppButton variant="destructive" size="lg">Delete</AppButton>
```

### AppButtonLink.vue

```vue
<template>
  <a class="btn" :data-variant="variant" :data-size="size">
    <slot />
  </a>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "default" | "destructive" | "outline" | "ghost";
    size?: "sm" | "default" | "lg";
  }>(),
  { variant: "default", size: "default" },
);
</script>
```

### AppBadge.vue

```vue
<template>
  <span class="badge" :data-variant="variant">
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "default" | "secondary" | "destructive" | "outline";
  }>(),
  { variant: "default" },
);
</script>
```

### AppCard.vue

```vue
<template>
  <div class="card">
    <h3 v-if="title" class="card-title">{{ title }}</h3>
    <div class="card-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>
```

### AppInput.vue

```vue
<template>
  <div class="input-wrapper">
    <label v-if="label" :for="id" class="input-label">{{ label }}</label>
    <input
      :id="id"
      :type="type"
      :placeholder="placeholder"
      :value="modelValue"
      class="input-base"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    id?: string;
    label?: string;
    type?: "text" | "email" | "password";
    placeholder?: string;
    modelValue?: string;
  }>(),
  { type: "text", modelValue: "" },
);

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>
```

Usage:

```vue
<AppInput v-model="email" id="email" label="Email" type="email" placeholder="you@example.com" />
```

### FormError.vue

```vue
<template>
  <p v-if="message" class="form-error">{{ message }}</p>
</template>

<script setup lang="ts">
defineProps<{
  message?: string;
}>();
</script>
```

### AppDialog.vue

```vue
<template>
  <div class="dialog-backdrop" aria-hidden="true" @click="$emit('close')" />
  <div role="dialog" aria-modal="true" class="dialog-panel" :data-variant="variant">
    <div class="dialog-title">
      <slot name="title" />
    </div>
    <div class="dialog-body">
      <slot />
    </div>
    <div class="dialog-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

withDefaults(
  defineProps<{
    variant?: "default" | "destructive";
  }>(),
  { variant: "default" },
);

const emit = defineEmits<{
  close: [];
}>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>
```

Usage:

```vue
<AppDialog variant="destructive" @close="onClose">
  <template #title><h2>Delete account?</h2></template>
  <p>This action cannot be undone.</p>
  <template #footer>
    <AppButton variant="outline" @click="onClose">Cancel</AppButton>
    <AppButton variant="destructive" @click="onDelete">Delete</AppButton>
  </template>
</AppDialog>
```

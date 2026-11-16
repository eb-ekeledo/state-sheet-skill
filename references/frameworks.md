# Sheet routes for apps

For a component that lives in an app, add one dev-only page that renders it with one case's props. The script opens it once per case, theme and width:

```bash
node scripts/sheet.js --url "http://localhost:5173/__sheet?case={case}&theme={theme}&width={width}" --cases cases.json --out state-sheet
```

The page must:

1. Read `case` and `theme` from the query string.
2. Look up that case's `props` in the same `cases.json` the script uses (import it, don't copy it).
3. Render the component inside `<div data-sheet-root>`. The script screenshots and measures only that element.
4. Set `data-theme` (or your app's dark class) on `<html>`. The browser's colour scheme is set as well, so `prefers-color-scheme` works on its own.
5. Never ship. Guard it with a dev check and keep it out of navigation.

## React with Vite

```jsx
// src/dev/Sheet.jsx  (mounted only when import.meta.env.DEV)
import cases from '../components/PricingCard/cases.json';
import { PricingCard } from '../components/PricingCard';

export default function Sheet() {
  const q = new URLSearchParams(location.search);
  const c = cases.cases.find((x) => x.id === q.get('case'));
  document.documentElement.dataset.theme = q.get('theme') || 'light';
  return <div data-sheet-root>{c ? <PricingCard {...c.props} /> : null}</div>;
}
```

```jsx
// src/main.jsx
const isSheet = import.meta.env.DEV && location.pathname === '/__sheet';
const Root = isSheet ? (await import('./dev/Sheet.jsx')).default : App;
```

## Next.js (app router)

```jsx
// app/__sheet/page.jsx
import { notFound } from 'next/navigation';
import cases from '@/components/PricingCard/cases.json';
import { PricingCard } from '@/components/PricingCard';

export default async function Sheet({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const c = cases.cases.find((x) => x.id === q.case);
  return (
    <html data-theme={q.theme || 'light'}>
      <body><div data-sheet-root>{c ? <PricingCard {...c.props} /> : null}</div></body>
    </html>
  );
}
```

If the root layout already renders `<html>`, set the theme with a small client effect instead.

## Vue with Vite

```vue
<!-- src/dev/Sheet.vue, routed at /__sheet only when import.meta.env.DEV -->
<script setup>
import cases from '../components/PricingCard/cases.json';
import PricingCard from '../components/PricingCard.vue';
const q = new URLSearchParams(location.search);
const c = cases.cases.find((x) => x.id === q.get('case'));
document.documentElement.dataset.theme = q.get('theme') || 'light';
</script>

<template>
  <div data-sheet-root><PricingCard v-if="c" v-bind="c.props" /></div>
</template>
```

## Svelte and others

Same four steps: read the query, find the case, set the theme, render inside `data-sheet-root`.

## States that need a nudge

- **Hover, focus, pressed:** set `"interact": "hover" | "focus" | "press"` on the case. The script does it for real; don't fake it with a prop.
- **Loading and error from data:** pass the state as a prop (`status: "loading"`) or mock the fetch in the sheet page. Never wait on a real network.
- **Reduced motion:** set `"reducedMotion": true` on a case to render it with `prefers-reduced-motion: reduce`.
- **One case at a time** while fixing: `--only loading,error`.

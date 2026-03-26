import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div>App loading…</div>
  </StrictMode>,
);

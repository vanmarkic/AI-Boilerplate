import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import '@weasel-js/labkit/styles.css';
import './app.css';
import { IconRegistryProvider } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import { kitIcons } from '@weasel-js/ui/kit-icons';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// The diagram's labels are canvas text in sans-serif; unregistered, they render blank.
registerCanvasFont('sans-serif');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IconRegistryProvider icons={kitIcons}>
      <App />
    </IconRegistryProvider>
  </StrictMode>,
);

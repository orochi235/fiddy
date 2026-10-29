import '@weasel-js/labkit/styles.css';
import './app.css';
import { IconRegistryProvider } from '@weasel-js/core';
import { registerCanvasFont } from '@weasel-js/font';
import { kitIcons } from '@weasel-js/ui/kit-icons';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Bare } from './bare/Bare';

// The diagram's labels are canvas text in sans-serif; unregistered, they render blank.
registerCanvasFont('sans-serif');

const params = new URLSearchParams(location.search);
const bare = params.get('bare');
if (bare !== null) {
  document.documentElement.classList.add('fd-bare');
  const bg = params.get('bg');
  // An embedder's backdrop, read from the URL, so it can only reach the page as a runtime value.
  if (bg && /^[0-9a-f]{6}$/i.test(bg)) document.documentElement.style.setProperty('--fd-bare-bg', `#${bg}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IconRegistryProvider icons={kitIcons}>{bare === null ? <App /> : <Bare still={bare === 'still'} />}</IconRegistryProvider>
  </StrictMode>,
);

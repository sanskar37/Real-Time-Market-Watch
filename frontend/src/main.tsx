import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { MarketSocket, defaultSocketUrl } from './services/marketSocket';
import { MarketProvider } from './store/MarketProvider';
import { MarketStore } from './store/marketStore';

// One store and one socket for the lifetime of the page.
const store = new MarketStore();
const socket = new MarketSocket(defaultSocketUrl(), store);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MarketProvider value={{ store, socket }}>
      <App />
    </MarketProvider>
  </StrictMode>,
);

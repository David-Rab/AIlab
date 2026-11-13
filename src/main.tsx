import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameScreen } from './ui/Game';
import { SetupScreen, StartScreen } from './ui/Menus';
import { store, useStore } from './ui/store';
import { TooltipProvider } from './ui/Tooltip';
import { AppV2 } from './ui/v2/App';
import './ui/styles.css';
import './ui/layout.css';

// v2 switch (V2-SPEC §8.1): build with VITE_V2=1, or open the page with ?v2. v1 stays the default until M4.
const USE_V2 = import.meta.env.VITE_V2 === '1' || new URLSearchParams(window.location.search).has('v2');

// Debug handle: window.ai27.state in the console
(window as unknown as { ai27: typeof store }).ai27 = store;

function App() {
  const st = useStore();
  return (
    <TooltipProvider>
      {st.screen === 'start' && <StartScreen />}
      {st.screen === 'setup' && <SetupScreen />}
      {st.screen === 'game' && <GameScreen />}
    </TooltipProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode>{USE_V2 ? <AppV2 /> : <App />}</StrictMode>);

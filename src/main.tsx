import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameScreen } from './ui/Game';
import { SetupScreen, StartScreen } from './ui/Menus';
import { useStore } from './ui/store';
import { TooltipProvider } from './ui/Tooltip';
import './ui/styles.css';
import './ui/layout.css';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

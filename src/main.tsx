import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppV2 } from './ui/v2/App';

createRoot(document.getElementById('root')!).render(<StrictMode><AppV2 /></StrictMode>);

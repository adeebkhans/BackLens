/**
 * Application entry point
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { isVsCodeEnvironment } from './api/createProvider';

// --- ENVIRONMENT-BASED UI ADJUSTMENTS ---

// Scale UI density based on host environment
if (isVsCodeEnvironment()) {
  // 1. Denser UI inside VS Code webview
  document.documentElement.style.setProperty('font-size', '13px', 'important');

  // 2. BOOST TRACKPAD ZOOM SPEED
  // VS Code heavily dampens wheel events. We intercept the native browser 
  // event and multiply the deltaY to restore normal React Flow zoom speeds.
  const originalDeltaY = Object.getOwnPropertyDescriptor(WheelEvent.prototype, 'deltaY');

  if (originalDeltaY && originalDeltaY.get) {
    const originalGet = originalDeltaY.get;
    Object.defineProperty(WheelEvent.prototype, 'deltaY', {
      get() {
        const rawValue = originalGet.call(this);;
        // Multiply by 4 (Adjust this number up or down until it feels perfect!)
        return rawValue * 4;
      }
    });
  }
} else {
  // Normal browser size for local development
  document.documentElement.style.setProperty('font-size', '16px', 'important');
}

// --- RENDER APPLICATION ---

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
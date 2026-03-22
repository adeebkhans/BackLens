/**
 * Application entry point
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { isVsCodeEnvironment } from './api/createProvider';

// --- ENVIRONMENT-BASED UI ADJUSTMENTS ---

declare global {
  interface Window {
    __backlensOriginalWheelDeltaYGetter?: () => number;
  }
}

function applyWheelZoomMultiplier(multiplier: number): void {
  const descriptor = Object.getOwnPropertyDescriptor(WheelEvent.prototype, 'deltaY');
  if (!descriptor?.get) {
    return;
  }

  // Keep a stable reference to the browser's native getter so HMR/reloads
  // don't stack multipliers on top of previous patches.
  if (!window.__backlensOriginalWheelDeltaYGetter) {
    window.__backlensOriginalWheelDeltaYGetter = descriptor.get;
  }

  Object.defineProperty(WheelEvent.prototype, 'deltaY', {
    configurable: true,
    get() {
      const rawValue = window.__backlensOriginalWheelDeltaYGetter!.call(this);
      return rawValue * multiplier;
    }
  });
}

// Scale UI density based on host environment
if (isVsCodeEnvironment()) {
  // 1. Denser UI inside VS Code webview
  document.documentElement.style.setProperty('font-size', '13px', 'important');

  // VS Code webview dampens trackpad wheel deltas significantly.
  applyWheelZoomMultiplier(4);
} else {
  // Normal browser size for local development
  document.documentElement.style.setProperty('font-size', '16px', 'important');

  // Keep standalone browser zoom responsive without over-accelerating it.
  applyWheelZoomMultiplier(1.5);
}

// --- RENDER APPLICATION ---

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
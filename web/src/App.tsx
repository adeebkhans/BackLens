/**
 * Main App component - 3-panel layout
 */
import { useState } from 'react';
import { LeftPanel } from './components/layout/LeftPanel';
import { GraphPanel } from './components/layout/GraphPanel';
import { RightPanel } from './components/layout/RightPanel';
import logoIcon from './assests/images/icon.png';

function App() {
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-gray-50 relative">

      {/* Left Panel Container */}
      <div
        className={`h-full flex-shrink-0 transition-all duration-300 ease-in-out border-r border-gray-200 relative bg-white z-10 shadow-xl ${showLeft ? 'w-80 translate-x-0' : 'w-0 -translate-x-full opacity-0'
          }`}
      >
        <div className="h-full w-80 flex flex-col">
          {/* Header / Logo Area */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2">
              <img src={logoIcon} alt="BackLens" className="w-6 h-6 object-contain" />
              <span className="font-bold text-gray-800 text-lg tracking-tight">BackLens</span>
            </div>
            <button
              onClick={() => setShowLeft(false)}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
              title="Collapse sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 12l12 6" /></svg>
            </button>
          </div>

          {/* Main Left Panel Content */}
          <div className="flex-1 overflow-hidden">
            <LeftPanel />
          </div>
        </div>
      </div>

      {/* Floating Left Toggle (visible when collapsed) */}
      {!showLeft && (
        <button
          onClick={() => setShowLeft(true)}
          className="absolute top-4 left-4 z-20 bg-white p-2 rounded-md shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all"
          title="Show sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 12L6 6" /></svg>
        </button>
      )}

      {/* Center Panel - Graph Canvas */}
      <div className="flex-1 h-full relative z-0">
        <GraphPanel />
      </div>

      {/* Floating Right Toggle (visible when collapsed) */}
      {!showRight && (
        <button
          onClick={() => setShowRight(true)}
          className="absolute top-4 right-4 z-20 bg-white p-2 rounded-md shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all"
          title="Show details"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        </button>
      )}

      {/* Right Panel Container */}
      <div
        className={`h-full flex-shrink-0 transition-all duration-300 ease-in-out border-l border-gray-200 relative bg-white z-10 shadow-xl ${showRight ? 'w-72 translate-x-0' : 'w-0 translate-x-full opacity-0'
          }`}
      >
        <div className="h-full w-72 flex flex-col relative">
          {/* Close button for right panel (absolute positioned to not take height) */}
          <button
            onClick={() => setShowRight(false)}
            className="absolute top-4 right-4 z-20 p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
            title="Collapse details"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>

          <div className="flex-1 overflow-hidden">
            <RightPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
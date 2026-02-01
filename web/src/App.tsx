/**
 * Main App component - 3-panel layout
 */
import { LeftPanel } from './components/layout/LeftPanel';
import { GraphPanel } from './components/layout/GraphPanel';
import { RightPanel } from './components/layout/RightPanel';

function App() {
  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* Left Panel - Search & Entry Points */}
      <div className="w-64 flex-shrink-0">
        <LeftPanel />
      </div>

      {/* Center Panel - Graph Canvas */}
      <div className="flex-1">
        <GraphPanel />
      </div>

      {/* Right Panel - Inspector */}
      <div className="w-80 flex-shrink-0">
        <RightPanel />
      </div>
    </div>
  );
}

export default App;

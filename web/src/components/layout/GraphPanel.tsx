/**
 * Center panel - Graph visualization
 */
import { GraphCanvas } from '../graph/GraphCanvas';

export function GraphPanel() {
  return (
    <div className="h-full w-full">
      <GraphCanvas />
    </div>
  );
}
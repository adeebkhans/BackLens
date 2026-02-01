/**
 * Right Panel - Node Inspector
 */
import { useGraphStore } from '../../store/graphStore';
import type { ClassNodeMeta, MethodNodeMeta, FunctionNodeMeta } from '../../types/graph';

// Badge component for consistent styling
const Badge = ({ text, color }: { text: string; color: 'purple' | 'orange' | 'blue' | 'green' | 'gray' }) => {
  const colorClasses = {
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    gray: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${colorClasses[color]}`}>
      {text}
    </span>
  );
};

// Info row component
const InfoRow = ({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) => (
  <div>
    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
    <p className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
);

export function RightPanel() {
  const { selectedNode, expandCallers, expandCallees, loading } = useGraphStore();  // Graph store actions and state

  if (!selectedNode) {
    return (
      <div className="h-full bg-gray-50 border-l border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Inspector</h2>
        <p className="text-sm text-gray-500">
          Click on a node in the graph to see its details
        </p>

        {/* Legend */}
        <div className="mt-6 space-y-2">
          <h3 className="text-xs font-medium text-gray-500 uppercase">Legend</h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-purple-300 border border-purple-400"></div>
              <span className="text-xs text-gray-600">Class</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-300 border border-green-400"></div>
              <span className="text-xs text-gray-600">Method</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-300 border border-blue-400"></div>
              <span className="text-xs text-gray-600">Function</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-300 border border-orange-400"></div>
              <span className="text-xs text-gray-600">External/Framework</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-300 border border-gray-400"></div>
              <span className="text-xs text-gray-600">File</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { id, type, label, meta } = selectedNode;

  // Type-specific metadata
  const methodMeta = type === 'method' ? (meta as MethodNodeMeta) : null;
  const classMeta = type === 'class' ? (meta as ClassNodeMeta) : null;
  const functionMeta = type === 'function' ? (meta as FunctionNodeMeta) : null;

  // Check for framework indicator
  const isFramework = meta && 'isFramework' in meta ? meta.isFramework : false;

  return (
    <div className="h-full bg-gray-50 border-l border-gray-200 p-4 flex flex-col overflow-auto">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Inspector</h2>

      {/* Node Type & Framework Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`
          inline-block px-3 py-1 rounded-full text-xs font-medium
          ${type === 'function' ? 'bg-blue-100 text-blue-800' : ''}
          ${type === 'file' ? 'bg-gray-100 text-gray-800' : ''}
          ${type === 'class' ? 'bg-purple-100 text-purple-800' : ''}
          ${type === 'method' ? 'bg-green-100 text-green-800' : ''}
          ${type === 'external' ? 'bg-orange-100 text-orange-800' : ''}
          ${type === 'placeholder' && meta?.external ? 'bg-orange-100 text-orange-800' : ''}
          ${type === 'placeholder' && !meta?.external ? 'bg-yellow-100 text-yellow-800' : ''}
        `}>
          {/* Show friendlier names for placeholder nodes based on context */}
          {type === 'placeholder'
            ? (meta?.external ? 'External Method' : isFramework ? 'Framework Call' : (meta?.receiver ? 'Method Call' : 'External Call'))
            : type}
        </span>
        {isFramework && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            🔧 Framework
          </span>
        )}
        {meta?.external && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            📦 {meta.moduleName}
          </span>
        )}
      </div>

      {/* Node Name */}
      <h3 className="text-xl font-bold mb-2 text-gray-900 break-words">
        {type === 'method' ? `${label}()` : label}
      </h3>

      {/* Method-specific: Class ownership */}
      {methodMeta?.className && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-purple-500">📦</span>
            <div>
              <div className="text-xs text-purple-600 font-medium uppercase">Member of Class</div>
              <div className="text-sm font-semibold text-purple-900">{methodMeta.className}</div>
            </div>
          </div>
        </div>
      )}

      {/* Class-specific: Method count */}
      {classMeta?.methods && classMeta.methods.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-xs text-green-600 font-medium uppercase mb-1">Methods</div>
          <div className="text-sm text-green-900">
            {classMeta.methods.length} method{classMeta.methods.length !== 1 ? 's' : ''} defined
          </div>
          <div className="mt-2 max-h-20 overflow-auto">
            {classMeta.methods.slice(0, 5).map((method, i) => (
              <div key={i} className="text-xs text-green-700 font-mono">⚡ {method}</div>
            ))}
            {classMeta.methods.length > 5 && (
              <div className="text-xs text-green-500">... and {classMeta.methods.length - 5} more</div>
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      {meta && (
        <div className="space-y-3 mb-6">
          {meta.file && (
            <InfoRow label="File" value={meta.file} />
          )}

          {/* Line information for methods/functions */}
          {(methodMeta?.startLine || functionMeta?.startLine) && (
            <div className="grid grid-cols-2 gap-3">
              <InfoRow
                label="Start Line"
                value={`L${methodMeta?.startLine || functionMeta?.startLine}`}
              />
              {(methodMeta?.endLine || functionMeta?.endLine) && (
                <InfoRow
                  label="End Line"
                  value={`L${methodMeta?.endLine || functionMeta?.endLine}`}
                />
              )}
            </div>
          )}

          {/* Legacy position info */}
          {meta.start && meta.end && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Start</label>
                <p className="text-sm text-gray-900">
                  L{meta.start.line}:{meta.start.column}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">End</label>
                <p className="text-sm text-gray-900">
                  L{meta.end.line}:{meta.end.column}
                </p>
              </div>
            </div>
          )}

          {/* Placeholder-specific metadata */}
          {type === 'placeholder' && meta.receiver && meta.method && (
            <div className={`mb-3 p-3 rounded-lg border ${meta.external ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className={`text-xs font-medium uppercase mb-1 ${meta.external ? 'text-orange-600' : 'text-yellow-600'}`}>
                {meta.external ? 'External Method Call' : 'Method Call'}
              </div>
              <div className={`text-sm font-semibold ${meta.external ? 'text-orange-900' : 'text-yellow-900'}`}>
                {meta.receiver}.{meta.method}()
              </div>
              {meta.external && meta.moduleName && (
                <div className="text-xs text-orange-700 mt-2 pt-2 border-t border-orange-200">
                  <strong>Module:</strong> {meta.moduleName}
                </div>
              )}
            </div>
          )}

          {type === 'placeholder' && meta.calleeName && (
            <InfoRow label="Callee Name" value={meta.calleeName} />
          )}

          {type === 'placeholder' && meta.receiver && (
            <InfoRow label="Receiver Object" value={meta.receiver} />
          )}

          {type === 'placeholder' && meta.line && (
            <InfoRow label="Line" value={`L${meta.line}`} />
          )}

          {/* External module metadata */}
          {type === 'external' && meta.moduleName && (
            <InfoRow label="Module" value={meta.moduleName} />
          )}

          {/* Method kind (if available) */}
          {methodMeta?.kind && (
            <div className="flex items-center gap-2">
              <Badge
                text={methodMeta.kind}
                color={methodMeta.kind === 'method' ? 'green' : methodMeta.kind === 'getter' ? 'blue' : 'purple'}
              />
              {methodMeta.isStatic && <Badge text="static" color="gray" />}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Actions</h4>

        <button
          onClick={() => expandCallers(id)}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm transition-colors"
          disabled={loading}
        >
          ← Expand Callers
        </button>

        <button
          onClick={() => expandCallees(id)}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm transition-colors"
          disabled={loading}
        >
          Expand Callees →
        </button>

        {/* Additional action for class nodes */}
        {type === 'class' && (
          <button
            onClick={() => expandCallees(id)}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 text-sm transition-colors"
            disabled={loading}
          >
            📦 Expand Methods
          </button>
        )}
      </div>

      {/* Node ID (for debugging) */}
      <div className="mt-auto pt-4 border-t border-gray-200">
        <label className="text-xs font-medium text-gray-500 uppercase">Node ID</label>
        <p className="text-xs text-gray-600 break-all font-mono">{id}</p>
      </div>
    </div>
  );
}
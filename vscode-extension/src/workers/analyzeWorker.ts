/**
 * Worker Script- It runs in a separate Node.js process,
 *  detached from the main VS Code window.
 */

// Purpose: In a single-threaded environment like JavaScript (Node.js),
// heavy computations block the "Event Loop." If we ran this code in the main extension
// process, VS Code would completely freeze until analysis is done

import { parseProject } from '@backlens/parser';
import { buildGraph, saveGraphWasm } from '@backlens/graph-store';

process.on('message', async (msg: any) => {
  if (msg.type !== 'start') { return; }

  const { rootPath, dbPath } = msg;

  try {
    // Send a message(s) BACK to the main process so it can update the UI progress bar.
    process.send?.({ type: 'progress', message: 'Parsing source files...', increment: 10 });
    const ir = await parseProject(rootPath);

    process.send?.({ type: 'progress', message: `Found ${ir.files.length} files...`, increment: 20 });

    process.send?.({ type: 'progress', message: 'Building call graph...', increment: 20 });
    const graph = buildGraph(ir);

    process.send?.({ type: 'progress', message: 'Saving to database...', increment: 20 });

    // Use WASM-based SQLite
    await saveGraphWasm(graph, dbPath);

    process.send?.({
      type: 'complete',
      stats: {
        files: ir.files.length,
        functions: ir.functions.length,
        classes: ir.classes?.length || 0,
        methods: ir.methods?.length || 0,
        edges: ir.calls.length
      }
    });
  } catch (err: any) {
    console.error('Worker error:', err);
    process.send?.({ type: 'error', error: err.message || String(err) });
  }

  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (err: any) => {
  console.error('Uncaught exception in worker:', err);
  process.send?.({ type: 'error', error: err.message || String(err) });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled rejection in worker:', reason);
  process.send?.({ type: 'error', error: reason.message || String(reason) });
  process.exit(1);
});
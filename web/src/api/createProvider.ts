/**
 * Provider Factory - Environment Detection and Singleton Management
 * 
 * Detects whether we're running in a VS Code webview or standalone web
 * and returns the appropriate IGraphProvider implementation.
 */
import type { IGraphProvider } from './IGraphProvider';
import { HttpGraphProvider } from './HttpGraphProvider';
import { VsCodeGraphProvider } from './VsCodeGraphProvider';

/**
 * Detects environment and returns the appropriate provider.
 */
export function createGraphProvider(): IGraphProvider {
  // Check if we're inside a VS Code webview
  if (typeof window !== 'undefined' && window.acquireVsCodeApi) {
    console.log('[BackLens] Running in VS Code webview mode');
    return new VsCodeGraphProvider();
  }
  
  // Default: standalone web with HTTP
  console.log('[BackLens] Running in standalone HTTP mode');
  return new HttpGraphProvider();
}

// Singleton instance for use across the app
let providerInstance: IGraphProvider | null = null;

/**
 * Get the singleton provider instance.
 * Creates one if it doesn't exist.
 */
export function getGraphProvider(): IGraphProvider {
  if (!providerInstance) {
    providerInstance = createGraphProvider();
  }
  return providerInstance;
}

/**
 * Check if we're running inside VS Code
 */
export function isVsCodeEnvironment(): boolean {
  return typeof window !== 'undefined' && !!window.acquireVsCodeApi;
}

/**
 * Reset the provider instance (useful for testing)
 */
export function resetProvider(): void {
  providerInstance = null;
}
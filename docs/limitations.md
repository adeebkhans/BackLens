# Limitations

BackLens performs static analysis, so some limits are expected.

## Current Supported Scope

- Languages with strongest support:
  - JavaScript
  - TypeScript
  - JSX
  - TSX
- Best results on backend-style codebases.

## Current Limitations

- Dynamic dispatch may not fully resolve.
- Runtime-generated behavior cannot always be inferred.
- Framework magic may appear as external or unresolved nodes.
- Alias-heavy or metaprogramming-heavy repositories may reduce accuracy.
- Non-JS ecosystems (Python/Go/Rust) are not yet at full semantic support level.

## Interpretation Guidance

When you see unresolved or external edges, treat them as:

- potential dynamic/runtime boundaries
- framework or dependency interactions
- targets requiring manual source confirmation

## Why This Exists

Static analysis trades runtime certainty for fast, local architectural visibility.

BackLens prioritizes practical call-flow exploration over perfect runtime equivalence.
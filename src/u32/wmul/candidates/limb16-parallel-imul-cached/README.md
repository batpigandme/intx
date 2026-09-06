# Parallel 16-Bit Limb Split (All `imul` Cached) (`limb16-parallel-imul-cached`)

## Approach Overview
This candidate caches `Math.imul` in a file-level closure variable (`const imul = Math.imul;`) and uses `imul(...)` for all 4 partial cross-products and `lo`.

## Hypothesis & Characteristics
- **Hypothesis**: Evaluates whether caching the global `Math.imul` property avoids property lookups in the parallel limb multiplication topology.

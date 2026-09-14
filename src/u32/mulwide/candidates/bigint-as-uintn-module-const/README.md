# BigInt with `asUintN(64, 32)` (Module Constant) (`bigint-as-uintn-module-const`)

## Approach Overview
This candidate extracts `const SHIFT_32 = 32n` to the top-level module scope rather than using an inline BigInt literal inside the hot function body.

## Hypothesis & Characteristics
- **Hypothesis**: Evaluates whether caching the `32n` BigInt literal in a top-level module closure variable prevents repeated literal instantiation in V8 bytecode.

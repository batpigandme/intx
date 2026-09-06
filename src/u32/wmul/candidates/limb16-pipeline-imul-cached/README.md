# Pipelined 16-Bit Limb Split (All `imul` Cached) (`limb16-pipe-imul-cached`)

## Approach Overview
This candidate caches `Math.imul` into a module-level variable (`const imul = Math.imul;`) and uses it for all 5 multiplication operations in the 3-stage pipelined carry chain.

## Hypothesis & Characteristics
- **Hypothesis**: Evaluates whether aliasing `Math.imul` into a file-level closure variable introduces closure lookup overhead vs direct intrinsic calls.

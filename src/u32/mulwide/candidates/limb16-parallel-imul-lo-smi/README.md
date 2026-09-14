# Parallel 16-Bit Limb Split (`imul` Lo, Smi / `| 0`) (`limb16-parallel-imul-lo-smi`)

## Approach Overview
This candidate implements the parallel 16-bit limb split using signed 32-bit integer (`| 0`) coercions throughout instead of unsigned right shifts (`>>> 0`):
1. Input coercion: `a |= 0; b |= 0;`.
2. Intermediate arithmetic uses `| 0` for 32-bit truncation.
3. Carries are extracted via `>>> 16`.
4. Low word computed via `Math.imul(a, b) | 0`.

## Hypothesis & Characteristics
- **Hypothesis**: Testing whether V8's internal representation of signed 31-bit Smis / Int32s with `| 0` avoids any potential unsigned Word32 box/representation conversions compared to `>>> 0`.

# Parallel 16-Bit Limb Split (All `imul` Direct) (`limb16-parallel-imul-all`)

## Approach Overview
This candidate computes all four 16-bit partial products plus the full 32-bit `lo` word using direct `Math.imul(...)` intrinsic calls:
1. $P_0 = \text{Math.imul}(al, bl), \; P_1 = \text{Math.imul}(ah, bl), \; P_2 = \text{Math.imul}(al, bh), \; P_3 = \text{Math.imul}(ah, bh)$.
2. Accumulates carries into `hi`.
3. $lo = \text{Math.imul}(a, b) \mathbin{>>>} 0$.

## Hypothesis & Characteristics
- **Hypothesis**: Direct `Math.imul` calls guarantee 32-bit hardware integer instructions (`imull`) without any engine heuristics trying to promote 16-bit multiplications into floating-point numbers.

# Pipelined 16-Bit Limb Split (All `imul` Direct) (`limb16-pipeline-imul-all`)

## Approach Overview
This candidate computes all intermediate carry multiplications and the full 32-bit `lo` word using direct `Math.imul(...)` calls:
1. $albl = \text{Math.imul}(al, bl) \implies llh = albl \gg 16$.
2. $ahbl = \text{Math.imul}(ah, bl) + llh \implies hll = ahbl \ \& \ \text{0xFFFF}, \; hlh = ahbl \gg 16$.
3. $albh = \text{Math.imul}(al, bh) + hll \implies lhh = albh \gg 16$.
4. $lo = \text{Math.imul}(a, b) \mathbin{>>>} 0$.
5. $hi = (\text{Math.imul}(ah, bh) + hlh + lhh) \mathbin{>>>} 0$.

## Hypothesis & Characteristics
- **Hypothesis**: Direct `Math.imul` forces V8's TurboFan compiler to emit hardware `imull` instructions everywhere, achieving peak execution rate (**~370 Mops/s**).

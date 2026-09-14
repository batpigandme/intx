# Parallel 16-Bit Limb Split (`imul` Lo) (`limb16-parallel-imul-lo`)

## Approach Overview
This candidate computes all four 16-bit partial products independently using standard `*` to accumulate carries into `hi`, but replaces the low-word bitwise assembly with a direct hardware multiplication:
1. $P_0 = a_l \cdot b_l, \; P_1 = a_h \cdot b_l, \; P_2 = a_l \cdot b_h, \; P_3 = a_h \cdot b_h$.
2. $mid = P_1 + (P_0 \gg 16), \; mid2 = P_2 + (mid \ \& \ \text{0xFFFF})$.
3. $hi = P_3 + (mid \gg 16) + (mid2 \gg 16)$.
4. $lo = \text{Math.imul}(a, b) \mathbin{>>>} 0$.

## Hypothesis & Characteristics
- **Hypothesis**: Replacing `((mid2 << 16) | (albl & 0xffff))` with a single 1-cycle `Math.imul(a, b)` instruction saves 3 bitwise ALU instructions while preserving parallel partial product calculation.

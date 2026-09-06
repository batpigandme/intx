# Parallel 16-Bit Limb Split (Bitwise Lo) (`limb16-parallel-bitwise-lo`)

## Approach Overview
This candidate implements the classic textbook 4-way partial product decomposition:
1. Split operands into 16-bit halves: $a = (a_h, a_l)$, $b = (b_h, b_l)$.
2. Compute all 4 partial cross-products independently:
   - $P_0 = a_l \cdot b_l$
   - $P_1 = a_h \cdot b_l$
   - $P_2 = a_l \cdot b_h$
   - $P_3 = a_h \cdot b_h$
3. Squeeze middle columns together via multi-shift bitwise arithmetic:
   - $mid = P_1 + (P_0 \gg 16)$
   - $mid2 = P_2 + (mid \ \& \ \text{0xFFFF})$
4. Assemble final outputs:
   - $hi = P_3 + (mid \gg 16) + (mid2 \gg 16)$
   - $lo = (mid2 \ll 16) \ | \ (P_0 \ \& \ \text{0xFFFF})$

## Hypothesis & Characteristics
- **Hypothesis**: Computing 4 independent multiplications upfront allows CPU out-of-order execution units to schedule multiplications across multiple ALU ports in parallel.
- **Bottlenecks**: All 4 product variables ($P_0, P_1, P_2, P_3$) must remain simultaneously alive in registers while intermediate columns are computed, increasing register pressure and requiring extra bitwise shifts (`mid >> 16`, `mid2 >> 16`, `P0 & 0xffff`).

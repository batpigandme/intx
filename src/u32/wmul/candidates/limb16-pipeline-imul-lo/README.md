# Pipelined 16-Bit Limb Split (`imul` Lo) (`limb16-pipe-imul-lo`)

## Approach Overview
This candidate combines minimal 16-bit carry propagation with a single direct `Math.imul(a, b)` for the low word:
1. $k_1 = (al \cdot bl) \gg 16$.
2. $t_1 = ah \cdot bl + k_1 \implies w_1 = t_1 \gg 16, \; w_2 = t_1 \ \& \ \text{0xFFFF}$.
3. $k_2 = (al \cdot bh + w_2) \gg 16$.
4. $hi = (ah \cdot bh + w_1 + k_2) \mathbin{>>>} 0$.
5. $lo = \text{Math.imul}(a, b) \mathbin{>>>} 0$.

## Hypothesis & Characteristics
- **Hypothesis**: Combines clean native `*` bytecode for 16-bit products with direct 1-cycle `imull` for `lo`, eliminating 4 bitwise reconstruction operations and achieving top-tier throughput.

# Asymmetric 16x32 Float Split (Bitwise Lo) (`limb16-float48-bitwise-lo`)

## Approach Overview
This candidate splits only one operand ($a$) into 16-bit halves ($a_h, a_l$), leaving $b$ as a full 32-bit integer:
1. $P_l = a_l \cdot b \quad (\le 65535 \times 4294967295 \approx 2.8147 \times 10^{14} < 2^{48} \ll 2^{53}-1)$.
2. $P_h = a_h \cdot b \quad (< 2^{48})$.
3. Because $2^{48} < 2^{53}-1$, both $P_l$ and $P_h$ evaluate with **0% precision loss** in IEEE-754 double precision.
4. Extract carries and assemble $lo$ and $hi$ via 16-bit shift/mask operations.

## Hypothesis & Characteristics
- **Hypothesis**: Reduces the number of multiplications from 4 down to 2 by exploiting the 48-bit exact range of JavaScript floating-point numbers.

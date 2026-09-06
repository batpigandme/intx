# Asymmetric 16x32 Float Split (`imul` Lo) (`limb16-float48-imul-lo`)

## Approach Overview
This candidate computes only two 48-bit exact products ($a_l \cdot b$ and $a_h \cdot b$) in IEEE-754 double precision to derive $hi$, and computes $lo$ in 1 hardware instruction via `Math.imul(a, b)`:
1. $P_l = a_l \cdot b, \quad P_h = a_h \cdot b$.
2. $P_{l\_hi} = \lfloor P_l / 65536 \rfloor$.
3. $hi = \lfloor (P_h + P_{l\_hi}) / 65536 \rfloor \mathbin{>>>} 0$.
4. $lo = \text{Math.imul}(a, b) \mathbin{>>>} 0$.

## Hypothesis & Characteristics
- **Hypothesis**: Combines 48-bit exact float arithmetic for carry accumulation with direct 32-bit hardware integer multiplication for $lo$.

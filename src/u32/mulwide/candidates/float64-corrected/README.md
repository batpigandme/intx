# Double-Precision Float with Exact Correction (`float64-corrected`)

## Approach Overview
This candidate calculates wide multiplication using standard JavaScript 64-bit floating-point numbers combined with analytical error correction:
1. $lo = \text{Math.imul}(a, b) \mathbin{>>>} 0$.
2. $P_{\text{float}} = a \cdot b$.
3. $hi = ((P_{\text{float}} - lo) \cdot 2^{-32} + 0.5) \mathbin{>>>} 0$.

## Mathematical Proof of 100% Exactness
- The maximum rounding error in IEEE-754 double precision (53-bit mantissa) for $P < 2^{64}$ is at most $|\epsilon| \le 1024$.
- Subtracting exact integer $lo$ yields $hi \cdot 2^{32} + \epsilon$.
- Multiplying by $2^{-32}$ yields $hi + (\epsilon \cdot 2^{-32})$, where $|\epsilon \cdot 2^{-32}| \le 2.38 \times 10^{-7} \ll 0.5$.
- Adding $0.5$ and applying unsigned truncation (`>>> 0`) completely cancels the residual error, recovering exact $hi$.

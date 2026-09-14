# BigInt with `asUintN(64)` + `Math.imul` Lo (`bigint-as-uint64-imul-lo`)

## Approach Overview
This candidate uses `BigInt.asUintN(64, a * b)` strictly for deriving the high 32 bits, and computes $lo$ in 1 cycle using `Math.imul(a, b)`:
1. `prod = BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0))`
2. `hi = Number(BigInt.asUintN(32, prod >> 32n))`
3. `lo = Math.imul(a, b) >>> 0`

## Hypothesis & Characteristics
- **Hypothesis**: Combines BigInt mathematical precision for $hi$ with direct 32-bit hardware ALU integer multiplication for $lo$.

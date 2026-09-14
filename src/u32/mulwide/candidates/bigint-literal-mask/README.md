# BigInt Baseline (`bigint-literal-mask`)

## Approach Overview
This candidate implements wide multiplication using JavaScript's native `BigInt` arbitrary-precision type with inline literal constants:
1. `prod = BigInt(a >>> 0) * BigInt(b >>> 0)`
2. `hi = Number(prod >> 32n) >>> 0`
3. `lo = Number(prod & 0xffffffffn) >>> 0`

## Hypothesis & Characteristics
- **Oracle Baseline**: Serves as the authoritative ground-truth reference for fuzz testing.
- **Heap Overhead**: Creates 3 temporary BigInt heap objects (`prod`, `0xffffffffn`, and the `&` result), causing high GC pressure.

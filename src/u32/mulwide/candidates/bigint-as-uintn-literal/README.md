# BigInt with `asUintN(64, 32)` (Literal Shift) (`bigint-as-uintn-literal`)

## Approach Overview
This candidate clamps the product to 64 bits and extracts both 32-bit limbs using `BigInt.asUintN`:
1. `prod = BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0))`
2. `hi = Number(BigInt.asUintN(32, prod >> 32n))`
3. `lo = Number(BigInt.asUintN(32, prod))`

## Hypothesis & Characteristics
- **Hypothesis**: Clamping the product to 64 bits guarantees V8 treats the BigInt as a single 64-bit digit word internally, unlocking fast-path C++ truncation and achieving **~8.6 Mops/s** (2.4x faster than baseline BigInt).

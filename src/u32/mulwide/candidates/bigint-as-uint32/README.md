# BigInt with `asUint32` Low Word (`bigint-as-uint32`)

## Approach Overview
This candidate replaces the heap-allocating bitwise `prod & 0xffffffffn` operation with the native `BigInt.asUintN(32, prod)` standard method:
1. `prod = BigInt(a >>> 0) * BigInt(b >>> 0)`
2. `hi = Number(prod >> 32n) >>> 0`
3. `lo = Number(BigInt.asUintN(32, prod))`

## Hypothesis & Characteristics
- **Hypothesis**: `BigInt.asUintN(32, prod)` reads the internal 64-bit digit directly in C++ without instantiating an intermediate BigInt result object on the heap, saving 1 heap allocation per call.

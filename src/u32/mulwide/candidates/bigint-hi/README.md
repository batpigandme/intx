# BigInt Direct High-Word with `asUintN(32)` (`bigint-hi`)

## Approach Overview
This candidate computes the high 32 bits by evaluating `BigInt.asUintN(32, ...)` directly on the shifted 64-bit product in a single inline expression, bypassing local variable assignments:
```javascript
out[0] = Number(
  BigInt.asUintN(
    32,
    BigInt.asUintN(64, BigInt(a >>> 0) * BigInt(b >>> 0)) >> 32n
  )
);
out[1] = Math.imul(a, b) >>> 0;
```

## Hypothesis & Characteristics
- **Hypothesis**: Evaluates single-expression inline evaluation of 64-bit clamped BigInt multiplication with 32-bit truncation and hardware `imul` low word.

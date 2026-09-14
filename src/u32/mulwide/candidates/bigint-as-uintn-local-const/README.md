# BigInt with `asUintN(64, 32)` (Local Constant) (`bigint-as-uintn-local-const`)

## Approach Overview
This candidate declares `const S32 = 32n` directly inside the function scope to test stack-local BigInt constant allocation.

## Hypothesis & Characteristics
- **Hypothesis**: Evaluates whether function-local BigInt variable declarations incur stack re-allocation overhead vs module-level constants.

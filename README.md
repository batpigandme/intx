# intx

Ultra high-performance multi-word and scalar integer arithmetic for JavaScript and Node.js.

Designed from the ground up for V8 TurboFan, SpiderMonkey, and JavaScriptCore optimizing JIT compilers—delivering bare-metal assembly throughput with zero deoptimizations, zero allocations, and monomorphic type feedback.

---

## Namespaces & Architecture

The library is organized into modular integer namespaces according to word width and signedness:

| Namespace | Representation | Width | Primary Use Case |
| :--- | :--- | :--- | :--- |
| **`intx.i32`** | Scalar Signed Int32 (`number`) | 32-bit | Fast modular arithmetic, CPU hardware intrinsics (`idivl`, `imull`, `roll`, `clz32`). |
| **`intx.u32`** | Scalar Unsigned Uint32 (`number`) | 32-bit | Unsigned arithmetic, widening multiplication (`mulhi`, `mulwide`). |
| **`intx.i64`** | Compound / Multi-word (`BigInt` / `Int32Array`) | 64-bit | 64-bit signed integer primitives. |
| **`intx.u64`** | Compound / Multi-word (`BigInt` / `Uint32Array`) | 64-bit | 64-bit unsigned integer primitives. |
| **`intx.u128`** | Multi-word (`Uint32Array` / `BigUint64Array`) | 128-bit | Multi-precision cryptography, hashing, and bignum arithmetic. |
| **`intx.const`** | Shared integer bitmasks and constants | — | Shared constants (`LOW_16`, `MASK_32`, `SIGN_BIT_32`). |
| **`intx.utils`** | Testing and random number utilities | — | Test vector generators (`randomU32`, `randomI32`). |

---

## Canonical Operation Conventions

`intx` follows strict, uniform naming and signature conventions across all namespaces:

1. **Widening Multiplication (`mulwide`)**:
   - `u32.mulwide(a, b, out)`: Computes the full 64-bit product of two 32-bit unsigned integers, storing `[hi, lo]` into `out[0]` and `out[1]`.
   - Canonical name is `mulwide` across all widths (e.g., `u64.mulwide` for 64 × 64 → 128 bits).
2. **High-Half Multiplication (`mulhi`)**:
   - `u32.mulhi(a, b)`: Returns the upper 32 bits of a 32 × 32-bit product as a 32-bit unsigned integer.
3. **Division, Modulo, and DivMod (`div`, `mod`, `divmod`)**:
   - `i32.div(a, b)`: 32-bit signed quotient (`a / b | 0`).
   - `i32.mod(a, b)`: 32-bit signed remainder (`a % b | 0`).
   - `i32.divmod(a, b, out)`: Simultaneous quotient and remainder (`out[0] = q`, `out[1] = r`) using single-divider algebraic identity optimization.
4. **Bit Rotations (`rotl`, `rotr`)**:
   - `i32.rotl(a, bits)`, `i32.rotr(a, bits)`: Hardware-recognized 32-bit circular rotations.
5. **Count Leading Zeros (`clz`)**:
   - `i32.clz(a)`: Hardware `lzcnt` / `bsr` intrinsic wrapper (`Math.clz32`).

---

## Installation & Usage

```bash
npm install intx
```

### Example: Scalar `i32` & Widening `u32` Arithmetic

```javascript
const { i32, u32 } = require("intx");

// Pure 1-cycle integer addition (prevents Float64 promotion)
const sum = i32.add(0x7fffffff, 1); // -2147483648

// High 32 bits of 32x32 unsigned multiplication
const hi = u32.mulhi(0xffffffff, 0xffffffff); // 0xfffffffe

// Widening 32x32 -> 64-bit multiplication into an out-buffer
const wideOut = new Uint32Array(2);
u32.mulwide(0xffffffff, 0xffffffff, wideOut);
console.log(wideOut[0], wideOut[1]); // 0xfffffffe (hi), 0x00000001 (lo)

// Simultaneous quotient & remainder
const divOut = new Int32Array(2);
i32.divmod(-10, 3, divOut);
console.log(divOut[0], divOut[1]); // -3 (quotient), -1 (remainder)
```

---

## Development & Benchmarking

### Running Tests
```bash
npm test
```

### Running Showdown Benchmarks
```bash
# Intrinsic scalar operations showdown (add, sub, mul, div, mod, divmod, rotl, rotr, clz)
npm run i32:showdown

# Multiplier execution patterns (scalar recurrence vs parallel unrolling vs buffer walk)
npm run i32:mul:showdown

# Widening 32x32 multiplication candidate tournament
npm run u32:mulwide:showdown

# High-half multiplication candidate tournament
npm run u32:mulhi:showdown
```

---

## License

Apache-2.0 © [Abdul Kaium](https://github.com/impawstarlight)

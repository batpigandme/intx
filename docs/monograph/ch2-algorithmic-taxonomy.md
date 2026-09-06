# Chapter 2: The 5 Algorithmic Families — A Mathematical & Evolutionary Taxonomy

To solve the 64-bit wide multiplication problem ($32 \times 32 \to 64$-bit $[hi, lo]$) within JavaScript's 53-bit floating point and 32-bit bitwise runtime constraints, we investigated **20 distinct evolutionary candidates** organized into **5 fundamental algorithmic families**.

```
+-------------------------------------------------------------------------------------------------------+
|                                    u32.wmul Algorithmic Taxonomy                                      |
+---------------------------+-----------------------------------+---------------------------------------+
| Family                    | Core Mathematical Mechanism       | Candidate Variations                  |
+---------------------------+-----------------------------------+---------------------------------------+
| 1. limb16-parallel        | 4-quadrant partial products       | bitwise-lo, imul-lo, imul-all, cached |
| 2. limb16-pipeline        | 3-stage carry forwarding          | bitwise-lo, imul-lo, imul-all, cached,|
|                           |                                   | imul-import                           |
| 3. limb16-float48         | Asymmetric 16x32 float mantissa   | bitwise-lo, imul-lo                   |
| 4. float64-corrected      | Exact float residual scaling      | corrected                             |
| 5. BigInt Variants        | Native BigInt digits & truncation | literal-mask, asUint32, asUint64,     |
|                           |                                   | module/local const, bigint-hi         |
+---------------------------+-----------------------------------+---------------------------------------+
```

---

## Family 1: `limb16-parallel` (Textbook 4-Quadrant Decomposition)

### Mathematical Derivation
The classic textbook method decomposes each 32-bit unsigned integer operand $a$ and $b$ into two 16-bit unsigned half-words (limbs):

$$a = a_h \cdot 2^{16} + a_l, \quad b = b_h \cdot 2^{16} + b_l$$

where $a_l, b_l = \text{operand} \mathbin{\&} \text{0xFFFF}$ and $a_h, b_h = \text{operand} \mathbin{>>>} 16$.

Expanding the algebraic product yields 4 independent partial products:

$$a \cdot b = (a_h \cdot 2^{16} + a_l)(b_h \cdot 2^{16} + b_l) = \underbrace{(a_l \cdot b_l)}_{p_0} + \underbrace{(a_h \cdot b_l)}_{p_1} \cdot 2^{16} + \underbrace{(a_l \cdot b_h)}_{p_2} \cdot 2^{16} + \underbrace{(a_h \cdot b_h)}_{p_3} \cdot 2^{32}$$

```
                ah          al
        ×       bh          bl
        -----------------------
               (al * bl)        <- p0 (0 to 32 bits)
        + (ah * bl) << 16       <- p1 (16 to 48 bits)
        + (al * bh) << 16       <- p2 (16 to 48 bits)
        + (ah * bh) << 32       <- p3 (32 to 64 bits)
```

Each partial product $p_i \le (2^{16} - 1)^2 = 4{,}294{,}836{,}225 < 2^{32}$, fitting comfortably into standard unsigned 32-bit integers.

To reassemble the 64-bit result:
1. **Middle Column Carry Sum**:
   $$\text{mid} = (p_0 \mathbin{>>>} 16) + (p_1 \mathbin{\&} \text{0xFFFF}) + (p_2 \mathbin{\&} \text{0xFFFF})$$
2. **High Word ($hi$)**:
   $$hi = p_3 + (p_1 \mathbin{>>>} 16) + (p_2 \mathbin{>>>} 16) + (\text{mid} \mathbin{>>>} 16)$$
3. **Low Word ($lo$)**:
   $$lo = (p_0 \mathbin{\&} \text{0xFFFF}) \mid ((\text{mid} \mathbin{\&} \text{0xFFFF}) \ll 16)$$

---

### Evolutionary Variations

#### 1.1 `limb16-parallel-bitwise-lo` (131.27 Mops/s)
Uses standard JavaScript arithmetic `*` for all 4 partial products and shifts/masks to assemble both `lo` and `hi`.

#### 1.2 `limb16-parallel-imul-lo` (237.71 Mops/s)
Replaces manual bitwise assembly of the low word with direct hardware `Math.imul(a, b) >>> 0`, providing a **1.81x speedup**.

#### 1.3 `limb16-parallel-imul-all` (238.55 Mops/s)
Replaces all 4 partial products $p_0, p_1, p_2, p_3$ with direct `Math.imul(limb_a, limb_b)`.

```javascript
function wmul(a, b, out) {
  const al = a & 0xffff, ah = a >>> 16;
  const bl = b & 0xffff, bh = b >>> 16;
  const p0 = Math.imul(al, bl);
  const p1 = Math.imul(ah, bl);
  const p2 = Math.imul(al, bh);
  const p3 = Math.imul(ah, bh);
  const mid = (p0 >>> 16) + (p1 & 0xffff) + (p2 & 0xffff);
  out[0] = (p3 + (p1 >>> 16) + (p2 >>> 16) + (mid >>> 16)) >>> 0;
  out[1] = Math.imul(a, b) >>> 0;
  return out;
}
```

#### 1.4 `limb16-parallel-imul-cached` (239.04 Mops/s)
Caches `const imul = Math.imul;` at the module level.

---

## Family 2: `limb16-pipeline` (Sequential Carry-Forwarding Pipeline)

### Mathematical Derivation
While `limb16-parallel` computes all 4 partial products independently and sums carries in a wide fan-in structure, `limb16-pipeline` organizes the carry resolution into a **3-stage forward carry chain**:

```mermaid
graph LR
    S0["Stage 0: ll = al * bl"] --> S1["Stage 1: hl = ah * bl + (ll >>> 16)"]
    S1 --> S2["Stage 2: lh = al * bh + (hl & 0xFFFF)"]
    S2 --> S3["Stage 3: hh = ah * bh + (hl >>> 16) + (lh >>> 16)"]
    S3 --> Out["hi = hh >>> 0<br/>lo = Math.imul(a, b) >>> 0"]
```

### Why Pipelining Reduces Register Pressure
In V8's TurboFan compiler, computing variables sequentially allows the register allocator (`LinearScanAllocator`) to immediately reuse registers for intermediate values (`ll`, `hl`, `lh`) rather than keeping all 4 products alive simultaneously on the stack frame.

---

### Evolutionary Variations

#### 2.1 `limb16-pipeline-bitwise-lo` (137.17 Mops/s)
Pipelined carry chain using `*` with bitwise low-word assembly `(ll & 0xffff) | (lh << 16)`.

#### 2.2 `limb16-pipeline-imul-lo` (240.12 Mops/s)
Pipelined carry chain with `Math.imul(a, b)` for the low word.

#### 2.3 `limb16-pipeline-imul-all` (238.31 Mops/s)
Pipelined carry chain replacing all internal products with `Math.imul`.

#### 2.4 `limb16-pipeline-imul-cached` (240.20 Mops/s)
Pipelined carry chain with cached `const imul = Math.imul`.

#### 2.5 `limb16-imul-import` (242.13 Mops/s — GRAND WINNER 🏆)
Imports a dedicated helper function `mul(a, b)` from `src/u32/mul` (`Math.imul(a, b) >>> 0`). TurboFan's inliner inlines the single-expression helper cleanly, and the explicit `>>> 0` type feedback helps the register allocator produce optimal x86-64 code.

```javascript
const mul = require('../../../mul');
const LOW_16 = 0xffff;

function wmul(a, b, out) {
  a >>>= 0; b >>>= 0;
  const ah = a >>> 16, al = a & LOW_16;
  const bh = b >>> 16, bl = b & LOW_16;

  const albl = mul(al, bl);
  const llh = albl >>> 16;

  const ahbl = (mul(ah, bl) + llh) >>> 0;
  const hll = ahbl & LOW_16;
  const hlh = ahbl >>> 16;

  const albh = (mul(al, bh) + hll) >>> 0;
  const lhh = albh >>> 16;

  out[0] = (mul(ah, bh) + hlh + lhh) >>> 0;
  out[1] = mul(a, b);
  return out;
}
```

---

## Family 3: `limb16-float48` (Asymmetric Float Mantissa Deconstruction)

### Mathematical Derivation
Can we exploit the 53-bit floating point range by splitting only **one** operand into 16-bit limbs, while leaving the second operand as a full 32-bit integer?

Let $a = a_h \cdot 2^{16} + a_l$ and leave $b \in [0, 2^{32}-1]$ intact:

$$a \cdot b = (a_l \cdot b) + (a_h \cdot b) \cdot 2^{16}$$

Notice the maximum magnitude of the partial products:

$$\max(a_l \cdot b) = (2^{16} - 1)(2^{32} - 1) = 2^{48} - 2^{32} - 2^{16} + 1 < 2^{48}$$

Since $2^{48} < 2^{53} = \text{Number.MAX\_SAFE\_INTEGER}$, **both partial products fit exactly in IEEE 754 float mantissas without losing a single bit of precision!**

Carries can be extracted via floating-point reciprocal multiplication:

$$\text{mid} = \lfloor p_0 \cdot \frac{1}{65536} \rfloor, \quad hi = \lfloor (p_1 + \text{mid}) \cdot \frac{1}{65536} \rfloor$$

```javascript
function wmul(a, b, out) {
  const al = a & 0xffff, ah = a >>> 16, u = b >>> 0;
  const p0 = al * u;
  const p1 = ah * u;
  const mid = (p0 * (1 / 65536)) | 0;
  const hi = (p1 + mid) * (1 / 65536);
  out[0] = hi >>> 0;
  out[1] = Math.imul(a, b) >>> 0;
  return out;
}
```

- **`limb16-float48-bitwise-lo`**: 48.96 Mops/s (penalized heavily by float $\leftrightarrow$ integer domain transitions).
- **`limb16-float48-imul-lo`**: 163.37 Mops/s.

---

## Family 4: `float64-corrected` (Exact Double Precision Residual Scaling)

### Mathematical Derivation
What if we compute the full product directly using double precision float multiplication $u \cdot v$?

Because $u \cdot v$ exceeds 53 bits by up to 11 bits, the lowest 11 bits in the float product are rounded:

$$u \cdot v = P_{\text{exact}} + \epsilon, \quad \text{where } |\epsilon| < 2^{11}$$

However, we can compute the **exact low 32 bits** using native integer arithmetic:

$$lo = \text{Math.imul}(u, v) \mathbin{>>>} 0 = P_{\text{exact}} \pmod{2^{32}}$$

Subtracting $lo$ from the floating-point product removes the lowest 32 bits:

$$d = u \cdot v - lo \approx hi \cdot 2^{32}$$

Multiplying $d$ by the exact reciprocal $2^{-32} = 2.3283064365386963 \times 10^{-10}$ and adding a half-ulp rounding bias of $+0.5$ reconstructs the exact high word $hi$:

$$hi = \lfloor d \cdot 2^{-32} + 0.5 \rfloor \mathbin{>>>} 0$$

```javascript
function wmul(a, b, out) {
  const u = a >>> 0;
  const v = b >>> 0;
  const lo = Math.imul(u, v) >>> 0;
  const d = u * v - lo;
  const hi = (d * 2.3283064365386963e-10 + 0.5) >>> 0;
  out[0] = hi;
  out[1] = lo;
  return out;
}
```

- **Performance**: **220.21 Mops/s** (91% of peak integer pipeline performance, with only 3 arithmetic lines of code!).

---

## Family 5: `bigint` (The Oracle, Boxing Overhead & Escape Analysis)

The ES2020 `BigInt` primitive represents arbitrarily large integers, providing a built-in mathematical oracle:

```javascript
const prod = BigInt(a >>> 0) * BigInt(b >>> 0);
out[0] = Number(prod >> 32n);
out[1] = Number(prod & 0xffffffffn);
```

### The 7 BigInt Variations Evaluated:
1. **`bigint-literal-mask` (4.17 Mops/s)**: Naive `>> 32n` and `& 0xffffffffn`.
2. **`bigint-as-uint32` (4.74 Mops/s)**: Using `BigInt.asUintN(32, prod)` for `lo`.
3. **`bigint-as-uintn-literal` (10.53 Mops/s)**: Pre-truncating the product with `BigInt.asUintN(64, ...)` with inline `32n` literal.
4. **`bigint-as-uintn-local-const` (10.68 Mops/s)**: Local `const S32 = 32n`.
5. **`bigint-as-uintn-module-const` (10.72 Mops/s)**: Module-scoped `const SHIFT_32 = 32n`.
6. **`bigint-as-uint64-imul-lo` (17.48 Mops/s)**: Extracting `hi` via BigInt and `lo` via `Math.imul(a, b)`.
7. **`bigint-hi` (17.56 Mops/s)**: Single inline `Number(BigInt.asUintN(32, BigInt.asUintN(64, a * b) >> 32n))` + `Math.imul`.

---

In [**Chapter 3: Under the Hood: V8 TurboFan, Machine Lowering & Compiler Mechanics**](ch3-v8-compiler-mechanics.md), we explore the low-level machine code generated by V8 for each of these families.

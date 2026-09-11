# Miscellaneous V8 & JavaScript Runtime Notes

Technical notes on V8 engine internals, memory representations, pointer tagging, NaN-boxing, engine comparisons, and historical design choices.

---

## 1. Value Representation Across JavaScript Engines

| Engine / Runtime | Value Strategy | Integer Range | Double (Float64) Storage | Pointer Compression |
| :--- | :--- | :--- | :--- | :---: |
| **Google V8 (Node.js)** | **Pointer Tagging** | **32-bit Signed**<br>`[-2,147,483,648, +2,147,483,647]` | Boxed **`HeapNumber`** on heap | ❌ Disabled |
| **Google V8 (Chrome)** | **Pointer Tagging** | **31-bit Signed**<br>`[-1,073,741,824, +1,073,741,823]` | Boxed **`HeapNumber`** on heap | ✅ Enabled (4GB cage) |
| **Safari (JavaScriptCore)** | **NaN-Boxing (`JSValue`)** | **32-bit Signed**<br>`[-2,147,483,648, +2,147,483,647]` | **Unboxed Double** (in NaN payload) | ❌ N/A (64-bit value) |
| **Firefox (SpiderMonkey)** | **Punned NaN-Boxing** | **32-bit Signed**<br>`[-2,147,483,648, +2,147,483,647]` | **Unboxed Double** (in NaN payload) | ❌ N/A (64-bit value) |

---

## 2. Deep Dive: NaN-Boxing (Safari & Firefox) vs. Pointer Tagging (V8)

### How NaN-Boxing Works (IEEE 754 Payload Reuse)
In a 64-bit IEEE 754 double, a **Quiet NaN** has exponent `0x7FF` and the top fraction bit set to `1`, leaving **51 unused payload bits**. 
JSC and SpiderMonkey use those unused 51 bits to encode:
- **Int32**: Stored directly in lower 32 bits with an `0xFFFE...` tag.
- **Pointers**: Stored directly with an `0xFFFF...` tag.
- **Booleans / Null / Undefined**: Encoded as specific bit patterns.
- **Doubles**: Stored raw as unboxed 64-bit floats with zero heap allocation!

### Why V8 Chose Pointer Tagging Instead
1. **32-bit Heritage (2006-2008)**: On 32-bit x86, a V8 tagged pointer took only **4 bytes (32 bits)**. NaN-boxing requires **8 bytes (64 bits)**, which would have doubled memory usage on every 32-bit computer.
2. **Pointer Compression (4-Byte Slots on 64-bit)**: In 64-bit Chrome, V8 confines heaps to a 4GB virtual cage, halving the size of object pointers and Smis to 32 bits. NaN-boxing cannot physically compress below 64 bits.
3. **Zero-Cost Pointer Dereferencing**: In V8, pointer dereference is `mov rax, [rdi - 1]` (0-cycle base-displacement addressing). In NaN-boxing, pointer tags must be masked out (`and rax, 0x00007FFFFFFFFFFF`).

---

## 3. Why JavaScript Was Designed with Only One `Number` (Float64)

- **The 10-Day Creation (May 1995)**: Brendan Eich had 10 days to build JS for non-programmer web designers. Integer division (`5 / 2 = 2` in C/Java) was considered too confusing for beginners.
- **Float64 Exact Integers**: IEEE 754 float64 can represent exact integers up to $9,007,199,254,740,991$ ($2^{53}-1$) *and* fractions (`5 / 2 = 2.5`) in one type.
- **"Don't Break the Web"**: TC39 could never change `Number` to integer division without breaking the web. Instead, specialized types were layered on later:
  - **TypedArrays (`Int32Array`, `Uint32Array`)**: WebGL & linear buffers.
  - **`BigInt` (`BigUint64Array`)**: 64-bit / arbitrary-precision integers.
  - **WebAssembly (Wasm)**: Bare-metal `i32`, `i64`, `f32`, `f64`.

---

## 4. The Signed Smi Dilemma & `0xDEADBEEF`

1. **Why Smis are Strictly Signed**:
   - A 32-bit slot can represent $2^{32} = 4.29$ billion discrete values.
   - Representing both negative numbers (`-1`, loop decrements, subtractions) and positive numbers up to $4.29$ billion requires **33 bits**.
   - Almost all ECMAScript operations (`|`, `&`, `^`, `<<`, `>>`) return `ToInt32` (Signed 32-bit). Only `>>>` returns `ToUint32`.
2. **The Boundary Behavior**:
   - `0xDEADBEEF >>> 0` ($+3,735,928,559$): Exceeds $+2^{31}-1$, forcing V8 to allocate a boxed `HeapNumber` (Float64).
   - `0xDEADBEEF | 0` ($-559,038,737$): Because its binary starts with `11` (`0xD`), it fits in 31-bit two's complement ($[-2^{30}, 2^{30}-1]$) as well as 32-bit Smi, avoiding heap allocation.
3. **Machine Code Bloat**:
   - `HeapNumber` operands force TurboFan to generate a **~92-byte fallback path** (`vmovsd`, `vcvttsd2siq`, `call DoubleToI`).
   - Smi operands (`| 0`) eliminate the entire float-handling path, shrinking compiled functions from 232 bytes to **140 bytes**.

---

## 5. Modern JavaScript Engine Performance Comparison

| Metric / Workload | Winner | Architectural Details |
| :--- | :--- | :--- |
| **DOM & UI Responsiveness (Speedometer 3.0)** | **JavaScriptCore** (Safari) | Low-overhead ICs, specialized DOM bindings on WebKit. |
| **Startup Time & CLI Tooling** | **JavaScriptCore** (Bun / Safari) | Low-Level Interpreter (**LLInt**) in handcrafted assembly; minimal warmup latency. |
| **Peak Throughput (Long-running servers)** | **Tie (V8 vs. JSC)** | V8 TurboFan and JSC FTL/B3 generate top-tier speculative assembly. |
| **WebAssembly (Wasm)** | **V8** (Chrome / Node) | Two-tier Wasm pipeline: **Liftoff** (instant baseline) + **TurboFan** (peak optimization). |
| **Memory Footprint (Large Object Graphs)** | **V8** (Chrome) | **Pointer Compression** halves pointer/Smi memory consumption in browser tabs. |

### Compilation Pipelines

```text
Google V8:
  Ignition (Interpreter) -> Sparkplug (Baseline JIT) -> Maglev (Mid-Tier SSA JIT) -> TurboFan (Optimizing JIT)

Apple JavaScriptCore:
  LLInt (Low-Level ASM Interpreter) -> Baseline JIT -> DFG (Data Flow Graph JIT) -> FTL / B3 (Bare Bones Backend)
```

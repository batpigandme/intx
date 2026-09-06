# 01. Memory, Representation & The V8 Type System

To write assembly-fast integer algorithms in JavaScript, a developer must understand how values are physically represented in memory by the engine. High-level JavaScript variables do not exist in a vacuum; they are concrete binary bit-patterns managed by V8's memory subsystem.

---

## 1.1 Smi (Small Integer) Representation & Pointer Tagging

In V8, all JavaScript values are passed around as **Tagged Pointers** (represented internally as `v8::internal::Tagged<Object>`).

On 64-bit architectures (x86-64, ARM64), memory addresses are naturally 8-byte aligned (i.e., the lowest 3 bits of any valid heap pointer are always `000_2`). V8 exploits this alignment to store small integers directly inside pointer words without allocating heap objects. This technique is called **Pointer Tagging**.

```
64-bit Word Representation on x86-64:

1. HeapObject Pointer Tag (LSB = 1):
 63                                                           3   2   1   0
+-----------------------------------------------------------+---+---+---+
|                  48-bit Canonical Heap Address            | 0 | 0 | 1 |  (Tag: HeapObject)
+-----------------------------------------------------------+---+---+---+

2. Smi (Small Integer) Tag (LSB = 0):
 63                             32 31                             1   0
+---------------------------------+---------------------------------+---+
|       31-bit Signed Payload     |            31 Zero Bits         | 0 |  (Tag: Smi)
+---------------------------------+---------------------------------+---+
```

### Key Properties of Smis:
- **Zero Allocation**: A Smi lives entirely in CPU registers (`rax`, `rdx`, `rcx`) or on the C++ execution stack. It requires 0 bytes of heap memory.
- **Range**: On 64-bit V8, a Smi represents a **31-bit signed integer**:
  $$\text{Smi Range} = [-2^{30}, 2^{30} - 1] = [-1{,}073{,}741{,}824, +1{,}073{,}741{,}823]$$
- **32-Bit Unsigned Integer Danger**: An unsigned 32-bit integer ($[0, 2^{32}-1]$) exceeds the 31-bit signed Smi range whenever its value is $\ge 2^{31}$ (`0x80000000` to `0xFFFFFFFF`).

When an arithmetic operation produces a number that does not fit into a Smi, V8 is forced to **box** the value into a **HeapNumber**.

---

## 1.2 HeapNumber Boxing & The Deoptimization Penalty

A `HeapNumber` is a physical JavaScript heap object allocated in V8's Young Generation (NewSpace). Its layout consists of:
1. **Map Pointer** (4 or 8 bytes): Points to the `HeapNumber` hidden class descriptor.
2. **Float64 Payload** (8 bytes): The actual IEEE 754 double-precision floating point value.

```
V8 HeapNumber Layout (16 Bytes on 64-bit Heap):
+-----------------------------------+-----------------------------------+
|     Map Word / Class Metadata     |   64-bit IEEE 754 Double Payload  |
+-----------------------------------+-----------------------------------+
 0                                 8 8                                16
```

### The Cost of Unintentional Boxing:
If your inner loop performs an operation that produces an out-of-Smi value and fails to keep it unboxed in TurboFan registers:
1. A 16-byte `HeapNumber` object is allocated via the young-generation allocation pointer (`top`).
2. When the young-generation nursery (typically 16MB to 64MB) fills up, V8 triggers a synchronous **Scavenge Garbage Collection**.
3. All live pointers must be traced, copied, and evacuated to survivor space, stalling execution for 2–15 milliseconds.

---

## 1.3 Inside the BigInt Memory Architecture

Why does `BigInt` have such high overhead for local 32-bit and 64-bit integer arithmetic? Let us inspect the V8 C++ source code definition (`src/objects/bigint.h`):

```cpp
// V8 Source: src/objects/bigint.h
class BigIntBase : public HeapObject {
 public:
  using digit_t = uintptr_t; // 64-bit unsigned integer on x64

 private:
  int length_;      // Number of 64-bit digit words
  uint32_t flags_;  // Sign bit + read-only bitfields
  digit_t digits_[0]; // Flexible array of 64-bit words
};
```

On a 64-bit machine, allocating even a tiny `BigInt(1n)` consumes **24 bytes of heap memory**:
- 8 bytes: `Map` pointer
- 4 bytes: `length_` word
- 4 bytes: `flags_` word
- 8 bytes: `digits_[0]` (uint64_t payload)

### Memory Trace of a 32x32 -> 64-bit BigInt Multiplication:
When you execute:
```javascript
const prod = BigInt(a >>> 0) * BigInt(b >>> 0);
const hi = Number(prod >> 32n);
const lo = Number(prod & 0xffffffffn);
```

V8 executes the following memory allocations:

```
Step 1: BigInt(a >>> 0)          --> Allocates 24B (NewSpace)
Step 2: BigInt(b >>> 0)          --> Allocates 24B (NewSpace)
Step 3: BigIntMultiply(op1, op2) --> Allocates 24B (NewSpace)
Step 4: BigIntShiftRight(prod)   --> Allocates 24B (NewSpace)
Step 5: BigIntBitwiseAnd(prod)   --> Allocates 24B (NewSpace)
-------------------------------------------------------------
Total Memory Allocation per Multiply: 120 Bytes!
```

At $10{,}000{,}000$ multiplications per second, this consumes **1.2 Gigabytes of heap memory per second**, keeping the garbage collector in continuous high-frequency scavenging loops!

---

## 1.4 The Zero-Allocation Procedural Memory Contract

To achieve maximum possible throughput, `intx` enforces a strict **Zero-Allocation Procedural Memory Contract**:

```javascript
// ✅ ZERO ALLOCATIONS: Caller supplies pre-allocated Uint32Array
function wmul(a, b, out) {
  out[0] = hi;
  out[1] = lo;
  return out;
}
```

### Why Passing Destination Buffers Works:
1. **Unboxed Register Execution**: Inside the body of `wmul`, all intermediate calculations (`al`, `ah`, `bl`, `bh`, `ll`, `hl`, `lh`, `hh`) fit entirely within unboxed 32-bit CPU registers.
2. **Direct Memory Store**: Writing `out[0] = hi` and `out[1] = lo` compiles directly to two scalar memory store instructions:
   ```nasm
   movl %ecx, (%rdi)       ; Store hi to out[0]
   movl %eax, 4(%rdi)      ; Store lo to out[1]
   ```
3. **Zero Heap Allocations**: No temporary arrays, no objects, no Smis, and no BigInts are allocated in the heap. The memory footprint of the function call is **0 bytes**.

---

In [**Chapter 02: TurboFan JIT Compiler Mechanics & Assembly Lowering**](02-turbofan-lowering-and-assembly.md), we explore how TurboFan translates these procedural expressions into raw machine code.

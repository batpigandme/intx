# Parallel 16-Bit Limb Split (Cached `imul`, Smi / `| 0`) (`limb16-parallel-imul-cached-smi`)

## Approach Overview
This candidate implements the parallel 16-bit limb split using a cached `imul = Math.imul` reference and signed 32-bit integer (`| 0`) coercions throughout.

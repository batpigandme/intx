# Pipelined 16-Bit Limb Split (Cached `imul`, Smi / `| 0`) (`limb16-pipeline-imul-cached-smi`)

## Approach Overview
This candidate implements the 2-stage pipelined 16-bit limb split using cached `imul = Math.imul` and signed 32-bit integer (`| 0`) coercions throughout.

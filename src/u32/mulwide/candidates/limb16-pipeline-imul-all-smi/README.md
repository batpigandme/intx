# Pipelined 16-Bit Limb Split (All `imul`, Smi / `| 0`) (`limb16-pipeline-imul-all-smi`)

## Approach Overview
This candidate implements the 2-stage pipelined 16-bit limb split using direct `Math.imul` for all multiplications and signed 32-bit integer (`| 0`) coercions throughout.

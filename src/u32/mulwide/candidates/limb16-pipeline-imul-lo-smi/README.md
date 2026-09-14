# Pipelined 16-Bit Limb Split (`imul` Lo, Smi / `| 0`) (`limb16-pipeline-imul-lo-smi`)

## Approach Overview
This candidate implements the 2-stage pipelined 16-bit limb split using signed 32-bit integer (`| 0`) coercions throughout.

# Pipelined 16-Bit Limb Split (Bitwise Lo) (`limb16-pipe-bitwise-lo`)

## Approach Overview
This candidate chains 16-bit intermediate carry calculations sequentially through a 3-stage pipeline:
1. $albl = al \cdot bl \implies lll = albl \ \& \ \text{0xFFFF}, \; llh = albl \gg 16$.
2. $ahbl = ah \cdot bl + llh \implies hll = ahbl \ \& \ \text{0xFFFF}, \; hlh = ahbl \gg 16$.
3. $albh = al \cdot bh + hll \implies lhl = albh \ \& \ \text{0xFFFF}, \; lhh = albh \gg 16$.
4. $lo = (lll \ | \ (lhl \ll 16)) \mathbin{>>>} 0$.
5. $hi = (ah \cdot bh + hlh + lhh) \mathbin{>>>} 0$.

## Hypothesis & Characteristics
- **Hypothesis**: Forwards carries immediately to keep variable lifetimes short, allowing registers to be recycled across pipeline stages without spills.

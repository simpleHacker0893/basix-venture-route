"""Deterministic route assembly (planning/DOMAIN.md §Team assembly, D-09, D-22, D-23).

Pure Python over typed engine results. Nothing here queries the MeTTa space or selects a
builder on its own judgement: the engine says who is eligible, the assembler only orders and
bounds covering subsets by team size and budget.
"""

"""LLM adapters (D-06, PRD §5.7).

The language model translates and explains. It never selects people, invents proof, sets the
route status, or receives raw graph data: `extract_brief` returns optional brief fields and
`explain_route` returns a summary string for a structured `VentureRoute`.
"""

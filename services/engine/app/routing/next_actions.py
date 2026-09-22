"""Fixed next-action table for the assembler gaps (requirements.md §Business rules, D-22).

The `skill`, `availability`, `mode` and `location` gaps and their next actions are produced by the
MeTTa `route-gap` rule through the engine adapter (Sprint 000); only the two assembler rules
phrase their actions here.
"""


def raise_daily_budget(total: int) -> list[str]:
    return [f"Raise daily budget to USD {total}"]


def raise_team_size(size: int) -> list[str]:
    return [f"Raise maximum team size to {size}"]


def budget_statement(total: int, budget: int) -> str:
    return f"Cheapest verified team costs USD {total} a day; budget is USD {budget}"


def team_size_statement(size: int, maximum: int) -> str:
    return f"Smallest verified team needs {size} people; maximum team size is {maximum}"

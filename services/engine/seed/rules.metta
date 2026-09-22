; Named MeTTa rules (planning/DOMAIN.md "Named rules"). Rule names are fixed; do not add
; new ones without a DECISIONS entry. Each rule returns witnesses that carry the exact facts
; it matched, so the adapter can build a ReasoningPath without re-deriving anything in Python.
;
; Brief facts are added to the space by the adapter for the duration of a query:
;   (brief-skill <brief> <skill>) (brief-vertical <brief> <vertical>) (brief-mode <brief> <mode>)
;   (brief-location <brief> <location>) (brief-window <brief> <start> <end>) (brief-prefers-ip <brief>)
; Engine constants: (min-overlap-days <n>) from settings (D-08).

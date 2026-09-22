; Named MeTTa rules (planning/DOMAIN.md "Named rules"). Rule names are fixed; do not add
; new ones without a DECISIONS entry. Each rule returns witnesses that carry the exact facts
; it matched, so the adapter can build a ReasoningPath without re-deriving anything in Python.
;
; Brief facts are added to the space by the adapter for the duration of a query:
;   (brief-skill <brief> <skill>) (brief-vertical <brief> <vertical>) (brief-mode <brief> <mode>)
;   (brief-location <brief> <location>) (brief-window <brief> <start> <end>) (brief-prefers-ip <brief>)
; Engine constants: (min-overlap-days <n>) from settings (D-08).

; ---- verified-for-skill (b s) -> (evidence <credential|project> (facts...)) ----
; A confirmed credential proves the skill, or a confirmed completed project demonstrates it.
; Self-described skills are never consulted here (AGENTS.md non-negotiable 4).
(= (verified-for-skill $b $s)
   (match &self (, (earned $b $c) (proves $c $s) (confirmed $adm $c))
      (evidence credential ((earned $b $c) (proves $c $s) (confirmed $adm $c)))))
(= (verified-for-skill $b $s)
   (match &self (, (built $b $p) (demonstrates $p $s) (confirmed $adm $p))
      (evidence project ((built $b $p) (demonstrates $p $s) (confirmed $adm $p)))))

; ---- mode-compatible (brief b) -> (mode-path (facts...)) ----
; The builder supports a mode the brief accepts; on-site briefs also need the builder's location.
(= (mode-compatible $brief $b)
   (match &self (, (brief-mode $brief $m) (mode-accepts $m $bm) (supports-mode $b $bm))
      (case $m
        ((on-site (match &self (, (brief-location $brief $loc) (located-in $b $loc))
                     (mode-path ((brief-mode $brief on-site) (supports-mode $b on-site)
                                 (brief-location $brief $loc) (located-in $b $loc)))))
         ($_ (mode-path ((brief-mode $brief $m) (mode-accepts $m $bm) (supports-mode $b $bm))))))))

; ---- available-for-brief (brief b) -> (avail-path (facts...)) ----
; overlap-days is a Python-grounded atom (date arithmetic only); the rule is MeTTa.
(= (available-for-brief $brief $b)
   (match &self (, (brief-window $brief $bs $be) (available $b $s $e) (min-overlap-days $min))
      (if (>= (overlap-days $s $e $bs $be) $min)
          (avail-path ((brief-window $brief $bs $be) (available $b $s $e) (min-overlap-days $min)))
          (empty))))

; ---- partner-fit (brief b) -> (partner p u c (facts...)) ----
; Four hops (D-07): brief vertical -> supports-vertical partner -> partners-with university
;                    -> cohort-of cohort -> belongs-to builder.
(= (partner-fit $brief $b)
   (match &self (, (brief-vertical $brief $v) (supports-vertical $p $v) (partners-with $p $u)
                   (cohort-of $c $u) (belongs-to $b $c))
      (partner $p $u $c ((supports-vertical $p $v) (partners-with $p $u)
                         (cohort-of $c $u) (belongs-to $b $c)))))

; ---- reuse-fit (brief) -> (reuse asset s (facts...)) ----
; Only when the brief prefers reusable IP: licensable, same vertical, demonstrates a required skill.
(= (reuse-fit $brief $asset)
   (match &self (, (brief-prefers-ip $brief) (brief-vertical $brief $v) (licensable $asset)
                   (vertical $asset $v) (brief-skill $brief $s) (demonstrates $asset $s))
      (reuse $asset $s ((brief-prefers-ip $brief) (licensable $asset) (vertical $asset $v)
                        (brief-skill $brief $s) (demonstrates $asset $s)))))

; ---- route-gap (brief s category) -> (gap category s) ----
; Per required skill: no verified builder -> skill; verified but none available -> availability;
; verified and available but none mode-compatible -> mode, or location when the brief is on-site
; and a verified, available builder supports on-site somewhere else.
(= (route-gap $brief $s skill)
   (let* (((brief-skill $brief $s) (match &self (brief-skill $brief $s) (brief-skill $brief $s))))
     (if (== (collapse (verified-for-skill $b $s)) ())
         (gap skill $s)
         (empty))))
(= (route-gap $brief $s availability)
   (let* (((brief-skill $brief $s) (match &self (brief-skill $brief $s) (brief-skill $brief $s))))
     (if (and (not (== (collapse (verified-for-skill $b $s)) ()))
              (== (collapse (verified-and-available $brief $s)) ()))
         (gap availability $s)
         (empty))))
(= (route-gap $brief $s mode)
   (let* (((brief-skill $brief $s) (match &self (brief-skill $brief $s) (brief-skill $brief $s))))
     (if (and (not (== (collapse (verified-and-available $brief $s)) ()))
              (and (== (collapse (verified-available-compatible $brief $s)) ())
                   (== (collapse (on-site-elsewhere $brief $s)) ())))
         (gap mode $s)
         (empty))))
(= (route-gap $brief $s location)
   (let* (((brief-skill $brief $s) (match &self (brief-skill $brief $s) (brief-skill $brief $s))))
     (if (and (== (collapse (verified-available-compatible $brief $s)) ())
              (not (== (collapse (on-site-elsewhere $brief $s)) ())))
         (gap location $s)
         (empty))))

; Helper conjunctions used only by route-gap (not rule names; they name no decision of their own).
(= (verified-and-available $brief $s)
   (let* (((evidence $ev $vf) (verified-for-skill $b $s))
          ((avail-path $af) (available-for-brief $brief $b)))
     $b))
(= (verified-available-compatible $brief $s)
   (let* (((evidence $ev $vf) (verified-for-skill $b $s))
          ((avail-path $af) (available-for-brief $brief $b))
          ((mode-path $mf) (mode-compatible $brief $b)))
     $b))
(= (on-site-elsewhere $brief $s)
   (let* (((evidence $ev $vf) (verified-for-skill $b $s))
          ((avail-path $af) (available-for-brief $brief $b))
          ((brief-mode $brief on-site) (match &self (brief-mode $brief on-site) (brief-mode $brief on-site)))
          ((supports-mode $b on-site) (match &self (supports-mode $b on-site) (supports-mode $b on-site))))
     $b))

; ---- eligible-builder (brief b s) -> (eligible b s ev (verified facts) (mode facts) (avail facts) (account fact)) ----
(= (eligible-builder $brief $b $s)
   (let* (((brief-skill $brief $s) (match &self (brief-skill $brief $s) (brief-skill $brief $s)))
          ((evidence $ev $vf) (verified-for-skill $b $s))
          ((mode-path $mf) (mode-compatible $brief $b))
          ((avail-path $af) (available-for-brief $brief $b))
          ((confirmed $adm $b) (match &self (confirmed $adm $b) (confirmed $adm $b))))
     (eligible $b $s $ev $vf $mf $af (confirmed $adm $b))))

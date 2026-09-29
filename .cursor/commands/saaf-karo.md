# Saaf karo — clean the room safely

Follow `docs/reference/OPERATOR.md`.
1. Call `plan_cleaning` and show the plan in 2–3 Hinglish lines (what it will collect, what it will leave, anything UNKNOWN).
2. If anything is UNKNOWN or protected, ask me before cleaning.
3. Then call `run_command` with the text "kachra saaf karo" (in dry_run it only describes; in full it starts).
4. While it runs, check `get_status` / `get_events` every few seconds; stop at once if anything looks wrong.
5. Finish with a one-line report: kitne uthaye, kitne fail, kya chhoda.

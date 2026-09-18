# Concurrent-session hazards specific to functional-model/

Multiple sessions editing the pool at once is normal (see CLAUDE.md's
"Multiple orchestrators" section for the general policy) — these are the
concrete, repeatedly-hit failure modes specific to this domain, and how
to work around them without stepping on someone else's in-flight work.

**Shared files get rewritten wholesale mid-task, not just appended to.**
`functional-model/scripts/verify-synergy.mjs`, `annotation-coverage.mjs`
(its `ANNOTATED_CARD_SLUGS` list), `compute-weights.mjs`, and
`server/api/recognizer-source/[rule].get.ts`'s hand-kept `RECOGNIZER_IDS`
allowlist have all been seen mutating between reads within the same task.
Re-read the live file immediately before editing it, append rather than
replace list entries, and re-verify immediately after — don't trust a
read from even a few minutes earlier.

**Isolating a before/after diff in a dirty pool**: don't use `git stash`/
`git checkout` as your isolation mechanism when other sessions have their
own uncommitted changes scattered across the pool — a scoped stash can
error on untracked new paths (see `script-cli-and-typecheck-gotchas.md`),
and a blanket stash/checkout risks reverting someone else's real,
legitimate in-flight work along with the noise you're trying to remove.
Prefer a plain file copy/backup-and-restore of just the one file you're
actually isolating (old content in, run the tool, swap new content back
in, diff), or re-run the same comparison twice in a row to rule out
"another session's edit landed between my two runs" before attributing a
diff to your own change.

**Before reverting anything**, diff first to confirm what's actually
stale versus a peer session's legitimate, still-wanted update — a
same-named file showing up dirty in `git status` is not by itself
evidence it's yours to discard.

**Don't force a retroactive audit onto everyone else's cards** just
because you're touching a shared file or a new standing rule was just
adopted — apply it to the card(s) actually in scope for your own task and
leave already-committed/other-batch cards for whoever next touches them
for an unrelated reason, unless explicitly asked to sweep the whole pool.

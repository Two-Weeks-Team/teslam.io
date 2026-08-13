# Lessons

Failures worth not repeating. Appended by `/keel:lesson`, read at the start of
any session that resumes prior work.

Each entry is four elements and no more. The heading states the **rule you now
follow**, not the incident — the next reader skims headings and stops there.

```markdown
### L<N> — <the rule, one line>

- **Problem**: what was observed, 1–2 sentences.
- **Cause**: the root cause, one sentence. Not the symptom.
- **Fix**: what is done differently now, naming the file or command that enforces it.
- **Reference**: commit, PR, run, or path where this is visible.
```

A lesson that can be checked mechanically should ship with the check — a
regression test, a gate step, or a hook — and the **Fix** line should name it.
A lesson with an enforcing test is a guarantee. A lesson without one is a hope.

---

<!-- Newest first. -->

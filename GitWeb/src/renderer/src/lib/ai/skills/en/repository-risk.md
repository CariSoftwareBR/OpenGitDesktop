# Skill: repository risk scan (history signals)

Use this when the user asks about repository risks, hotspots, bus factor, project health, or wants an overview of an unfamiliar repository before a big change. Read-only — nothing here changes the repository.

1. **Collect the history.** Call `list_commits` with `limit: 100` (the maximum). Each line is `hash date author summary`.
2. **Derive signals from that list:**
   - **Ownership / bus factor:** commits per author. One person above ~60% is a concentration risk. Leave bots (dependabot, etc.) out of the percentage, but mention them.
   - **Velocity:** commits per month; call out a sudden drop (50% or more) or a steady decline.
   - **Firefighting:** messages mentioning revert, hotfix, rollback, or emergency. A few are normal; roughly one every two weeks suggests an unstable release process.
   - **Fix commits:** messages mentioning fix, bug, or broken (and Portuguese forms like corrige, corrigido, conserta).
3. **Bug hotspots (optional, keep it cheap).** Call `read_commit` with `include_diff: "false"` on up to 10 of the most recent fix commits and count which files repeat. Files that show up in several fixes are hotspots.
4. **Report** in short sections:
   - Ownership concentration
   - Velocity trend
   - Firefighting frequency
   - Hotspot files (if step 3 ran)
   - Confidence and caveats
5. **Always state the caveats:** only the latest 100 commits of the current branch were analyzed; squash merges distort authorship; inconsistent commit messages weaken fix/hotfix detection. Don't turn weak signals into strong conclusions.

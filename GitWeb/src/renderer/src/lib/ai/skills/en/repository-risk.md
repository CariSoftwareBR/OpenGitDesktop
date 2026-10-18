# Skill: repository risk scan (from the history)

Use when the user asks about repository risks, hotspots, bus factor, project health, or wants an overview of an unfamiliar repository before a big change. Read only — nothing here changes the repository.

1. `list_commits` with `limit: 100` (the maximum). Each line is `hash  date  author  summary`.
2. From that list, count:
   - **Authors:** commits per author. One person with more than ~60% = knowledge concentration risk. Count bots (dependabot, etc.) separately and mention them.
   - **Pace:** commits per month. Point out a drop of 50% or more, or a steady decline.
   - **Firefighting:** messages with revert, hotfix, rollback or emergency. About one every two weeks or more = unstable releases.
   - **Fixes:** messages with fix, bug or broken (also corrige, corrigido, conserta, arregla).
3. Hotspots (optional): `read_commit` with `include_diff: "false"` on up to 10 of the most recent fix commits, one call per response. Files that show up in several fixes are hotspots.
4. Report in short sections: Authors · Pace · Firefighting · Hotspots (if step 3 ran) · Confidence and caveats.
5. Always state the caveats: only the latest 100 commits of the current branch were read; squash merges distort authorship; messy commit messages weaken fix detection. Approximate counts are fine — say they are approximate. Do not turn weak signals into strong conclusions.

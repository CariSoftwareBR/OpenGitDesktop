# Skill: reviewing CODEOWNERS

Use this when the user asks about CODEOWNERS, code ownership, or who has to approve changes to a path. This is read-only analysis — answer in text; there is no tool to edit files.

1. **Find the file.** Call `list_files` with `pattern: "**/CODEOWNERS"`. GitHub only honors `.github/CODEOWNERS`, `CODEOWNERS` at the repository root, or `docs/CODEOWNERS` (the first one found, in that order). If none exists, say so and offer a starter layout (step 4).
2. **Read it** with `read_file`. To check whether important paths are covered, use `list_files` with narrow patterns (e.g. `.github/workflows/*`) — don't list the whole repository.
3. **Check and report:**
   - Critical paths (CI workflows, build/release scripts, auth or security code, dependency manifests) have explicit owners, not only the `*` fallback.
   - Owners are preferably teams (`@org/team`) rather than single people.
   - Overlapping rules: the **last** matching pattern wins — flag earlier rules that a later, broader rule silently overrides.
   - Invalid lines or owners that look like typos.
   You can't verify whether an owner is still active, or whether branch protection requires code-owner review — tell the user to check those in the GitHub repository settings.
4. **Starter layout** (only when the file is missing or the user asks), using paths that actually exist in this repository:
   ```
   # Fallback
   * @org/maintainers

   # CI and release
   .github/workflows/ @org/devops
   ```
   Tell the user to replace `@org/...` with their real teams — never present invented owners as real.

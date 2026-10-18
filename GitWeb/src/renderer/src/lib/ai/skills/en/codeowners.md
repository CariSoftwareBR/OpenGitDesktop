# Skill: reviewing CODEOWNERS

Use when the user asks about CODEOWNERS, code ownership, or who must approve changes to a path. Read only: answer in text. There is no tool to edit files.

1. Find the file: `list_files` with `pattern: "*CODEOWNERS"`. GitHub uses only the first one of: `.github/CODEOWNERS`, `CODEOWNERS` (repository root), `docs/CODEOWNERS`. None found → say so and offer the starter layout (step 4).
2. Read it with `read_file`. To check coverage, use `list_files` with a narrow pattern (e.g. `.github/workflows/*`). Never list the whole repository.
3. Check and report:
   - Critical paths (CI workflows, build/release scripts, auth or security code, dependency manifests) have explicit owners, not only the `*` fallback.
   - Owners are preferably teams (`@org/team`), not single people.
   - The **last** matching rule wins. Flag earlier rules that a later, broader rule overrides.
   - Invalid lines, or owners that look like typos.
   - You cannot check whether an owner is still active, or whether branch protection requires code-owner review. Tell the user to check that in the GitHub repository settings.
4. Starter layout (only when the file is missing or the user asks). Use paths that exist in this repository:
   ```
   # Fallback
   * @org/maintainers

   # CI and release
   .github/workflows/ @org/devops
   ```
   Tell the user to replace `@org/...` with their real teams. Never present invented owners as real.

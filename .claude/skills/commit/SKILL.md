---
name: commit
description: Commit conventions for this repository. Use whenever creating a git commit, writing or amending a commit message, splitting work into commits, or opening a pull request.
---

# Commit conventions

Everything that lands in git history is written in **English**: commit messages, branch names, PR titles
and descriptions. This holds even when the conversation with the user is in Portuguese.

## Message format

[Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<optional scope>): <summary>

<optional body>
```

- **Summary**: imperative mood ("add", not "added" or "adds"), lower case first letter, no trailing
  period, at most 72 characters. It says what the commit does to the product, not which files changed.
- **Body**: only when the summary is not enough. Explain why the change was needed and anything
  surprising about how it was done. Wrap at 72 characters.
- **Breaking changes**: add `!` after the type or scope and a `BREAKING CHANGE:` paragraph in the body.

### Types

| Type       | Use for                                           |
| ---------- | ------------------------------------------------- |
| `feat`     | A new capability the user can see or use          |
| `fix`      | A bug fix                                         |
| `refactor` | Code restructuring with no behavior change        |
| `perf`     | A change whose purpose is speed or memory         |
| `test`     | Adding or fixing tests only                       |
| `docs`     | README, comments, skills and other documentation  |
| `style`    | Formatting only (Prettier), no code change        |
| `build`    | Dependencies, Vite, TypeScript or package scripts |
| `ci`       | GitHub Actions workflows                          |
| `chore`    | Repository upkeep that fits none of the above     |

### Scopes

Optional. Use the area of the code when it helps: `generator`, `render`, `structures`, `ui`.

### Examples

```
feat(structures): add roads between settlements
fix(generator): keep rivers from crossing lakes
refactor(render): split icon painters into separate modules
test(generator): cover outlines that touch the map border
build: upgrade vite to 8.4
```

## Before committing

1. Run `npm run check` (typecheck, lint, format check, tests). Do not commit when it fails.
2. One logical change per commit. A feature and its tests go together; unrelated cleanups, dependency
   bumps and formatting passes get their own commits.
3. Stage files explicitly by path. Never commit `node_modules`, `dist` or local settings.

## Branches and pushing

- `main` is the default branch and must always pass CI.
- Branch names: `<type>/<short-kebab-description>`, for example `feat/kingdom-borders`.
- Commit and push only when the user asks. Never force-push `main`.

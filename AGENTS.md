# Repository privacy requirements

- All commits must use `shortsagar` and `314394435+Shortsagar@users.noreply.github.com` for BOTH author and committer. Annotated taggers must use the same identity.
- Never infer a Git identity from the OS account, filesystem path, account profile, or a prior commit.
- Run `npm run privacy:setup` in a new clone before committing. Preserve the tracked `.githooks` privacy checks.
- Do not bypass identity checks with `--no-verify`, an alternate hooks path, or environment overrides. Fix the identity or history instead.
- Before publishing, run `npm run test:identity`. The pre-push hook must pass for every pushed ref.
- Publish only reviewed `dist/` contents for static hosting. Do not publish backups, private notes, credentials, or local Git metadata.

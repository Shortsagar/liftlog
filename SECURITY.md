# Security and privacy review

Reviewed November 16, 2026. Scope: local application source, storage and backup handling, DOM rendering, service worker, development server, build/deployment scripts, tracked files and reachable local Git history, and generated deployment assets. This is a source review and targeted regression verification, not a guarantee of anonymity or freedom from vulnerabilities. No live deployment, hosting account, DNS configuration, remote repository, device security or provider logs were audited.

## Findings and changes

| Finding | Risk | Resolution |
| --- | --- | --- |
| Build and service-worker scripts recursively included whole asset directories; the server allowed arbitrary files under those directories | High impact if a backup, secret or private note were placed there: accidental public distribution | Replaced directory-wide inclusion with `tools/public-assets.json`. Build and server reject symlinked assets. Extra files are neither published nor precached. New assets require deliberate inventory changes. |
| No content security policy or response-level browser protections | Defense-in-depth gap: a future injection bug would have fewer restrictions; hosted app could be framed | Added a restrictive CSP to HTML and response configuration, no-referrer, nosniff, embedding restrictions and sensitive-permission restrictions. Scripts and connections are restricted to the current origin. Inline styles remain allowed because the UI uses them; inline scripts and eval are blocked. |
| Generic DOM helper exposed an unused raw HTML option | Latent injection hazard; no reachable exploit found in existing callers | Removed raw HTML rendering; the option now throws. User text continues to use text nodes. |
| Imported files were read in full without a byte limit | A selected large file could exhaust memory or stall the page | Reject files above 20 MiB before reading or parsing, preserving existing nested validation and transactional replacement. This reduces, but does not eliminate, resource-exhaustion risks on small devices. |
| Backup UI omitted sensitivity of exports | Workout times, notes, weigh-ins and routines can identify a person when shared | Added explicit readable-JSON disclosure. Export remains an intentional user action and can invoke the device share sheet. No encryption was added. |
| Publishing guidance recommended pushing the workspace and Git history | Git author/committer names and email addresses can identify the publisher | Changed guidance to publish only generated assets in a separate deployment repository with a privacy-preserving account and Git identity. Existing history was not rewritten. |

## What the review found

- No backend, remote account database, third-party runtime dependencies, analytics, advertising SDK, geolocation collection, or automatic workout-data upload was found in the reviewed source. `package.json` has no dependency packages, so there is no installed npm dependency tree to audit.
- User content is rendered using text nodes; routes use local hashes. Backup settings are allowlisted and nested records validated before replacement. No current exploitable DOM injection or server authorization bypass was identified in reviewed paths.
- Service worker caching is restricted to app assets and scoped cache names. No workout data is written to its asset cache. Online visits can still contact hosting for assets and updates.
- Pattern scans of tracked text in reachable local commits found no matches for email addresses, local home paths, or the tested credential patterns. This is not proof that every possible secret or identifier is absent. Git commit identity metadata does contain names/email fields; raw values are intentionally not reproduced here.
- Development serving is loopback-only unless `--lan` is explicitly requested. Private folders, repository metadata, unexpected assets and directory listings are denied. The development animation preview retains its inline script and is excluded from the production build.

## Remaining risks and deployment requirements

1. **Storage is not an encrypted vault.** Browser IndexedDB/localStorage and backups have no app-level encryption or app login. An unlocked device/browser, privileged extension, malware or compromised same-origin script can read data. Use a trusted browser and device lock; protect exported files and avoid identifying notes in shared backups.
2. **Separate paths are not security boundaries.** Scoped database names prevent accidental mixing, but JavaScript elsewhere on the same origin can access storage. Use a dedicated HTTPS origin for LiftLog, separate from untrusted or unrelated apps. The CSP deliberately permits same-origin scripts and connections and cannot protect against a compromised host serving malicious app code.
3. **Hosting is not anonymous.** A provider can observe IP addresses and request metadata. Public account handles, repository membership, commit identities, domain registration and shared links can reveal the publisher. No existing public identity exposure was removed or verified remotely.
4. **Deploy only `dist/`.** The generated `_headers` supplies Netlify-style response configuration. Other hosts need equivalent configuration; do not assume copying that file enforces headers everywhere. The HTML fallback cannot enforce `frame-ancestors`, X-Frame-Options or Permissions-Policy. Verify the real HTTPS responses after deployment, including service-worker-served pages after the update. The new protections are not active on an existing deployment until it is updated and clients activate the update.
5. **Deletion has limits.** Reset clears the current installation's records, but exported backups, provider/device backups and original legacy migration storage may remain. Clearing site data removes browser-origin storage across installations; it does not delete exported copies. No user data was deleted during this review.
6. **Public inventory needs review.** An allowlisted file can still contain sensitive text if someone edits it. Review release diffs and artifacts before publishing; `.gitignore` is only an accidental-add safeguard, not a secret scanner or history eraser.

## Verification

- `npm test`: 115 tests passed, including oversized-import pre-read rejection, unexpected-file exclusion, symlink rejection, raw-HTML rejection and deployment-policy checks.
- `npm run test:server`: 4 tests passed, covering private/traversal paths, symlink denial and security response headers.
- `npm run test:browser`: 14 checks passed in disposable headless Chrome, including actual CSP rejection of inline script/eval, native storage transactions, save failure recovery, logging/reload/finish, and real offline reload. Browser tests use a test-only state module, excluded from production, rather than weakening CSP for eval.
- `npm run dist`: rebuilt the clean deployment directory and service-worker version. No deployment was performed.
- `git diff --check`: passed.

To release: build, review `dist/`, deploy it to a dedicated HTTPS origin, verify response headers and lack of exposed private files at the live URL, and accept the app update on installed clients. Provider account protection and public identity settings require a separate account-level review.

## Commit identity prevention follow-up

Public main history was rewritten to the gamer tag and GitHub noreply email. Old commit URLs may still expose prior identity metadata retained by GitHub; these controls cannot erase copies already published. Local commit/merge and push hooks now require the approved author, committer and annotated-tagger identity. Push verification scans all ancestors to catch reintroduced historical identities. Run `npm run privacy:setup` on each new clone. Five isolated regression checks verify accepted identities and rejection of author/committer overrides, unsafe ancestors and unsafe taggers. Global Git defaults on this computer use the same gamer tag and noreply email; repository-specific overrides on other projects can supersede them.

<a id="integrationspatch"></a>
# Integration patch

`ui-core.patch` is generated from audited local RealHartlMax fork baseline and contains only added UI host, UiCoreBridge, focus coordination and required test-harness import. Existing ChatBridge is a prerequisite, not part of this patch.

Prefer `npm run build`, `npm run integration:plan`, then `npm run integration:apply` in UI-Core repository. Installer checks source hashes, retains backups and rejects other interim changes. `SKYMP_FORK` selects another verified checkout. No automatic commit, plugin hot reload or deployment by this patch.

For another fork version first run `git apply --check ui-core.patch`, inspect actual Chat/focus interfaces. Then build client/CEF separately and distribute a consistent Launcher runtime. See docs/CLIENT_DEPLOYMENT.md.

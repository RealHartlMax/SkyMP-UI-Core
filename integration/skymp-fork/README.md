# Integrationspatch

`ui-core.patch` wird aus der auditierten lokalen Basis des RealHartlMax-Forks
erzeugt und enthält ausschließlich den zusätzlichen UI-Host, UiCoreBridge,
Fokuskoordination und den notwendigen Testharnessimport. Die bereits vorhandene
ChatBridge ist Voraussetzung, nicht Teil dieses Patches.

Bevorzugt `npm run build`, `npm run integration:plan`, dann
`npm run integration:apply` im UI-Core-Repo verwenden. Der Installer prüft die
Ausgangshashes, hält Backups vor und verweigert fremde zwischenzeitliche Änderungen.
`SKYMP_FORK` wählt einen anderen geprüften Checkout. Kein automatisches Commit,
kein Plugin-Hot-Reload, kein Deployment durch diesen Patch.

Für einen anderen Forkstand zuerst `git apply --check ui-core.patch` und die
wirklichen Chat-/Fokusschnittstellen prüfen. Danach Client und CEF getrennt bauen
und als konsistente Launcher-Runtime verteilen. Siehe docs/CLIENT_DEPLOYMENT.md.

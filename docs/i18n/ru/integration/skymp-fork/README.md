<a id="integrationspatch"></a>
# Патч интеграции

`ui-core.patch` создаётся из проверенной локальной базы RealHartlMax-fork и содержит лишь новый UI-host, UiCoreBridge, координацию фокуса, необходимый test-harness-import. Существующий ChatBridge — условие, не часть патча.

Предпочтительно выполнить `npm run build`, `npm run integration:plan`, `npm run integration:apply` в UI-Core. Installer проверяет исходные хеши, хранит копии, отклоняет чужие промежуточные изменения. `SKYMP_FORK` выбирает другой проверенный checkout. Автоматического commit, hot-reload и deployment патч не выполняет.

Для другого fork сначала `git apply --check ui-core.patch`, проверить настоящие Chat/focus-интерфейсы. Затем отдельно собрать client/CEF и поставить согласованной Launcher-runtime. См. docs/CLIENT_DEPLOYMENT.md.

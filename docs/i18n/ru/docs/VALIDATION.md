<a id="prüfstand-und-verbleibende-abnahme"></a>
# Состояние проверки и оставшаяся приёмка

Актуальное **1.1.0 / UI-редактор (29.10.2026)**: [UI_EDITOR_VALIDATION.md](UI_EDITOR_VALIDATION.md). Таблица ниже описывает исходное состояние 28.10.2026.

На 28.10.2026, Windows, Node 24.19.0, локальный TypeScript 5.9.3. API 1, frontend-protocol 1, plugin 1.0.0. Без commit/push/upload/release.

<a id="ausgeführte-prüfungen"></a>
## Выполненные проверки

| Команда / проверка | Результат / смысл |
| --- | --- |
| UI Core: `npm run typecheck` | без ошибок, явные node/react-типы, Node16 resolution |
| UI Core: `npm test` | 31 тест: контракты, изоляция, replay, limits/TTL, actions, локали, настоящий focus-adapter, временный entry |
| `npm run verify:fork` | настоящий неизменённый fork-validator/discovery/requireTemp; safe/enabled; два внешних потребителя |
| `npm run verify:native` | те же плагины с настоящими Scamp-ботами/native user/actor; приватное действие ровно один раз |
| Fork-client: `npm run build` | Webpack/TypeScript-build успешен |
| Fork-client: `npm run test:chat` | 12 прежних Chat-regression успешны |
| Fork-client: `npm run test:server-js` | 4 signature/configuration-теста успешны |
| Fork-client: `npm run test:spawn-location` | 8 spawn/reconnect-тестов успешны |
| Fork-frontend: `npm run build` | production-build, прежний gzip-budget соблюдён; общие asset-size warnings остаются |
| Fork-frontend: `npm test` | locale-структура, прежние unit, budget успешны |
| Launcher: `build-client-runtime.mjs` | compatibility-build успешен, предупреждений нет |
| `tools/browser-acceptance.cjs` через Playwright | два production-root browsers + native bots + прежний Chat; page/bridge-ошибок нет |
| Launcher: `create-ui-core-runtime.mjs` | базовый каталог/все исходники хешированы; 212 установочных файлов, 37 text-transport, 73 native неизменны |
| Windows ZIP byte-check | все 251 записи runtime-ZIP сверены с подготовленными файлами |
| Launcher: `node --test tests/runtime-packaging.mjs` | 15 сценариев, включая binary-text-transport/отказ повреждению, успешны |

Точные результаты/хеши: `artifacts/{loader,native,browser}-validation.json`, в Launcher-output — `VALIDATION.json`. Пакетные результаты: `artifacts/packages/PACKAGE-VALIDATION.json`, SHA256SUMS.

Browser-run загружает настоящий собранный root на `/` без dev/admin. CEF-клик проходит реальные UiCoreBridge/BrowserService, native-bot-сообщение, server-Core и назад в React-host. Native-output подаётся настоящему client-controller; browser/keyboard/menu-callback SkyrimPlatform даёт harness. Это интеграционное доказательство в браузере, не Skyrim/CEF-сессия.

В браузере проверены два consumer-namespace, серверное подтверждение/приватный счётчик, duplicate-replay, injection как текст, свежий snapshot после CEF-reload, масштаб/DE-EN, suspend/resume Skyrim-menu, Chat A/B/приватная сторонняя команда, F2/Enter, disconnect, отсутствие UI Core при работающем Chat. Скриншоты: `artifacts/ui-core-*.png`.

<a id="typfehler-im-editor"></a>
## Ошибки типов редактора

Сообщённые Node/timer/node10-диагностики исправлены явными `types: ["node","react"]`, `module/moduleResolution: "Node16"`, импортами `node:timers`. @types/node установлен/зафиксирован lockfile. `.vscode/settings.json` указывает локальный TS. При устаревших сообщениях выполнить `TypeScript: Restart TS Server`, выбрать workspace-версию; приоритет у фактической CLI-проверки.

<a id="noch-nicht-nachgewiesen"></a>
## Ещё не доказано

- Два настоящих игрока видят/используют UI в Skyrim/CEF-процессе.
- Настоящее подавление/возврат игрового ввода во всех меню Skyrim.
- Steam/Launcher live-download после upload, неизменные webhost transport-байты.
- Native-совместимость других Skyrim-версий и Linux-server.
- Публикация/hosting/production-установка: не выполнялись.

Ручной план — MANUAL_ACCEPTANCE.md. Техническая реализация упакована/автоматически интегрирована, но исходное полное определение готовности с настоящими игроками открыто.

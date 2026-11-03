<a id="ui-editor-110-aktueller-prüfstand"></a>
# UI-редактор 1.1.0: актуальная проверка

На 29.10.2026, Windows, Node 24.19.0. API 1, frontend-protocol 1, согласованный editor 1. Без commit/push/upload/deployment.

| Проверка | Фактически выполненный результат |
| --- | --- |
| npm run typecheck | ошибок нет |
| npm test | 41 пройдено, пропусков нет |
| npm run verify:fork | plugin 1.1.0, настоящий validator, safe-discovery, activation, requireTemp успешны |
| npm run verify:native | два нативных Scamp-бота, аутентифицированные цели, изолированное действие/replay успешны |
| Изолированный fork-client: webpack-cli | полный TypeScript/Webpack-build успешен |
| Изолированный fork-client: tests/chatBridge.test.cjs | 15 прежних Chat-regression успешны |
| Изолированный fork-frontend: npm run build | production-root успешен; свой bundle-budget соблюдён, прежние asset-size warnings |
| Изолированный fork-frontend: npm test | прежние unit/locale/bundle-budget успешны |
| Launcher build-client-runtime.mjs на изолированном источнике | compatibility-build успешен, без предупреждений |
| tools/browser-acceptance.cjs с Playwright | 14 интеграционных проверок с двумя production-root browsers, двумя native bots, неизменённым Chat/Metabolism-адаптером успешны; page/bridge-ошибок нет |

В браузере доказано: /UiEdit проходит настоящий Chat-parser/registry/client-мосты. Три отдельные Metabolism-индикации видны лишь нужному игроку. Drag/corner-resize/индивидуальные 150%/стрелки/сохранённые нормализованные позиции/отмена/CEF-reload/server-value/1024×768 и 1920×1080/visibility/reset работают. Инвентарь приостанавливает/восстанавливает редактор. Повторный native/DOM Escape закрывает один слой. Disconnect/отсутствие плагина освобождают фокус; чат доступен. Layout не отправляет menu-actions/игровые значения.

Используется настоящий Metabolism-UiAdapter с тестовыми серверными значениями, без изменения его исходников/правил. SkyrimPlatform browser/menu/keyboard-callback даёт прежний harness. Настоящая Skyrim/CEF-сессия с gameplay этим не доказана.

Машиночитаемые доказательства:

- artifacts/browser-validation.json: 14 проверок, browser-ошибки, build-хеши
- artifacts/loader-validation.json и native-validation.json
- artifacts/editor-build-plan.json: неизменённые исходные байты/изолированные целевые
- artifacts/uiedit-launcher-client/build-report.json
- artifacts/packages/: побайтно проверенные ZIP/SHA256SUMS

Скриншоты обычного production-root без dev/admin: artifacts/uiedit-hud.png, uiedit-editor.png, uiedit-hud-custom.png. Это browser-тесты, не кадры Skyrim.

Проверенные идентичности байтов:

- Server-bundle: f47e9ee6780b9bba1485266d288ae5b86d7bf4726238a63c86df57be4e2f5f9e
- Frontend build.js: 46dd62b584fed750c4469927ee1228bb4dd3561accc2e30868d45be5b195dc02
- Launcher-client-script: 1e12ca7fbe55264401e1c7c1939ad5865be4b27a5ddca37e4f0d76ce7b1dad6c
- Native UI-bridge-source: 64af8462bc8ba1af3a62d0a293f2b7ea0cabc83e26131309b07f120ba35e9dd0

Открыты реальная Skyrim-input/CEF-приёмка с двумя игроками, фактический Launcher/webhost-rollout с проверкой live transport-байтов. Оригинальные checkout SkyMP/Chat/Metabolism/Launcher не менялись.

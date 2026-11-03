<a id="client--und-launcher-auslieferung"></a>
# Поставка клиента и Launcher

Внешний серверный плагин не может один установить этот интерфейс в текущем форке. UI Core требует однократный integration-patch существующего клиента SkyMP/CEF. Следующим потребителям зарегистрированных templates изменения UI Core/клиента уже не нужны.

<a id="geänderte-fork-dateien"></a>
## Изменённые файлы форка

- `skymp5-client/src/services/services/browserService.ts`: общий координатор фокуса.
- `skymp5-client/src/services/services/uiCoreBridge.ts`: probe/ready, пакеты, lease/reset.
- `skymp5-front/src/index.js`: host существующего Provider рядом с App во всех обычных игровых render-путях.
- `skymp5-front/src/features/uiCore/index.js`, `index.css`: host из этого репозитория.
- `skymp5-client/tests/helpers/chatHarness.cjs`: новый service-import прежнего regression-теста.

Нет изменений `skymp5-server/ts/index.ts`, Chat-компонентов/parser, player-auth или отдельного SkyMP-Chat. Для UI Core серверу новая нативная Core-сборка не нужна.

`tools/integrate-fork.cjs` сначала создаёт patch с исходными/целевыми хешами и копиями в `artifacts/fork-integration/`. `--apply` пишет только при совпадении; `--refresh` обновляет patch из первоначальной локальной базы. Пример после npm run build:

```powershell
npm run integration:plan
npm run integration:apply
# Nach eigenen Änderungen am Host:
node tools/integrate-fork.cjs --refresh --apply
```

Patch основан на проверенном локальном форке с интегрированным ChatBridge. Не применять вслепую к публичному checkout без этих работ. `git apply --check` либо hash-installer должны соответствовать базе. Копии содержат прежние пользовательские правки и остаются локальными.

<a id="erzeugte-clientdateien"></a>
## Созданные клиентские файлы

```powershell
cd D:/GitHub/skymp/skymp5-client
npm run build
cd D:/GitHub/skymp/skymp5-front
npm run build
```

Цель клиента: `skymp/build/dist/client/Data/Platform/Plugins/skymp5-client.js`. Фронтенд: `skymp/skymp5-front/dist/` с `assets-manifest.json`. Launcher дополнительно использует существующий compatibility-builder для сохранения CEF-path/world-start-исправлений:

```powershell
cd D:/GitHub/skymp-client-launcher
node launcher/scripts/build-client-runtime.mjs --source D:/GitHub/skymp/skymp5-client --output D:/GitHub/SkyMP-UI-Core/artifacts/launcher-client-code
```

Выходной каталог должен быть новым. Клиенты получают script как `Data/Platform/Plugins/skymp5-client.js`, HTML/JS/CSS/изображения/шрифты/звуки фронтенда — в `Data/Platform/UI/`. Второго HTML-root/браузера нет. Dev/Admin-URL и LocalStorage-разрешение входа не нужны.

<a id="launcher-runtime"></a>
## Runtime Launcher

Адаптер готовится/устанавливается из UI-Core через `node tools/integrate-launcher.cjs --apply`. Четыре изменения предварительно проверяются по хешам/резервируются. Затем Launcher содержит:

- `launcher/scripts/create-ui-core-runtime.mjs`
- `launcher/scripts/archive-runtime.ps1`
- npm-script `package:runtime:ui-core`
- дополненный `docs/RUNTIME_UPDATES.md`

Для финального результата проверенная браузером CEF-сборка заморожена в `artifacts/verified-frontend`, client-script снова собран в `artifacts/launcher-client-code-final`. Промежуточные frontend-сборки других работ не подменяют проверенные байты. Предыдущий runtime-черновик сохранён как `runtime-2026-10-28-ui-core-before-final`, финальный использует новый release-path `ui-core-v2`.

Фактически использованная команда:

```powershell
node launcher/scripts/create-ui-core-runtime.mjs --base-runtime-root D:/GitHub/skymp-client-launcher/local-builds/current/runtime-tintfix-2026-10-25/client-runtime --game-version 1.7.104.0 --release client-2026-10-28-ui-core-v2 --client-script D:/GitHub/SkyMP-UI-Core/artifacts/launcher-client-code-final/skymp5-client.js --ui-source D:/GitHub/SkyMP-UI-Core/artifacts/verified-frontend --output D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-28-ui-core
```

Builder проверяет весь базовый каталог, каждый байт базы, client/CEF-маркеры. Нативные DLL/EXE/BIN сохраняет неизменными, заменяет script/CEF вместе, создаёт manifest/catalog и hash-addressed `payloads/*.bin` текста. Старые UI-ресурсы не переносятся. Другие Skyrim-версии базового каталога сохраняются. Выбирать новый output, старые releases не перезаписываются.

Подготовлено: 212 установочных файлов, 37 бинарных текстовых transport, 73 неизменённых нативных файла, 251 побайтно проверенная ZIP-запись. Snapshot убрал неиспользуемые файлы старых frontend-сборок. Приоритет у `VALIDATION.json` и `SHA256SUMS` выходного каталога. ZIP содержит `client-runtime/` для runtime-webroot, не Launcher EXE/сервер.

При ручном rollout сначала загрузить неизменяемый пакетный каталог и все `.bin` в бинарном режиме, последним — `catalog.json`. Сначала сверить live-каталог и остальные версии. Затем проверить live-manifest, размеры/SHA-256 настоящих download-transport, лишь потом игру. Публикация/передача в этом задании не выполнялась.

Профиль сервера `launcherResources.runtimeSource` должен указывать на этот каталог; ручной client-source Launcher может его переопределить. Работающему Skyrim нужен полный перезапуск. Server-plugin/языковые изменения отдельно требуют перезапуска игрового сервера. Native-совместимость, Steam, настоящая webhost-загрузка и игра вдвоём повторно здесь не проверялись.

<a id="ui-editor-110-29102026"></a>
## UI-редактор 1.1.0 (29.10.2026)

Актуальные проверенные файлы: artifacts/editor-fork/skymp5-front/dist и artifacts/uiedit-launcher-client/skymp5-client.js в UI-Core. Оригинальный SkyMP-checkout для этого не записывался. Полный patch обновлён; при уже установленном UI Core заменить нужно только native uiCoreBridge.ts и features/uiCore/index.js/index.css.

Server-plugin и client/CEF-пакет обновлять вместе. /UiEdit требует новый ready-маркер editorVersion: 1. API/протокол остаются 1, существующим потребителям изменения не нужны.

npm run package:client после успешной browser-проверки создаёт отдельный SkyMP-UI-Core-Client-1.1.0.zip из точно хешированных файлов. ZIP содержит Data/Platform/Plugins/skymp5-client.js и полный CEF-build под Data/Platform/UI/. Это client-overlay для подходящей runtime, не server-plugin/Launcher EXE. Для Launcher-доставки нужны новые manifests/catalog-хеши; старые каталоги не должны ссылаться на старые клиентские байты. Полную локальную runtime можно подготовить существующим create-ui-core-runtime.mjs.

Использование: UI_EDITOR.md. Актуальные проверки: UI_EDITOR_VALIDATION.md.

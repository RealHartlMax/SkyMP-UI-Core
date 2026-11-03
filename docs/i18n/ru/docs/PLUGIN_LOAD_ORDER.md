<a id="plugin-ladereihenfolge-und-fehlende-beispiel-ui"></a>
# Порядок загрузки плагинов и отсутствующий пример UI

Сообщённые логи показывают: ExampleUiConsumer и SecondUiConsumer загрузились до skymp-ui-core. Они выбирают документированный необязательный fallback и не регистрируют UI в этом процессе. Позднее Ready UI Core не запускает этих старых потребителей заново.

В форке уже были `pluginsLoadOrder` и стартовая сортировка. Пустой список давал алфавитный порядок и этот случай. Теперь порядок видимо настраивается в **Ресурсы → Серверные плагины**: номера позиций, вверх/вниз, сохранить, отменить. `skymp-ui-core` должен идти перед `example-ui-consumer`/`second-ui-consumer`. Затем перезапустить игровой сервер. Включение и порядок независимы.

Поиск не меняет полный сохраняемый список. При одновременных изменениях UI требует отмены/перезагрузки; сервер не затирает новый порядок. Известные временно отсутствующие ID сохраняются. Новые ненастроенные следуют по алфавиту. Зависимости автоматически не разрешаются, process-плагины общего mp/RPC не получают.

GET `/api/admin/plugins/load-order`: canViewLogs, текущий порядок/ревизия. PUT: canConsole, same-origin JSON `{revision,pluginsLoadOrder}`. Сохраняется лишь это поле. Неверные/неполные списки — 400, устаревшие — 409. Приватные настройки, mod-list, startup-flags, discovery-state сохраняются. API не загружает entry плагинов.

Изменённые файлы форка: `skymp5-server/ts/pluginLoadOrder.ts`, `ts/ui.ts`, `tests/pluginLoadOrder.integration.mjs`, frontend `PluginsPanel.tsx`, `plugins.scss`, шесть locale-файлов, `README-plugins.md`. Старый стартовый сортировщик `ts/index.ts` не менялся и проверен на сохранённом порядке. Копии/хеши: `artifacts/plugin-load-order/`. Подготовка/применение: `node tools/integrate-plugin-load-order.cjs [--apply]` в UI-Core.

Локально собраны серверный `npm run build-ts`, production-CEF `artifacts/plugin-order-frontend/`. API, прежние plugin/locale/unit/bundle-budget и аутентифицированные browser-тесты успешны. Browser проверяет save/reload, поиск, конфликты, узкий экран, права чтения. Доказательства: `artifacts/plugin-load-order-{api,browser}.json`.

По явному требованию пользователь отдельно собирает сервер в server-репозитории. Ранее запущенная локальная сборка завершилась до этого указания; новых серверных сборок нет. Приоритет у исходников `D:/GitHub/skymp`. После установки своей backend/dashboard-сборки нужен один перезапуск starter/dashboard. Позже порядку достаточно перезапуска игрового сервера. Client/CEF-runtime готовится отдельно в Launcher: `local-builds/runtime-2026-10-28-plugin-load-order/`. Серверный пакет не меняет приватную конфигурацию и не содержит нативных бинарников.

Эта dashboard-проверка не подтверждает настоящую Skyrim-сессию. Публикация и production-перезапуск не выполнялись.

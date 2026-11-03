<a id="skymp-ui-core"></a>
# SkyMP UI Core

> На 29.10.2026: новый [Plugin Runtime Loader](docs/PLUGIN_RUNTIME.md) доставляет клиентский код и UI плагинов подписанными пакетами с игрового сервера. Общим runtime и Launcher один раз нужен bootstrap; затем совместимые обновления остаются в проекте плагина. Старое описание ниже действует только там, где согласуется с новым контрактом. Изменение выполнено лишь в исходниках; новые сборки, ZIP и игровая приёмка предстоят.

Общий игровой UI для форка RealHartlMax SkyMP: виджеты, безопасные декларативные меню, уведомления, версионированный серверный API. Host работает в существующем React/CEF-root рядом с неизменённым SkyMP Chat.

**API v1 · протокол фронтенда v1 · плагин 1.1.0.** Один server-плагин не устанавливает клиентские файлы. Client-script и CEF обновляются отдельно. Ручная приёмка с двумя настоящими Skyrim-игроками открыта; нативные Scamp-боты и production-root в браузере проверены автоматически.

<a id="ui-im-spiel-anpassen"></a>
## Настройка интерфейса в игре

**`/UiEdit`** в существующем чате позволяет свободно перемещать HUD-элементы и отдельно масштабировать каждый. Сохранение, отмена, видимость и сброс доступны в редакторе. Metabolism представлен тремя отдельными fantasy-рунами сытости, жидкости и отдыха. Плагин Metabolism и Chat не меняются.

Обновить **серверный плагин и** client/CEF-пакет до 1.1.0; один перезапуск сервера новых клиентских файлов не доставляет. [Использование и обновление](docs/UI_EDITOR.md).

<a id="lokal-bauen-und-prüfen"></a>
## Локальная сборка и проверка

Node.js от 20, npm. В репозитории UI-Core:

```powershell
npm ci
npm run typecheck
npm test
npm run verify:fork
npm run verify:native
npm run package
```

`build` собирает TypeScript через esbuild в `dist/index.cjs`. `package` создаёт установочные ZIP под `artifacts/packages/`; файлы также распакованы в `release/`. Игровому серверу npm/node_modules не нужны. Fork-проверки используют `../skymp`, другой путь — `SKYMP_FORK`. Нативному тесту нужны подходящий `scam_native.node` и локальный Skyrim.esm. Linux-сервер может использовать платформонезависимый CJS-bundle; этот запуск проверен на Windows.

<a id="installation"></a>
## Установка

Скопировать `release/SkyMPUICore/` в `<game-server-working-directory>/Plugins/SkyMPUICore/`, то есть фактический рабочий каталог сервера. В поставке с game-CWD `Server/` это `Server/Plugins/SkyMPUICore/`. Один раз обнаружить в safe-режиме, включить в панели **Ресурсы → Серверные плагины**, полностью перезапустить игровой сервер.

Для теста дополнительно установить `ExampleUiConsumer` и `SecondUiConsumer` после `skymp-ui-core`. ExampleUiConsumer после настоящего frontend-ready открывает диалог; подтверждение обновляет приватный виджет авторизованным серверным handler. Сам UI Core не создаёт игровые значения, chat-сообщения и команды. На рабочих серверах примеры не устанавливать.

Новая локальная client-runtime: `D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-28-ui-core/`. Она содержит новые client/CEF-файлы, соответствующие хеши, бинарную передачу текста и каталог Skyrim **1.7.104.0 / SKSE 2.3.1**. Она не опубликована. После rollout перезапустить Skyrim. Новая сборка Launcher EXE для этого обновления пакета не нужна.

<a id="sprache-konfigurieren"></a>
## Настройка языка

В `Plugins/SkyMPUICore/config.json`:

```json
{ "locale": "de", "logLevel": "info" }
```

`locale` принимает `de`/`en`. Тексты — `locales/de.json`, `locales/en.json` рядом с конфигурацией. Недостающие файлы/ключи заменяются встроенным переводом того же языка; неизвестные ключи, неверный JSON/текст явно отклоняются. После изменений перезапустить сервер; для текстов новая client-сборка не нужна. Игрок может сменить язык текущего представления в UI. Тексты чужих виджетов/меню принадлежат их плагинам.

<a id="eigenes-plugin-anbinden"></a>
## Подключение своего плагина

```js
const ui = globalThis.skympUi;
if (!ui || ui.apiVersion !== 1 || !ui.getStatus().ready) {
  console.warn('UI Core v1 unavailable; optional UI disabled');
} else {
  ui.registerWidget({
    owner: 'my-plugin', id: 'my-plugin:status', kind: 'status', schemaVersion: 1
  });
  // userId comes from your authenticated server event, never from CEF JSON.
  // ui.updateWidget({ userId }, 'my-plugin:status', {
  //   schemaVersion: 1, label: 'Status', text: 'Vom Server erzeugt'
  // });
}
```

Action-handler без явного `authorize` заблокирован. Разрешены только поставляемые templates/layout-ID, без HTML/JS/CSS-payload. Детали и исполняемые примеры: [API](docs/API.md), [ExampleUiConsumer](../../../examples/ExampleUiConsumer/index.ts).

<a id="integration-und-nachweise"></a>
## Интеграция и доказательства

- [Архитектура и проверенное состояние](docs/ARCHITECTURE.md)
- [Установка, включение, конфигурация, обновление](docs/INSTALLATION.md)
- [Client-build, fork-patch, Launcher-rollout](docs/CLIENT_DEPLOYMENT.md)
- [Фокус и Chat](docs/FOCUS_AND_CHAT.md)
- [Автопроверки и открытая игровая приёмка](docs/VALIDATION.md)
- [Ручной план двух клиентов](docs/MANUAL_ACCEPTANCE.md)
- [Порядок загрузки в серверной панели](docs/PLUGIN_LOAD_ORDER.md)

Локальный форк изменён изолированным патчем с проверкой хешей. `integration/skymp-fork/ui-core.patch` содержит именно эти изменения относительно проверенного локального Chat. `integration/launcher/` содержит отдельный адаптер упаковки runtime. Резервные копии/хеши — в `artifacts/`. Исходники Chat в `D:/GitHub/SkyMP-Chat` не менялись.

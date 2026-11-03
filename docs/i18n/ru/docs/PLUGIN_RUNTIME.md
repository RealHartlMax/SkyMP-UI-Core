<a id="plugin-runtime-loader--api-1"></a>
# Plugin Runtime Loader – API 1

Общая среда SkyrimPlatform содержит универсальный нативный загрузчик и host в существующем CEF-браузере. Клиентский код, UI-шаблоны, CSS и публичные ресурсы принадлежат каждому плагину. После однократной установки bootstrap совместимые изменения плагинов не требуют новой сборки Launcher EXE или общей среды. Нативные DLL остаются в центральном базовом пакете под соответствующую версию Skyrim.

<a id="aufbau-und-zuständigkeit"></a>
## Структура и ответственность

```text
Plugins/SkyMPChat/
  plugin.json                 # runtime: "client/manifest.json"
  index.cjs                   # privater Server-Einstieg
  config.json                 # private Server-Konfiguration
  client/
    manifest.json
    client.js                 # optional: nativer JS-Client
    ui.js                     # optional: CEF-Oberfläche
    ui.css                    # optional: Stylesheet
    assets/...
```

Чисто серверные плагины не указывают `runtime`. Потребители UI-Core, например Metabolism, регистрируют только данные, виджеты и меню; собственный runtime-пакет и второй браузер им не нужны. Chat, UI-Core и YACA поставляют свои пакеты.

Игровой сервер публикует только плагины, успешно загруженные при текущем запуске. Флажки dashboard по-прежнему описывают следующий запуск. Поэтому после установки/отключения нужен перезапуск игрового сервера. Изменения dashboard/backend дополнительно требуют перезапуска соответствующей службы. Завершившиеся process-плагины удаляются из публикации. Файлы и manifest поставляются вместе, затем нужен перезапуск.

<a id="manifest-und-http-auslieferung"></a>
## Манифест и HTTP-доставка

Публичный манифест Launcher использует версию `3`, если нужны runtime-пакеты; старые Launcher отклоняют неизвестную версию. Без таких пакетов остаётся версия `2`. `pluginRuntime` содержит `{version:1,revision,packages:[...]}` с ID плагина, версией, SHA-256 и размером файла manifest, а также путём загрузки.

- `GET /api/launcher/plugin-runtime/manifest`: активный каталог пакетов.
- `GET /api/launcher/plugin-runtime/manifests/:sha256`: неизменённые байты manifest.
- `GET /api/launcher/plugin-runtime/files/:id`: явно разрешённый публичный файл. ID = SHA-256 от `manifestSha256 + "\0" + file.path`.

Публичного списка каталогов плагина нет. Отдаются только явно перечисленные файлы под `client/`. Серверный bundle и конфигурация вне этого каталога не получают пути загрузки. Символические ссылки, выход за каталог, имена устройств Windows, коллизии имён без учёта регистра и нативные бинарные файлы запрещены. Текст также передаётся побайтно в бинарном режиме.

```json
{
  "formatVersion": 1,
  "pluginId": "skymp-chat",
  "version": "1.2.0",
  "requires": {"clientApi": 1, "uiApi": 1},
  "entrypoints": {"client": "client.js", "ui": "ui.js", "styles": ["ui.css"]},
  "files": [{"path": "client.js", "size": 123, "sha256": "64 kleine Hex-Zeichen"}],
  "signature": {"algorithm": "ed25519", "keyId": "herausgeber", "value": "128 kleine Hex-Zeichen"}
}
```

Пример сокращён: каждая точка входа и stylesheet должны присутствовать в полном списке. Неизвестные поля отклоняются. Лимиты: 128 активных пакетов, 256 файлов/пакет, 16 MiB/файл, 64 MiB/пакет, всего 256 MiB активных файлов, 256 KiB/manifest, 8 MiB/активный index, 240 символов полного установочного пути относительно каталога игры.

У каждой пары `(pluginId, version)` байты manifest, включая подпись, неизменны. Изменённые файлы/ключи публикуются под новой версией. Launcher запоминает проверенные ревизии и отклоняет изменённые существующие версии. Общий контракт — `contract.cjs`; SDK-исходники `tools/plugin-runtime/` в проектах плагинов должны оставаться ему идентичными.

Старые серверы без `pluginRuntime` используют замороженные мосты Chat/UI-Core. Launcher пишет для них `plugin-runtime-managed:false`. Обновлённые серверы публикуют явный, в том числе пустой, список пакетов. Старые поверхности там отключаются, активируются только объявленные плагинами интерфейсы.

<a id="signieren-und-herausgeber-freigeben"></a>
## Подпись и доверенные издатели

**Signaturen sind optional.** Ohne Schlüssel reicht das Manifest mit Größe und SHA-256 jeder Datei; das schützt vor beschädigten Downloads, nicht vor einem böswilligen Server. Erst wenn ein Spieler im Launcher vertrauenswürdige Herausgeber einträgt, sind gültige Signaturen dieser Herausgeber Pflicht.

Launcher и нативный загрузчик проверяют Ed25519 над каноническим UTF-8 JSON: ключи объектов сортируются рекурсивно, порядок массивов сохраняется, лишних пробелов нет, поле `signature` целиком исключается. SHA-256, подписи и публичные ключи записываются строчными hex-символами. 

```powershell
# Einmalig, außerhalb des öffentlichen Plugin-/Runtime-Verzeichnisses:
node tools/plugin-runtime/package.cjs keygen --output C:/private/herausgeber.pem --key-id herausgeber
# Die Ausgabe ist eine JSON-Zuordnung Herausgeber-ID -> öffentlicher Schlüssel.
$env:SKYMP_PLUGIN_SIGNING_KEY = 'C:/private/herausgeber.pem'
$env:SKYMP_PLUGIN_KEY_ID = 'herausgeber'
# Bei einem später ausdrücklich beauftragten Plugin-Build wird damit signiert.
# Alternativ einen bereits gebauten Kandidaten signieren:
node tools/plugin-runtime/package.cjs sign --root client --private-key C:/private/herausgeber.pem --key-id herausgeber
```

Не помещайте приватный ключ в `client/` или публичные архивы. Игроки вводят только независимо проверенное публичное соответствие JSON в **Настройки Launcher → Игра → Доверенные издатели плагинов**. Игровой сервер не может сам себе выдать доверие. Неизвестный издатель, изменённые байты, неверная подпись, несовместимые API и изменённая существующая версия прерывают подготовку до запуска Skyrim.

Текущее задание по исходникам не создавало постоянных ключей издателей или релизных пакетов. Автоматические source-тесты используют только временные ключи, затем удаляемые.

<a id="download-installation-und-serverwechsel"></a>
## Загрузка, установка и смена сервера

Сначала Launcher готовит базовую runtime под версию Skyrim. Для плагинных пакетов её manifest обязан содержать `pluginRuntimeApi:1`. Затем проверяются подписанные манифесты и все файлы. Файлы размещаются исключительно в `Data/Platform/PluginRuntime/packages/<pluginId>/<manifestSha256>/`. Привязанный хешем индекс `active.json` содержит полный набор пакетов, целевой host и игровой порт.

Индекс, доверенные ключи и настройки проходят через существующий installation-journal с проверкой коллизий, резервированием и восстановлением. Неудачная загрузка не активирует неполное состояние. При смене сервера Launcher заменяет набор и восстанавливает ранее управляемые файлы тем же журналом. Прямое переключение в игре на другой host отклоняется, пока сервер не подготовлен в Launcher.

Нативный загрузчик повторно проверяет индекс, подписи и каждый файл до выполнения любого скачанного клиентского модуля. Нативные JS-модули — доверенный код SkyrimPlatform; проверка издателя не является песочницей.

<a id="entwickler-einstiege-und-aufräumen"></a>
## Точки входа разработчика и очистка

`client.js` — самостоятельно собранный CommonJS-модуль с `apiVersion = 1` и `activate(api)`. Он может вернуть синхронную функцию очистки. Используйте внедрённые `api.sp`, `api.controller`, `api.constants.CustomPacket`; вторую копию SkyrimPlatform не импортируйте. Нативные подписки, emitter-listener, состояния фокуса и зарегистрированная очистка снимаются при disconnect, неудачной активации и reload.

`ui.js` регистрируется через `window.SkyMPPluginRuntime.register({pluginId,apiVersion:1,mount(ctx)})`. `mount` получает собственную DOM-область, разрешение ресурсов, React/store/i18n, регистрацию reducer, функции фокуса, событий и очистки. Может вернуть синхронную очистку. Общие импорты: React, ReactDOM, React Redux, React i18next, React Draggable, React Resizable. При загрузке `require('skymp-plugin-host')` даёт текущий host-контекст. Используйте существующий браузер; свои таймеры, сокеты и дополнительные listener удаляйте при очистке. Два владельца одного reducer запрещены; выгрузка пакета удаляет его состояние. Ошибка UI-активации выгружает модули и останавливает соединение.

Chat/UI-Core сохраняют существующие проверяемые сервером пути сообщений. YACA сохраняет нативный EventSource/TeamSpeak-транспорт, но обычный server-bundle больше не встраивает UI. Подписанный скачанный интерфейс управляет своим сокетом и таймерами. При выгрузке нативный YACA-модуль также снимает browser-handler EventSource и завершает цепочку обновлений. Поэтому предел 100 KiB тела нативной EventSource-функции больше не ограничивает размер UI. `dist/ui/overlay.js` остаётся выходом инструментария для legacy-тестов; `SKYMP_YACA_LEGACY_OVERLAY=1` явно возвращает его при будущей сборке. Новому обычному пакету нужен bootstrap.

<a id="spätere-abnahme"></a>
## Последующая приёмка

Source-тесты и `tsc --noEmit` не заменяют установку и игровую приёмку. После отдельно заказанных сборок: подписать манифесты, разрешить издателей, подготовить сервер, проверить байты загрузки, запустить Skyrim, использовать Chat/UI-Core/Metabolism/YACA. Проверить reconnect и смену на сервер с другими, меньшим числом либо без плагинов: старые DOM-области, listener, фокус и данные должны исчезать. Изменённые файлы, неизвестные издатели и изменённые существующие версии должны отклоняться. Каждую поддерживаемую версию Skyrim, настоящее TeamSpeak-аудио и lipsync проверять отдельно.

В текущем задании изменялись только исходники и документация. Новых сборок, ZIP, commit, push и публикаций нет.

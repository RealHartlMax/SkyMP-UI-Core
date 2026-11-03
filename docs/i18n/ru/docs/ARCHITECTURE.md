<a id="verifizierte-architektur"></a>
# Проверенная архитектура

> Обновление архитектуры 29.10.2026: [PLUGIN_RUNTIME.md](PLUGIN_RUNTIME.md) заменяет фиксированную копию client/CEF-исходников собственным подписанным runtime-пакетом плагина. Общие загрузчики находятся в fork/Launcher. Ниже выводы о старом копировании/упаковке являются историческими доказательствами интеграции. Для нового состояния сборки/ZIP не создавались.

Аудит 28.10.2026. Рабочий репозиторий `D:/GitHub/SkyMP-UI-Core`, источник интеграции `D:/GitHub/skymp`, Chat только для чтения `D:/GitHub/SkyMP-Chat`, runtime-поставка `D:/GitHub/skymp-client-launcher`.

<a id="befunde-vor-der-implementierung"></a>
## Выводы перед реализацией

Локальный SkyMP HEAD и последний commit `RealHartlMax/skymp`, запрошенный GitHub-коннектором, — `5a70479f1944c32837c58592fd4fcbf308564b68`. Дополнительно рабочее дерево имеет незакоммиченные Chat/focus/frontend-build/spawn/runtime-изменения. Это база интеграции; патч только против публичного commit потерял бы их. Chat уже реализован локально; AGENTS.md частично описывает старые целевые контракты. Приоритет у `Plugins/SkyMPChat/src/{runtime,registry,entry}.cjs` и настоящего client/CEF-моста.

Прочитаны `README-plugins.md`, server/client scripting-reference, events/properties-документация, `docs/skyrim_platform/browser.md`, серверный `ts/index.ts`, клиентские `browserService.ts`, `gamemodeEventSourceService.ts`, `chatBridge.ts`, frontend `App.js`, `constructor.js`, `utils/Widgets.js`, Chat-компоненты, Redux/Chat-bridge, Webpack client/frontend и упаковка Launcher runtime.

<a id="loader-und-serveridentität"></a>
## Загрузчик и серверная идентичность

`skymp5-server/ts/index.ts` обнаруживает прямые подкаталоги `process.cwd()/Plugins`. `kind: gamemode` назначает `globalThis.mp` общему ScampServer и загружает через `requireTemp` только entry во временный `.js`. Разрешения зависимостей, frontend-installer и надёжного hot-reload нет. Новые плагины отключены в safe, нужны включение/полный перезапуск. `requireTemp` перехватывает ошибки внутри, поэтому статус панели не доказывает старт API.

Нативные методы подтверждены `ts/scampNative.ts`, `cpp/addon/ScampServer.cpp`: `isConnected`, `getUserActor`, `getUserByActor`, `sendCustomPacket`. `ScampServerListener::OnCustomPacket` передаёт аутентифицированный user ID отдельно от JSON. UI Core проверяет двустороннее user/actor-соответствие каждой цели/запроса.

<a id="tatsächlicher-transport"></a>
## Настоящий транспорт

UI Core, как Chat, использует надёжные CustomPackets:

1. CEF `window.skyrimPlatform.sendMessage('skympUi:…', data)`.
2. Нативный `browserMessage` существующего BrowserService/UiCoreBridge.
3. Controller `sendMessage`, `MsgType.CustomPacket`, `reliability: 'reliable'`.
4. Scamp `customPacket(userId, content)` и серверная проверка.
5. `mp.sendCustomPacket(userId, JSON.stringify(packet))` только этому пользователю.
6. Client `customPacketMessage` -> правильно JSON-экранированный `CustomEvent` CEF.
7. React-host проверяет снова, рендерит только текст/фиксированные компоненты.

`makeEventSource/ctx.sendEvent` тоже доступен, но здесь не нужен. UI Core не раздаёт чужие scripts или новые EventSources и не зависит от их настройки подписи. Вымышленных `mp.sendToClient`, `mp.broadcast`, `window.skymp.send` нет.

<a id="kleinster-integrationseingriff"></a>
## Минимальное изменение интеграции

`skymp5-front/src/index.js` монтирует host рядом с App в том же Provider/CEF-root. Он работает и в обычном игровом render-пути без входа, без трюков devUi/admin/LocalStorage. `constructor.js`, `Widgets.js`, Chat-компоненты не меняются.

BrowserService остаётся единственным владельцем нативного фокуса. Небольшой UiCoreBridge добавляет Ready/Probe, сброс соединения, транспорт actions, запросы фокуса. Центральная policy координирует меню Skyrim/UI, Chat, Enter/Escape, F2/F6. Отдельный Chat-репозиторий не меняется. Installer проверяет исходные хеши, делает изолированные изменения/копии вместо перезаписи чужих незакоммиченных правок.

API v1 и frontend-protocol v1 проверяются отдельно. Handshake лишь после React-mount/появления своего actor; актуальные снимки при медленном CEF/reload/reconnect. Полные последовательные ограниченные frames заменяют потерянные частичные updates; очереди/state/replay/TTL ограничены. Серверный session-prefix и монотонный счётчик запросов предотвращают replay даже после удаления старого ACK из кеша.

<a id="distribution-und-nachweisgrenze"></a>
## Поставка и границы доказательств

Сервер: полностью собранный `release/SkyMPUICore/index.cjs`. Клиент: `Data/Platform/Plugins/skymp5-client.js`, все файлы `skymp5-front/dist` под `Data/Platform/UI/`. Launcher получает их из отдельно версионированного каталога. Для UI Core нативные DLL менять не нужно. Текстовым файлам нужны существующие hash-addressed `.bin`-транспорты; каталог, manifest, установленный файл и transport должны иметь согласованные SHA-256/размеры.

Автоматические loader/native-bot/browser-тесты служат доказательствами интеграции, но не заменяют два настоящих Skyrim-клиента с CEF/gameplay/Chat. Настоящий игровой сеанс признаётся пройденным лишь после выполнения. Локальная runtime не опубликована и не развёрнута на update-webserver. См. VALIDATION.md и ручной план.

<a id="erweiterung-110-editor-und-status-hud-29102026"></a>
## Расширение 1.1.0: редактор и status-HUD (29.10.2026)

Локальный/публичный HEAD форка повторно сверены с 5a70479f1944c32837c58592fd4fcbf308564b68; текущее дерево остаётся базой. Реально прочитаны неизменённые Chat `registerCommand/unregisterCommand`, case-insensitive CommandRegistry и ограниченно опустошаемая skympChatReady-queue. Адаптер UI-Core использует их, перед приватным edit-пакетом повторно проверяет native user/actor, Ready-lease, editorVersion. Server-API остаётся v1. Формат wire-перевода прежний; новые DE/EN-тексты редактора отдельно встроены в клиент, чтобы старые клиенты не отвергали новые locale-ключи сервера.

Настоящий Metabolism-адаптер src/integrations/ui-core/adapter.ts регистрирует kind=icon-list и даёт три локализованные дроби со status/hint. Он не меняется. Общий renderer разделяет только представление списков. Локальные изменения одного элемента не передвигают другие.

Production-build проверяется в приватной копии artifacts/editor-fork. Оригинальные SkyMP, SkyMP-Chat, SkyMP-Metabolism, Launcher для этого не записываются. Dependency-пути копии служат только локальной сборке и не поставляются.

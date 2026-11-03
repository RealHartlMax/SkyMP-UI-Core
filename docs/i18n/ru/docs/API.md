<a id="öffentliche-server-api-v1"></a>
# Публичный серверный API v1

`globalThis.skympUi` — неперезаписываемая ссылка на замороженный объект службы в общем gamemode-процессе. `kind: process` доступа не имеет. `getStatus().ready` означает готовность серверной службы, не уже подключённый CEF. `frontendProtocol` независим от `apiVersion`.

Машинно проверяемые контракты/валидаторы: `shared/contracts.ts`, локализация: `shared/localization.ts`. После сборки — `dist/types/shared/contracts.d.ts`, связанные типы/JSON под `dist/types/`. Примеры используют только `SkyMpUiApiV1`, без внутренних runtime-объектов.

<a id="registrierung-und-identität"></a>
## Регистрация и идентичность

Owner: `[a-z][a-z0-9-]{0,47}`. ID: `owner:local-id`, всего до 96 символов; local-id начинается буквой, разрешены `a-z0-9._-`. Все определения/состояния имеют `schemaVersion: 1`. Повторные ID, неверный owner, неизвестные поля/версии/templates вызывают ошибку.

Все серверные плагины — доверенный код одного процесса. Owner-имена защищают от случайной перезаписи, а не вредоносного Node-плагина с прямым доступом к `mp`. Вызывающий не подставляет browser-identity: UI Core разрешает `{userId}`/`{actorId}`, проверяет `isConnected`, `getUserActor` и обратное нативное соответствие.

```ts
registerWidget(definition): void
unregisterWidget(owner, id): void
updateWidget(target, id, state): void
setWidgetVisible(target, id, visible): void
registerMenu(definition): void
unregisterMenu(owner, id): void
openMenu(target, id, state): void
closeMenu(target, id): void
notify(target, message, { tone?, durationMs? }?): void
onAction(owner, id, actionId, handler, { authorize }?): void
getStatus(): { ready, apiVersion, frontendProtocol, sessions, locale }
```

`setWidgetVisible` требует инициализированного состояния. `unregister*` удаляет также состояния игроков и action-handler. Регистрации живут только в процессе; после shutdown обновление/регистрация вызывает ошибку. Hot-reload не обещается. Потребители загружаются после UI Core; при отсутствии один раз выбирают необязательный fallback.

<a id="feste-templates"></a>
## Фиксированные templates

| Widget-kind | Состояние помимо schemaVersion |
| --- | --- |
| status, text | label? (160 символов), text? (1024), value? (строка/конечное число), tone? |
| progress | label, value, max; `0 <= value <= max`, max положителен |
| icon-list | items: до 16 `{label, value?, tone?}`, фиксированные текстовые маркеры |
| custom-template | только templateId `core:status-v1`, состояние как status |

У status/text обязателен хотя бы label/text/value. Позиции: `top-left`, `top-right`, `bottom-left`, `bottom-right`. `defaultVisible` необязателен. Widget-layer неинтерактивен. Динамических HTML/JS/CSS/URL-template нет.

`status`-виджеты и записи icon-list отображаются руническими печатями: внутри круга только `value`; `label` и `text` — текст подсказки/screenreader. `value` в виде полной дроби «текущее/max», при необходимости с единицей («85,3/100 · Gut», «8/40 m»), пропорционально заполняет кольцо вокруг печати; `max` — полное кольцо.

Меню: `{owner,id,title,schemaVersion,layoutId,modal?}`. Layout: `core:dialog-v1` (текст/кнопки), `core:form-v1` (ещё и поля). Состояние `{schemaVersion:1,text?,actions:[{id,label,tone?}],fields?}`. До 8 actions/12 полей. Поля содержат `id,label,type`, необязательные `required,value`; у текста `maxLength` до 512, у чисел `min/max`, у select `options:[{value,label}]` до 24 пунктов. Типы text/number/checkbox/select. UI Core сверяет переданные значения именно с открытым сервером состоянием. Предметные правила — цену, количество, права — проверяет плагин.

<a id="actions-und-freigaben"></a>
## Actions и разрешение

Handler регистрируется до `openMenu`. Полный пример: `examples/ExampleUiConsumer/index.ts`. Минимум:

```js
ui.onAction('shop', 'shop:trade', 'buy', async ctx => {
  if (ctx.signal.aborted) return;
  // Recheck live server prices, stock and the player's money here.
}, { authorize: ctx => serverPermissionCheck(ctx.userId, 'shop.buy') === true });
```

`authorize` обязан синхронно вернуть строго `true`. Нет функции, ошибка, Promise, другое truthy-значение — отказ. Handler получает `userId,actorId,widgetId,actionId,payload,requestId,signal` из проверенного серверного контекста. Payload — копия JSON-данных; форма даёт `{values:{...}}`. Неоткрытое/просроченное/закрытое меню не вызывает handler. Browser-флаги user/role/permissions не часть контракта.

Browser-action содержит лишь версию протокола, widget/action-ID, request-ID, payload внутри namespaced CustomPacket. ID: `<server-session-UUID>_<monotonic-counter>`. Новый frontend-handshake меняет ключ сеанса; старые/вытесненные запросы повторно не выполняются. Ack подтверждает принятие/отказ, не успешное завершение бизнес-действия. Журнал ошибок не содержит payload/token. `core.close` — зарезервированное закрытие меню текущего сеанса без внешнего handler.

Один handler на игрока, максимум 64 одновременно. Через 5 секунд выставляется AbortSignal. Незавершающийся handler удерживает свой ограниченный слот до настоящего завершения. Асинхронный плагин обязан учитывать signal и текущее player/game-состояние; UI Core не может остановить чужой Node-код или откатить DB-транзакцию.

<a id="transport-limits-und-lokale-einstellungen"></a>
## Транспорт, лимиты и локальные настройки

Максимум 128 определений, 20 widgets/4 меню/8 уведомлений на игрока, 512 сеансов. State до 8 KiB UTF-8, полный player-frame до 48 KiB, транспорт до 64 KiB. Глубина JSON 10, максимум 4096 значений, массивы до 256. 50 updates/s с burst 100, flush каждые 100 мс. Actions 4/с burst 8, уведомления 1/с burst 4, длительность 1–30 с. Widgets TTL 5 минут, меню 2 минуты; нужные состояния потребитель продлевает заранее. При лимите API бросает ошибку; плагины обрабатывают budget-ошибки/объединяют updates.

Ready/snapshot и каждое последовательное обновление содержат полное текущее разрешённое состояние только этого игрока. Медленный CEF/reload получает последний вариант. Heartbeat 10 с, client-lease 30 с, server-session 60 с. Значения widgets не хранятся в БД SkyMP. Disconnect/смена actor удаляют состояние из памяти.

Масштаб 75–150%, позиции и локальная видимость — данные представления. CEF LocalStorage читается только как ограниченные проверенные preferences. Ключи — хеши нативных GUID; стабильность между запусками игры не обещается. Пустой GUID даёт случайный session-ключ; без storage настройки остаются в React-памяти. Игровые значения, роли, авторизация локально не сохраняются.

`config.json` задаёт язык по умолчанию; `locales/{de,en}.json` переопределяют фиксированные встроенные ключи. Оба проверенных словаря приходят в frame как безопасные тексты. Новым templates/версиям протокола нужен контролируемый client/CEF-release; одним переводам — только перезапуск сервера.

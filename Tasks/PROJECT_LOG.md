## 17.01.2026.16:25 — Отключение прокрутки в числовых полях ПЛ

**Type:** fix  
**Zone:** waybills | ui

**Context/problem:**  
При скроллинге страницы путевого листа, если курсор мыши находился над числовым полем (например, "Км" в маршруте или показания одометра/топлива), значение поля изменялось, приводя к непреднамеренным ошибкам ввода.

**What was done:**
- Добавлен обработчик `onWheel` в числовые поля компонентов `WaybillFuelInfo` и `WaybillRouteRow`.
- Обработчик снимает фокус с поля (`blur`) при попытке прокрутки колесом мыши, предотвращая изменение значения и позволяя странице прокручиваться дальше.

**How verified:**
- Code review.

**Files:**
- [MODIFY] `components/waybills/form/WaybillFuelInfo.tsx`
- [MODIFY] `components/waybills/form/WaybillRouteRow.tsx`

---

## 17.01.2026.16:15 — Валидация номера ПЛ и ручной ввод

**Type:** feat  
**Zone:** waybills | validation

**Context/problem:**  
1. Система позволяла создавать несколько путевых листов с одинаковым номером (например, "ЧБ 000001"), что приводило к путанице.
2. Поле "Номер ПЛ" было заблокировано для ручного ввода, не позволяя исправлять номера или вводить свои.

**What was done:**
- Разблокировано поле "Номер ПЛ" в форме документа (`WaybillGeneralInfo`).
- Добавлена строгая проверка уникальности номера при создании и сохранении ПЛ в `services/api/waybills.ts`.
- Проверка осуществляется в пределах календарного года документа. Отмененные (Cancelled) документы игнорируются.

**How verified:**
- Code review.

**Files:**
- [MODIFY] `components/waybills/form/WaybillGeneralInfo.tsx`
- [MODIFY] `services/api/waybills.ts`

---

## 17.01.2026.16:05 — Резервирование бланков для черновиков

**Type:** fix  
**Zone:** waybills | blanks

**Context/problem:**  
При создании черновика ПЛ вручную назначенный бланк оставался в статусе `issued` (выдан), из-за чего система предлагала тот же самый номер бланка для следующих создаваемых черновиков, создавая дубликаты.

**What was done:**
- Обновлены `addWaybill` и `updateWaybill` в `services/api/waybills.ts`.
- Теперь при сохранении ПЛ (включая черновики) назначенный бланк переводится в статус `reserved` (зарезервирован).
- Это исключает его из выборки доступных бланков для следующих документов.

**How verified:**
- Code review.

**Files:**
- [MODIFY] `services/api/waybills.ts`

---

## 17.01.2026.15:55 — Исправление валидации даты маршрута

**Type:** fix  
**Zone:** waybills | validation

**Context/problem:**  
При ручном вводе даты маршрута пользователь получал ошибку "Дата выходит за пределы диапазона", даже если дата визуально совпадала с диапазоном. Проблема вызвана использованием объекта `Date` и методов `setHours(0,0,0,0)`, которые могут вести себя некорректно из-за смещения таймзон при сравнении дат, полученных из разных источников (строка YYYY-MM-DD vs new Date()).

**What was done:**
- Переписана функция `isRouteDateValid` в `hooks/useWaybillForm.ts`.
- Теперь используется прямое лексикографическое сравнение строк в формате ISO (`YYYY-MM-DD`), что гарантирует корректность независимо от часового пояса.

**How verified:**
- Code review.

**Files:**
- [MODIFY] `hooks/useWaybillForm.ts`

---

## 17.01.2026.15:45 — Поддержка формата ДД.ММ.ГГГГ в датах маршрута

**Type:** feat  
**Zone:** waybills | manual-input

**Context/problem:**  
Пользователь или внешний скрипт может передавать дату маршрута в формате `ДД.ММ.ГГГГ` (RU локаль), тогда как система внутренней валидации и хранения ожидает `YYYY-MM-DD` (ISO). Это приводило к ошибкам валидации или некорректному сохранению.

**What was done:**
- Обновлен `handleRouteUpdate` в `hooks/useWaybillForm.ts`.
- Добавлена автоматическая нормализация: если строковое значение соответствует формату `DD.MM.YYYY`, оно преобразуется в `YYYY-MM-DD` перед проверкой валидности и сохранением в стейт.

**How verified:**
- Code review.

**Files:**
- [MODIFY] `hooks/useWaybillForm.ts`

---

## 17.01.2026.15:35 — Начальные данные из черновиков

**Type:** feat  
**Zone:** waybills | creation

**Context/problem:**  
Ранее при создании нового ПЛ начальные данные (пробег, остаток топлива) подтягивались только из последнего *проведенного* документа. Пользователь запросил возможность подтягивания данных из *последнего черновика*, если он существует, чтобы продолжать цепочку документов без необходимости их немедленной проводки.

**What was done:**
- Обновлена функция `getLastWaybillForVehicle` в `services/api/waybills.ts`.
- Теперь она возвращает последний по дате путевой лист, статус которого не равен `Cancelled`, независимо от того, `Posted` он или `Draft`.

**How verified:**
- Code review.

**Files:**
- [MODIFY] `services/api/waybills.ts`

---

## 17.01.2026.15:20 — Исправление нумерации бланков при ручном создании

**Type:** fix  
**Zone:** waybills | blanks

**Context/problem:**  
При создании ПЛ вручную, даже если у водителя были бланки и они подтягивались системой (ID бланка сохранялся), визуальный номер ПЛ оставался пустым, из-за чего при сохранении срабатывала автогенерация (формат `WL-YYYYMM-XXXXXX`) вместо использования номера бланка.

**What was done:**
- В `useWaybillForm.ts` добавлена явная установка поля `number` в формате `СЕРИЯ 000000` при автоматическом выборе бланка.
- Добавлен паддинг (дополнение нулями) номера бланка до 6 символов.

**How verified:**
- Code review of `useWaybillForm.ts` logic.

**Files:**
- [MODIFY] `hooks/useWaybillForm.ts`

---

## 17.01.2026.15:00 — Исправление модификаторов расчета топлива

**Type:** fix  
**Zone:** waybills | calculation

**Context/problem:**  
Пользователь сообщил, что коэффициенты "Город", "Прогрев", "Горы" не влияют на расчет топлива при выборе метода "По общему пробегу" ('by_total').

**What was done:**
- Изменен маппинг метода расчета: `by_total` теперь использует алгоритм `MIXED` вместо `BOILER`.
- `MIXED` алгоритм вычисляет среднюю норму расхода на основе всех сегментов маршрута (с учетом их коэффициентов) и применяет её к общему пробегу.
- Это позволяет учитывать галочки в маршрутном листе даже при расчете "по общему пробегу".

**How verified:**
- Code review of `fuelCalculationService.ts`.

**Files:**
- [MODIFY] `services/fuelCalculationService.ts`

---

## 17.01.2026.14:35 — Bulk Selection Across Pages

**Type:** feat  
**Zone:** waybills | ui | ux

**Context/problem:**  
Чекбокс "Выбрать все" в заголовке таблицы выбирал только записи текущей страницы (из-за пагинации). Невозможно было массово обработать (удалить/провести) все отфильтрованные документы сразу.

**What was done:**
- Реализована функция `handleSelectAllFiltered`, которая загружает все ID по текущим фильтрам
- В панель массовых действий добавлена ссылка "Выбрать все {total} документов", которая появляется при выборе всей страницы

**How verified:**
- Ожидает ручного тестирования

**Files:**
- [MODIFY] `components/waybills/WaybillList.tsx`

---

## 17.01.2026.14:05 — Mountain Coefficient UI (COEF-MOUNTAIN-001)

**Type:** feat  
**Zone:** vehicles | waybills | fuel

**Context/problem:**  
Коэффициент горной местности (COEF-MOUNTAIN-001) был добавлен в types.ts и fuelCalculationService, но в UI не было соответствующих полей для ввода значений.

**What was done:**
- Добавлено поле `useMountainModifier` в интерфейс `Vehicle`
- Обновлена схема валидации `vehicleSchema.ts`
- В форме ТС добавлен 3-й блок "Горная местность" с чекбоксом и полем надбавки
- В `WaybillRouteRow.tsx` добавлен чекбокс "Горы" для отметки горных сегментов

**How verified:**
- Ожидает ручного тестирования

**Files:**
- [MODIFY] `types.ts`
- [MODIFY] `components/vehicles/vehicleSchema.ts`
- [MODIFY] `components/vehicles/VehicleList.tsx`
- [MODIFY] `components/waybills/form/WaybillRouteRow.tsx`

---

## 17.01.2026.13:55 — Excel Import Blank Assignment Fix

**Type:** fix  
**Zone:** waybills | blanks | import

**Context/problem:**  
При импорте из Excel ПЛ создавались с системной автонумерацией (WL-...). Выданные водителю бланки НЕ использовались.

**What was done:**
- Добавлена проверка наличия бланков у водителя перед импортом
- Реализовано резервирование бланков (`reserveBlank`)
- Номер ПЛ формируется из серии/номера бланка
- Добавлен диалог при нехватке бланков с выбором:
  - Использовать авто-номера
  - Отмена

**How verified:**
- Ожидает ручного тестирования

**Files:**
- [MODIFY] `components/waybills/ExcelImportModal.tsx`

---

## 17.01.2026.13:50 — Waybill List Filter Persistence

**Type:** feat  
**Zone:** waybills | ui | ux

**Context/problem:**  
Настройки журнала ПЛ (даты, статусы, ТС, водители) сбрасывались при каждом открытии страницы. Пользователям приходилось заново устанавливать фильтры.

**What was done:**
- Добавлена персистентность фильтров через localStorage
- Сохраняются: dateFrom, dateTo, status, vehicleId, driverId
- Сохраняется конфигурация сортировки (ключ и направление)
- Сохраняется режим отображения (расширенный/стандартный)

**How verified:**
- Ожидает ручного тестирования

**Files:**
- [MODIFY] `components/waybills/WaybillList.tsx`

---

## 17.01.2026.13:40 — Batch Import Blank Shortage Handling

**Type:** feat  
**Zone:** waybills | blanks | ui

**Context/problem:**  
При пакетном импорте из Excel, если у водителя недостаточно бланков, система молча присваивала номер "Б/Н". Пользователь не получал предупреждения.

**What was done:**
- Добавлена функция `estimateWaybillCount` — расчёт количества ПЛ с учётом группировки
- Добавлена функция `checkBlanksAvailability` — проверка наличия бланков у водителя
- В `BatchGeneratorModal.tsx` добавлен диалог выбора при нехватке бланков:
  - Использовать автоматические номера ("Б/Н")
  - Отмена — вернуться к предпросмотру

**How verified:**
- Ожидает ручного тестирования

**Files:**
- [MODIFY] `services/batchWaybillService.ts`
- [MODIFY] `components/waybills/BatchGeneratorModal.tsx`

---

## 2026-01-17 18:28 (MSK) — Unified Fuel Calculation Service

**Type:** feat  
**Zone:** fuel | waybills | validation

**Context/problem:**  
Логика расчёта топлива была распределена по 5 файлам с дублированием кода (`isWinterDate` определена в 2 местах). Отсутствовала поддержка горной местности (COEF-MOUNTAIN-001) и метода MIXED.

**What was done:**
- Создан единый сервис `services/fuelCalculationService.ts` с алгоритмами BOILER, SEGMENTS, MIXED
- Добавлена поддержка коэффициента горной местности (`isMountainDriving`, `mountainIncreasePercent`)
- Рефакторинг `utils/waybillCalculations.ts` — делегирование на новый сервис
- Рефакторинг `services/batchWaybillService.ts` — использование `calculateFuel()` с поддержкой метода
- Удалён дубликат `isWinterDate` из `services/api/settings.ts` (теперь re-export)
- Создан файл тестов `services/fuelCalculationService.test.ts`

**How verified:**
- `npm run build` — успешно (1119 modules, 5.36s)
- Unit-тесты — ожидает подтверждения пользователем

**Files:**
- [NEW] `services/fuelCalculationService.ts`
- [NEW] `services/fuelCalculationService.test.ts`
- [MODIFY] `types.ts`
- [MODIFY] `domain/waybill/fuel.ts`
- [MODIFY] `utils/waybillCalculations.ts`
- [MODIFY] `services/batchWaybillService.ts`
- [MODIFY] `services/api/settings.ts`

---

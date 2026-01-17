/**
 * Единый сервис расчёта расхода топлива.
 * 
 * ВСЕ расчёты топлива в приложении ДОЛЖНЫ использовать эти функции:
 * - WaybillDetail.tsx
 * - WaybillCheckModal.tsx
 * - batchWaybillService.ts
 * - waybillCalculations.ts
 * 
 * Алгоритмы:
 * - BOILER: Сумма отрезков → округление до целого → расчёт расхода → округление до сотых
 * - SEGMENTS: По каждому отрезку с модификаторами (город/прогрев/горы)
 * - MIXED: Усреднённая норма из отрезков, применённая к общему пробегу
 */

import { Route, SeasonSettings } from '../types';

// ============================================================================
// ТИПЫ
// ============================================================================

export type FuelCalculationMethod = 'BOILER' | 'SEGMENTS' | 'MIXED';

export interface FuelRates {
    summerRate: number;
    winterRate: number;
    cityIncreasePercent?: number;
    warmingIncreasePercent?: number;
    mountainIncreasePercent?: number;  // COEF-MOUNTAIN-001
}

export interface FuelCalculationInput {
    routes: Route[];
    rates: FuelRates;
    baseDate: string;
    seasonSettings: SeasonSettings | null;
    dayMode?: 'single' | 'multi';
    odometerDistance?: number;  // Для MIXED: пробег по одометру
}

export interface FuelCalculationResult {
    /** Суммарный пробег (округлённый до целого) */
    distance: number;
    /** Расход топлива (округлённый до сотых) */
    consumption: number;
    /** Расчётный одометр на конец */
    odometerEnd?: number;
}

// ============================================================================
// ОПРЕДЕЛЕНИЕ СЕЗОНА (ЕДИНСТВЕННАЯ РЕАЛИЗАЦИЯ)
// ============================================================================

/**
 * Определяет, является ли дата зимним периодом.
 * ЕДИНСТВЕННАЯ функция определения сезона во всём приложении.
 */
export const isWinterDate = (dateStr: string, settings: SeasonSettings | null): boolean => {
    if (!settings) return false;
    const date = new Date(dateStr);
    if (settings.type === 'manual') {
        if (!settings.winterStartDate || !settings.winterEndDate) return false;
        const start = new Date(settings.winterStartDate);
        const end = new Date(settings.winterEndDate);
        return date >= start && date <= end;
    } else {
        const m = date.getMonth() + 1;
        // Logic: if current month is >= winter start month OR < summer start month
        // Example: Winter starts Nov (11), Summer starts Apr (4).
        // Months 11, 12, 1, 2, 3 are winter.
        const winterMonth = settings.winterMonth || 11;
        const summerMonth = settings.summerMonth || 4;
        if (m >= winterMonth || m < summerMonth) return true;
        return false;
    }
};

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Определяет базовую норму расхода (зима/лето)
 * Экспортируется для использования в UI компонентах
 */
export const getBaseRateForDate = (date: string, rates: FuelRates, seasonSettings: SeasonSettings | null): number => {
    const isWinter = isWinterDate(date, seasonSettings);
    return isWinter
        ? (rates.winterRate || rates.summerRate || 0)
        : (rates.summerRate || rates.winterRate || 0);
};

/**
 * Суммирует расстояние всех отрезков (без округления)
 */
const sumRouteDistances = (routes: Route[]): number => {
    return routes.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0);
};

// ============================================================================
// АЛГОРИТМ 1: BOILER (По котлу)
// ============================================================================
/**
 * Расчёт по котлу — только база, без модификаторов.
 * 
 * Алгоритм:
 * 1. Суммировать все отрезки пути
 * 2. Округлить до целого
 * 3. Произвести расчёт расхода (км / 100 * норма)
 * 4. Округлить расход до сотых
 * 
 * @param input Входные данные расчёта
 * @returns Результат с distance и consumption
 */
export const calculateBoiler = (input: FuelCalculationInput): FuelCalculationResult => {
    const { routes, rates, baseDate, seasonSettings } = input;

    // 1. Суммировать все отрезки
    const rawDistance = sumRouteDistances(routes);

    // 2. Округлить до целого
    const distance = Math.round(rawDistance);

    // 3. Получить базовую норму (зима/лето)
    const baseRate = getBaseRateForDate(baseDate, rates, seasonSettings);

    // 4. Расчёт: (км / 100) * норма
    const rawConsumption = (distance / 100) * baseRate;

    // 5. Округлить до сотых
    const consumption = Math.round(rawConsumption * 100) / 100;

    return { distance, consumption };
};

// ============================================================================
// АЛГОРИТМ 2: SEGMENTS (По отрезкам)
// ============================================================================
/**
 * Расчёт по отрезкам — с учётом модификаторов (город/прогрев/горы) на каждом отрезке.
 * 
 * Алгоритм:
 * 1. Для каждого отрезка:
 *    - Определить базовую норму (зима/лето по дате отрезка)
 *    - Применить модификаторы (город, прогрев, горы)
 *    - Рассчитать расход отрезка
 * 2. Просуммировать расходы всех отрезков
 * 3. Округлить итоговый расход до сотых
 * 
 * @param input Входные данные расчёта
 * @returns Результат с distance и consumption
 */
export const calculateSegments = (input: FuelCalculationInput): FuelCalculationResult => {
    const { routes, rates, baseDate, seasonSettings, dayMode = 'multi' } = input;

    let totalConsumption = 0;

    for (const route of routes) {
        const distanceKm = Number(route.distanceKm) || 0;
        if (distanceKm === 0) continue;

        // Дата отрезка (для определения сезона)
        const routeDate = (dayMode === 'multi' && route.date) ? route.date : baseDate;

        // Базовая норма для этого отрезка
        const baseRate = getBaseRateForDate(routeDate, rates, seasonSettings);

        // Эффективная норма с модификаторами
        // Аддитивная модель коэффициентов (как на бэкенде)
        let totalCoeff = 0;

        if (route.isCityDriving && (rates.cityIncreasePercent || 0) > 0) {
            totalCoeff += (rates.cityIncreasePercent || 0) / 100;
        }

        if (route.isWarming && (rates.warmingIncreasePercent || 0) > 0) {
            totalCoeff += (rates.warmingIncreasePercent || 0) / 100;
        }

        // COEF-MOUNTAIN-001: Горная местность
        if (route.isMountainDriving && (rates.mountainIncreasePercent || 0) > 0) {
            totalCoeff += (rates.mountainIncreasePercent || 0) / 100;
        }

        const effectiveRate = baseRate * (1 + totalCoeff);

        // Расход отрезка
        totalConsumption += (distanceKm / 100) * effectiveRate;
    }

    // Общий пробег (округлённый до целого)
    const distance = Math.round(sumRouteDistances(routes));

    // Округлить расход до сотых
    const consumption = Math.round(totalConsumption * 100) / 100;

    return { distance, consumption };
};

// ============================================================================
// АЛГОРИТМ 3: MIXED (Смешанный)
// ============================================================================
/**
 * Смешанный расчёт — усреднённая норма из отрезков, применённая к общему пробегу.
 * 
 * Алгоритм:
 * 1. Рассчитать суммарный расход по отрезкам (как SEGMENTS)
 * 2. Рассчитать среднюю норму: суммарный_расход / (суммарный_пробег / 100)
 * 3. Применить среднюю норму к пробегу по одометру (или суммарному пробегу)
 * 4. Округлить расход до сотых
 * 
 * @param input Входные данные расчёта (odometerDistance используется для итогового расчёта)
 * @returns Результат с distance и consumption
 */
export const calculateMixed = (input: FuelCalculationInput): FuelCalculationResult => {
    const { routes, rates, baseDate, seasonSettings, dayMode = 'multi', odometerDistance } = input;

    // Сначала рассчитываем как SEGMENTS
    let totalConsRaw = 0;
    let segmentsKm = 0;

    for (const route of routes) {
        const distanceKm = Number(route.distanceKm) || 0;
        if (distanceKm === 0) continue;

        const routeDate = (dayMode === 'multi' && route.date) ? route.date : baseDate;
        const baseRate = getBaseRateForDate(routeDate, rates, seasonSettings);

        // Аддитивная модель коэффициентов
        let totalCoeff = 0;

        if (route.isCityDriving && (rates.cityIncreasePercent || 0) > 0) {
            totalCoeff += (rates.cityIncreasePercent || 0) / 100;
        }

        if (route.isWarming && (rates.warmingIncreasePercent || 0) > 0) {
            totalCoeff += (rates.warmingIncreasePercent || 0) / 100;
        }

        // COEF-MOUNTAIN-001: Горная местность
        if (route.isMountainDriving && (rates.mountainIncreasePercent || 0) > 0) {
            totalCoeff += (rates.mountainIncreasePercent || 0) / 100;
        }

        const effectiveRate = baseRate * (1 + totalCoeff);

        totalConsRaw += (distanceKm / 100) * effectiveRate;
        segmentsKm += distanceKm;
    }

    // Расстояние из маршрутов (округлённое)
    const distance = Math.round(segmentsKm);

    // Если нет маршрутов, fallback к BOILER
    if (segmentsKm === 0) {
        return calculateBoiler(input);
    }

    // Средняя норма
    const avgRate = totalConsRaw / (segmentsKm / 100);

    // Применяем к одометру (если есть) или к пробегу из маршрутов
    const finalDistance = odometerDistance ?? distance;
    const rawConsumption = (finalDistance / 100) * avgRate;

    // Округлить расход до сотых
    const consumption = Math.round(rawConsumption * 100) / 100;

    return { distance, consumption };
};

// ============================================================================
// УНИВЕРСАЛЬНАЯ ТОЧКА ВХОДА
// ============================================================================
/**
 * Универсальная функция расчёта топлива.
 * Выбирает алгоритм на основе указанного метода.
 * 
 * @param method Метод расчёта: 'BOILER' | 'SEGMENTS' | 'MIXED'
 * @param input Входные данные
 * @returns Результат расчёта
 */
export const calculateFuel = (
    method: FuelCalculationMethod,
    input: FuelCalculationInput
): FuelCalculationResult => {
    switch (method) {
        case 'BOILER':
            return calculateBoiler(input);
        case 'SEGMENTS':
            return calculateSegments(input);
        case 'MIXED':
            return calculateMixed(input);
        default:
            // Fallback к BOILER
            return calculateBoiler(input);
    }
};

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СОВМЕСТИМОСТИ
// ============================================================================

/**
 * Совместимость с методами из batchWaybillService:
 * 'by_total' → 'BOILER'
 * 'by_segment' → 'SEGMENTS'
 */
export const mapLegacyMethod = (legacyMethod: string): FuelCalculationMethod => {
    if (legacyMethod === 'by_segment') return 'SEGMENTS';
    // Используем MIXED вместо BOILER для by_total, чтобы учитывать модификаторы (город/горы) 
    // в усредненном расчете, даже если выбран метод "По общему пробегу".
    // Это решает проблему игнорирования галочек в UI.
    if (legacyMethod === 'by_total') return 'MIXED';
    return legacyMethod as FuelCalculationMethod;
};

/**
 * Рассчитывает одометр на конец.
 * Формула: Math.round(odometerStart + rawDistance)
 * Соответствует batchWaybillService: odometerEnd = Math.round(startOdo + distance)
 */
export const calculateOdometerEnd = (odometerStart: number, routes: Route[]): number => {
    const rawDistance = sumRouteDistances(routes);
    return Math.round(odometerStart + rawDistance);
};

/**
 * Рассчитывает остаток топлива на конец.
 * Формула: Math.round((start + filled - consumed) * 100) / 100
 */
export const calculateFuelEnd = (
    fuelStart: number,
    fuelFilled: number,
    fuelConsumed: number
): number => {
    const result = (fuelStart || 0) + (fuelFilled || 0) - (fuelConsumed || 0);
    return Math.round(result * 100) / 100;
};

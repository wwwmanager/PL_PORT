/**
 * Waybill calculations utility.
 * Now delegates to fuelCalculationService for all fuel-related calculations.
 */

import { Route, Vehicle, SeasonSettings, WaybillCalculationMethod } from '../types';
import {
    calculateFuel,
    mapLegacyMethod,
    getBaseRateForDate,
    FuelCalculationInput
} from '../services/fuelCalculationService';

// Re-export isWinterDate from the single source of truth
export { isWinterDate } from '../services/fuelCalculationService';

/**
 * Calculate total distance from routes (rounded to integer).
 */
export const calculateDistance = (routes: Route[]): number => {
    return Math.round(routes.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0));
};

/**
 * Calculate fuel consumption for routes.
 * Uses SEGMENTS method by default for precise calculation with modifiers.
 * 
 * @deprecated Use calculateFuel from fuelCalculationService directly
 */
export const calculateFuelConsumption = (
    routes: Route[],
    vehicle: Vehicle,
    seasonSettings: SeasonSettings,
    baseDate: string,
    dayMode: 'single' | 'multi' = 'multi'
): number => {
    const input: FuelCalculationInput = {
        routes,
        rates: vehicle.fuelConsumptionRates,
        baseDate,
        seasonSettings,
        dayMode
    };

    const result = calculateFuel('SEGMENTS', input);
    return result.consumption;
};

/**
 * Calculate statistics for waybill routes.
 * Delegates to fuelCalculationService for actual calculation.
 */
export const calculateStats = (
    routes: Route[],
    vehicle: Vehicle | undefined,
    seasonSettings: SeasonSettings | null,
    baseDate: string,
    dayMode: 'single' | 'multi' = 'multi',
    method: WaybillCalculationMethod = 'by_total'
) => {
    const rawDistance = routes.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0);

    // Fallback if no vehicle/settings available (just sum distance)
    if (!vehicle || !seasonSettings) {
        return {
            distance: Math.round(rawDistance),
            consumption: 0,
            averageRate: 0,
            baseRate: 0
        };
    }

    // Get base rate for display
    const baseRate = getBaseRateForDate(baseDate, vehicle.fuelConsumptionRates, seasonSettings);

    // Prepare input for unified calculation
    const input: FuelCalculationInput = {
        routes,
        rates: vehicle.fuelConsumptionRates,
        baseDate,
        seasonSettings,
        dayMode
    };

    // Map legacy method to new method and calculate
    const fuelMethod = mapLegacyMethod(method);
    const result = calculateFuel(fuelMethod, input);

    // Calculate effective average rate for display purposes
    const averageRate = rawDistance > 0
        ? (result.consumption / rawDistance) * 100
        : baseRate;

    return {
        distance: result.distance,
        consumption: result.consumption,
        averageRate,
        baseRate
    };
};

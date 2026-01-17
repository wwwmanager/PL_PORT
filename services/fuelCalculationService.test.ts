import { describe, it, expect } from 'vitest';
import {
    isWinterDate,
    getBaseRateForDate,
    calculateBoiler,
    calculateSegments,
    calculateMixed,
    calculateFuel,
    mapLegacyMethod,
    calculateOdometerEnd,
    calculateFuelEnd,
    FuelRates,
    FuelCalculationInput
} from './fuelCalculationService';
import { Route, SeasonSettings } from '../types';

// ============================================================================
// TEST DATA
// ============================================================================

const summerSettings: SeasonSettings = {
    type: 'recurring',
    summerMonth: 4,  // April
    winterMonth: 11  // November
};

const manualWinterSettings: SeasonSettings = {
    type: 'manual',
    winterStartDate: '2024-11-15',
    winterEndDate: '2025-03-15'
};

const defaultRates: FuelRates = {
    summerRate: 10,
    winterRate: 12,
    cityIncreasePercent: 10,
    warmingIncreasePercent: 5,
    mountainIncreasePercent: 15
};

const createRoute = (distanceKm: number, opts: Partial<Route> = {}): Route => ({
    id: `route-${Math.random()}`,
    from: 'A',
    to: 'B',
    distanceKm,
    isCityDriving: false,
    isWarming: false,
    ...opts
});

// ============================================================================
// isWinterDate TESTS
// ============================================================================

describe('isWinterDate', () => {
    it('should return false when settings is null', () => {
        expect(isWinterDate('2024-01-15', null)).toBe(false);
    });

    describe('recurring mode', () => {
        it('should identify winter months correctly (Nov-Mar)', () => {
            expect(isWinterDate('2024-01-15', summerSettings)).toBe(true);  // January
            expect(isWinterDate('2024-02-28', summerSettings)).toBe(true);  // February
            expect(isWinterDate('2024-03-31', summerSettings)).toBe(true);  // March
            expect(isWinterDate('2024-11-01', summerSettings)).toBe(true);  // November
            expect(isWinterDate('2024-12-25', summerSettings)).toBe(true);  // December
        });

        it('should identify summer months correctly (Apr-Oct)', () => {
            expect(isWinterDate('2024-04-01', summerSettings)).toBe(false); // April
            expect(isWinterDate('2024-07-15', summerSettings)).toBe(false); // July
            expect(isWinterDate('2024-10-31', summerSettings)).toBe(false); // October
        });
    });

    describe('manual mode', () => {
        it('should identify dates within manual winter range', () => {
            expect(isWinterDate('2024-12-01', manualWinterSettings)).toBe(true);
            expect(isWinterDate('2025-01-15', manualWinterSettings)).toBe(true);
            expect(isWinterDate('2025-03-15', manualWinterSettings)).toBe(true);
        });

        it('should identify dates outside manual winter range', () => {
            expect(isWinterDate('2024-11-14', manualWinterSettings)).toBe(false);
            expect(isWinterDate('2025-03-16', manualWinterSettings)).toBe(false);
            expect(isWinterDate('2024-07-01', manualWinterSettings)).toBe(false);
        });
    });
});

// ============================================================================
// getBaseRateForDate TESTS
// ============================================================================

describe('getBaseRateForDate', () => {
    it('should return summer rate for summer date', () => {
        expect(getBaseRateForDate('2024-07-15', defaultRates, summerSettings)).toBe(10);
    });

    it('should return winter rate for winter date', () => {
        expect(getBaseRateForDate('2024-01-15', defaultRates, summerSettings)).toBe(12);
    });

    it('should fallback to summerRate when winterRate is 0', () => {
        const rates: FuelRates = { summerRate: 10, winterRate: 0 };
        expect(getBaseRateForDate('2024-01-15', rates, summerSettings)).toBe(10);
    });

    it('should fallback to winterRate when summerRate is 0', () => {
        const rates: FuelRates = { summerRate: 0, winterRate: 12 };
        expect(getBaseRateForDate('2024-07-15', rates, summerSettings)).toBe(12);
    });
});

// ============================================================================
// BOILER ALGORITHM TESTS
// ============================================================================

describe('calculateBoiler', () => {
    it('should calculate simple consumption without modifiers', () => {
        const input: FuelCalculationInput = {
            routes: [createRoute(50), createRoute(50)],
            rates: defaultRates,
            baseDate: '2024-07-15',  // Summer
            seasonSettings: summerSettings
        };

        const result = calculateBoiler(input);

        expect(result.distance).toBe(100);
        // 100km / 100 * 10 = 10 liters
        expect(result.consumption).toBe(10);
    });

    it('should round distance to integer', () => {
        const input: FuelCalculationInput = {
            routes: [createRoute(33.3), createRoute(33.3), createRoute(33.3)],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings
        };

        const result = calculateBoiler(input);

        // 33.3 * 3 = 99.9 → rounds to 100
        expect(result.distance).toBe(100);
    });

    it('should use winter rate for winter date', () => {
        const input: FuelCalculationInput = {
            routes: [createRoute(100)],
            rates: defaultRates,
            baseDate: '2024-01-15',  // Winter
            seasonSettings: summerSettings
        };

        const result = calculateBoiler(input);

        // 100km / 100 * 12 = 12 liters
        expect(result.consumption).toBe(12);
    });

    it('should ignore city/warming/mountain modifiers', () => {
        const input: FuelCalculationInput = {
            routes: [
                createRoute(100, { isCityDriving: true, isWarming: true, isMountainDriving: true })
            ],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings
        };

        const result = calculateBoiler(input);

        // BOILER ignores modifiers, should be 10 liters
        expect(result.consumption).toBe(10);
    });

    it('should handle empty routes', () => {
        const input: FuelCalculationInput = {
            routes: [],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings
        };

        const result = calculateBoiler(input);

        expect(result.distance).toBe(0);
        expect(result.consumption).toBe(0);
    });
});

// ============================================================================
// SEGMENTS ALGORITHM TESTS
// ============================================================================

describe('calculateSegments', () => {
    it('should calculate consumption with city modifier', () => {
        const input: FuelCalculationInput = {
            routes: [createRoute(100, { isCityDriving: true })],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings
        };

        const result = calculateSegments(input);

        // 100km / 100 * 10 * (1 + 0.10) = 11 liters
        expect(result.consumption).toBe(11);
    });

    it('should calculate consumption with warming modifier', () => {
        const input: FuelCalculationInput = {
            routes: [createRoute(100, { isWarming: true })],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings
        };

        const result = calculateSegments(input);

        // 100km / 100 * 10 * (1 + 0.05) = 10.5 liters
        expect(result.consumption).toBe(10.5);
    });

    it('should calculate consumption with mountain modifier (COEF-MOUNTAIN-001)', () => {
        const input: FuelCalculationInput = {
            routes: [createRoute(100, { isMountainDriving: true })],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings
        };

        const result = calculateSegments(input);

        // 100km / 100 * 10 * (1 + 0.15) = 11.5 liters
        expect(result.consumption).toBe(11.5);
    });

    it('should sum all modifiers additively', () => {
        const input: FuelCalculationInput = {
            routes: [
                createRoute(100, { isCityDriving: true, isWarming: true, isMountainDriving: true })
            ],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings
        };

        const result = calculateSegments(input);

        // 100km / 100 * 10 * (1 + 0.10 + 0.05 + 0.15) = 13 liters
        expect(result.consumption).toBe(13);
    });

    it('should handle multi-day mode with different dates', () => {
        const input: FuelCalculationInput = {
            routes: [
                createRoute(100, { date: '2024-07-15' }),  // Summer: 10
                createRoute(100, { date: '2024-01-15' })   // Winter: 12
            ],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings,
            dayMode: 'multi'
        };

        const result = calculateSegments(input);

        expect(result.distance).toBe(200);
        // (100/100 * 10) + (100/100 * 12) = 10 + 12 = 22
        expect(result.consumption).toBe(22);
    });

    it('should use baseDate for all routes in single mode', () => {
        const input: FuelCalculationInput = {
            routes: [
                createRoute(100, { date: '2024-01-15' }),  // Would be winter
                createRoute(100, { date: '2024-01-15' })
            ],
            rates: defaultRates,
            baseDate: '2024-07-15',  // Summer base date
            seasonSettings: summerSettings,
            dayMode: 'single'
        };

        const result = calculateSegments(input);

        // Both routes use summer rate due to dayMode: 'single'
        expect(result.consumption).toBe(20);
    });
});

// ============================================================================
// MIXED ALGORITHM TESTS
// ============================================================================

describe('calculateMixed', () => {
    it('should apply average rate to odometer distance', () => {
        const input: FuelCalculationInput = {
            routes: [
                createRoute(50, { isCityDriving: true }),   // city: +10%
                createRoute(50, { isWarming: true })        // warming: +5%
            ],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings,
            odometerDistance: 100
        };

        const result = calculateMixed(input);

        // Segment 1: 50/100 * 10 * 1.10 = 5.5
        // Segment 2: 50/100 * 10 * 1.05 = 5.25
        // Total segments: 10.75, Total km: 100
        // Avg rate: 10.75 / (100/100) = 10.75
        // Final: 100 / 100 * 10.75 = 10.75
        expect(result.consumption).toBe(10.75);
    });

    it('should use route distance when odometerDistance not provided', () => {
        const input: FuelCalculationInput = {
            routes: [createRoute(100)],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings
        };

        const result = calculateMixed(input);

        expect(result.distance).toBe(100);
        expect(result.consumption).toBe(10);
    });

    it('should fallback to BOILER when no routes', () => {
        const input: FuelCalculationInput = {
            routes: [],
            rates: defaultRates,
            baseDate: '2024-07-15',
            seasonSettings: summerSettings,
            odometerDistance: 100
        };

        const result = calculateMixed(input);

        expect(result.distance).toBe(0);
        expect(result.consumption).toBe(0);
    });
});

// ============================================================================
// calculateFuel (UNIVERSAL ENTRY POINT) TESTS
// ============================================================================

describe('calculateFuel', () => {
    const baseInput: FuelCalculationInput = {
        routes: [createRoute(100)],
        rates: defaultRates,
        baseDate: '2024-07-15',
        seasonSettings: summerSettings
    };

    it('should route to BOILER correctly', () => {
        const result = calculateFuel('BOILER', baseInput);
        expect(result.consumption).toBe(10);
    });

    it('should route to SEGMENTS correctly', () => {
        const input = {
            ...baseInput,
            routes: [createRoute(100, { isCityDriving: true })]
        };
        const result = calculateFuel('SEGMENTS', input);
        expect(result.consumption).toBe(11);
    });

    it('should route to MIXED correctly', () => {
        const result = calculateFuel('MIXED', baseInput);
        expect(result.consumption).toBe(10);
    });

    it('should fallback to BOILER for unknown method', () => {
        const result = calculateFuel('UNKNOWN' as any, baseInput);
        expect(result.consumption).toBe(10);
    });
});

// ============================================================================
// HELPER FUNCTIONS TESTS
// ============================================================================

describe('mapLegacyMethod', () => {
    it('should map by_total to BOILER', () => {
        expect(mapLegacyMethod('by_total')).toBe('BOILER');
    });

    it('should map by_segment to SEGMENTS', () => {
        expect(mapLegacyMethod('by_segment')).toBe('SEGMENTS');
    });

    it('should pass through new method names', () => {
        expect(mapLegacyMethod('BOILER')).toBe('BOILER');
        expect(mapLegacyMethod('SEGMENTS')).toBe('SEGMENTS');
        expect(mapLegacyMethod('MIXED')).toBe('MIXED');
    });
});

describe('calculateOdometerEnd', () => {
    it('should add distance to start odometer', () => {
        const routes = [createRoute(50), createRoute(75.5)];
        const result = calculateOdometerEnd(10000, routes);
        // 10000 + 125.5 = 10125.5 → rounds to 10126
        expect(result).toBe(10126);
    });
});

describe('calculateFuelEnd', () => {
    it('should calculate fuel balance correctly', () => {
        // 50 + 30 - 25 = 55
        expect(calculateFuelEnd(50, 30, 25)).toBe(55);
    });

    it('should handle zero values', () => {
        expect(calculateFuelEnd(0, 0, 0)).toBe(0);
    });

    it('should allow negative result (for validation)', () => {
        // 10 + 0 - 15 = -5
        expect(calculateFuelEnd(10, 0, 15)).toBe(-5);
    });

    it('should round to 2 decimal places', () => {
        // 10.123 + 5.456 - 3.333 = 12.246
        expect(calculateFuelEnd(10.123, 5.456, 3.333)).toBe(12.25);
    });
});

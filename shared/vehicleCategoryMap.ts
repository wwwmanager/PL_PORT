/**
 * Vehicle category mapping
 * Maps vehicle types to allowed driver license categories
 */

import { DriverLicenseCategory } from '../types';

/**
 * Matrix: Vehicle Type → Allowed Categories
 */
export const VEHICLE_TYPE_TO_CATEGORIES: Record<string, DriverLicenseCategory[]> = {
    'Легковой': ['B', 'B1'],
    'Тягач': ['C1', 'C'],
    'Прицеп': ['BE', 'CE', 'DE', 'C1E', 'D1E'],
    'Автобус': ['D', 'D1', 'DE', 'D1E'],
    'Спецтехника': ['AI', 'AII', 'A3', 'A4', 'B', 'C', 'D', 'E', 'F']
};

/**
 * Labels for UI display
 * Note: A3 displays as "AIII", A4 displays as "AIV"
 */
export const CATEGORY_LABELS: Record<DriverLicenseCategory, string> = {
    // Обычные права
    'M': 'M - Мопеды',
    'A': 'A - Мотоциклы',
    'A1': 'A1 - Легкие мотоциклы',
    'B': 'B - Легковые до 3.5т',
    'B1': 'B1 - Трициклы/квадрициклы',
    'C': 'C - Грузовые',
    'C1': 'C1 - Средние грузовые до 7.5т',
    'D': 'D - Автобусы',
    'D1': 'D1 - Малые автобусы',
    'BE': 'BE - Легковые + прицеп',
    'CE': 'CE - Грузовые + прицеп',
    'C1E': 'C1E - Средние грузовые + прицеп',
    'DE': 'DE - Автобусы + прицеп',
    'D1E': 'D1E - Малые автобусы + прицеп',
    'Tm': 'Tm - Трамваи (устаревшее)',
    'Tb': 'Tb - Троллейбусы (устаревшее)',

    // УТМ (самоходная техника)
    'AI': 'AI - Мототранспорт',
    'AII': 'AII - Не на пневмоходу',
    'A3': 'AIII - На пневмоходу',
    'A4': 'AIV - Внедорожные',
    'E': 'E - Гусеничные',
    'F': 'F - Самоходные'
};

/**
 * Special labels for UTM (Special Machinery)
 * Used when vehicleType is 'Спецтехника'
 */
export const UTM_CATEGORY_LABELS: Partial<Record<DriverLicenseCategory, string>> = {
    'AI': 'AI - Мототранспортные средства',
    'AII': 'AII - Автотранспортные < 3500кг',
    'A3': 'AIII - Автотранспортные > 3500кг',
    'A4': 'AIV - Автотранспортные > 8 мест',
    'B': 'B - Гус. и кол. машины до 25,7 кВт',
    'C': 'C - Кол. машины от 25,7 до 110,3 кВт',
    'D': 'D - Кол. машины > 110,3 кВт',
    'E': 'E - Гус. машины > 25,7 кВт',
    'F': 'F - Комбайны'
};

/**
 * Get allowed categories for a vehicle type
 * Filters out deprecated Tm/Tb categories
 */
export function getAllowedCategories(vehicleType?: string | null): DriverLicenseCategory[] {
    if (!vehicleType) return [];

    const categories = VEHICLE_TYPE_TO_CATEGORIES[vehicleType] || [];

    // Exclude Tm/Tb (deprecated)
    return categories.filter(c => c !== 'Tm' && c !== 'Tb');
}

/**
 * Check if category is allowed for vehicle type
 */
export function isCategoryAllowed(
    category: DriverLicenseCategory | null | undefined,
    vehicleType: string | null | undefined
): boolean {
    if (!category || !vehicleType) return true; // Allow empty

    const allowed = getAllowedCategories(vehicleType);
    return allowed.includes(category);
}

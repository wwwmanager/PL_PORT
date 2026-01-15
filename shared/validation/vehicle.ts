/**
 * Vehicle validation and normalization utilities
 * Extracted from services/faker.ts for better separation of concerns
 */

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalizes a plate number to canonical format:
 * - Trim whitespace
 * - Convert to uppercase
 * - Remove all spaces and dashes
 * 
 * @example normalizePlate('а123вс 77') → 'А123ВС77'
 */
export function normalizePlate(s: unknown): string {
    if (typeof s !== 'string') return '';
    return s.trim().toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Normalizes a VIN to canonical format:
 * - Trim whitespace
 * - Convert to uppercase
 * - Remove all spaces and dashes
 * 
 * @example normalizeVin('vin1234567890abc') → 'VIN1234567890ABC'
 */
export function normalizeVin(s: unknown): string {
    if (typeof s !== 'string') return '';
    return s.trim().toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Converts empty string to null, preserves non-empty strings
 * 
 * @example emptyToNull('  ') → null
 * @example emptyToNull('ABC123') → 'ABC123'
 */
export function emptyToNull(s: string | null | undefined): string | null {
    if (!s || s.trim() === '') return null;
    return s.trim();
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates plate number (Russian format)
 * Format: А123ВС77 (without spaces)
 * Допустимы только латинские символы: ABEKMHOPCTYX (12 букв, совпадающих с латиницей)
 * 
 * @param value - normalized plate number
 * @returns error message or null if valid
 */
export function validatePlateNumber(value: string): string | null {
    if (!value) return "Гос. номер обязателен";

    // Strict format after normalization: А123ВС77
    const regex = /^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2,3}$/;

    if (!regex.test(value)) {
        return "Неверный формат гос. номера. Пример: A123BC77. Допустимы только латинские символы: ABEKMHOPCTYX";
    }

    return null;
}

/**
 * Validates VIN (soft validation - optional field)
 * If provided, must be exactly 17 characters, no I/O/Q
 * 
 * @param value - normalized VIN or null
 * @returns error message or null if valid
 */
export function validateVin(value: string | null | undefined): string | null {
    // VIN is optional
    if (!value || value === '') return null;

    // If provided, must be exactly 17 characters
    if (value.length !== 17) {
        return "VIN должен содержать ровно 17 символов";
    }

    // Only alphanumeric, excluding I, O, Q (as per ISO 3779)
    const regex = /^[A-HJ-NPR-Z0-9]{17}$/;

    if (!regex.test(value)) {
        return "VIN содержит недопустимые символы. Разрешены только латинские символы (кроме I, O, Q) и цифры";
    }

    return null;
}

/**
 * Validates body number (soft validation)
 * 
 * @param value - body number
 * @returns error message or null if valid
 */
export function validateBodyNumber(value: string | null | undefined): string | null {
    // Body number is optional
    if (!value || value === '') return null;

    const trimmed = value.trim();

    if (trimmed.length < 3) {
        return "Номер кузова должен содержать минимум 3 символа";
    }

    if (trimmed.length > 64) {
        return "Номер кузова слишком длинный (максимум 64 символа)";
    }

    // Allow alphanumeric, dashes, slashes
    const regex = /^[A-Z0-9\-\/]+$/i;

    if (!regex.test(trimmed)) {
        return "Номер кузова может содержать только буквы, цифры, дефисы и слэши";
    }

    return null;
}

/**
 * Validates chassis number (soft validation)
 * 
 * @param value - chassis number
 * @returns error message or null if valid
 */
export function validateChassisNumber(value: string | null | undefined): string | null {
    // Chassis number is optional
    if (!value || value === '') return null;

    const trimmed = value.trim();

    if (trimmed.length < 3) {
        return "Номер шасси/рамы должен содержать минимум 3 символа";
    }

    if (trimmed.length > 64) {
        return "Номер шасси/рамы слишком длинный (максимум 64 символа)";
    }

    // Allow alphanumeric, dashes, slashes
    const regex = /^[A-Z0-9\-\/]+$/i;

    if (!regex.test(trimmed)) {
        return "Номер шасси/рамы может содержать только буквы, цифры, дефисы и слэши";
    }

    return null;
}

// ============================================================================
// WARNING FUNCTIONS
// ============================================================================

/**
 * Returns non-blocking warnings for a vehicle
 * Used to alert user about missing data without preventing save
 */
export function getVehicleWarnings(v: Partial<{
    status: string;
    vin?: string | null;
    bodyNumber?: string | null;
    chassisNumber?: string | null;
    vehicleType?: string | null;
}>): string[] {
    const warnings: string[] = [];

    // Only check active vehicles
    if (v.status !== 'Active') return warnings;

    // Check if all identifiers are missing
    const hasVin = v.vin && v.vin.trim() !== '';
    const hasBody = v.bodyNumber && v.bodyNumber.trim() !== '';
    const hasChassis = v.chassisNumber && v.chassisNumber.trim() !== '';

    if (!hasVin && !hasBody && !hasChassis) {
        warnings.push(
            '⚠️ Рекомендуется заполнить хотя бы один идентификатор: VIN, номер кузова или номер шасси'
        );
    }

    // Special hint for special equipment
    if (v.vehicleType === 'Спецтехника' && !hasVin && !hasChassis) {
        warnings.push(
            '💡 Для спецтехники рекомендуется указать номер шасси/рамы при наличии'
        );
    }

    return warnings;
}

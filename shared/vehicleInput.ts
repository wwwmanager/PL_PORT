/**
 * Vehicle input normalization and validation
 * Handles real-time input with cyrillic-to-latin auto-conversion
 */

// ============================================================================
// MAPPING TABLES
// ============================================================================

/**
 * Variant A: Visually similar letters (GOST lookalikes)
 * Cyrillic letters that look like Latin equivalents
 */
const CYRILLIC_TO_LATIN_LOOKALIKES: Record<string, string> = {
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H',
    'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X',
    'а': 'A', 'в': 'B', 'е': 'E', 'к': 'K', 'м': 'M', 'н': 'H',
    'о': 'O', 'р': 'P', 'с': 'C', 'т': 'T', 'у': 'Y', 'х': 'X',
};

/**
 * Variant B: Russian keyboard layout to English (fallback)
 * For when user typed in wrong layout
 */
const RU_TO_EN_KEYBOARD: Record<string, string> = {
    'й': 'Q', 'ц': 'W', 'у': 'E', 'к': 'R', 'е': 'T', 'н': 'Y',
    'г': 'U', 'ш': 'I', 'щ': 'O', 'з': 'P', 'х': '[', 'ъ': ']',
    'ф': 'A', 'ы': 'S', 'в': 'D', 'а': 'F', 'п': 'G', 'р': 'H',
    'о': 'J', 'л': 'K', 'д': 'L', 'ж': ';', 'э': '\'',
    'я': 'Z', 'ч': 'X', 'с': 'C', 'м': 'V', 'и': 'B', 'т': 'N',
    'ь': 'M', 'б': ',', 'ю': '.',
    'Й': 'Q', 'Ц': 'W', 'У': 'E', 'К': 'R', 'Е': 'T', 'Н': 'Y',
    'Г': 'U', 'Ш': 'I', 'Щ': 'O', 'З': 'P', 'Х': '[', 'Ъ': ']',
    'Ф': 'A', 'Ы': 'S', 'В': 'D', 'А': 'F', 'П': 'G', 'Р': 'H',
    'О': 'J', 'Л': 'K', 'Д': 'L', 'Ж': ';', 'Э': '\'',
    'Я': 'Z', 'Ч': 'X', 'С': 'C', 'М': 'V', 'И': 'B', 'Т': 'N',
    'Ь': 'M', 'Б': ',', 'Ю': '.',
};

// ============================================================================
// TYPES
// ============================================================================

export interface NormalizeResult {
    value: string;
    wasConverted: boolean;
}

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Detect if string contains cyrillic characters
 */
function hasCyrillic(str: string): boolean {
    return /[а-яА-ЯёЁ]/.test(str);
}

/**
 * Convert cyrillic to latin using lookalikes (Variant A)
 */
function mapCyrillicLookalikesToLatin(str: string): string {
    return str.split('').map(char => CYRILLIC_TO_LATIN_LOOKALIKES[char] || char).join('');
}

/**
 * Convert cyrillic to latin using keyboard layout (Variant B)
 */
function mapRuKeyboardToEn(str: string): string {
    return str.split('').map(char => RU_TO_EN_KEYBOARD[char] || char).join('');
}

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalize plate number input (ГРЗ)
 * Format: A123BC77 (no spaces, uppercase, only allowed letters)
 */
export function normalizePlateInput(input: string): NormalizeResult {
    let value = input.trim().toUpperCase();
    let wasConverted = false;

    // Check if contains cyrillic
    if (hasCyrillic(value)) {
        wasConverted = true;

        // Variant A: Convert lookalikes first
        value = mapCyrillicLookalikesToLatin(value);

        // Variant B: If still has cyrillic, try keyboard mapping
        if (hasCyrillic(value)) {
            value = mapRuKeyboardToEn(value);
        }
    }

    // Remove spaces and dashes
    value = value.replace(/[\s-]/g, '');

    // Filter to allowed characters for plate (A-Z except I/O/Q, and digits)
    // For Russian plates, we allow all latin but will validate separately
    value = value.replace(/[^A-Z0-9]/g, '');

    return { value, wasConverted };
}

/**
 * Normalize VIN input
 * Format: 17 characters, uppercase, no I/O/Q
 */
export function normalizeVinInput(input: string): NormalizeResult {
    let value = input.trim().toUpperCase();
    let wasConverted = false;

    // Check if contains cyrillic
    if (hasCyrillic(value)) {
        wasConverted = true;

        // Variant A: Convert lookalikes first
        value = mapCyrillicLookalikesToLatin(value);

        // Variant B: If still has cyrillic, try keyboard mapping
        if (hasCyrillic(value)) {
            value = mapRuKeyboardToEn(value);
        }
    }

    // Remove spaces and dashes
    value = value.replace(/[\s-]/g, '');

    // Filter to allowed characters for VIN (no I/O/Q)
    value = value.replace(/[^A-HJ-NPR-Z0-9]/g, '');

    // Limit to 17 characters
    if (value.length > 17) {
        value = value.substring(0, 17);
    }

    return { value, wasConverted };
}

/**
 * Normalize body number input
 * Format: uppercase, alphanumeric with dashes/slashes allowed
 */
export function normalizeBodyInput(input: string): NormalizeResult {
    let value = input.trim().toUpperCase();
    let wasConverted = false;

    // Check if contains cyrillic
    if (hasCyrillic(value)) {
        wasConverted = true;

        // Variant A: Convert lookalikes first
        value = mapCyrillicLookalikesToLatin(value);

        // Variant B: If still has cyrillic, try keyboard mapping
        if (hasCyrillic(value)) {
            value = mapRuKeyboardToEn(value);
        }
    }

    // Remove spaces (keep dashes/slashes)
    value = value.replace(/\s/g, '');

    // Filter to allowed characters
    value = value.replace(/[^A-Z0-9\-\/]/g, '');

    return { value, wasConverted };
}

/**
 * Normalize chassis number input
 * Same as body number
 */
export function normalizeChassisInput(input: string): NormalizeResult {
    return normalizeBodyInput(input);
}

// ============================================================================
// SOFT VALIDATION FUNCTIONS
// ============================================================================

/**
 * Soft validation for plate number (during input)
 * Allows partial input but validates complete format
 */
export function validatePlateSoft(value: string): ValidationResult {
    if (!value || value.trim() === '') {
        return { isValid: false, error: 'Гос. номер обязателен' };
    }

    // Check format: should be like A123BC77
    const plateRegex = /^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2,3}$/;
    if (!plateRegex.test(value)) {
        if (value.length < 8) {
            return { isValid: false, error: 'Неполный номер (минимум 8 символов)' };
        }
        return { isValid: false, error: 'Неверный формат гос. номера. Пример: A123BC77. Допустимы только латинские символы: ABEKMHOPCTYX' };
    }

    return { isValid: true };
}

/**
 * Soft validation for VIN (during input)
 * Optional, but if filled must be 17 characters without I/O/Q
 */
export function validateVinSoft(value: string): ValidationResult {
    // Empty is valid (optional field)
    if (!value || value.trim() === '') {
        return { isValid: true };
    }

    // Must be exactly 17 characters
    if (value.length !== 17) {
        return { isValid: false, error: `VIN должен быть 17 символов (сейчас: ${value.length})` };
    }

    // Must not contain I/O/Q
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
    if (!vinRegex.test(value)) {
        return { isValid: false, error: 'VIN содержит недопустимые символы. Разрешены только латинские символы (кроме I, O, Q) и цифры' };
    }

    return { isValid: true };
}

/**
 * Soft validation for body number (during input)
 * Optional, but if filled must be at least 3 characters
 */
export function validateBodySoft(value: string): ValidationResult {
    // Empty is valid (optional field)
    if (!value || value.trim() === '') {
        return { isValid: true };
    }

    // Minimum 3 characters
    if (value.length < 3) {
        return { isValid: false, error: 'Минимум 3 символа' };
    }

    // Maximum 64 characters
    if (value.length > 64) {
        return { isValid: false, error: 'Максимум 64 символа' };
    }

    return { isValid: true };
}

/**
 * Soft validation for chassis number (during input)
 * Same as body number
 */
export function validateChassisSoft(value: string): ValidationResult {
    return validateBodySoft(value);
}

/**
 * Validates plate number (Russian format)
 * Format: A123BC77 (without spaces) - LATIN characters only
 * Allowed Latin letters: ABEKMHOPCTYX (visually similar to Cyrillic АВЕКМНОРСТУХ)
 * 
 * @param value - normalized plate number
 * @returns error message or null if valid
 */
export function validatePlateNumber(value: string): string | null {
    if (!value) return "Гос. номер обязателен";

    // Strict format after normalization: A123BC77 (LATIN only)
    // Allowed: A B E K M H O P C T Y X
    const regex = /^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2,3}$/;

    if (!regex.test(value)) {
        return "Неверный формат гос. номера. Пример: A123BC77. Допустимы только латинские символы: ABEKMHOPCTYX";
    }

    return null;
}

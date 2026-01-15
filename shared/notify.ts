/**
 * Unified notification service with anti-spam logic
 * Prevents duplicate toasts with debounce and TTL-based deduplication
 * 
 * Usage: Call createNotify(showToast) to get notify functions
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Track last shown timestamp for each notification key
 */
const lastShownMap = new Map<string, number>();

/**
 * Pending debounced notifications
 */
const pendingTimeouts = new Map<string, NodeJS.Timeout>();

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_TTL_MS = 10000; // Don't show same notification within 10 seconds
const DEFAULT_DEBOUNCE_MS = 800; // Wait 800ms after last input before showing

// ============================================================================
// TYPES
// ============================================================================

type ToastType = 'success' | 'error' | 'info';
type ShowToastFn = (message: string, type?: ToastType) => void;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create notify functions bound to a showToast implementation
 */
export function createNotify(showToast: ShowToastFn) {
    /**
     * Show notification only once per TTL period
     * Prevents spam by tracking last shown time
     */
    function notifyOnce(
        key: string,
        message: string,
        options: {
            ttlMs?: number;
            type?: ToastType;
        } = {}
    ): void {
        const { ttlMs = DEFAULT_TTL_MS, type = 'info' } = options;
        const now = Date.now();
        const lastShown = lastShownMap.get(key);

        // Check if we showed this recently
        if (lastShown && now - lastShown < ttlMs) {
            return; // Skip, too soon
        }

        // Show toast
        showToast(message, type);

        // Update last shown timestamp
        lastShownMap.set(key, now);
    }

    /**
     * Show notification with debounce
     * Waits for user to stop typing before showing
     * Combines with TTL to prevent spam
     */
    function notifyDebounced(
        key: string,
        message: string,
        options: {
            debounceMs?: number;
            ttlMs?: number;
            type?: ToastType;
        } = {}
    ): void {
        const { debounceMs = DEFAULT_DEBOUNCE_MS, ttlMs = DEFAULT_TTL_MS, type = 'info' } = options;

        // Clear existing pending timeout for this key
        const existingTimeout = pendingTimeouts.get(key);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new timeout
        const timeout = setTimeout(() => {
            notifyOnce(key, message, { ttlMs, type });
            pendingTimeouts.delete(key);
        }, debounceMs);

        pendingTimeouts.set(key, timeout);
    }

    /**
     * Clear all pending notifications (useful on unmount)
     */
    function clearPending(): void {
        for (const timeout of pendingTimeouts.values()) {
            clearTimeout(timeout);
        }
        pendingTimeouts.clear();
    }

    /**
     * Reset notification state for a specific key
     * Useful when you want to allow re-showing after manual trigger
     */
    function resetKey(key: string): void {
        lastShownMap.delete(key);
        const timeout = pendingTimeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            pendingTimeouts.delete(key);
        }
    }

    return { notifyOnce, notifyDebounced, clearPending, resetKey };
}

import { getLocalDateString } from './dateUtils';

/**
 * Normalizes any input date (string, timestamp, Date obj) to a YYYY-MM-DD string.
 */
export const normalizeToDateString = (dateInput) => {
    if (!dateInput) return null;
    if (typeof dateInput === 'string') {
        const datePart = dateInput.split('T')[0];
        if (datePart.length === 10 && datePart.includes('-')) return datePart;
    }
    try {
        const d = new Date(dateInput);
        if (!isNaN(d.getTime())) {
            return getLocalDateString(d);
        }
    } catch (e) {
        // Fallback
    }
    return null;
};

/**
 * Robust matcher function for checking if a given date satisfies the filterConfig.
 * filterConfig can be:
 * { type: 'preset', preset: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all' }
 * { type: 'single', date: 'YYYY-MM-DD' }
 * { type: 'range', startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 * OR legacy string ('today', 'yesterday', 'week', 'month', 'year', 'all').
 */
export const isDateMatchingFilter = (targetDateInput, filterConfig) => {
    if (!targetDateInput) return false;
    const targetStr = normalizeToDateString(targetDateInput);
    if (!targetStr) return false;

    // Handle legacy string argument
    if (typeof filterConfig === 'string') {
        filterConfig = { type: 'preset', preset: filterConfig };
    }

    const type = filterConfig?.type || 'preset';

    if (type === 'preset') {
        const preset = filterConfig?.preset || 'all';
        if (preset === 'all') return true;

        const todayStr = getLocalDateString(new Date());
        if (preset === 'today') return targetStr === todayStr;

        const todayDate = new Date(todayStr);

        if (preset === 'yesterday') {
            const yestDate = new Date(todayDate);
            yestDate.setDate(yestDate.getDate() - 1);
            return targetStr === getLocalDateString(yestDate);
        }

        const targetDate = new Date(targetStr);
        const diffDays = Math.floor((todayDate - targetDate) / (86400000));

        if (preset === 'week') return diffDays >= 0 && diffDays < 7;
        if (preset === 'month') return diffDays >= 0 && diffDays < 30;
        if (preset === 'year') return diffDays >= 0 && diffDays < 365;
    }

    if (type === 'single') {
        if (!filterConfig.date) return true;
        return targetStr === filterConfig.date;
    }

    if (type === 'range') {
        const { startDate, endDate } = filterConfig;
        if (startDate && targetStr < startDate) return false;
        if (endDate && targetStr > endDate) return false;
        return true;
    }

    return true;
};

/**
 * Returns formatted Arabic label for a date string (e.g., 'السبت، 8 أغسطس 2026')
 */
export const getArabicDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
};

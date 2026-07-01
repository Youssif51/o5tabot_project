/**
 * Utility function to get the YYYY-MM-DD local date string,
 * adjusted for the local timezone offset to prevent midnight timezone bugs.
 */
export const getLocalDateString = (dateObj) => {
    const d = dateObj || new Date();
    const tzoffset = d.getTimezoneOffset() * 60000;
    return (new Date(d.getTime() - tzoffset)).toISOString().substring(0, 10);
};

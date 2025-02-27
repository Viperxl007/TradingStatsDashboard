export const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US');
};

export const calculatePercentage = (part: number, total: number): number => {
    if (total === 0) return 0;
    return ((part / total) * 100);
};

export const roundToTwoDecimals = (num: number): number => {
    return Math.round(num * 100) / 100;
};
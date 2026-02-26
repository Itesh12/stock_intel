export interface MarketStatus {
    isOpen: boolean;
    nextAction: string;
    label: 'OPEN' | 'CLOSED' | 'PRE-MARKET';
}

export function getMarketStatus(): MarketStatus {
    // Current time in IST (UTC+5:30)
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();

    // Total minutes from UTC midnight
    const utcTotalMinutes = (utcHours * 60) + utcMinutes;
    // Add 330 minutes for IST
    let istTotalMinutes = utcTotalMinutes + 330;

    // Day of the week (0-6, where 0 is Sunday)
    // We need to adjust the day if IST goes into the next day
    let istDay = now.getUTCDay();
    if (istTotalMinutes >= 1440) {
        istTotalMinutes -= 1440;
        istDay = (istDay + 1) % 7;
    }

    const istHour = Math.floor(istTotalMinutes / 60);
    const istMinute = istTotalMinutes % 60;

    // Weekend check
    if (istDay === 0 || istDay === 6) {
        return {
            isOpen: false,
            label: 'CLOSED',
            nextAction: 'OPENS MONDAY 09:15'
        };
    }

    const marketOpenMinutes = (9 * 60) + 15;
    const marketCloseMinutes = (15 * 60) + 30;
    const preMarketOpenMinutes = (9 * 60);

    if (istTotalMinutes >= marketOpenMinutes && istTotalMinutes < marketCloseMinutes) {
        return {
            isOpen: true,
            label: 'OPEN',
            nextAction: `CLOSES AT 15:30`
        };
    }

    if (istTotalMinutes >= preMarketOpenMinutes && istTotalMinutes < marketOpenMinutes) {
        return {
            isOpen: false,
            label: 'PRE-MARKET',
            nextAction: 'OPENS AT 09:15'
        };
    }

    return {
        isOpen: false,
        label: 'CLOSED',
        nextAction: istTotalMinutes < preMarketOpenMinutes ? 'OPENS AT 09:15' : 'OPENS TOMORROW 09:15'
    };
}

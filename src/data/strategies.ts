export interface StrategyStep {
    id: string;
    title: string;
    description: string;
    formula?: string;
    requirements: string[];
}

export interface Strategy {
    id: string;
    name: string;
    trader: string;
    description: string;
    longDescription: string;
    objective: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    winRate: string;
    steps: StrategyStep[];
    recommendations: string[];
    riskManagement: string[];
}

export const strategies: Strategy[] = [
    {
        id: 'canslim',
        name: 'CANSLIM Quant Strategy',
        trader: 'James B. Rogers Jr.',
        description: 'A unified quantitative model for identifying high-growth institutional leaders in the Indian market.',
        objective: 'Scan NSE universe to detect leadership, earnings strength, and institutional demand via price/volume confirmation.',
        longDescription: `This strategy converts the CANSLIM philosophy into a single, executable quantitative model. It systematically identifies institutionally accumulated, high-growth Indian equities breaking into new price trends while filtering out low-quality or speculative stocks.`,
        riskLevel: 'HIGH',
        winRate: '68%',
        steps: [
            {
                id: 'M',
                title: 'Market Direction Filter',
                description: 'BROAD MARKET ALIGNMENT',
                formula: 'NIFTY_CLOSE > NIFTY_50DMA AND NIFTY_50DMA > NIFTY_200DMA',
                requirements: ['Nifty 50 in uptrend', '5-Day Advance/Decline Ratio ≥ 1.2']
            },
            {
                id: 'C',
                title: 'Current Quarterly Earnings',
                description: 'BUSINESS MOMENTUM',
                formula: 'Quarterly_EPS_Growth ≥ 25%',
                requirements: ['Revenue Growth ≥ 20%', 'EBITDA Margin expanding YoY', 'Positive EPS last 4 quarters']
            },
            {
                id: 'A',
                title: 'Annual Earnings Quality',
                description: 'SUSTAINED COMPOUNDING',
                formula: 'EPS_CAGR_5Y ≥ 20%',
                requirements: ['ROE ≥ 17%', 'Debt to Equity ≤ 0.5', 'Positive Operating Cash Flow']
            },
            {
                id: 'N',
                title: 'New Catalyst Proxy',
                description: 'PRICE CONFIRMATION',
                formula: 'Current_Price / 52W_High ≥ 0.95',
                requirements: ['Near 52-week highs', 'Market recognition of change']
            },
            {
                id: 'S',
                title: 'Supply Constraint',
                description: 'TIGHT OWNERSHIP',
                formula: 'Promoter_Holding ≥ 50%',
                requirements: ['Free Float ≤ 45%', 'No equity dilution last 2 years']
            },
            {
                id: 'L',
                title: 'Leadership',
                description: 'RELATIVE STRENGTH',
                formula: 'RS_Rating ≥ 80',
                requirements: ['RS vs Nifty ≥ 1.30', 'Structural uptrend (50DMA > 200DMA)']
            },
            {
                id: 'I',
                title: 'Institutional Sponsorship',
                description: 'ACCUMULATION PHASE',
                requirements: ['Institutional Ownership 10-45%', 'Increasing MF holding last 3 quarters', 'No sharp FII exits']
            }
        ],
        recommendations: ['TATAELXSI.NS', 'DIXON.NS', 'ASTRAL.NS', 'PIIND.NS', 'PAGEIND.NS'],
        riskManagement: [
            'Stop Loss at Buy Price × 0.93',
            'No averaging down',
            'Sell immediately if stop violated'
        ]
    },
    {
        id: 'intermarket-analysis-india',
        name: 'Intermarket Analysis (India)',
        trader: 'John Murphy',
        description: 'Global financial market interconnectedness model focusing on stocks, bonds, commodities, and currencies.',
        objective: 'Identify macro market shifts and sector rotations to find the strongest stocks using relative strength and technical breakouts.',
        longDescription: `Based on John Murphy's "Intermarket Analysis", this strategy adapts global relationships to the Indian market. It evaluates the yield curve (India 10Y Bond vs 91-Day T-Bill), inflation trends (CRB vs Bonds), and Dollar strength (DXY vs MA200) to understand the macro regime. Further, it uses Sector Relative Strength vs Nifty 50 to find outperforming sectors, and applies strict technical breakout filters (MA200, 50-Day High, RSI) to capture high momentum stocks.`,
        riskLevel: 'MEDIUM',
        winRate: '62%',
        steps: [
            {
                id: '1',
                title: 'Macro Regime & Yield Curve',
                description: 'Determine the economic expansion or recession risk.',
                formula: 'Yield Spread = India 10Y Bond Yield - 91-Day T-Bill Yield',
                requirements: ['Expansion (Spread > 0)', 'Inflation Indicators Align', 'Dollar Strength Check (DXY vs MA200)']
            },
            {
                id: '2',
                title: 'Sector Relative Strength',
                description: 'Identify the strongest sectors relative to the broad market.',
                formula: 'RS_Sector = Sector Index Price / Nifty50 Price',
                requirements: ['RS_Sector > EMA20(RS_Sector)', 'Sector Outperforming']
            },
            {
                id: '3',
                title: 'Long Term Trend',
                description: 'Ensure the stock is in a persistent uptrend.',
                formula: 'Stock Price > MA200',
                requirements: ['Price is above the 200-day moving average']
            },
            {
                id: '4',
                title: 'Resistance Breakout',
                description: 'Confirm new demand emerging with a breakout.',
                formula: 'Close > HHV(High, 50)',
                requirements: ['Close is greater than the Highest High of the last 50 days']
            },
            {
                id: '5',
                title: 'Momentum Confirmation',
                description: 'Validate strength using RSI.',
                formula: 'RSI(14) > 55',
                requirements: ['RSI must indicate bullish momentum']
            },
            {
                id: '6',
                title: 'Quality & Liquidity Check',
                description: 'Filter out illiquid or high-debt stocks.',
                requirements: ['Market Cap > 2000 Cr', 'Avg Volume > 5,00,000', 'Debt/Equity < 1']
            }
        ],
        recommendations: ['RELIANCE.NS'],
        riskManagement: [
            'Position Size = (Portfolio × Risk%) / Stop Loss',
            'Stop Loss (Longs) = Entry - 2 × ATR(14)',
            'Stop Loss (Shorts) = Entry + 2 × ATR(14)'
        ]
    }
];

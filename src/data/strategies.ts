import type { Strategy } from "../domain/strategy";

// Static strategy seed data — used to bootstrap DB on first run.
// Live recommendations are populated by quant-scanner and override these static arrays.
export const strategies: Strategy[] = [
    {
        id: 'canslim',
        slug: 'canslim',
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
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    },
    {
        id: 'intermarket-analysis-india',
        slug: 'intermarket-analysis-india',
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
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    },
    {
        id: 'warren-buffet',
        slug: 'warren-buffet',
        name: 'Indian Buffett Filter',
        trader: 'Warren Buffett',
        description: 'The Indian Value Compounder Formula (IVCF) identifies high-quality business franchises with strong moats and financial strength.',
        objective: 'Identify long-term compounders in the Indian market using Quality, Moat, Financial, Valuation, and Growth metrics (IVCF).',
        longDescription: `This strategy implements the Indian Value Compounder Formula (IVCF), specifically calibrated for the Indian market's unique dynamics like promoter holding and governance. It uses a weighted scoring system: Quality (25%), Moat (20%), Financial Strength (20%), Valuation (20%), and Growth (15%). It filters for stocks with ROE > 15%, ROCE > 18%, low debt, and high promoter skin in the game.`,
        riskLevel: 'LOW',
        winRate: '75%',
        steps: [
            {
                id: 'Q',
                title: 'Quality Score (25%)',
                description: 'BUSINESS QUALITY METRICS',
                formula: '(ROE + ROCE + OPM) / 3',
                requirements: ['ROE > 15%', 'ROCE > 18%', 'Operating Margin > 15%']
            },
            {
                id: 'M',
                title: 'Moat Score (20%)',
                description: 'COMPETITIVE ADVANTAGE',
                requirements: ['Brand Power', 'Market Share Leadership', 'Pricing Power', 'Low Competition']
            },
            {
                id: 'F',
                title: 'Financial Strength (20%)',
                description: 'BALANCE SHEET INTEGRITY',
                formula: '100 - (Debt/Equity * 100)',
                requirements: ['Debt/Equity < 0.5', 'High Interest Coverage', 'Positive Free Cash Flow']
            },
            {
                id: 'V',
                title: 'Valuation Score (20%)',
                description: 'MARGIN OF SAFETY',
                formula: '(Intrinsic Value / Market Price) * 100',
                requirements: ['P/E vs Sector Average', 'P/B for Banks', 'EV/EBITDA for Industrials']
            },
            {
                id: 'G',
                title: 'Growth Score (15%)',
                description: 'COMPOUNDING VELOCITY',
                formula: '(Revenue CAGR + EPS CAGR) / 2',
                requirements: ['5Y Sales CAGR > 10%', '5Y Profit CAGR > 12%']
            }
        ],
        recommendations: ['TITAN.NS', 'ASIANPAINT.NS', 'HDFCBANK.NS', 'TCS.NS', 'HINDUNILVR.NS'],
        riskManagement: [
            'Buy on dips in fair value zones',
            'Hold as long as business quality is intact',
            'Exit if governance issues emerge'
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    },
    {
        id: 'john-carter-intraday',
        slug: 'john-carter-intraday',
        name: 'Master Intraday Strategy Framework',
        trader: 'John F. Carter',
        description: 'A 4-step daily playbook combining Floor Pivots, Market Internals, Opening Gaps, TTM Squeezes, and Fakeout Fades.',
        objective: 'Execute a unified daily playbook: calculate premarket floor pivots & breadth bias, wait for time-based triggers (Opening Gap, TTM Squeeze, or 52W Fade), size with strict 1-2% risk, and scale out across 3 targets.',
        longDescription: `In "Mastering the Trade", John F. Carter highlights that while each setup addresses a specific market condition, they can be unified into a single Time-Based Master Intraday Strategy Framework. Rather than picking isolated setups, this master strategy operates as a 4-step daily playbook that tells you exactly what to scan for, when to enter, how to size your position, and how to exit.

• Step 1: Premarket Setup & Daily Bias Filter (Floor Pivots P, R1/S1, R2/S2 & Advance/Decline Breadth Ratio)
• Step 2: Intraday Entry Execution Matrix (9:15-9:45 Opening Gap Play, 10:00-1:30 TTM Squeeze, 52-Week High Fakeout Fade)
• Step 3: Account Risk & Position Sizing Formula (1%-2% Capital Risk & Stop Market Orders)
• Step 4: Multi-Target Scaling Exit System (Target 1: 1/3 at 1:1, Target 2: 1/3 at 2:1, Target 3: 1/3 Trend Runner)`,
        riskLevel: 'MEDIUM',
        winRate: '74%',
        steps: [
            {
                id: '1',
                title: 'Premarket Setup & Daily Bias Filter',
                description: 'FLOOR PIVOTS & MARKET INTERNALS',
                formula: 'P = (H + L + C) / 3 | R1 = 2P - L, S1 = 2P - H | R2 = P + (H - L), S2 = P - (H - L)',
                requirements: [
                    'Calculate Floor Pivot Points: P, R1, S1, R2, S2',
                    'Bullish Bias (A/D Ratio > 3:1): Focus strictly on Long Squeezes & Gap Follows',
                    'Bearish Bias (A/D Ratio < 1:3): Focus strictly on Short Squeezes & Fade Breakouts'
                ]
            },
            {
                id: '2',
                title: 'Intraday Entry Execution Matrix',
                description: 'TIME-BASED ENTRY TRIGGERS',
                formula: 'Trigger A (9:15-9:45 AM Gap) | Trigger B (10:00 AM-1:30 PM TTM Squeeze) | Trigger C (52W Fakeout)',
                requirements: [
                    'Trigger A (9:15–9:45 AM Opening Gap): Fade back to Pivot P if 5-min candle fails breakout on weak volume',
                    'Trigger B (10:00 AM–1:30 PM TTM Squeeze): Bollinger Bands (20, 2.0) narrow inside Keltner (20, 1.5); enter on momentum breakout with ≥ 2:1 R:R to pivots',
                    'Trigger C (Exhaustion Highs): New 52W High with 7-period RSI Bearish Divergence & Volume Exhaustion (≤ 25%); short on open after close below prior 52W high'
                ]
            },
            {
                id: '3',
                title: 'Account Risk & Position Sizing Formula',
                description: 'CAPITAL PRESERVATION DISCIPLINE',
                formula: 'Position Size = (Account Capital × Risk % [1% to 2%]) / |Entry Price - Stop Loss Price|',
                requirements: [
                    'Strict 1% to 2% max account risk per trade',
                    'Always use Stop Market Orders (never limit orders) to guarantee execution',
                    'Squeeze & Gap Plays: Stop placed just beyond recent swing high/low or key pivot',
                    'Fade Breakout Play: Stop placed ₹2–₹5 above recent extreme 52-week high'
                ]
            },
            {
                id: '4',
                title: 'Multi-Target Scaling Exit System',
                description: '3-TARGET SCALING DISCIPLINE',
                formula: 'Target 1 (1:1 / S1 or R1): 1/3 | Target 2 (2:1 / S2 or R2): 1/3 | Target 3 (Runner): 1/3',
                requirements: [
                    'Target 1 (1:1 R:R / S1 or R1): Close 1/3 of position; reduce stop distance on remaining to cut risk by ~60%',
                    'Target 2 (2:1 R:R / S2 or R2): Close 1/3 of position; move stop on final portion to Breakeven',
                    'Target 3 (Trend Runner): Hold final 1/3 position until 60-min candle closes past extreme bar high/low'
                ]
            }
        ],
        recommendations: ['RELIANCE.NS', 'TCS.NS', 'ICICIBANK.NS', 'HDFCBANK.NS', 'BHARTIARTL.NS', 'INFY.NS', 'LT.NS', 'KOTAKBANK.NS', 'TATAMOTORS.NS', 'SBIN.NS'],
        riskManagement: [
            'Position Size = (Account Capital × Risk [1%-2%]) / |Entry - Stop|',
            'Always use Stop Market Orders to guarantee immediate execution',
            'Squeeze & Gap Plays: Stop placed beyond recent swing high/low or pivot',
            'Fade Breakout: Stop placed ₹2–₹5 above recent extreme 52-week high',
            'Target 1: Close 1/3 at 1:1 R:R / R1 or S1; cut total risk by ~60%',
            'Target 2: Close 1/3 at 2:1 R:R / R2 or S2; move stop on final 1/3 to Breakeven',
            'Target 3: Trail final 1/3 until 60-min candle closes past extreme bar high/low'
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    }
];



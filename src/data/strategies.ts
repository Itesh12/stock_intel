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
        id: 'intraday-strategy',
        slug: 'intraday-strategy',
        name: 'Intraday Confluence System',
        trader: 'Confluence Quant',
        description: 'A high-probability multi-strategy scoring system that enters trades only when 7 or more out of 10 entry signals align.',
        objective: 'Align 4 individual strategies (ORB, VWAP Reversion, EMA Pullback, Gap Fill) and score candidates out of 10 to filter for 75–80% win-rate setups.',
        longDescription: `The Intraday Confluence System focuses on high-probability intraday setups. Instead of trading a single strategy, it tracks 10 individual technical signals across 4 strategy types (Opening Range Breakout, VWAP Reversion, EMA Pullback, and Gap Fill). It scores each stock from 0 to 10; trades are only executed when the score reaches 7 or above. This strict filter maximizes the edge, driving historical win rates to the 75–80% range.`,
        riskLevel: 'MEDIUM',
        winRate: '75-80%',
        steps: [
            {
                id: '1',
                title: 'Pre-market scan (9:00–9:15 AM)',
                description: 'Run the 4-filter stock scanner. Pick 4–6 stocks that pass liquidity, ATR, RVOL, and gap filters. These are your candidates.',
                requirements: ['Passing liquidity filter', 'ATR volatility check', 'RVOL > 1.2', 'Gap size check']
            },
            {
                id: '2',
                title: 'Score each stock (9:15–9:30 AM)',
                description: 'Use the Signal Checker tab to score each candidate. Each signal adds points. Stocks scoring ≥ 7 go on your trade list. Others are skipped — no exceptions.',
                requirements: ['Evaluate 10 technical signals', 'Accumulate confluence points', 'Strict threshold ≥ 7']
            },
            {
                id: '3',
                title: 'Identify entry type category',
                description: 'Every high-score stock falls into one of 4 types: Trend-Momentum, Mean Reversion, Gap Fill, or VWAP Reclaim. Each type has its own exact entry rule.',
                requirements: ['Trend-Momentum', 'Mean Reversion', 'Gap Fill', 'VWAP Reclaim']
            },
            {
                id: '4',
                title: 'Enter after 9:30 AM with confirmation',
                description: 'Never enter during 9:15–9:30 ORB formation window. Wait for the first 5-min candle close after 9:30 to confirm the signal. Volume must be ≥ 1.5× average.',
                requirements: ['Wait for first 5-min candle close after 9:30', 'Volume ≥ 1.5x average']
            },
            {
                id: '5',
                title: 'Manage with 2-target system',
                description: 'Book 50% at Target 1. Move SL to cost. Let 50% run to Target 2. Hard exit of all positions by 2:15 PM. No trades after 2:30 PM.',
                requirements: ['Target 1: Book 50% & SL to cost', 'Target 2: Let remaining run', 'Hard exit by 2:15 PM']
            }
        ],
        recommendations: ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'TATAMOTORS.NS', 'SBIN.NS'],
        riskManagement: [
            'Min score to trade: 7 / 10',
            'Avg R:R: 1 : 1.5',
            'Trades/day: 1–3',
            'Book 50% at Target 1 and move SL to cost',
            'Let 50% run to Target 2',
            'Hard exit of all positions by 2:15 PM. No trades after 2:30 PM.'
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    },
    {
        id: 'swing-strategy',
        slug: 'swing-strategy',
        name: '1-Month Confluence Positional System',
        trader: 'Minervini & O\'Neil',
        description: 'A high-probability swing and positional strategy combining Stage 2 Breakouts, 52-Week High Momentum, and Weekly EMA Crossovers.',
        objective: 'Identify high-probability swing setups with an expected holding period of 3–5 weeks using a 12-signal weekly scoring system requiring a score of 8+.',
        longDescription: `The 1-Month Confluence Positional System is a swing trading system that blends weekly trend filters, Stage 2 breakouts, volume surges, and relative strength. By requiring a confluence score of at least 8 out of 12 before entering, the strategy achieves a target win rate of 78–82% with an average risk-to-reward ratio of 1:2.5+. Position exits are strictly managed via a weekly trailing stop, a time exit at 5 weeks, or target profit bookings.`,
        riskLevel: 'MEDIUM',
        winRate: '78-82%',
        steps: [
            {
                id: '1',
                title: 'Weekly chart analysis (Sunday evening)',
                description: 'Every Sunday, scan weekly charts. Look for stocks in Stage 2 (uptrend) with price near a breakout level. This is your only scan window — don\'t chase mid-week entries.',
                requirements: ['Weekly chart analysis', 'Stage 2 uptrend verification', 'Near breakout level consolidation']
            },
            {
                id: '2',
                title: 'Score each candidate (8+ to qualify)',
                description: 'Use the Signal Checker tab. Score must reach 8/12. Lower scores mean the setup is incomplete — wait for next week or skip.',
                requirements: ['Evaluate 12 scoring signals', 'Strict threshold of 8/12 minimum']
            },
            {
                id: '3',
                title: 'Entry on Monday or Tuesday only',
                description: 'Enter at market open on Monday or by Tuesday close. If you miss the entry window, skip — don\'t chase. A missed trade is better than a bad entry.',
                requirements: ['Strict Monday-Tuesday entry window', 'No mid-week chasing']
            },
            {
                id: '4',
                title: 'Set hard SL immediately at entry',
                description: 'Place SL order in your broker the moment you enter. SL = 7–8% below entry (or below the base/consolidation low — whichever is tighter). No mental SLs.',
                requirements: ['Hard broker SL placed instantly', 'SL at 7-8% or base low']
            },
            {
                id: '5',
                title: 'Trail stop weekly — never move it down',
                description: 'Every Sunday, trail your SL up to 7% below the week\'s closing price. Only move SL upward, never loosen it. This locks profits as stock rises.',
                requirements: ['Sunday weekly stop trailing', 'Only trail upward, never downward']
            },
            {
                id: '6',
                title: 'Exit rules — 3 triggers',
                description: 'Exit when: (a) trailing SL is hit, OR (b) Target 2 is reached, OR (c) 5 weeks have passed and stock hasn\'t moved 10%+ — time-based exit. Don\'t hold losers hoping for recovery.',
                requirements: ['Trailing SL hit', 'Target 2 reached', 'Time-based exit at 5 weeks if < 10% movement']
            }
        ],
        recommendations: ['RELIANCE.NS', 'TCS.NS', 'BHARTIARTL.NS', 'ICICIBANK.NS', 'LTIM.NS'],
        riskManagement: [
            'Min score to enter: 8 / 12',
            'Hold period: 3–5 weeks',
            'R:R target: 1 : 2.5+',
            'Hard SL at 7-8% below entry',
            'Weekly trailing SL 7% below closing price',
            'Book 40% at +12%, 40% at +20%, trail last 20% with weekly trailing SL'
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
    }
];

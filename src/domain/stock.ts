export interface Stock {
  id: string;          // UUID
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  volume?: number;
  peRatio?: number;
  dividendYield?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  currency?: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  // Fundamental Expansion
  eps?: number;
  epsForward?: number;
  beta?: number;
  pbRatio?: number;
  forwardPe?: number;
  revenue?: number;
  ebitda?: number;
  roe?: number;
  roa?: number;
  profitMargins?: number;
  grossMargins?: number;
  operatingMargins?: number;
  ebitdaMargins?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  sharesOutstanding?: number;
  floatShares?: number;
  insiderOwnership?: number;
  institutionOwnership?: number;
  totalCash?: number;
  totalDebt?: number;
  debtToEquity?: number;
  quickRatio?: number;
  currentRatio?: number;
  freeCashflow?: number;
  operatingCashflow?: number;
  enterpriseValue?: number;
  enterpriseToRevenue?: number;
  enterpriseToEbitda?: number;
  bookValue?: number;
  priceToSales?: number;
  fiftyTwoWeekChange?: number;
  lastDividendValue?: number;
  lastDividendDate?: Date;
  lastUpdated: Date;
  createdAt: Date;
}

export interface StockScore {
  stockId: string;
  overallScore: number;
  fundamentalScore: number;
  technicalScore: number;
  liquidityScore: number;
  riskScore: number;
  momentumScore: number;
  updatedAt: Date;
}

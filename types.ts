export type AssetType = 'BTC' | 'GOLD';

export interface RawTransaction {
  date: Date;
  invested: number;
  assetPrice: number;
  assetPurchased: number;
}

export interface ChartDataPoint {
  date: string;
  portValue: number;
  assetValue: number;
  cumulativeAmount?: number;
}

export interface SummaryData {
  profitPercentage: number;
  totalCapital: number;
  entryPrice: number;
  startDate: Date;
  portValue: number;
  lastUpdated: Date;
  totalAmount: number;
}

export interface DcaBundle {
    chartData: ChartDataPoint[];
    summaryData: SummaryData | null;
    rawData: RawTransaction[];
    error?: string;
}

export type TimeRange = 'W' | 'M' | 'Y';
export type Currency = 'THB' | 'USD';


export interface PriceInfo {
  price: number;
  change24h: number;
  change24hPercentage: number;
  isMock?: boolean;
}

export interface CurrencyPrices {
    thb: PriceInfo;
    usd: PriceInfo;
}

export type LiveAssetPriceData = {
    [key in AssetType]?: CurrencyPrices;
};
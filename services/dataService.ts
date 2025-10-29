import { RawTransaction, ChartDataPoint, SummaryData, LiveAssetPriceData, AssetType, DcaBundle, CurrencyPrices, PriceInfo } from '../types';

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTky6EXF-T1UqfBgBdLM_shv8VdaQzGifDBwlYSRBDk_J4_wxDeU_9FSdhjj2I-EaoN2jREHxAnyxa3/pub?gid=0&single=true&output=csv';
const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3/coins/markets?ids=bitcoin';
const GOLD_PRICE_API_BASE_URL = 'https://data-asg.goldprice.org/dbXRates/';

const COLUMN_MAP: Record<AssetType, { date: string, invested: string, price: string, purchased: string }> = {
    BTC: {
        date: 'Date',
        invested: 'Invested (THB)',
        price: 'BTC Price (THB)',
        purchased: 'BTC Purchased'
    },
    GOLD: {
        date: 'Gold Date',
        invested: 'Invested Gold (THB)',
        price: 'Gold Price (THB)',
        purchased: 'Gold Purchased (g)'
    }
};

export const fetchLivePrices = async (): Promise<{ prices: LiveAssetPriceData, thbUsdRate: number }> => {
    try {
        const [
            btcUsdResponse,
            btcThbResponse,
            goldThbResponse,
            goldUsdResponse
        ] = await Promise.all([
            fetch(`${COINGECKO_API_BASE_URL}&vs_currency=usd`),
            fetch(`${COINGECKO_API_BASE_URL}&vs_currency=thb`),
            fetch(`${GOLD_PRICE_API_BASE_URL}THB`),
            fetch(`${GOLD_PRICE_API_BASE_URL}USD`)
        ]);

        if (!btcUsdResponse.ok) throw new Error(`CoinGecko API for BTC/USD failed: ${btcUsdResponse.status}`);
        if (!btcThbResponse.ok) throw new Error(`CoinGecko API for BTC/THB failed: ${btcThbResponse.status}`);
        if (!goldThbResponse.ok) throw new Error(`Goldprice.org API for THB failed: ${goldThbResponse.status}`);
        if (!goldUsdResponse.ok) throw new Error(`Goldprice.org API for USD failed: ${goldUsdResponse.status}`);

        const btcUsdData = await btcUsdResponse.json();
        const btcThbData = await btcThbResponse.json();
        const goldThbData = await goldThbResponse.json();
        const goldUsdData = await goldUsdResponse.json();
        
        const btcUsd = btcUsdData?.[0];
        const btcThb = btcThbData?.[0];

        if (!btcUsd || !btcThb) throw new Error('Invalid data from CoinGecko API');

        const btcPrices: CurrencyPrices = {
            usd: { price: btcUsd.current_price, change24h: btcUsd.price_change_24h, change24hPercentage: btcUsd.price_change_percentage_24h },
            thb: { price: btcThb.current_price, change24h: btcThb.price_change_24h, change24hPercentage: btcThb.price_change_percentage_24h }
        };
        
        if (!btcPrices.usd.price || btcPrices.usd.price === 0) throw new Error('BTC price in USD is zero or invalid.');
        
        const TROY_OUNCE_TO_GRAMS = 31.1035;
        const GOLD_CONVERSION_GRAMS = 14.71;
        const goldThbRaw = goldThbData?.items?.[0];
        const goldUsdRaw = goldUsdData?.items?.[0];
        if (!goldThbRaw || !goldUsdRaw) throw new Error('Invalid data from Goldprice.org API');
        
        const goldThbPrice: PriceInfo = {
            price: (goldThbRaw.xauPrice / TROY_OUNCE_TO_GRAMS) * GOLD_CONVERSION_GRAMS,
            change24h: (goldThbRaw.chgXau / TROY_OUNCE_TO_GRAMS) * GOLD_CONVERSION_GRAMS,
            change24hPercentage: goldThbRaw.pcXau
        };
        const goldUsdPrice: PriceInfo = {
            price: (goldUsdRaw.xauPrice / TROY_OUNCE_TO_GRAMS) * GOLD_CONVERSION_GRAMS,
            change24h: (goldUsdRaw.chgXau / TROY_OUNCE_TO_GRAMS) * GOLD_CONVERSION_GRAMS,
            change24hPercentage: goldUsdRaw.pcXau
        };
        const goldPrices: CurrencyPrices = { thb: goldThbPrice, usd: goldUsdPrice };

        const thbUsdRate = btcPrices.thb.price / btcPrices.usd.price;

        return { prices: { BTC: btcPrices, GOLD: goldPrices }, thbUsdRate };

    } catch (error) {
        console.error("Error fetching live prices:", error);
        throw new Error('Could not fetch live prices.');
    }
};

const parseCsv = (csvText: string, asset: AssetType): { data: RawTransaction[], error: string | null } => {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) return { data: [], error: "CSV file is empty or has only a header." };
    
    const header = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1);

    const assetColumns = COLUMN_MAP[asset];
    const dateIndex = header.indexOf(assetColumns.date);
    const investedIndex = header.indexOf(assetColumns.invested);
    const priceIndex = header.indexOf(assetColumns.price);
    const purchasedIndex = header.indexOf(assetColumns.purchased);

    if ([dateIndex, investedIndex, priceIndex, purchasedIndex].includes(-1)) {
        const error = `Columns for ${asset} not found in the Google Sheet. Please ensure the following headers are present and correct in the published CSV: ${Object.values(assetColumns).join(', ')}. Empty columns between BTC and Gold data may cause this issue.`;
        return { data: [], error };
    }

    const data = dataRows.map(line => {
        const values = line.split(',').map(v => v.trim());
        return {
            date: new Date(values[dateIndex]),
            invested: parseFloat(values[investedIndex]),
            assetPrice: parseFloat(values[priceIndex]),
            assetPurchased: parseFloat(values[purchasedIndex]),
        };
    }).filter(d => d.date && !isNaN(d.invested) && !isNaN(d.assetPrice) && !isNaN(d.assetPurchased) && d.invested > 0);

    return { data, error: null };
};

export const fetchAllDcaData = async (): Promise<Record<AssetType, DcaBundle>> => {
  if (GOOGLE_SHEET_CSV_URL.includes('YOUR_SHEET_ID_HERE')) {
    throw new Error('Please update GOOGLE_SHEET_CSV_URL in services/dataService.ts');
  }

  const response = await fetch(GOOGLE_SHEET_CSV_URL);
  if (!response.ok) throw new Error(`Failed to fetch from Google Sheets: ${response.status}`);
  
  const csvText = await response.text();
  
  const assets: AssetType[] = ['BTC', 'GOLD'];
  const result: Partial<Record<AssetType, DcaBundle>> = {};

  for (const asset of assets) {
      const { data, error } = parseCsv(csvText, asset);
      if (error) {
          result[asset] = { rawData: [], chartData: [], summaryData: null, error };
      } else if (data.length === 0) {
          result[asset] = { rawData: [], chartData: [], summaryData: null, error: `No valid transaction rows found for ${asset}. Please check the data in your Google Sheet.` };
      }
      else {
          result[asset] = processData(data);
      }
  }

  return result as Record<AssetType, DcaBundle>;
};

const processData = (data: RawTransaction[]): DcaBundle => {
  if (data.length === 0) {
    return { chartData: [], summaryData: null, rawData: [] };
  }

  let cumulativeInvested = 0;
  let cumulativeAmount = 0;

  const chartData: ChartDataPoint[] = data.map(point => {
    cumulativeInvested += point.invested;
    cumulativeAmount += point.assetPurchased;
    const portValue = cumulativeAmount * point.assetPrice;
    return {
      date: point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      portValue: parseFloat(portValue.toFixed(2)),
      assetValue: parseFloat(cumulativeInvested.toFixed(2)),
      cumulativeAmount: cumulativeAmount,
    };
  });

  const finalDataPoint = data[data.length - 1];
  const finalPortValue = cumulativeAmount * finalDataPoint.assetPrice;
  const profit = finalPortValue - cumulativeInvested;
  const profitPercentage = (profit / cumulativeInvested) * 100;
  const entryPrice = cumulativeInvested / cumulativeAmount;

  const summaryData: SummaryData = {
    profitPercentage,
    totalCapital: cumulativeInvested,
    entryPrice,
    startDate: data[0].date,
    portValue: finalPortValue,
    lastUpdated: finalDataPoint.date,
    totalAmount: cumulativeAmount,
  };

  return { chartData, summaryData, rawData: data };
};
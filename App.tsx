import React, { useState, useEffect, useMemo, FC } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps } from 'recharts';
import { TimeRange, ChartDataPoint, SummaryData, Currency, LiveAssetPriceData, DcaBundle, AssetType } from './types';
import { fetchAllDcaData, fetchLivePrices } from './services/dataService';
import { formatCompactNumber, formatCurrency, formatFullDate, formatDate, formatPercentage } from './utils/formatters';
import { ChartIcon, InfoIcon, CapitalIcon, PortValueIcon, BtcIcon, WarningIcon, LivePriceIcon, RefreshIcon, GoldIcon } from './components/Icons';
import TransactionHistory from './components/TransactionHistory';

const CustomTooltip: FC<TooltipProps<number, string> & { currency: Currency, asset: AssetType }> = ({ active, payload, label, currency, asset }) => {
  if (active && payload && payload.length) {
    const portValuePayload = payload.find(p => p.dataKey === 'portValue');
    const assetValuePayload = payload.find(p => p.dataKey === 'assetValue');
    const amountPayload = payload.find(p => p.dataKey === 'cumulativeAmount');
    return (
      <div className="bg-slate-700/80 backdrop-blur-sm p-4 rounded-lg border border-slate-600 shadow-lg">
        <p className="text-sm text-slate-300 font-bold">{`Date: ${label}`}</p>
        {portValuePayload && <p className="text-sm text-pink-400">{`Port Value: ${formatCurrency(portValuePayload.value || 0, currency)}`}</p>}
        {assetValuePayload && <p className="text-sm text-purple-400">{`Invested: ${formatCurrency(assetValuePayload.value || 0, currency)}`}</p>}
        {amountPayload && <p className="text-sm text-yellow-400">{`${asset} Holdings: ${(amountPayload.value || 0).toFixed(8)}`}</p>}
      </div>
    );
  }
  return null;
};

const App: FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allDcaData, setAllDcaData] = useState<Record<AssetType, DcaBundle> | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('Y');
  const [currency, setCurrency] = useState<Currency>('THB');
  const [selectedAsset, setSelectedAsset] = useState<AssetType>('BTC');
  
  const [livePrices, setLivePrices] = useState<LiveAssetPriceData | null>(null);
  const [thbUsdRate, setThbUsdRate] = useState<number | null>(null);
  const [livePriceError, setLivePriceError] = useState<string | null>(null);
  const [livePriceLastUpdated, setLivePriceLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadInitialData = async () => {
    try {
      const [dcaData, priceData] = await Promise.all([
        fetchAllDcaData(),
        fetchLivePrices()
      ]);
      setAllDcaData(dcaData);
      setLivePrices(priceData.prices);
      setThbUsdRate(priceData.thbUsdRate);
      setLivePriceLastUpdated(new Date());
      if(error) setError(null); 
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      setLivePriceError(errorMessage)
      throw err;
    }
  };

  useEffect(() => {
    const initialLoad = async () => {
      setLoading(true);
      await loadInitialData().catch(console.error);
      setLoading(false);
    };
    initialLoad();

    const intervalId = setInterval(() => fetchLivePrices().then(data => {
        setLivePrices(data.prices);
        setThbUsdRate(data.thbUsdRate);
        setLivePriceLastUpdated(new Date());
    }).catch(err => {
        if (err instanceof Error) setLivePriceError(err.message)
    }), 60000);
    return () => clearInterval(intervalId);
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await loadInitialData().catch(console.error);
    setIsRefreshing(false);
  };

  const conversionRate = useMemo(() => (currency === 'USD' && thbUsdRate) ? (1 / thbUsdRate) : 1, [currency, thbUsdRate]);

  const currentAssetData = useMemo(() => allDcaData?.[selectedAsset] ?? null, [allDcaData, selectedAsset]);
  const currentLivePrice = useMemo(() => livePrices?.[selectedAsset]?.[currency.toLowerCase() as 'thb' | 'usd'] ?? null, [livePrices, selectedAsset, currency]);

  const GOLD_CONVERSION_GRAMS = 14.71;

  const livePricePerGram = useMemo(() => {
    if (!currentLivePrice) return null;
    if (selectedAsset === 'GOLD') {
      return {
        ...currentLivePrice,
        price: currentLivePrice.price / GOLD_CONVERSION_GRAMS
      };
    }
    return currentLivePrice;
  }, [currentLivePrice, selectedAsset]);


  const filteredChartData = useMemo(() => {
    if (currentAssetData?.error || !currentAssetData?.chartData) return [];
    
    let data;
    switch (timeRange) {
      case 'W': data = currentAssetData.chartData.slice(-7); break;
      case 'M': data = currentAssetData.chartData.slice(-30); break;
      default: data = currentAssetData.chartData;
    }
    
    return data.map(d => ({
        ...d,
        portValue: (livePricePerGram && d.cumulativeAmount) ? (d.cumulativeAmount * livePricePerGram.price) : (d.portValue * conversionRate),
        assetValue: d.assetValue * conversionRate
    }));
  }, [currentAssetData, timeRange, conversionRate, livePricePerGram]);

  const liveSummary = useMemo(() => {
    if (!currentAssetData?.summaryData) return null;
    const { summaryData } = currentAssetData;
    const convertedTotalCapital = summaryData.totalCapital * conversionRate;
    const convertedEntryPrice = summaryData.entryPrice * conversionRate;
    let livePortValue = summaryData.portValue * conversionRate;
    let liveProfitPercentage = summaryData.profitPercentage;

    if (livePricePerGram) {
      livePortValue = summaryData.totalAmount * livePricePerGram.price;
      const profit = livePortValue - convertedTotalCapital;
      liveProfitPercentage = (profit / convertedTotalCapital) * 100;
    }
    
    return { ...summaryData, portValue: livePortValue, profitPercentage: liveProfitPercentage, totalCapital: convertedTotalCapital, entryPrice: convertedEntryPrice };
  }, [currentAssetData, livePricePerGram, conversionRate]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-white"><div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-purple-500"></div><p className="ml-4 text-lg">Loading Dashboard Data...</p></div>;
  if (error && !allDcaData) return <div className="flex flex-col items-center justify-center min-h-screen text-white p-8 bg-slate-900"><div className="bg-slate-800 border border-red-500/50 rounded-lg p-8 max-w-2xl text-center shadow-2xl"><h2 className="text-2xl font-bold text-red-400 mb-4">Oops! Something went wrong.</h2><p className="text-slate-300 mb-6">We couldn't load initial data. Please check the error below.</p><pre className="text-left bg-slate-900 p-4 rounded-md text-red-300 text-sm whitespace-pre-wrap">{error}</pre></div></div>;
  
  const timeRanges: TimeRange[] = ['W', 'M', 'Y'];
  const currencies: Currency[] = ['THB', 'USD'];
  const supportedAssets: AssetType[] = ['BTC', 'GOLD'];
  
  const AssetIcon = selectedAsset === 'BTC' ? BtcIcon : GoldIcon;
  const isGold = selectedAsset === 'GOLD';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-4 sm:p-6 lg:p-8 font-sans">
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-blue-400">DCA BTC journey</h1>
        <div className="flex items-center gap-4">
            <div className="bg-slate-700/50 rounded-full p-1 flex items-center gap-1">
                {supportedAssets.map(asset => (
                    <button key={asset} onClick={() => setSelectedAsset(asset)} className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-300 ${selectedAsset === asset ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-600'}`}>{asset}</button>
                ))}
            </div>
            <div className="bg-slate-700/50 rounded-full p-1 flex items-center gap-1">
                {currencies.map(c => <button key={c} onClick={() => setCurrency(c)} className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-300 ${currency === c ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-600'}`}>{c}</button>)}
            </div>
        </div>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {currentAssetData?.error ? (
          <div className="lg:col-span-3 bg-slate-800/50 rounded-2xl p-6 border border-yellow-500/30 flex items-start gap-4">
            <WarningIcon className="w-8 h-8 text-yellow-400 flex-shrink-0 mt-1"/>
            <div>
              <h3 className="font-bold text-lg text-yellow-300 mb-2">Data Issue for {selectedAsset}</h3>
              <p className="text-yellow-200">{currentAssetData.error}</p>
            </div>
          </div>
        ) : (!liveSummary || !currentAssetData || currentAssetData.rawData.length === 0) ? (
            <div className="lg:col-span-3 flex items-center justify-center min-h-[50vh] text-slate-400">
                <p>No data available to display for {selectedAsset}.</p>
            </div>
        ) : (
          <>
            <div className="lg:col-span-2 bg-slate-800/50 rounded-2xl p-6 border border-slate-700 shadow-2xl shadow-slate-950/50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <div>
                  <div className="flex items-center gap-2 text-slate-400 text-sm"><ChartIcon className="w-5 h-5" /><span>PORTFOLIO CHART</span><InfoIcon className="w-4 h-4" /></div>
                  <h2 className="text-2xl font-bold text-white mt-1">Portfolio Value vs Invested</h2>
                  <span className="inline-block bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-semibold mt-2 px-2.5 py-1 rounded-full">Dollar-Cost Averaging</span>
                </div>
                <div className="flex items-center gap-2 mt-4 sm:mt-0">
                    <div className="bg-slate-700/50 rounded-full p-1 flex items-center gap-1">
                    {timeRanges.map(range => <button key={range} onClick={() => setTimeRange(range)} className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-300 ${timeRange === range ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-600'}`}>{range}</button>)}
                    </div>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="p-2.5 bg-slate-700/50 rounded-full text-slate-400 hover:bg-slate-600 hover:text-white transition-colors duration-300 disabled:opacity-50" title="Refresh Data"><RefreshIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} /></button>
                </div>
              </div>
              <div className='text-xs text-purple-300/80 mb-6 font-mono flex flex-wrap gap-x-4 gap-y-1'>
                <span>Symbol: {selectedAsset} {currency}</span>
                <span>Start: {formatFullDate(liveSummary.startDate)}</span>
                <span>End: {formatFullDate(new Date(new Date(liveSummary.lastUpdated).setFullYear(new Date(liveSummary.lastUpdated).getFullYear() + 1)))}</span>
                <span>Step: 1 DAY(S)</span>
              </div>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorPortValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorAsset" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#facc15" stopOpacity={0.4}/><stop offset="95%" stopColor="#facc15" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatCompactNumber} orientation="left" width={40} />
                    <YAxis yAxisId="right" stroke="#facc15" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => typeof value === 'number' ? value.toFixed(4) : ''} orientation="right" width={60} />
                    <Tooltip content={<CustomTooltip currency={currency} asset={selectedAsset}/>} />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} formatter={(value, entry) => <span style={{ color: entry.color }}>{value}</span>}/>
                    <Area yAxisId="left" type="monotone" dataKey="portValue" name="PortValue" stroke="#f43f5e" fillOpacity={1} fill="url(#colorPortValue)" strokeWidth={2} />
                    <Area yAxisId="left" type="monotone" dataKey="assetValue" name="Invested" stroke="#a855f7" fillOpacity={1} fill="url(#colorAsset)" strokeWidth={2} />
                    <Area yAxisId="right" type="monotone" dataKey="cumulativeAmount" name={`${selectedAsset} Holdings`} stroke="#facc15" fillOpacity={0.5} fill="url(#colorAmount)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="lg:col-span-1 bg-[#1e222d] rounded-2xl p-6 border border-slate-700 flex flex-col gap-6 shadow-2xl shadow-slate-950/50">
              <div>
                <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-white">Profit</h3><div className="flex items-center gap-2"><span className={`font-bold ${liveSummary.profitPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercentage(liveSummary.profitPercentage)}</span><InfoIcon className="w-4 h-4 text-slate-400" /></div></div>
                <div className="w-full bg-slate-700 rounded-full h-2.5"><div className={`${liveSummary.profitPercentage >= 0 ? 'bg-green-500' : 'bg-red-500'} h-2.5 rounded-full`} style={{ width: `${Math.max(0, Math.min(100, 50 + liveSummary.profitPercentage / 2))}%` }}></div></div>
              </div>
              <div className="flex items-start gap-4">
                <LivePriceIcon />
                <div className="flex-1">
                    <p className="text-slate-400 text-sm">Live {selectedAsset} Price {isGold && `(per ${GOLD_CONVERSION_GRAMS}g)`}</p>
                    {currentLivePrice ? (<><p className="text-xl font-bold text-white mt-1">{formatCurrency(currentLivePrice.price, currency)}</p><p className={`text-sm font-semibold mt-1 ${currentLivePrice.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>{!currentLivePrice.isMock && (currentLivePrice.change24h >= 0 ? '+' : '')}{formatCurrency(currentLivePrice.change24h, currency)}<span className="text-slate-500 font-normal ml-1">({currentLivePrice.isMock ? 'Static' : `${currentLivePrice.change24hPercentage.toFixed(2)}% 24h`})</span></p><p className="text-xs text-slate-500 mt-1">Updated: {livePriceLastUpdated ? livePriceLastUpdated.toLocaleTimeString() : 'N/A'}</p></>)
                    : livePriceError ? <p className="text-sm text-red-400 mt-1">{livePriceError}</p>
                    : <div className="mt-2 space-y-2"><div className="h-5 bg-slate-700 rounded w-3/4 animate-pulse"></div><div className="h-4 bg-slate-700 rounded w-1/2 animate-pulse"></div><div className="h-3 bg-slate-700 rounded w-1/3 animate-pulse"></div></div>}
                </div>
              </div>
              <div className="flex items-start gap-4"><CapitalIcon /><div className="flex-1"><p className="text-slate-400 text-sm">Capital</p><p className="text-xl font-bold text-white mt-1">{formatCurrency(liveSummary.totalCapital, currency)}</p><p className="text-xs text-slate-500 mt-1">Avg. Buy Price: {formatCurrency(liveSummary.entryPrice, currency)}</p><p className="text-xs text-slate-500">Started: {formatDate(liveSummary.startDate)}</p></div></div>
              <div className="flex items-start gap-4"><PortValueIcon /><div className="flex-1"><p className="text-slate-400 text-sm">Port Value</p><p className="text-xl font-bold text-white mt-1">{formatCurrency(liveSummary.portValue, currency)}</p><p className="text-xs text-slate-500 mt-1">Updated: {livePriceLastUpdated ? livePriceLastUpdated.toLocaleTimeString() : `as of ${formatDate(liveSummary.lastUpdated)}`}</p></div></div>
              <div className="flex items-start gap-4"><AssetIcon /><div className="flex-1"><p className="text-slate-400 text-sm">{selectedAsset}</p><p className="text-xl font-bold text-white mt-1">{liveSummary.totalAmount.toFixed(8)}</p></div></div>
              <div className="mt-auto bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs rounded-lg p-3 flex items-start gap-2"><WarningIcon className="w-5 h-5 flex-shrink-0 mt-0.5" /><span>Amount in Portfolio is estimated value and may not be the same as actual value</span></div>
            </div>
          </>
        )}
      </main>
      <section className="mt-8">
        {currentAssetData && !currentAssetData.error && currentAssetData.rawData.length > 0 && (
          <TransactionHistory data={currentAssetData.rawData} currency={currency} conversionRate={conversionRate} asset={selectedAsset} />
        )}
      </section>
    </div>
  );
};

export default App;
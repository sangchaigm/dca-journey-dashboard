import React, { FC } from 'react';
import { RawTransaction, Currency, AssetType } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { HistoryIcon } from './Icons';

interface TransactionHistoryProps {
  data: RawTransaction[];
  currency: Currency;
  conversionRate: number;
  asset: AssetType;
}

const TransactionHistory: FC<TransactionHistoryProps> = ({ data, currency, conversionRate, asset }) => {
  if (!data || data.length === 0) {
    return null;
  }

  const assetUnit = asset === 'GOLD' ? 'g' : '';

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 shadow-2xl shadow-slate-950/50">
      <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
        <HistoryIcon className="w-5 h-5" />
        <span>TRANSACTION HISTORY</span>
      </div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto relative">
        <table className="w-full text-sm text-left text-slate-400">
          <thead className="text-xs text-slate-300 uppercase bg-slate-700/50 sticky top-0 backdrop-blur-sm">
            <tr>
              <th scope="col" className="px-6 py-3">Date</th>
              <th scope="col" className="px-6 py-3 text-right">Invested</th>
              <th scope="col" className="px-6 py-3 text-right">{asset} Price</th>
              <th scope="col" className="px-6 py-3 text-right">{asset} Purchased</th>
            </tr>
          </thead>
          <tbody>
            {data.map((tx, index) => (
              <tr key={index} className="bg-slate-800/30 border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-300 whitespace-nowrap">{formatDate(tx.date)}</td>
                <td className="px-6 py-4 text-right">{formatCurrency(tx.invested * conversionRate, currency)}</td>
                <td className="px-6 py-4 text-right">{formatCurrency(tx.assetPrice * conversionRate, currency)}</td>
                <td className="px-6 py-4 text-right font-mono">{tx.assetPurchased.toFixed(8)} {assetUnit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionHistory;

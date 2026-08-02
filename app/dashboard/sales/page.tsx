'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';
import { TableSkeleton, CardSkeleton, StatCardSkeleton } from '@/components/ui/table-skeleton';
import { EnterpriseDateRangePicker } from '@/components/ui/enterprise-date-range-picker';

interface SalesData {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  totalOrders: number;
  dailySales: Array<{
    date: string;
    revenue: number;
    itemsSold: number;
    profit: number;
  }>;
  monthlySales: Array<{
    month: string;
    revenue: number;
    itemsSold: number;
    profit: number;
  }>;
}

export default function SalesAnalyticsPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchSalesData();
  }, [startDate, endDate]);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      let apiUrl = '/api/dashboard';
      const params = new URLSearchParams();
      
      params.append('period', '1M');
      
      if (startDate) {
        params.append('startDate', startDate.toISOString());
      }
      if (endDate) {
        params.append('endDate', endDate.toISOString());
      }
      
      if (params.toString()) {
        apiUrl += `?${params.toString()}`;
      }
      
      const data = await apiGet<any>(apiUrl);
      
      const transformedSalesOverTime = (data.salesOverTime || []).map((item: any) => {
        const revenue = item.sales || 0;
        const cost = (item.quantity || 0) * (data.totalCost / Math.max(data.totalTransactions, 1));
        const profit = revenue - cost;
        
        let fullDate: string;
        if (item.date.includes(':')) {
          const today = new Date();
          const [hours] = item.date.split(':');
          today.setHours(parseInt(hours), 0, 0, 0);
          fullDate = today.toISOString();
        } else if (item.date.includes('-')) {
          fullDate = new Date(item.date).toISOString();
        } else {
          const currentYear = new Date().getFullYear();
          const [month, day] = item.date.split(' ');
          const monthMap: { [key: string]: number } = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          const monthIndex = monthMap[month] || 0;
          const date = new Date(currentYear, monthIndex, parseInt(day));
          fullDate = date.toISOString();
        }
        
        return {
          date: fullDate,
          revenue: revenue,
          itemsSold: item.quantity || 0,
          profit: profit
        };
      });
      
      const transformedData: SalesData = {
        totalRevenue: data.totalRevenue || 0,
        totalCost: data.totalCost || 0,
        totalProfit: data.totalProfit || 0,
        profitMargin: data.profitMargin || 0,
        totalOrders: data.totalTransactions || 0,
        dailySales: transformedSalesOverTime,
        monthlySales: transformedSalesOverTime
      };
      
      setSalesData(transformedData);
    } catch (err) {
      console.error('[Sales Page] Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="h-10 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <StatCardSkeleton count={4} />
        <CardSkeleton lines={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md border-0 shadow-sm">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
            <Button onClick={fetchSalesData} variant="outline" size="sm">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const calculatedProfitMargin = salesData?.totalRevenue && salesData.totalRevenue > 0 
    ? salesData.totalProfit / salesData.totalRevenue 
    : 0;

  const hasNoSales = !salesData || (salesData.totalOrders === 0 && salesData.totalRevenue === 0);

  if (hasNoSales) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">Sales History</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Track revenue and performance</p>
        </div>
        
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-base font-medium text-slate-900 dark:text-white mb-2">
              No sales data available
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Sales transactions will appear here once recorded
            </p>
            <Button onClick={fetchSalesData} variant="outline" size="sm">Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate first day of month offset
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Sales History
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400">
            Track revenue, analyze performance, and monitor sales trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EnterpriseDateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={(start, end) => {
              setStartDate(start)
              setEndDate(end)
            }}
          />
          <Button variant="outline" size="sm" className="h-9">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics - Dashboard Style with colored backgrounds and shadows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 shadow-lg shadow-emerald-500/30 flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Revenue</p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 tabular-nums">
                {formatCurrency(salesData.totalRevenue)}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 flex items-center gap-1 mt-0.5">
                {salesData.totalOrders} orders
              </p>
            </div>
          </div>
        </Card>

        {/* Total Cost */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-600 shadow-lg shadow-slate-500/30 flex-shrink-0">
              <Minus className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">Total Cost</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatCurrency(salesData.totalCost)}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                Total expenses
              </p>
            </div>
          </div>
        </Card>

        {/* Total Profit */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-lg flex-shrink-0 ${
              salesData.totalProfit > 0 
                ? 'bg-blue-600 shadow-blue-500/30' 
                : salesData.totalProfit < 0 
                ? 'bg-red-600 shadow-red-500/30'
                : 'bg-slate-600 shadow-slate-500/30'
            }`}>
              {salesData.totalProfit > 0 ? (
                <TrendingUp className="h-5 w-5 text-white" />
              ) : salesData.totalProfit < 0 ? (
                <TrendingDown className="h-5 w-5 text-white" />
              ) : (
                <Minus className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${
                salesData.totalProfit > 0 
                  ? 'text-blue-700 dark:text-blue-400' 
                  : salesData.totalProfit < 0 
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-slate-700 dark:text-slate-400'
              }`}>Net Profit</p>
              <p className={`text-2xl font-bold tabular-nums ${
                salesData.totalProfit > 0 
                  ? 'text-blue-900 dark:text-blue-100' 
                  : salesData.totalProfit < 0 
                  ? 'text-red-900 dark:text-red-100'
                  : 'text-slate-900 dark:text-slate-100'
              }`}>
                {formatCurrency(salesData.totalProfit)}
              </p>
              <p className={`text-xs flex items-center gap-1 mt-0.5 ${
                salesData.totalProfit > 0 
                  ? 'text-blue-600 dark:text-blue-500' 
                  : salesData.totalProfit < 0 
                  ? 'text-red-600 dark:text-red-500'
                  : 'text-slate-600 dark:text-slate-500'
              }`}>
                {salesData.totalProfit > 0 ? '✓ Profitable' : salesData.totalProfit < 0 ? '⚠ Loss' : 'Break-even'}
              </p>
            </div>
          </div>
        </Card>

        {/* Profit Margin */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-600 shadow-lg shadow-amber-500/30 flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Profit Margin</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 tabular-nums">
                {formatPercentage(calculatedProfitMargin)}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1 mt-0.5">
                {calculatedProfitMargin >= 0.3 ? '🏆 Excellent!' : calculatedProfitMargin >= 0.15 ? '✓ Good' : '⚠ Improve'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sales Calendar - Dashboard Style */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-blue-500 rounded-full flex-shrink-0"></div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Sales Calendar</h3>
                <p className="text-xs mt-0.5 text-slate-600 dark:text-slate-400">Daily sales overview</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(currentMonth.getMonth())}
                onValueChange={(val) => {
                  const newDate = new Date(currentMonth);
                  newDate.setMonth(Number(val));
                  setCurrentMonth(newDate);
                }}
              >
                <SelectTrigger className="w-[130px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((month, idx) => (
                    <SelectItem key={idx} value={String(idx)}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(currentMonth.getFullYear())}
                onValueChange={(val) => {
                  const newDate = new Date(currentMonth);
                  newDate.setFullYear(Number(val));
                  setCurrentMonth(newDate);
                }}
              >
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
                className="h-8 px-3 text-xs"
              >
                Today
              </Button>
            </div>
          </div>
        </div>
        <CardContent className="pt-4 pb-3">
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center pb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{day}</span>
              </div>
            ))}
            
            {/* Empty cells for offset */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {/* Calendar days */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dayData = salesData.dailySales?.find(d => {
                const date = new Date(d.date);
                return date.getDate() === day && 
                       date.getMonth() === currentMonth.getMonth() && 
                       date.getFullYear() === currentMonth.getFullYear();
              });

              const isToday = new Date().getDate() === day && 
                            new Date().getMonth() === currentMonth.getMonth() &&
                            new Date().getFullYear() === currentMonth.getFullYear();

              return (
                <div
                  key={day}
                  className={`
                    aspect-square rounded-lg p-2 flex flex-col items-center justify-center
                    transition-all duration-150
                    ${isToday 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500' 
                      : dayData 
                      ? 'bg-slate-50 dark:bg-[#1a1a1a] hover:bg-slate-100 dark:hover:bg-[#222] border border-transparent hover:border-slate-200 dark:hover:border-emerald-500/15 cursor-pointer'
                      : 'bg-white dark:bg-slate-900'
                    }
                  `}
                >
                  <div className={`text-sm font-bold mb-1 ${
                    isToday 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {day}
                  </div>
                  {dayData && dayData.revenue > 0 ? (
                    <div className="text-center">
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        ₱{formatNumber(dayData.revenue)}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {dayData.itemsSold} items
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 dark:text-slate-600">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US').format(value);
};

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Download, TrendingUp, TrendingDown, Minus, Package, ShoppingCart, DollarSign, Award, FileText, Printer } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';
import { TableSkeleton, CardSkeleton, StatCardSkeleton } from '@/components/ui/table-skeleton';
import { EnterpriseDateRangePicker } from '@/components/ui/enterprise-date-range-picker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import * as XLSX from 'xlsx';

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
  topProducts?: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  recentTransactions?: Array<{
    id: string;
    date: string;
    itemName: string;
    quantity: number;
    totalRevenue: number;
  }>;
}

interface DayDetailsData {
  date: string;
  transactions: Array<{
    id: string;
    time: string;
    product: string;
    quantity: number;
    amount: number;
    customer?: string;
  }>;
  totalRevenue: number;
  totalItems: number;
}

export default function SalesAnalyticsPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [previousMonthData, setPreviousMonthData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedDayDetails, setSelectedDayDetails] = useState<DayDetailsData | null>(null);
  const [dayDetailsOpen, setDayDetailsOpen] = useState(false);

  useEffect(() => {
    fetchSalesData();
    fetchPreviousMonthData();
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
        monthlySales: transformedSalesOverTime,
        topProducts: data.topProducts || [],
        recentTransactions: data.recentTransactions || []
      };
      
      setSalesData(transformedData);
    } catch (err) {
      console.error('[Sales Page] Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviousMonthData = async () => {
    try {
      const prevMonth = new Date();
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const prevMonthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
      const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
      
      const params = new URLSearchParams();
      params.append('period', '1M');
      params.append('startDate', prevMonthStart.toISOString());
      params.append('endDate', prevMonthEnd.toISOString());
      
      const data = await apiGet<any>(`/api/dashboard?${params.toString()}`);
      
      setPreviousMonthData({
        totalRevenue: data.totalRevenue || 0,
        totalCost: data.totalCost || 0,
        totalProfit: data.totalProfit || 0,
        profitMargin: data.profitMargin || 0,
        totalOrders: data.totalTransactions || 0,
        dailySales: [],
        monthlySales: []
      });
    } catch (err) {
      console.error('[Sales Page] Error fetching previous month:', err);
    }
  };

  const handleExportExcel = () => {
    if (!salesData) return;

    const worksheetData = [
      ['Sales Report'],
      ['Generated:', new Date().toLocaleDateString()],
      [],
      ['Summary'],
      ['Total Revenue', formatCurrency(salesData.totalRevenue)],
      ['Total Cost', formatCurrency(salesData.totalCost)],
      ['Total Profit', formatCurrency(salesData.totalProfit)],
      ['Profit Margin', formatPercentage(calculatedProfitMargin)],
      ['Total Orders', salesData.totalOrders],
      [],
      ['Daily Sales'],
      ['Date', 'Revenue', 'Items Sold', 'Profit']
    ];

    salesData.dailySales.forEach(day => {
      worksheetData.push([
        new Date(day.date).toLocaleDateString(),
        day.revenue,
        day.itemsSold,
        day.profit
      ]);
    });

    if (salesData.topProducts && salesData.topProducts.length > 0) {
      worksheetData.push([], ['Top Products'], ['Product', 'Quantity', 'Revenue']);
      salesData.topProducts.forEach(product => {
        worksheetData.push([product.name, product.quantity, product.revenue]);
      });
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');
    XLSX.writeFile(workbook, `sales-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleDayClick = (day: number) => {
    const dayData = salesData?.dailySales?.find(d => {
      const date = new Date(d.date);
      return date.getDate() === day && 
             date.getMonth() === currentMonth.getMonth() && 
             date.getFullYear() === currentMonth.getFullYear();
    });

    if (!dayData || dayData.revenue === 0) return;

    const mockTransactions = [
      {
        id: '1',
        time: '09:30 AM',
        product: 'Product A',
        quantity: 2,
        amount: dayData.revenue * 0.3,
        customer: 'Customer 1'
      },
      {
        id: '2',
        time: '11:45 AM',
        product: 'Product B',
        quantity: 1,
        amount: dayData.revenue * 0.2,
        customer: 'Customer 2'
      },
      {
        id: '3',
        time: '02:15 PM',
        product: 'Product C',
        quantity: 3,
        amount: dayData.revenue * 0.5,
        customer: 'Customer 3'
      }
    ];

    setSelectedDayDetails({
      date: new Date(dayData.date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      transactions: mockTransactions,
      totalRevenue: dayData.revenue,
      totalItems: dayData.itemsSold
    });
    setDayDetailsOpen(true);
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

  if (!salesData) {
    return null;
  }

  const calculatedProfitMargin = salesData.totalRevenue && salesData.totalRevenue > 0 
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
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9"
            onClick={handleExportExcel}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9"
            onClick={handleExportPDF}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
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

      {/* Period Comparison Cards - This Month vs Last Month */}
      {previousMonthData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue Comparison */}
          <Card className="p-5 border-0 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Revenue Change
              </p>
              {salesData.totalRevenue >= previousMonthData.totalRevenue ? (
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </div>
            <p className={`text-2xl font-bold tabular-nums ${
              salesData.totalRevenue >= previousMonthData.totalRevenue 
                ? 'text-emerald-600' 
                : 'text-red-600'
            }`}>
              {previousMonthData.totalRevenue > 0
                ? `${((salesData.totalRevenue - previousMonthData.totalRevenue) / previousMonthData.totalRevenue * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
              vs last month: {formatCurrency(previousMonthData.totalRevenue)}
            </p>
          </Card>

          {/* Cost Comparison */}
          <Card className="p-5 border-0 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Cost Change
              </p>
              {salesData.totalCost <= previousMonthData.totalCost ? (
                <TrendingDown className="h-4 w-4 text-emerald-600" />
              ) : (
                <TrendingUp className="h-4 w-4 text-red-600" />
              )}
            </div>
            <p className={`text-2xl font-bold tabular-nums ${
              salesData.totalCost <= previousMonthData.totalCost 
                ? 'text-emerald-600' 
                : 'text-red-600'
            }`}>
              {previousMonthData.totalCost > 0
                ? `${((salesData.totalCost - previousMonthData.totalCost) / previousMonthData.totalCost * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
              vs last month: {formatCurrency(previousMonthData.totalCost)}
            </p>
          </Card>

          {/* Profit Comparison */}
          <Card className="p-5 border-0 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Profit Change
              </p>
              {salesData.totalProfit >= previousMonthData.totalProfit ? (
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </div>
            <p className={`text-2xl font-bold tabular-nums ${
              salesData.totalProfit >= previousMonthData.totalProfit 
                ? 'text-emerald-600' 
                : 'text-red-600'
            }`}>
              {previousMonthData.totalProfit !== 0
                ? `${((salesData.totalProfit - previousMonthData.totalProfit) / Math.abs(previousMonthData.totalProfit) * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
              vs last month: {formatCurrency(previousMonthData.totalProfit)}
            </p>
          </Card>

          {/* Orders Comparison */}
          <Card className="p-5 border-0 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Orders Change
              </p>
              {salesData.totalOrders >= previousMonthData.totalOrders ? (
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </div>
            <p className={`text-2xl font-bold tabular-nums ${
              salesData.totalOrders >= previousMonthData.totalOrders 
                ? 'text-emerald-600' 
                : 'text-red-600'
            }`}>
              {previousMonthData.totalOrders > 0
                ? `${((salesData.totalOrders - previousMonthData.totalOrders) / previousMonthData.totalOrders * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
              vs last month: {previousMonthData.totalOrders} orders
            </p>
          </Card>
        </div>
      )}

      {/* Top Products Section */}
      {salesData.topProducts && salesData.topProducts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top 5 by Revenue */}
          <Card className="p-5 border-0 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-amber-600 shadow-md shadow-amber-500/30">
                <Award className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Products by Revenue</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">Best performing items</p>
              </div>
            </div>
            <div className="space-y-3">
              {salesData.topProducts
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5)
                .map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {product.name}
                      </span>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(product.revenue)}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-500">
                        {product.quantity} sold
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          {/* Top 5 by Quantity */}
          <Card className="p-5 border-0 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-blue-600 shadow-md shadow-blue-500/30">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Products by Quantity</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">Most sold items</p>
              </div>
            </div>
            <div className="space-y-3">
              {salesData.topProducts
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5)
                .map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {product.name}
                      </span>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {product.quantity} units
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-500">
                        {formatCurrency(product.revenue)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* Sales Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Order Value */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600 shadow-lg shadow-purple-500/30 flex-shrink-0">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                Avg Order Value
              </p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 tabular-nums">
                {salesData.totalOrders > 0 
                  ? formatCurrency(salesData.totalRevenue / salesData.totalOrders)
                  : formatCurrency(0)}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-500 mt-0.5">
                Per transaction
              </p>
            </div>
          </div>
        </Card>

        {/* Total Items Sold */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/30 flex-shrink-0">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                Total Items Sold
              </p>
              <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 tabular-nums">
                {salesData.dailySales.reduce((sum, day) => sum + day.itemsSold, 0).toLocaleString()}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-500 mt-0.5">
                Units moved
              </p>
            </div>
          </div>
        </Card>

        {/* Average Daily Revenue */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-600 shadow-lg shadow-teal-500/30 flex-shrink-0">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                Avg Daily Revenue
              </p>
              <p className="text-2xl font-bold text-teal-900 dark:text-teal-100 tabular-nums">
                {salesData.dailySales.length > 0
                  ? formatCurrency(
                      salesData.dailySales.reduce((sum, day) => sum + day.revenue, 0) / 
                      salesData.dailySales.length
                    )
                  : formatCurrency(0)}
              </p>
              <p className="text-xs text-teal-600 dark:text-teal-500 mt-0.5">
                Per day average
              </p>
            </div>
          </div>
        </Card>

        {/* Best Sales Day */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600 shadow-lg shadow-rose-500/30 flex-shrink-0">
              <Award className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                Best Sales Day
              </p>
              <p className="text-2xl font-bold text-rose-900 dark:text-rose-100 tabular-nums">
                {salesData.dailySales.length > 0
                  ? formatCurrency(Math.max(...salesData.dailySales.map(d => d.revenue)))
                  : formatCurrency(0)}
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">
                {salesData.dailySales.length > 0
                  ? new Date(
                      salesData.dailySales.reduce((max, day) => 
                        day.revenue > max.revenue ? day : max
                      ).date
                    ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'N/A'}
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
                  onClick={() => dayData && dayData.revenue > 0 && handleDayClick(day)}
                  className={`
                    aspect-square rounded-lg p-2 flex flex-col items-center justify-center
                    transition-all duration-150
                    ${isToday 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500' 
                      : dayData && dayData.revenue > 0
                      ? 'bg-slate-50 dark:bg-[#1a1a1a] hover:bg-slate-100 dark:hover:bg-[#222] border border-transparent hover:border-slate-200 dark:hover:border-emerald-500/15 cursor-pointer hover:scale-105'
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

      {/* Day Details Modal */}
      <Dialog open={dayDetailsOpen} onOpenChange={setDayDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold gradient-text">
              Sales Details
            </DialogTitle>
            <DialogDescription>
              {selectedDayDetails?.date}
            </DialogDescription>
          </DialogHeader>
          
          {selectedDayDetails && (
            <div className="space-y-4">
              {/* Day Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {formatCurrency(selectedDayDetails.totalRevenue)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">
                    Total Items
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {selectedDayDetails.totalItems}
                  </p>
                </div>
              </div>

              {/* Transactions List */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Transactions</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedDayDetails.transactions.map((transaction) => (
                    <div 
                      key={transaction.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {transaction.product}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {transaction.time} • {transaction.customer}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(transaction.amount)}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-500">
                          {transaction.quantity} {transaction.quantity === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US').format(value);
};

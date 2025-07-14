import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import './App.css'

// Import the financial data
import financialData from './assets/structured_financial_data.json'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0']

function App() {
  const [selectedMonth, setSelectedMonth] = useState('May 2025')
  const [activeTab, setActiveTab] = useState('Overview')
  const [data, setData] = useState(null)
  
  // Date range state
  const [startMonth, setStartMonth] = useState('May 2025')
  const [endMonth, setEndMonth] = useState('May 2025')

  useEffect(() => {
    console.log('Loading financial data:', financialData)
    setData(financialData)
  }, [])

  if (!data) {
    return <div className="loading">Loading financial data...</div>
  }

  // Get all available months and sort them chronologically
  const allMonths = Object.keys(data).sort((a, b) => {
    const dateA = new Date(a)
    const dateB = new Date(b)
    return dateA - dateB
  })

  console.log('Available months:', allMonths)

  // Define the 12-month period (July 2024 - June 2025)
  const twelveMonthPeriod = [
    'July 2024', 'August 2024', 'September 2024', 'October 2024', 'November 2024', 'December 2024',
    'January 2025', 'February 2025', 'March 2025', 'April 2025', 'May 2025', 'June 2025'
  ]

  // Filter to only include months that exist in the data
  const availableMonths = twelveMonthPeriod.filter(month => data[month])
  console.log('Available 12-month period:', availableMonths)

  // Calculate 12-month totals with rent included
  const calculate12MonthTotals = () => {
    let totalRevenue = 0
    let totalCOGS = 0
    let totalPayroll = 0
    let totalOperatingExpenses = 0
    let totalRent = 0

    availableMonths.forEach(month => {
      const monthData = data[month]
      if (monthData) {
        totalRevenue += monthData.total_revenue || 0
        totalCOGS += monthData.cogs || 0
        totalPayroll += monthData.payroll || 0
        totalOperatingExpenses += monthData.operating_expenses || 0
        
        // Add rent from operating expense details
        if (monthData.operating_expense_details && monthData.operating_expense_details['Rent Expense']) {
          totalRent += monthData.operating_expense_details['Rent Expense']
        }
      }
    })

    // Total expenses now includes rent (which is part of operating expenses)
    const totalExpenses = totalCOGS + totalPayroll + totalOperatingExpenses
    const netProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      totalCOGS,
      totalPayroll,
      totalOperatingExpenses,
      totalRent,
      monthCount: availableMonths.length
    }
  }

  const totals = calculate12MonthTotals()

  // Prepare monthly data for charts
  const monthlyData = availableMonths.map(month => {
    const monthData = data[month]
    if (!monthData) return null

    const totalRevenue = monthData.total_revenue || 0
    const cogs = monthData.cogs || 0
    const payroll = monthData.payroll || 0
    const operatingExpenses = monthData.operating_expenses || 0
    const rent = monthData.operating_expense_details?.['Rent Expense'] || 0
    const otherExpenses = operatingExpenses - rent
    const totalExpenses = cogs + payroll + operatingExpenses
    const netProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    return {
      month: month.split(' ')[0], // Just the month name
      fullMonth: month,
      revenue: totalRevenue,
      expenses: totalExpenses,
      cogs: cogs,
      payroll: payroll,
      rent: rent,
      otherExpenses: otherExpenses,
      operatingExpenses: operatingExpenses,
      profit: netProfit,
      profitMargin: profitMargin
    }
  }).filter(Boolean)

  // Get months within selected date range
  const getMonthsInRange = (start, end) => {
    const startIndex = allMonths.indexOf(start)
    const endIndex = allMonths.indexOf(end)
    
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      return [start] // fallback to single month
    }
    
    return allMonths.slice(startIndex, endIndex + 1)
  }

  const selectedMonths = getMonthsInRange(startMonth, endMonth)

  // Calculate aggregated data for selected date range
  const calculateRangeData = () => {
    let totalRevenue = 0
    let totalCOGS = 0
    let totalPayroll = 0
    let totalOperatingExpenses = 0
    let totalRent = 0

    selectedMonths.forEach(month => {
      const monthData = data[month]
      if (monthData) {
        totalRevenue += monthData.total_revenue || 0
        totalCOGS += monthData.cogs || 0
        totalPayroll += monthData.payroll || 0
        totalOperatingExpenses += monthData.operating_expenses || 0
        
        // Add rent from operating expense details
        if (monthData.operating_expense_details && monthData.operating_expense_details['Rent Expense']) {
          totalRent += monthData.operating_expense_details['Rent Expense']
        }
      }
    })

    const otherExpenses = totalOperatingExpenses - totalRent
    const totalExpenses = totalCOGS + totalPayroll + totalOperatingExpenses
    const netProfit = totalRevenue - totalExpenses

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      totalCOGS,
      totalPayroll,
      totalRent,
      otherExpenses,
      monthCount: selectedMonths.length
    }
  }

  const rangeData = calculateRangeData()

  // Get current month data (for single month view compatibility)
  const currentMonthData = data[selectedMonth] || {}

  // Prepare payment type data for current month
  const paymentData = []
  if (currentMonthData.payment_breakdown) {
    Object.entries(currentMonthData.payment_breakdown).forEach(([type, amount]) => {
      if (type !== 'total' && amount > 0) {
        paymentData.push({
          name: type,
          value: amount
        })
      }
    })
  }

  // Prepare expense breakdown for current month with rent separated
  const currentRevenue = currentMonthData.total_revenue || 0
  const expenseBreakdown = []
  
  if (currentRevenue > 0) {
    const cogs = currentMonthData.cogs || 0
    const payroll = currentMonthData.payroll || 0
    const operatingExpenses = currentMonthData.operating_expenses || 0
    
    // Get rent from operating expense details
    const rent = currentMonthData.operating_expense_details?.['Rent Expense'] || 0
    
    expenseBreakdown.push(
      { name: 'COGS', value: cogs, percentage: (cogs / currentRevenue) * 100 },
      { name: 'Payroll (COL)', value: payroll, percentage: (payroll / currentRevenue) * 100 },
      { name: 'Rent Expense', value: rent, percentage: (rent / currentRevenue) * 100 },
      { name: 'Other Operating Expenses', value: operatingExpenses - rent, percentage: ((operatingExpenses - rent) / currentRevenue) * 100 }
    )

    // Add detailed operating expense breakdown if available
    if (currentMonthData.operating_expense_details) {
      Object.entries(currentMonthData.operating_expense_details).forEach(([category, amount]) => {
        if (category !== 'Rent Expense' && amount > 0) {
          expenseBreakdown.push({
            name: category,
            value: amount,
            percentage: (amount / currentRevenue) * 100
          })
        }
      })
    }
  }

  // Prepare trend data for selected range
  const trendData = selectedMonths.map(month => {
    const monthData = data[month]
    if (!monthData) return null

    const totalRevenue = monthData.total_revenue || 0
    const cogs = monthData.cogs || 0
    const payroll = monthData.payroll || 0
    const operatingExpenses = monthData.operating_expenses || 0
    const rent = monthData.operating_expense_details?.['Rent Expense'] || 0
    const otherExpenses = operatingExpenses - rent
    const totalExpenses = cogs + payroll + operatingExpenses
    const netProfit = totalRevenue - totalExpenses

    return {
      month: month.split(' ')[0], // Just the month name
      fullMonth: month,
      revenue: totalRevenue,
      expenses: totalExpenses,
      netProfit: netProfit,
      cogs: cogs,
      payroll: payroll,
      rent: rent,
      otherExpenses: otherExpenses,
      profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    }
  }).filter(Boolean)

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value) => {
    return `${value.toFixed(2)}%`
  }

  // Tab content rendering
  const renderTabContent = () => {
    switch (activeTab) {
      case 'Revenue':
        return (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Store Revenue by Payment Type</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Revenue Sources</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">Store Revenue (VAT-excluded)</span>
                    <span className="font-bold">{formatCurrency(currentMonthData.store_revenue_vat_excluded || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">Non-Store Revenue</span>
                    <span className="font-bold">{formatCurrency(currentMonthData.non_store_revenue || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                    <span className="font-bold">Total Revenue</span>
                    <span className="font-bold text-blue-600">{formatCurrency(currentMonthData.total_revenue || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      
      case 'Expenses':
        return (
          <div className="p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown (% of Revenue)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expenseBreakdown.map((expense, index) => (
                <div key={expense.name} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-700">{expense.name}</span>
                    <span className="text-sm font-bold text-gray-900">{formatPercentage(expense.percentage)}</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900">{formatCurrency(expense.value)}</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(expense.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      
      case 'Trends':
        return (
          <div className="p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Trends Analysis ({startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`})
            </h4>
            
            {/* Revenue and Profit Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div>
                <h5 className="text-md font-semibold text-gray-800 mb-4">Revenue & Profit Trends</h5>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                      <Tooltip 
                        formatter={(value, name) => [formatCurrency(value), name]}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} name="Revenue" />
                      <Line type="monotone" dataKey="netProfit" stroke="#10B981" strokeWidth={2} name="Net Profit" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h5 className="text-md font-semibold text-gray-800 mb-4">Expense Breakdown Trends</h5>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                      <Tooltip 
                        formatter={(value, name) => [formatCurrency(value), name]}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Line type="monotone" dataKey="cogs" stroke="#F59E0B" strokeWidth={2} name="COGS" />
                      <Line type="monotone" dataKey="payroll" stroke="#8B5CF6" strokeWidth={2} name="Payroll" />
                      <Line type="monotone" dataKey="rent" stroke="#6366F1" strokeWidth={2} name="Rent" />
                      <Line type="monotone" dataKey="otherExpenses" stroke="#6B7280" strokeWidth={2} name="Other Expenses" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white border rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 mb-2">Period Summary</h5>
                <p className="text-sm text-gray-600">Selected range</p>
                <div className="text-lg font-bold text-blue-600 mt-2">
                  {rangeData.monthCount} {rangeData.monthCount === 1 ? 'Month' : 'Months'}
                </div>
                <div className="text-sm text-gray-500">
                  {startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`}
                </div>
              </div>
              
              <div className="bg-white border rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 mb-2">Avg Monthly Revenue</h5>
                <p className="text-sm text-gray-600">Period average</p>
                <div className="text-lg font-bold text-green-600 mt-2">
                  {formatCurrency(rangeData.totalRevenue / rangeData.monthCount)}
                </div>
              </div>
              
              <div className="bg-white border rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 mb-2">Avg Monthly Profit</h5>
                <p className="text-sm text-gray-600">Period average</p>
                <div className="text-lg font-bold text-purple-600 mt-2">
                  {formatCurrency(rangeData.netProfit / rangeData.monthCount)}
                </div>
              </div>
              
              <div className="bg-white border rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 mb-2">Avg Profit Margin</h5>
                <p className="text-sm text-gray-600">Period average</p>
                <div className="text-lg font-bold text-indigo-600 mt-2">
                  {formatPercentage(rangeData.totalRevenue > 0 ? (rangeData.netProfit / rangeData.totalRevenue) * 100 : 0)}
                </div>
              </div>
            </div>
          </div>
        )
      
      default:
        return (
          <div className="p-6">
            {/* Revenue Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Store Revenue by Payment Type</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Revenue Sources</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">Store Revenue (VAT-excluded)</span>
                    <span className="font-bold">{formatCurrency(currentMonthData.store_revenue_vat_excluded || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">Non-Store Revenue</span>
                    <span className="font-bold">{formatCurrency(currentMonthData.non_store_revenue || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                    <span className="font-bold">Total Revenue</span>
                    <span className="font-bold text-blue-600">{formatCurrency(currentMonthData.total_revenue || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expense Breakdown */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown (% of Revenue)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {expenseBreakdown.map((expense, index) => (
                  <div key={expense.name} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-700">{expense.name}</span>
                      <span className="text-sm font-bold text-gray-900">{formatPercentage(expense.percentage)}</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{formatCurrency(expense.value)}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(expense.percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">P&L Dashboard</h1>
            <p className="text-gray-600">Monthly Financial Analysis (VAT-Excluded Store Revenue)</p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {allMonths.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 12-Month Overview */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">12-Month P&L Overview</h2>
            <div className="text-sm text-gray-600 mt-2 md:mt-0">
              <span className="font-medium">July 2024 - June 2025</span>
              <span className="ml-4">June 2024 available for YoY reference</span>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">Total Revenue ({totals.monthCount} months)</h3>
                <span className="text-blue-600">💰</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalRevenue)}</div>
              <p className="text-xs text-gray-500 mt-1">
                VAT Excluded | Avg: {formatCurrency(totals.totalRevenue / totals.monthCount)}/month
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">Total Expenses ({totals.monthCount} months)</h3>
                <span className="text-red-600">📊</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalExpenses)}</div>
              <p className="text-xs text-gray-500 mt-1">
                COGS: {formatCurrency(totals.totalCOGS)} | Payroll: {formatCurrency(totals.totalPayroll)} | Rent: {formatCurrency(totals.totalRent)}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">Total Net Profit ({totals.monthCount} months)</h3>
                <span className="text-green-600">📈</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.netProfit)}</div>
              <p className="text-xs text-gray-500 mt-1">
                Avg: {formatCurrency(totals.netProfit / totals.monthCount)}/month
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">Avg Profit Margin ({totals.monthCount} months)</h3>
                <span className="text-purple-600">⏰</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">{formatPercentage(totals.profitMargin)}</div>
              <p className="text-xs text-gray-500 mt-1">
                VAT Savings: {formatCurrency(totals.totalRevenue * 0.07)}
              </p>
            </div>
          </div>

          {/* Monthly Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              12-Month Financial Overview (July 2024 - June 2025)
            </h3>
            <p className="text-sm text-gray-600 mb-6">Monthly breakdown of Revenue, Expenses, and Profit</p>
            
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                  <Tooltip 
                    formatter={(value, name) => [formatCurrency(value), name]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Bar dataKey="revenue" fill="#3B82F6" name="Total Revenue" />
                  <Bar dataKey="expenses" fill="#EF4444" name="Total Expenses" />
                  <Bar dataKey="profit" fill="#10B981" name="Net Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Date Range Analysis */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Date Range Analysis</h2>
          
          {/* Date Range Selectors */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center mb-6">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">From:</label>
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {allMonths.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">To:</label>
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {allMonths.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="text-sm text-gray-600">
                Selected: {rangeData.monthCount} {rangeData.monthCount === 1 ? 'month' : 'months'}
              </div>
            </div>
            
            {/* Aggregated Key Metrics */}
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`} Aggregated Results
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Revenue */}
              <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Total Revenue</h4>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(rangeData.totalRevenue)}</div>
                <p className="text-sm text-gray-600 mt-1">100.00%</p>
              </div>

              {/* Total Expenses */}
              <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Total Expenses</h4>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(rangeData.totalExpenses)}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {rangeData.totalRevenue > 0 ? formatPercentage((rangeData.totalExpenses / rangeData.totalRevenue) * 100) : '0%'}
                </p>
              </div>

              {/* Net Profit */}
              <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Net Profit</h4>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(rangeData.netProfit)}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {rangeData.totalRevenue > 0 ? formatPercentage((rangeData.netProfit / rangeData.totalRevenue) * 100) : '0%'}
                </p>
              </div>

              {/* COGS */}
              <div className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                <h4 className="text-sm font-medium text-gray-700 mb-1">COGS</h4>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(rangeData.totalCOGS)}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {rangeData.totalRevenue > 0 ? formatPercentage((rangeData.totalCOGS / rangeData.totalRevenue) * 100) : '0%'}
                </p>
              </div>

              {/* Payroll (COL) */}
              <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Payroll (COL)</h4>
                <div className="text-2xl font-bold text-purple-600">{formatCurrency(rangeData.totalPayroll)}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {rangeData.totalRevenue > 0 ? formatPercentage((rangeData.totalPayroll / rangeData.totalRevenue) * 100) : '0%'}
                </p>
              </div>

              {/* Rent */}
              <div className="p-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-500">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Rent</h4>
                <div className="text-2xl font-bold text-indigo-600">{formatCurrency(rangeData.totalRent)}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {rangeData.totalRevenue > 0 ? formatPercentage((rangeData.totalRent / rangeData.totalRevenue) * 100) : '0%'}
                </p>
              </div>

              {/* Other Expenses */}
              <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-500">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Other Expenses</h4>
                <div className="text-2xl font-bold text-gray-600">{formatCurrency(rangeData.otherExpenses)}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {rangeData.totalRevenue > 0 ? formatPercentage((rangeData.otherExpenses / rangeData.totalRevenue) * 100) : '0%'}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6">
                {['Overview', 'Revenue', 'Expenses', 'Trends'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`border-b-2 py-4 px-1 text-sm font-medium ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App


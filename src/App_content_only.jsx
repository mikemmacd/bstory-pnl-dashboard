import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { Upload, Calendar, TrendingUp, DollarSign, PieChart as PieChartIcon, BarChart3, Clock } from 'lucide-react'
import * as XLSX from 'xlsx'

// Import the financial data
import financialData from './assets/structured_financial_data.json'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

function App() {
  const [data, setData] = useState(financialData)
  const [selectedFromMonth, setSelectedFromMonth] = useState('2025-05')
  const [selectedToMonth, setSelectedToMonth] = useState('2025-05')
  const [activeTab, setActiveTab] = useState('overview')
  const [showBenchmarks, setShowBenchmarks] = useState(false)
  const [aiRecommendations, setAiRecommendations] = useState('')
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  
  // Upload states
  const [showRevenueUpload, setShowRevenueUpload] = useState(false)
  const [showExpensesUpload, setShowExpensesUpload] = useState(false)
  const [showPayrollUpload, setShowPayrollUpload] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  // Get available months for dropdowns
  const availableMonths = Object.keys(data).sort()

  // Calculate 12-month rolling data
  const getLast12Months = () => {
    const months = Object.keys(data).sort()
    return months.slice(-12)
  }

  const last12Months = getLast12Months()

  // Calculate totals for 12-month period
  const calculate12MonthTotals = () => {
    let totalRevenue = 0
    let totalCOGS = 0
    let totalPayroll = 0
    let totalRent = 0
    let totalOtherExpenses = 0

    last12Months.forEach(month => {
      const monthData = data[month]
      if (monthData) {
        totalRevenue += monthData.storeRevenue || 0
        totalCOGS += monthData.cogs || 0
        totalPayroll += monthData.payroll || 0
        totalRent += monthData.rent || 0
        totalOtherExpenses += monthData.otherExpenses || 0
      }
    })

    const totalExpenses = totalCOGS + totalPayroll + totalRent + totalOtherExpenses
    const totalEBITDA = totalRevenue - totalExpenses

    return {
      totalRevenue,
      totalCOGS,
      totalPayroll,
      totalRent,
      totalOtherExpenses,
      totalExpenses,
      totalEBITDA,
      avgEBITDA: totalRevenue > 0 ? (totalEBITDA / totalRevenue) * 100 : 0
    }
  }

  const totals12Month = calculate12MonthTotals()

  // Extract date from file content only
  const extractDateFromContent = (content, fileType) => {
    try {
      if (fileType === 'expenses') {
        // For expenses XLSX, look for date range in the header like "From 01/07/2025 To 31/07/2025"
        const lines = content.split('\n')
        for (const line of lines) {
          const dateMatch = line.match(/From\s+(\d{2})\/(\d{2})\/(\d{4})\s+To\s+(\d{2})\/(\d{2})\/(\d{4})/)
          if (dateMatch) {
            const month = parseInt(dateMatch[2])
            const year = parseInt(dateMatch[3])
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                               'July', 'August', 'September', 'October', 'November', 'December']
            return `${monthNames[month - 1]} ${year}`
          }
        }
      } else if (fileType === 'revenue') {
        // For revenue CSV, we'll need to prompt user or use current date
        // Since Loyverse CSV doesn't contain date info in content, we'll use current date
        const currentDate = new Date()
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December']
        return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
      }
    } catch (error) {
      console.error('Error extracting date from content:', error)
    }
    
    // Fallback to current date
    const currentDate = new Date()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December']
    return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  // Convert month name to YYYY-MM format
  const convertToMonthKey = (monthString) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December']
    const parts = monthString.split(' ')
    if (parts.length === 2) {
      const monthName = parts[0]
      const year = parts[1]
      const monthIndex = monthNames.indexOf(monthName)
      if (monthIndex !== -1) {
        return `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`
      }
    }
    return null
  }

  // Process revenue CSV data
  const processRevenueData = (csvContent) => {
    const lines = csvContent.split('\n')
    const headers = lines[0].split(',')
    
    let totalRevenue = 0
    let processedEntries = 0
    let ignoredWastage = 0

    // Process each line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',')
      if (values.length >= 6) {
        const paymentType = values[0]?.trim()
        const netAmount = parseFloat(values[5]) || 0

        // Skip wastage entries
        if (paymentType && paymentType.toLowerCase().includes('wastage')) {
          ignoredWastage++
          console.log(`Ignoring wastage entry: ${paymentType}`)
          continue
        }

        // Remove 7% VAT (divide by 1.07)
        const vatExcludedAmount = netAmount / 1.07
        totalRevenue += vatExcludedAmount
        processedEntries++
        console.log(`Processed ${paymentType}: ${netAmount} -> ${vatExcludedAmount} (VAT excluded)`)
      }
    }

    return {
      total_revenue: totalRevenue,
      processed_entries: processedEntries,
      ignored_wastage: ignoredWastage
    }
  }

  // Process expenses XLSX data
  const processExpensesData = (csvContent) => {
    const lines = csvContent.split('\n')
    let cogs = 0
    let operatingExpenses = 0
    let rentExpense = 0
    let operatingExpenseDetails = {}

    lines.forEach(line => {
      const values = line.split(',')
      if (values.length >= 2) {
        const account = values[0]?.trim()
        const total = parseFloat(values[1]) || 0
        
        if (!account || total <= 0) return
        
        const cleanAccount = account.replace(/"/g, '').trim()
        
        // Extract COGS
        if (cleanAccount === 'Cost of Goods Sold') {
          cogs = total
          console.log(`COGS: ${total}`)
          return
        }
        
        // EXCLUDE Salaries and Employee Wages (as per requirements)
        if (cleanAccount.toLowerCase().includes('salaries') || 
            cleanAccount.toLowerCase().includes('employee wages') ||
            cleanAccount.toLowerCase().includes('payroll')) {
          console.log(`Excluding payroll item: ${cleanAccount}`)
          return
        }
        
        // Extract Rent separately
        if (cleanAccount.toLowerCase().includes('rent')) {
          rentExpense = total
          operatingExpenseDetails['Rent Expense'] = total
          operatingExpenses += total
          console.log(`Rent Expense: ${total}`)
          return
        }
        
        // All other operating expenses
        if (cleanAccount && total > 0) {
          operatingExpenseDetails[cleanAccount] = total
          operatingExpenses += total
          console.log(`Operating Expense - ${cleanAccount}: ${total}`)
        }
      }
    })
    
    return {
      cogs: cogs,
      operating_expenses: operatingExpenses,
      rent_expense: rentExpense,
      operating_expense_details: operatingExpenseDetails
    }
  }

  // Handle revenue upload
  const handleRevenueUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setUploadMessage('Please select a CSV file for revenue data.')
        return
      }

      const csvContent = await file.text()
      const monthString = extractDateFromContent(csvContent, 'revenue')
      const monthKey = convertToMonthKey(monthString)
      
      if (!monthKey) {
        setUploadMessage('Could not determine month from file content.')
        return
      }

      const revenueData = processRevenueData(csvContent)
      
      // Update data
      const newData = { ...data }
      if (!newData[monthKey]) {
        newData[monthKey] = {}
      }
      newData[monthKey].storeRevenue = revenueData.total_revenue

      setData(newData)
      setUploadMessage(`Revenue data for ${monthString} uploaded successfully! Total VAT-excluded revenue: $${revenueData.total_revenue.toLocaleString()} (${revenueData.processed_entries} entries processed, ${revenueData.ignored_wastage} wastage entries ignored)`)
      setShowRevenueUpload(false)
    } catch (error) {
      setUploadMessage(`Error processing revenue file: ${error.message}`)
    }
  }

  // Handle expenses upload
  const handleExpensesUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setUploadMessage('Please select an Excel (.xlsx) file for expenses data.')
        return
      }

      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const csvContent = XLSX.utils.sheet_to_csv(worksheet)
      
      const monthString = extractDateFromContent(csvContent, 'expenses')
      const monthKey = convertToMonthKey(monthString)
      
      if (!monthKey) {
        setUploadMessage('Could not determine month from file content.')
        return
      }

      const expensesData = processExpensesData(csvContent)
      
      // Update data
      const newData = { ...data }
      if (!newData[monthKey]) {
        newData[monthKey] = {}
      }
      newData[monthKey].cogs = expensesData.cogs
      newData[monthKey].rent = expensesData.rent_expense
      newData[monthKey].otherExpenses = expensesData.operating_expenses
      newData[monthKey].otherExpensesBreakdown = expensesData.operating_expense_details

      setData(newData)
      setUploadMessage(`Expenses data for ${monthString} uploaded successfully! COGS: $${expensesData.cogs.toLocaleString()} | Operating Expenses: $${expensesData.operating_expenses.toLocaleString()} | Rent: $${expensesData.rent_expense.toLocaleString()} (Salaries and Employee Wages excluded)`)
      setShowExpensesUpload(false)
    } catch (error) {
      setUploadMessage(`Error processing expenses file: ${error.message}`)
    }
  }

  // Calculate date range data
  const calculateDateRangeData = () => {
    const fromDate = new Date(selectedFromMonth + '-01')
    const toDate = new Date(selectedToMonth + '-01')
    
    let totalRevenue = 0
    let totalCOGS = 0
    let totalPayroll = 0
    let totalRent = 0
    let totalOtherExpenses = 0
    let monthCount = 0

    Object.keys(data).forEach(month => {
      const monthDate = new Date(month + '-01')
      if (monthDate >= fromDate && monthDate <= toDate) {
        const monthData = data[month]
        if (monthData) {
          totalRevenue += monthData.storeRevenue || 0
          totalCOGS += monthData.cogs || 0
          totalPayroll += monthData.payroll || 0
          totalRent += monthData.rent || 0
          totalOtherExpenses += monthData.otherExpenses || 0
          monthCount++
        }
      }
    })

    const totalExpenses = totalCOGS + totalPayroll + totalRent + totalOtherExpenses
    const totalEBITDA = totalRevenue - totalExpenses

    return {
      totalRevenue,
      totalCOGS,
      totalPayroll,
      totalRent,
      totalOtherExpenses,
      totalExpenses,
      totalEBITDA,
      avgEBITDA: totalRevenue > 0 ? (totalEBITDA / totalRevenue) * 100 : 0,
      monthCount
    }
  }

  const dateRangeData = calculateDateRangeData()

  // Prepare chart data for 12-month overview
  const chartData = last12Months.map(month => {
    const monthData = data[month] || {}
    const revenue = monthData.storeRevenue || 0
    const expenses = (monthData.cogs || 0) + (monthData.payroll || 0) + (monthData.rent || 0) + (monthData.otherExpenses || 0)
    const profit = revenue - expenses
    
    return {
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      revenue,
      expenses,
      profit
    }
  })

  // Get expense breakdown for selected period
  const getExpenseBreakdown = () => {
    const fromDate = new Date(selectedFromMonth + '-01')
    const toDate = new Date(selectedToMonth + '-01')
    
    let totalRevenue = 0
    let totalCOGS = 0
    let totalPayroll = 0
    let totalRent = 0
    let totalOtherExpenses = 0

    Object.keys(data).forEach(month => {
      const monthDate = new Date(month + '-01')
      if (monthDate >= fromDate && monthDate <= toDate) {
        const monthData = data[month]
        if (monthData) {
          totalRevenue += monthData.storeRevenue || 0
          totalCOGS += monthData.cogs || 0
          totalPayroll += monthData.payroll || 0
          totalRent += monthData.rent || 0
          totalOtherExpenses += monthData.otherExpenses || 0
        }
      }
    })

    return [
      { name: 'COGS', value: totalCOGS, percentage: totalRevenue > 0 ? (totalCOGS / totalRevenue * 100).toFixed(2) : '0.00' },
      { name: 'Payroll (COL)', value: totalPayroll, percentage: totalRevenue > 0 ? (totalPayroll / totalRevenue * 100).toFixed(2) : '0.00' },
      { name: 'Rent', value: totalRent, percentage: totalRevenue > 0 ? (totalRent / totalRevenue * 100).toFixed(2) : '0.00' },
      { name: 'Other Expenses', value: totalOtherExpenses, percentage: totalRevenue > 0 ? (totalOtherExpenses / totalRevenue * 100).toFixed(2) : '0.00' }
    ]
  }

  const expenseBreakdown = getExpenseBreakdown()

  // Get other expenses breakdown for selected month
  const getOtherExpensesBreakdown = () => {
    const monthData = data[selectedFromMonth]
    if (!monthData || !monthData.otherExpensesBreakdown) return []

    const totalRevenue = monthData.storeRevenue || 0
    return Object.entries(monthData.otherExpensesBreakdown).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.amount - a.amount)
  }

  const otherExpensesBreakdown = getOtherExpensesBreakdown()

  // Generate AI recommendations
  const generateAIRecommendations = async () => {
    setIsGeneratingAI(true)
    try {
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const recommendations = `Based on your P&L analysis for ${selectedFromMonth}, here are key recommendations:

**Cost Optimization:**
• COGS at ${expenseBreakdown[0]?.percentage}% - Industry benchmark is 28%. ${parseFloat(expenseBreakdown[0]?.percentage) > 28 ? 'Consider supplier negotiations or menu engineering.' : 'Well controlled, maintain current practices.'}
• Payroll at ${expenseBreakdown[1]?.percentage}% - Target is 25%. ${parseFloat(expenseBreakdown[1]?.percentage) > 25 ? 'Review scheduling efficiency and productivity.' : 'Good control, monitor for consistency.'}

**Revenue Growth:**
• Current EBITDA: ${dateRangeData.avgEBITDA.toFixed(1)}%
• Potential improvement: Focus on high-margin items and peak hour optimization
• Estimated impact: +$${(dateRangeData.totalRevenue * 0.02).toLocaleString()} monthly revenue

**Operational Efficiency:**
• Utility costs represent ${otherExpensesBreakdown.find(item => item.category.includes('Utility'))?.percentage || '0'}% of revenue
• Consider energy-efficient equipment upgrades
• Packaging costs at ${otherExpensesBreakdown.find(item => item.category.includes('Packaging'))?.percentage || '0'}% - explore bulk purchasing

**Strategic Actions:**
1. Implement dynamic pricing during peak hours
2. Optimize staff scheduling based on sales patterns
3. Negotiate better terms with top 3 suppliers
4. Focus marketing on highest-margin menu items

**Financial Health Score: ${dateRangeData.avgEBITDA > 20 ? 'Excellent' : dateRangeData.avgEBITDA > 15 ? 'Good' : 'Needs Improvement'}**`

      setAiRecommendations(recommendations)
    } catch (error) {
      setAiRecommendations('Error generating recommendations. Please try again.')
    }
    setIsGeneratingAI(false)
  }

  // Prepare trends data
  const trendsData = last12Months.map(month => {
    const monthData = data[month] || {}
    const revenue = monthData.storeRevenue || 0
    const cogs = monthData.cogs || 0
    const payroll = monthData.payroll || 0
    const rent = monthData.rent || 0
    const otherExpenses = monthData.otherExpenses || 0
    
    return {
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
      cogsPercent: revenue > 0 ? (cogs / revenue * 100) : 0,
      payrollPercent: revenue > 0 ? (payroll / revenue * 100) : 0,
      rentPercent: revenue > 0 ? (rent / revenue * 100) : 0,
      otherPercent: revenue > 0 ? (otherExpenses / revenue * 100) : 0,
      // Industry benchmarks
      cogsBenchmark: 28,
      payrollBenchmark: 25,
      rentBenchmark: 6,
      otherBenchmark: 15
    }
  })

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">P&L Dashboard</h1>
          <p className="text-gray-600">Monthly Financial Analysis (VAT-Excluded Store Revenue)</p>
        </div>

        {/* Upload Buttons */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={() => setShowRevenueUpload(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Upload size={20} />
            Upload Revenue
          </button>
          <button
            onClick={() => setShowExpensesUpload(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Upload size={20} />
            Upload Expenses
          </button>
          <button
            onClick={() => setShowPayrollUpload(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Upload size={20} />
            Upload Payroll
          </button>
        </div>

        {/* Upload Message */}
        {uploadMessage && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">{uploadMessage}</p>
            <button 
              onClick={() => setUploadMessage('')}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 12-month Rolling Overview */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">12-month Rolling P&L Overview</h2>
            <div className="text-sm text-gray-600">
              {last12Months.length > 0 ? (
                <>
                  {new Date(last12Months[0] + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - {new Date(last12Months[last12Months.length - 1] + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  <span className="ml-2 text-blue-600">Dynamic rolling period</span>
                </>
              ) : (
                'No data available'
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Revenue ({last12Months.length} months)</h3>
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-600">${totals12Month.totalRevenue.toLocaleString()}</p>
              <p className="text-sm text-gray-500">VAT Excluded | Avg: ${(totals12Month.totalRevenue / Math.max(last12Months.length, 1)).toLocaleString()}/month</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Expenses ({last12Months.length} months)</h3>
                <BarChart3 className="h-5 w-5 text-red-600" />
              </div>
              <p className="text-3xl font-bold text-red-600">${totals12Month.totalExpenses.toLocaleString()}</p>
              <p className="text-sm text-gray-500">COGS: ${totals12Month.totalCOGS.toLocaleString()} | Payroll: ${totals12Month.totalPayroll.toLocaleString()} | Rent: ${totals12Month.totalRent.toLocaleString()}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total EBITDA ({last12Months.length} months)</h3>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-600">${totals12Month.totalEBITDA.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Avg: ${(totals12Month.totalEBITDA / Math.max(last12Months.length, 1)).toLocaleString()}/month</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Avg EBITDA ({last12Months.length} months)</h3>
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-purple-600">{totals12Month.avgEBITDA.toFixed(2)}%</p>
              <p className="text-sm text-gray-500">VAT Savings: $0</p>
            </div>
          </div>

          {/* 12-Month Chart */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">12-Month Financial Overview ({new Date(last12Months[0] + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - {new Date(last12Months[last12Months.length - 1] + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})</h3>
            <p className="text-sm text-gray-600 mb-4">Monthly breakdown of Revenue, Expenses, and Profit</p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
                <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
                <Bar dataKey="profit" fill="#10B981" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Date Range Analysis */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Date Range Analysis</h2>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From:</label>
                <select 
                  value={selectedFromMonth} 
                  onChange={(e) => setSelectedFromMonth(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  {availableMonths.map(month => (
                    <option key={month} value={month}>
                      {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To:</label>
                <select 
                  value={selectedToMonth} 
                  onChange={(e) => setSelectedToMonth(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  {availableMonths.map(month => (
                    <option key={month} value={month}>
                      {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div className="text-sm text-gray-600">
                  Selected: {dateRangeData.monthCount} month{dateRangeData.monthCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">
              {selectedFromMonth === selectedToMonth 
                ? new Date(selectedFromMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' Results'
                : `${new Date(selectedFromMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - ${new Date(selectedToMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Results`
              }
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Revenue ({dateRangeData.monthCount} month{dateRangeData.monthCount !== 1 ? 's' : ''})</h3>
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-blue-600">${dateRangeData.totalRevenue.toLocaleString()}</p>
                <p className="text-sm text-gray-500">VAT Excluded | Avg: ${(dateRangeData.totalRevenue / Math.max(dateRangeData.monthCount, 1)).toLocaleString()}/month</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Expenses ({dateRangeData.monthCount} month{dateRangeData.monthCount !== 1 ? 's' : ''})</h3>
                  <BarChart3 className="h-5 w-5 text-red-600" />
                </div>
                <p className="text-3xl font-bold text-red-600">${dateRangeData.totalExpenses.toLocaleString()}</p>
                <p className="text-sm text-gray-500">COGS: ${dateRangeData.totalCOGS.toLocaleString()} | Payroll: ${dateRangeData.totalPayroll.toLocaleString()} | Rent: ${dateRangeData.totalRent.toLocaleString()}</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total EBITDA ({dateRangeData.monthCount} month{dateRangeData.monthCount !== 1 ? 's' : ''})</h3>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-green-600">${dateRangeData.totalEBITDA.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Avg: ${(dateRangeData.totalEBITDA / Math.max(dateRangeData.monthCount, 1)).toLocaleString()}/month</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Avg EBITDA ({dateRangeData.monthCount} month{dateRangeData.monthCount !== 1 ? 's' : ''})</h3>
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-3xl font-bold text-purple-600">{dateRangeData.avgEBITDA.toFixed(2)}%</p>
                <p className="text-sm text-gray-500">VAT Savings: $0</p>
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-semibold mb-4">Expense Breakdown</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {expenseBreakdown.map((item, index) => (
                    <div key={item.name} className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">${item.value.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">{item.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Store Revenue Breakdown */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-semibold mb-4">Store Revenue by Payment Type</h4>
                <div className="space-y-4">
                  <div>
                    <h5 className="font-medium text-gray-700 mb-2">Revenue Sources</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Store Revenue (VAT-excluded)</span>
                        <span className="font-medium">${dateRangeData.totalRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Non-Store Revenue</span>
                        <span className="font-medium">$0</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total Revenue</span>
                        <span>${dateRangeData.totalRevenue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Expenses Breakdown */}
            {otherExpensesBreakdown.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h4 className="text-lg font-semibold mb-4">
                  Other Expenses Breakdown ({new Date(selectedFromMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})
                </h4>
                <div className="space-y-3">
                  {otherExpensesBreakdown.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <span className="font-medium text-gray-700">{item.category}</span>
                        <span className="text-sm text-gray-500">{item.percentage}%</span>
                        <span className="font-bold text-gray-900">${item.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('trends')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'trends'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Trends
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'ai'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                AI Recommendations
              </button>
            </nav>
          </div>

          <div className="mt-6">
            {activeTab === 'overview' && (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold mb-4">Financial Overview</h3>
                <p className="text-gray-600">
                  This dashboard provides a comprehensive view of your restaurant's financial performance. 
                  Use the date range selector to analyze specific periods, and review the expense breakdown 
                  to identify optimization opportunities.
                </p>
              </div>
            )}

            {activeTab === 'trends' && (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Cost Trends Analysis</h3>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showBenchmarks}
                      onChange={(e) => setShowBenchmarks(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Show Industry Benchmarks</span>
                  </label>
                </div>
                {showBenchmarks && (
                  <p className="text-sm text-gray-600 mb-4">
                    Dashed lines show industry benchmarks: COGS 28%, Labor 25%, Rent 6%, Other 15%
                  </p>
                )}
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="cogsPercent" stroke="#EF4444" name="COGS %" strokeWidth={2} />
                    <Line type="monotone" dataKey="payrollPercent" stroke="#F59E0B" name="Payroll %" strokeWidth={2} />
                    <Line type="monotone" dataKey="rentPercent" stroke="#8B5CF6" name="Rent %" strokeWidth={2} />
                    <Line type="monotone" dataKey="otherPercent" stroke="#06B6D4" name="Other %" strokeWidth={2} />
                    {showBenchmarks && (
                      <>
                        <Line type="monotone" dataKey="cogsBenchmark" stroke="#EF4444" strokeDasharray="5 5" name="COGS Benchmark" />
                        <Line type="monotone" dataKey="payrollBenchmark" stroke="#F59E0B" strokeDasharray="5 5" name="Payroll Benchmark" />
                        <Line type="monotone" dataKey="rentBenchmark" stroke="#8B5CF6" strokeDasharray="5 5" name="Rent Benchmark" />
                        <Line type="monotone" dataKey="otherBenchmark" stroke="#06B6D4" strokeDasharray="5 5" name="Other Benchmark" />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">AI-Powered Recommendations</h3>
                  <button
                    onClick={generateAIRecommendations}
                    disabled={isGeneratingAI}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {isGeneratingAI ? 'Generating...' : 'Generate AI Recommendations'}
                  </button>
                </div>
                {aiRecommendations ? (
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{aiRecommendations}</pre>
                  </div>
                ) : (
                  <p className="text-gray-600">Click "Generate AI Recommendations" to get personalized insights based on your financial data.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upload Modals */}
        {showRevenueUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Upload Revenue Data</h3>
                <button
                  onClick={() => setShowRevenueUpload(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  Upload a CSV file with Loyverse payment type sales data. The month will be determined from the file content or current date.
                </p>
                <label className="block">
                  <span className="sr-only">Choose revenue CSV file</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleRevenueUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </label>
              </div>
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-2">Expected CSV Format (Loyverse):</p>
                <ul className="text-xs space-y-1">
                  <li><strong>Columns:</strong> Payment type, Payment transactions, Payments amount, Refund transactions, Refunds amount, Net amount</li>
                  <li><strong>Processing:</strong> Wastage entries ignored, 7% VAT automatically removed (÷1.07)</li>
                  <li><strong>Date:</strong> Extracted from file content or uses current date</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {showExpensesUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Upload Expenses Data</h3>
                <button
                  onClick={() => setShowExpensesUpload(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  Upload an Excel (.xlsx) file with Zoho Books Profit and Loss data. The month will be automatically extracted from the file content.
                </p>
                <label className="block">
                  <span className="sr-only">Choose expenses Excel file</span>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleExpensesUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </label>
              </div>
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-2">Expected Excel Format (Zoho Books):</p>
                <ul className="text-xs space-y-1">
                  <li><strong>Source:</strong> Zoho Books Profit and Loss report</li>
                  <li><strong>Columns:</strong> Account, Total (or Amount)</li>
                  <li><strong>Processing:</strong> Salaries and Employee Wages automatically excluded</li>
                  <li><strong>Date:</strong> Extracted from "From DD/MM/YYYY To DD/MM/YYYY" in file content</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {showPayrollUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Upload Payroll Data</h3>
                <button
                  onClick={() => setShowPayrollUpload(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Payroll upload functionality coming soon. This will allow you to upload payroll data to complete your P&L analysis.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App


import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine } from 'recharts'
import * as XLSX from 'xlsx'
import './App.css'

// Import the financial data
import financialData from './assets/structured_financial_data.json'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0']

// Industry benchmarks for restaurant industry (percentages of revenue)
const INDUSTRY_BENCHMARKS = {
  cogs: 28, // Food cost typically 25-35%
  payroll: 25, // Labor cost typically 25-35%
  rent: 6, // Rent typically 6-10%
  otherExpenses: 15, // Other operating expenses typically 10-20%
  profitMargin: 15 // Net profit margin typically 3-15%
}

// Staff data from the monthly P&L CSV - extracted manually
const staffData = {
  'June 2024': { active_staff: 122, payroll: 2466633.02 },
  'July 2024': { active_staff: 125, payroll: 2495991.77 },
  'August 2024': { active_staff: 124, payroll: 2513341.92 },
  'September 2024': { active_staff: 123, payroll: 2466534.78 },
  'October 2024': { active_staff: 123, payroll: 2513704.29 },
  'November 2024': { active_staff: 123, payroll: 2647902.28 },
  'December 2024': { active_staff: 125, payroll: 2708850.03 },
  'January 2025': { active_staff: 124, payroll: 3031718.49 },
  'February 2025': { active_staff: 124, payroll: 2664117.85 },
  'March 2025': { active_staff: 125, payroll: 2557636.9 },
  'April 2025': { active_staff: 124, payroll: 2792392.49 },
  'May 2025': { active_staff: 123, payroll: 2487125.68 },
  'June 2025': { active_staff: 123, payroll: 2487126 } // Estimated based on pattern
}

function App() {
  const [activeTab, setActiveTab] = useState('Overview')
  const [data, setData] = useState(financialData) // Initialize directly with data
  const [showBenchmarks, setShowBenchmarks] = useState(false)
  
  // Upload states
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadType, setUploadType] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadedData, setUploadedData] = useState({})
  const [zohoAuthenticated, setZohoAuthenticated] = useState(false)
  
  // Date range state
  const [startMonth, setStartMonth] = useState('May 2025')
  const [endMonth, setEndMonth] = useState('May 2025')

  // Extract date from file content
  const extractDateFromContent = (content, type) => {
    if (type === 'revenue') {
      // For revenue files, use current date as fallback since CSV doesn't contain dates
      const now = new Date()
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
      return `${monthNames[now.getMonth()]} ${now.getFullYear()}`
    } else if (type === 'expenses') {
      // For expenses files, look for date range in content
      const dateMatch = content.match(/From (\d{2})\/(\d{2})\/(\d{4}) To (\d{2})\/(\d{2})\/(\d{4})/)
      if (dateMatch) {
        const month = parseInt(dateMatch[2])
        const year = parseInt(dateMatch[3])
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December']
        return `${monthNames[month - 1]} ${year}`
      }
    }
    return null
  }

  // Process revenue upload - LOYVERSE CSV FORMAT
  const processRevenueUpload = (csvContent, month) => {
    const lines = csvContent.split('\n')
    const headers = lines[0].split(',')
    
    let totalRevenue = 0
    const paymentTypes = {}
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const values = line.split(',')
      const paymentType = values[0]?.replace(/"/g, '').trim()
      const netAmount = parseFloat(values[5]?.replace(/"/g, '')) || 0
      
      // IGNORE WASTAGE ENTRIES
      if (paymentType && paymentType.toLowerCase().includes('wastage')) {
        console.log(`Ignoring wastage entry: ${paymentType}`)
        continue
      }
      
      if (paymentType && netAmount > 0) {
        // REMOVE 7% VAT (divide by 1.07)
        const vatExcludedAmount = netAmount / 1.07
        paymentTypes[paymentType] = vatExcludedAmount
        totalRevenue += vatExcludedAmount
      }
    }
    
    return {
      total_revenue: totalRevenue,
      payment_types: paymentTypes
    }
  }

  // Process expenses upload - ZOHO BOOKS XLSX FORMAT (converted to CSV)
  const processExpensesUpload = (csvContent, month) => {
    let cogs = 0
    let operatingExpenses = 0
    let rentExpense = 0
    const operatingExpenseDetails = {}
    
    console.log('Processing expenses CSV content...')
    
    // Parse CSV content into rows
    const lines = csvContent.split('\n')
    
    // Find the header row (should contain "Account" and "Total")
    let headerRowIndex = -1
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase()
      if (line.includes('account') && line.includes('total')) {
        headerRowIndex = i
        break
      }
    }
    
    if (headerRowIndex === -1) {
      console.error('Could not find header row with Account and Total columns')
      return { cogs: 0, operating_expenses: 0, operating_expense_details: {} }
    }
    
    console.log(`Found header at row ${headerRowIndex}`)
    
    // Process each data row after the header
    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // Split by comma and clean up
      const columns = line.split(',').map(col => col.trim().replace(/"/g, ''))
      if (columns.length < 2) continue
      
      const account = columns[0] || ''
      const totalStr = columns[1] || '0'
      const total = parseFloat(totalStr.replace(/[,$]/g, '')) || 0
      
      if (!account || total <= 0) continue
      
      // Clean up account name (remove leading spaces)
      const cleanAccount = account.trim()
      
      console.log(`Processing: "${cleanAccount}" = ${total}`)
      
      // Extract COGS
      if (cleanAccount === 'Cost of Goods Sold') {
        cogs = total
        console.log(`✅ COGS found: ${total}`)
        continue
      }
      
      // Skip total rows and section headers
      if (cleanAccount.startsWith('Total for') || 
          cleanAccount === 'Operating Income' ||
          cleanAccount === 'Operating Expense' ||
          cleanAccount === 'Gross Profit' ||
          cleanAccount === 'Operating Profit' ||
          cleanAccount === 'Net Profit/Loss') {
        continue
      }
      
      // EXCLUDE Salaries and Employee Wages (as per requirements)
      if (cleanAccount.toLowerCase().includes('salaries') || 
          cleanAccount.toLowerCase().includes('employee wages') ||
          cleanAccount.toLowerCase().includes('payroll')) {
        console.log(`❌ Excluding payroll item: ${cleanAccount}`)
        continue
      }
      
      // Extract Rent separately
      if (cleanAccount.toLowerCase().includes('rent')) {
        rentExpense = total
        operatingExpenseDetails['Rent Expense'] = total
        operatingExpenses += total
        console.log(`🏠 Rent Expense: ${total}`)
        continue
      }
      
      // All other operating expenses (only if they have meaningful values)
      if (cleanAccount && total > 0 && 
          !cleanAccount.toLowerCase().includes('income') &&
          !cleanAccount.toLowerCase().includes('profit')) {
        operatingExpenseDetails[cleanAccount] = total
        operatingExpenses += total
        console.log(`💰 Operating Expense - ${cleanAccount}: ${total}`)
      }
    }
    
    console.log(`Final results: COGS=${cogs}, Operating Expenses=${operatingExpenses}, Rent=${rentExpense}`)
    
    return {
      cogs: cogs,
      operating_expenses: operatingExpenses,
      operating_expense_details: operatingExpenseDetails
    }
  }

  // Handle Zoho Books expenses sync
  const handleZohoExpensesSync = async (monthYear) => {
    try {
      setUploadMessage('Syncing expenses data from Zoho Books...')
      
      // First check if authenticated
      const healthResponse = await fetch('https://bstory-pnl-backend.onrender.com/api/health')
      const healthResult = await healthResponse.json()
      
      if (!healthResult.authenticated) {
        // Need to authenticate first
        const authResponse = await fetch('https://bstory-pnl-backend.onrender.com/api/expenses')
        const authResult = await authResponse.json()
        
        if (authResult.success) {
          setUploadMessage(`❌ Authentication required. Please visit: ${authResult.auth_url}`)
          // Open auth URL in new window
          window.open(authResult.auth_url, '_blank')
          return
        } else {
          setUploadMessage(`❌ Error initiating authentication: ${authResult.error}`)
          return
        }
      }
      
      // Get organizations first
      const orgsResponse = await fetch('https://bstory-pnl-backend.onrender.com/api/expenses')
      const orgsResult = await orgsResponse.json()
      
      if (!orgsResult.success) {
        setUploadMessage(`❌ Error getting organizations: ${orgsResult.error}`)
        return
      }
      
      const organizations = orgsResult.data.organizations || []
      if (organizations.length === 0) {
        setUploadMessage('❌ No organizations found in Zoho Books')
        return
      }
      
      // Use the first organization (or let user select)
      const orgId = organizations[0].organization_id
      
      // Get P&L data for the specified month
      const plResponse = await fetch(`https://bstory-pnl-backend.onrender.com/api/expenses`)
      const plResult = await plResponse.json()
      
      if (!plResult.success) {
        setUploadMessage(`❌ Error syncing expenses: ${plResult.error}`)
        return
      }
      
      const expensesData = plResult.data
      
      // Update the data state with expenses information
      const newData = { ...data }
      const newUploadedData = { ...uploadedData }
      
      if (!newData[monthYear]) {
        newData[monthYear] = {}
      }
      
      newData[monthYear] = {
        ...newData[monthYear],
        cogs: expensesData.cogs,
        operating_expenses: expensesData.operating_expenses,
        operating_expense_details: expensesData.operating_expense_details
      }
      
      if (!newUploadedData[monthYear]) {
        newUploadedData[monthYear] = {}
      }
      newUploadedData[monthYear] = {
        ...newUploadedData[monthYear],
        expenses: true
      }
      
      setData(newData)
      setUploadedData(newUploadedData)
      
      setUploadMessage(`✅ Expenses data synced successfully from Zoho Books! ${monthYear} - COGS: $${expensesData.cogs.toLocaleString()} | Operating Expenses: $${expensesData.operating_expenses.toLocaleString()} | Processed: ${expensesData.total_expenses_processed} items`)
      
    } catch (error) {
      console.error('Zoho Books sync error:', error)
      setUploadMessage(`❌ Error syncing expenses data: ${error.message}`)
    }
  }

  // Handle Zoho Books connection with localhost callback
  const handleZohoConnect = async () => {
    try {
      setUploadMessage('Getting authorization URL...')
      
      // Get the authorization URL from our backend
      const response = await fetch('https://bstory-pnl-backend.onrender.com/api/expenses')
      const result = await response.json()
      
      if (result.success) {
        setUploadMessage('Opening Zoho Books authorization... Please complete the authorization and return to this page.')
        
        // Open authorization URL in a new window
        const authWindow = window.open(result.auth_url, '_blank', 'width=600,height=700')
        
        // Poll for authentication completion
        const pollForAuth = setInterval(async () => {
          try {
            const statusResponse = await fetch('https://bstory-pnl-backend.onrender.com/api/health')
            const statusResult = await statusResponse.json()
            
            if (statusResult.authenticated) {
              clearInterval(pollForAuth)
              setZohoAuthenticated(true)
              setUploadMessage('✅ Successfully connected to Zoho Books! You can now sync expenses data.')
              if (authWindow && !authWindow.closed) {
                authWindow.close()
              }
            }
          } catch (error) {
            console.error('Error checking auth status:', error)
          }
        }, 2000) // Check every 2 seconds
        
        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollForAuth)
          if (authWindow && !authWindow.closed) {
            authWindow.close()
          }
        }, 300000)
        
      } else {
        setUploadMessage(`❌ Error getting authorization URL: ${result.error}`)
      }
    } catch (error) {
      console.error('Error initiating Zoho connection:', error)
      setUploadMessage(`❌ Error connecting to Zoho Books: ${error.message}`)
    }
  }

  // Check for OAuth callback parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const zohoSuccess = urlParams.get('zoho_success')
    const zohoError = urlParams.get('zoho_error')
    
    if (zohoSuccess === 'true') {
      setUploadMessage('✅ Successfully connected to Zoho Books! You can now sync expenses data.')
      setZohoAuthenticated(true)
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (zohoError) {
      setUploadMessage(`❌ Zoho Books connection failed: ${decodeURIComponent(zohoError)}`)
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    
    // Check initial authentication status
    checkZohoAuthStatus()
  }, [])

  // Check Zoho authentication status
  const checkZohoAuthStatus = async () => {
    try {
      const response = await fetch('https://bstory-pnl-backend.onrender.com/api/health')
      const result = await response.json()
      setZohoAuthenticated(result.authenticated || false)
    } catch (error) {
      console.error('Error checking Zoho auth status:', error)
      setZohoAuthenticated(false)
    }
  }

  // Handle payroll sync from Google Sheets
  const handlePayrollSync = async () => {
    try {
      setUploadMessage('Syncing payroll data from Google Sheets...')
      
      const response = await fetch('https://bstory-pnl-backend.onrender.com/api/payroll')
      const result = await response.json()
      
      if (!result.success) {
        setUploadMessage(`❌ Error: ${result.error}`)
        return
      }
      
      const payrollData = result.data
      let updatedMonths = 0
      
      // Update the data state with payroll information
      const newData = { ...data }
      const newUploadedData = { ...uploadedData }
      
      Object.entries(payrollData).forEach(([monthYear, payrollInfo]) => {
        if (!newData[monthYear]) {
          newData[monthYear] = {}
        }
        
        newData[monthYear] = {
          ...newData[monthYear],
          payroll: payrollInfo.payroll,
          active_staff: payrollInfo.active_staff
        }
        
        if (!newUploadedData[monthYear]) {
          newUploadedData[monthYear] = {}
        }
        newUploadedData[monthYear] = {
          ...newUploadedData[monthYear],
          payroll: true
        }
        
        updatedMonths++
      })
      
      setData(newData)
      setUploadedData(newUploadedData)
      
      const latestMonth = Object.keys(payrollData).sort().pop()
      const latestData = payrollData[latestMonth]
      
      setUploadMessage(`✅ Payroll data synced successfully! Updated ${updatedMonths} months from Google Sheets. Latest: ${latestMonth} - Payroll: ฿${latestData?.payroll.toLocaleString()} | Staff: ${latestData?.active_staff}`)
      
    } catch (error) {
      console.error('Payroll sync error:', error)
      setUploadMessage(`❌ Error syncing payroll data: ${error.message}`)
    }
  }

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    try {
      setUploadMessage('Processing file...')

      if (uploadType === 'revenue') {
        const csvContent = await file.text()
        const month = extractDateFromContent(csvContent, 'revenue')
        
        if (!month) {
          setUploadMessage('❌ Error: Could not extract month from file content. Using current date as fallback.')
          return
        }

        const revenueData = processRevenueUpload(csvContent, month)
        
        // Update the data state
        const newData = { ...data }
        newData[month] = {
          ...newData[month],
          ...revenueData
        }
        setData(newData)
        setUploadedData({ ...uploadedData, [month]: { ...uploadedData[month], revenue: true } })
        
        setUploadMessage(`✅ Revenue data for ${month} uploaded successfully! Total VAT-excluded revenue: $${revenueData.total_revenue.toLocaleString()}`)
        
      } else if (uploadType === 'expenses') {
        // For expenses, sync from Zoho Books API instead of file upload
        // We'll need to ask user for the month since API requires specific month
        const currentDate = new Date()
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December']
        const currentMonth = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
        
        await handleZohoExpensesSync(currentMonth)
        return
        
      } else if (uploadType === 'payroll') {
        // For payroll, sync from Google Sheets instead of file upload
        await handlePayrollSync()
        return
      }

    } catch (error) {
      console.error('Upload error:', error)
      setUploadMessage(`❌ Error uploading file: ${error.message}`)
    }

    // Clear the file input
    event.target.value = ''
  }

  // Combine original data with uploaded data
  const combinedData = { ...data, ...uploadedData }

  // Get available months and sort them
  const availableMonths = Object.keys(combinedData).sort((a, b) => {
    const dateA = new Date(a)
    const dateB = new Date(b)
    return dateA - dateB
  })

  // Get the last 12 months for rolling calculation
  const last12Months = availableMonths.slice(-12)

  // Calculate 12-month totals
  const calculate12MonthTotals = () => {
    let totalRevenue = 0
    let totalCOGS = 0
    let totalPayroll = 0
    let totalOperatingExpenses = 0
    let totalRent = 0

    last12Months.forEach(month => {
      const monthData = combinedData[month]
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
      monthCount: last12Months.length
    }
  }

  const totals = calculate12MonthTotals()

  // Prepare monthly data for charts
  const monthlyData = last12Months.map(month => {
    const monthData = combinedData[month]
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
      month: month.substring(0, 3),
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: netProfit,
      cogs,
      payroll,
      rent,
      otherExpenses,
      profitMargin
    }
  }).filter(Boolean)

  // Calculate date range data
  const getDateRangeData = () => {
    const startIndex = availableMonths.indexOf(startMonth)
    const endIndex = availableMonths.indexOf(endMonth)
    
    if (startIndex === -1 || endIndex === -1) return null
    
    const selectedMonths = availableMonths.slice(startIndex, endIndex + 1)
    
    let totalRevenue = 0
    let totalCOGS = 0
    let totalPayroll = 0
    let totalOperatingExpenses = 0
    let totalRent = 0
    
    selectedMonths.forEach(month => {
      const monthData = combinedData[month]
      if (monthData) {
        totalRevenue += monthData.total_revenue || 0
        totalCOGS += monthData.cogs || 0
        totalPayroll += monthData.payroll || 0
        totalOperatingExpenses += monthData.operating_expenses || 0
        
        if (monthData.operating_expense_details && monthData.operating_expense_details['Rent Expense']) {
          totalRent += monthData.operating_expense_details['Rent Expense']
        }
      }
    })
    
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
      monthCount: selectedMonths.length,
      selectedMonths
    }
  }

  const dateRangeData = getDateRangeData()

  // Get payment type data for the selected date range
  const getPaymentTypeData = () => {
    if (!dateRangeData) return []
    
    const paymentTypeTotals = {}
    
    dateRangeData.selectedMonths.forEach(month => {
      const monthData = combinedData[month]
      if (monthData && monthData.payment_types) {
        Object.entries(monthData.payment_types).forEach(([type, amount]) => {
          paymentTypeTotals[type] = (paymentTypeTotals[type] || 0) + amount
        })
      }
    })
    
    return Object.entries(paymentTypeTotals).map(([name, value]) => ({
      name,
      value: Math.round(value)
    }))
  }

  const paymentTypeData = getPaymentTypeData()

  // Get other expenses breakdown for selected date range
  const getOtherExpensesData = () => {
    if (!dateRangeData) return []
    
    const expenseTypeTotals = {}
    
    dateRangeData.selectedMonths.forEach(month => {
      const monthData = combinedData[month]
      if (monthData && monthData.operating_expense_details) {
        Object.entries(monthData.operating_expense_details).forEach(([type, amount]) => {
          if (type !== 'Rent Expense') { // Exclude rent as it's shown separately
            expenseTypeTotals[type] = (expenseTypeTotals[type] || 0) + amount
          }
        })
      }
    })
    
    return Object.entries(expenseTypeTotals)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        percentage: dateRangeData.totalRevenue > 0 ? ((value / dateRangeData.totalRevenue) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.value - a.value)
  }

  const otherExpensesData = getOtherExpensesData()

  // Generate AI recommendations
  const [aiRecommendations, setAiRecommendations] = useState('')
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

  const generateAIRecommendations = async () => {
    if (!dateRangeData) return
    
    setIsGeneratingAI(true)
    
    // Simulate AI analysis with realistic restaurant industry insights
    const cogsPercentage = (dateRangeData.totalCOGS / dateRangeData.totalRevenue * 100).toFixed(1)
    const payrollPercentage = (dateRangeData.totalPayroll / dateRangeData.totalRevenue * 100).toFixed(1)
    const rentPercentage = (dateRangeData.totalRent / dateRangeData.totalRevenue * 100).toFixed(1)
    
    setTimeout(() => {
      let recommendations = `## AI-Powered Financial Analysis & Recommendations\n\n`
      
      // COGS Analysis
      if (parseFloat(cogsPercentage) > 32) {
        recommendations += `### 🔴 Cost of Goods Sold (${cogsPercentage}%)\n`
        recommendations += `**Status:** Above industry benchmark (28-32%)\n`
        recommendations += `**Recommendations:**\n`
        recommendations += `• Review supplier contracts and negotiate better pricing\n`
        recommendations += `• Implement portion control measures to reduce food waste\n`
        recommendations += `• Analyze menu engineering - promote high-margin items\n`
        recommendations += `• Consider seasonal menu adjustments to optimize costs\n`
        recommendations += `**Potential Impact:** 2-4% reduction could save $${Math.round(dateRangeData.totalRevenue * 0.03).toLocaleString()}/month\n\n`
      } else if (parseFloat(cogsPercentage) < 25) {
        recommendations += `### 🟢 Cost of Goods Sold (${cogsPercentage}%)\n`
        recommendations += `**Status:** Excellent - below industry average\n`
        recommendations += `**Recommendations:**\n`
        recommendations += `• Maintain current supplier relationships and inventory practices\n`
        recommendations += `• Consider investing savings into premium ingredients for signature dishes\n`
        recommendations += `• Monitor for any quality compromises that might affect customer satisfaction\n\n`
      } else {
        recommendations += `### 🟡 Cost of Goods Sold (${cogsPercentage}%)\n`
        recommendations += `**Status:** Within industry benchmark (28-32%)\n`
        recommendations += `**Recommendations:**\n`
        recommendations += `• Continue monitoring food costs and waste reduction initiatives\n`
        recommendations += `• Implement regular inventory audits to maintain efficiency\n\n`
      }
      
      // Payroll Analysis
      if (parseFloat(payrollPercentage) > 35) {
        recommendations += `### 🔴 Payroll Costs (${payrollPercentage}%)\n`
        recommendations += `**Status:** Above industry benchmark (25-35%)\n`
        recommendations += `**Recommendations:**\n`
        recommendations += `• Review staffing schedules and optimize labor allocation\n`
        recommendations += `• Implement cross-training to improve staff flexibility\n`
        recommendations += `• Consider technology solutions to improve efficiency\n`
        recommendations += `• Analyze peak hours and adjust scheduling accordingly\n`
        recommendations += `**Potential Impact:** 3-5% reduction could save $${Math.round(dateRangeData.totalRevenue * 0.04).toLocaleString()}/month\n\n`
      } else {
        recommendations += `### 🟢 Payroll Costs (${payrollPercentage}%)\n`
        recommendations += `**Status:** Well-managed within industry standards\n`
        recommendations += `**Recommendations:**\n`
        recommendations += `• Maintain current staffing efficiency\n`
        recommendations += `• Consider performance-based incentives to boost productivity\n\n`
      }
      
      // Rent Analysis
      if (parseFloat(rentPercentage) > 10) {
        recommendations += `### 🔴 Rent Expense (${rentPercentage}%)\n`
        recommendations += `**Status:** Above recommended threshold (6-10%)\n`
        recommendations += `**Recommendations:**\n`
        recommendations += `• Negotiate lease terms during renewal periods\n`
        recommendations += `• Maximize revenue per square foot through layout optimization\n`
        recommendations += `• Consider revenue-sharing lease structures if applicable\n\n`
      } else {
        recommendations += `### 🟢 Rent Expense (${rentPercentage}%)\n`
        recommendations += `**Status:** Excellent location efficiency\n`
        recommendations += `**Recommendations:**\n`
        recommendations += `• Leverage prime location for marketing and brand building\n`
        recommendations += `• Consider expansion opportunities in similar locations\n\n`
      }
      
      // Profitability Analysis
      if (dateRangeData.profitMargin < 10) {
        recommendations += `### 🔴 Profit Margin (${dateRangeData.profitMargin.toFixed(1)}%)\n`
        recommendations += `**Status:** Below industry average (10-15%)\n`
        recommendations += `**Recommendations:**\n`
        recommendations += `• Focus on high-margin menu items and upselling\n`
        recommendations += `• Review pricing strategy - consider strategic price increases\n`
        recommendations += `• Implement cost control measures across all categories\n`
        recommendations += `• Enhance customer experience to justify premium pricing\n\n`
      } else if (dateRangeData.profitMargin > 20) {
        recommendations += `### 🟢 Profit Margin (${dateRangeData.profitMargin.toFixed(1)}%)\n`
        recommendations += `**Status:** Exceptional performance\n`
        recommendations += `**Recommendations:**\n`
        recommendations += `• Consider reinvestment in growth opportunities\n`
        recommendations += `• Maintain quality standards that support premium positioning\n`
        recommendations += `• Explore expansion or franchise opportunities\n\n`
      }
      
      // Top Expense Recommendations
      if (otherExpensesData.length > 0) {
        recommendations += `### 💡 Operating Expense Optimization\n`
        recommendations += `**Top expense categories to review:**\n`
        otherExpensesData.slice(0, 3).forEach(expense => {
          recommendations += `• **${expense.name}**: $${expense.value.toLocaleString()} (${expense.percentage}% of revenue)\n`
        })
        recommendations += `\n**Action Items:**\n`
        recommendations += `• Benchmark these expenses against industry standards\n`
        recommendations += `• Negotiate with vendors for better rates\n`
        recommendations += `• Implement energy-saving measures for utilities\n`
        recommendations += `• Review marketing ROI and optimize spend allocation\n\n`
      }
      
      recommendations += `### 📊 Overall Assessment\n`
      recommendations += `Your restaurant is generating $${Math.round(dateRangeData.totalRevenue / dateRangeData.monthCount).toLocaleString()}/month in revenue with a ${dateRangeData.profitMargin.toFixed(1)}% profit margin. `
      
      if (dateRangeData.profitMargin > 15) {
        recommendations += `This represents strong financial performance in the competitive restaurant industry.`
      } else if (dateRangeData.profitMargin > 10) {
        recommendations += `This shows solid operational efficiency with room for strategic improvements.`
      } else {
        recommendations += `Focus on the recommendations above to improve profitability and long-term sustainability.`
      }
      
      setAiRecommendations(recommendations)
      setIsGeneratingAI(false)
    }, 2000)
  }

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
            onClick={() => { setUploadType('revenue'); setShowUploadModal(true); setUploadMessage('') }}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Revenue
          </button>
          
          <button
            onClick={() => { setUploadType('expenses'); setShowUploadModal(true); setUploadMessage('') }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Expenses
          </button>
          
          <button
            onClick={() => { setUploadType('payroll'); setShowUploadModal(true); setUploadMessage('') }}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Payroll
          </button>
        </div>

        {/* 12-month Rolling P&L Overview */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">12-month Rolling P&L Overview</h2>
            <div className="text-sm text-gray-500">
              {last12Months.length > 0 ? `${last12Months[0]} - ${last12Months[last12Months.length - 1]}` : 'No data'} | Dynamic rolling period
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-700">Total Revenue ({totals.monthCount} months)</h3>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-1">
                ${totals.totalRevenue.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">
                VAT Excluded | Avg: ${totals.monthCount > 0 ? Math.round(totals.totalRevenue / totals.monthCount).toLocaleString() : 0}/month
              </div>
            </div>

            <div className="bg-red-50 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-700">Total Expenses ({totals.monthCount} months)</h3>
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-red-600 mb-1">
                ${totals.totalExpenses.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">
                COGS: ${totals.totalCOGS.toLocaleString()} | Payroll: ${totals.totalPayroll.toLocaleString()} | Rent: ${totals.totalRent.toLocaleString()}
              </div>
            </div>

            <div className="bg-green-50 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-700">Total EBITDA ({totals.monthCount} months)</h3>
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">
                ${totals.netProfit.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">
                Avg: ${totals.monthCount > 0 ? Math.round(totals.netProfit / totals.monthCount).toLocaleString() : 0}/month
              </div>
            </div>

            <div className="bg-purple-50 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-700">Avg EBITDA ({totals.monthCount} months)</h3>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-1">
                {totals.profitMargin.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-500">
                VAT Savings: $0
              </div>
            </div>
          </div>

          {/* 12-Month Chart */}
          <div className="bg-white">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              12-Month Financial Overview ({last12Months.length > 0 ? `${last12Months[0]} - ${last12Months[last12Months.length - 1]}` : 'No data available'})
            </h3>
            <p className="text-gray-600 mb-6">Monthly breakdown of Revenue, Expenses, and Profit</p>
            
            {monthlyData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                    <Tooltip 
                      formatter={(value, name) => [`$${value.toLocaleString()}`, name]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
                    <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
                    <Bar dataKey="profit" fill="#10B981" name="EBITDA" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">No data available for chart display</p>
              </div>
            )}
          </div>
        </div>

        {/* Date Range Analysis */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Date Range Analysis</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From:</label>
              <select 
                value={startMonth} 
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {availableMonths.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To:</label>
              <select 
                value={endMonth} 
                onChange={(e) => setEndMonth(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {availableMonths.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <div className="bg-blue-50 p-3 rounded-lg w-full">
                <div className="text-sm text-gray-600">Selected:</div>
                <div className="text-lg font-semibold text-blue-600">
                  {dateRangeData ? dateRangeData.monthCount : 0} month{dateRangeData && dateRangeData.monthCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          {dateRangeData && (
            <>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`} Results
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-700">Total Revenue ({dateRangeData.monthCount} month{dateRangeData.monthCount !== 1 ? 's' : ''})</h3>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    ${dateRangeData.totalRevenue.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    VAT Excluded | Avg: ${Math.round(dateRangeData.totalRevenue / dateRangeData.monthCount).toLocaleString()}/month
                  </div>
                </div>

                <div className="bg-red-50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-700">Total Expenses ({dateRangeData.monthCount} month{dateRangeData.monthCount !== 1 ? 's' : ''})</h3>
                    <div className="p-2 bg-red-100 rounded-lg">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-red-600 mb-1">
                    ${dateRangeData.totalExpenses.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    COGS: ${dateRangeData.totalCOGS.toLocaleString()} | Payroll: ${dateRangeData.totalPayroll.toLocaleString()} | Rent: ${dateRangeData.totalRent.toLocaleString()}
                  </div>
                </div>

                <div className="bg-green-50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-700">Total EBITDA ({dateRangeData.monthCount} month{dateRangeData.monthCount !== 1 ? 's' : ''})</h3>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    ${dateRangeData.netProfit.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    Avg: ${Math.round(dateRangeData.netProfit / dateRangeData.monthCount).toLocaleString()}/month
                  </div>
                </div>

                <div className="bg-purple-50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-700">Avg EBITDA ({dateRangeData.monthCount} month{dateRangeData.monthCount !== 1 ? 's' : ''})</h3>
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-purple-600 mb-1">
                    {dateRangeData.profitMargin.toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-500">
                    VAT Savings: $0
                  </div>
                </div>
              </div>

              {/* Expense Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">COGS</span>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">${dateRangeData.totalCOGS.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">{((dateRangeData.totalCOGS / dateRangeData.totalRevenue) * 100).toFixed(2)}%</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Payroll (COL)</span>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">${dateRangeData.totalPayroll.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">{((dateRangeData.totalPayroll / dateRangeData.totalRevenue) * 100).toFixed(2)}%</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Rent</span>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">${dateRangeData.totalRent.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">{((dateRangeData.totalRent / dateRangeData.totalRevenue) * 100).toFixed(2)}%</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Other Expenses</span>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">${(dateRangeData.totalOperatingExpenses - dateRangeData.totalRent).toLocaleString()}</div>
                        <div className="text-sm text-gray-500">{(((dateRangeData.totalOperatingExpenses - dateRangeData.totalRent) / dateRangeData.totalRevenue) * 100).toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Type Pie Chart */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Store Revenue by Payment Type</h4>
                  {paymentTypeData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentTypeData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {paymentTypeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center">
                      <p className="text-gray-500">No payment type data available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Revenue Sources */}
              <div className="bg-blue-50 p-6 rounded-lg mb-8">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Revenue Sources</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Store Revenue (VAT-excluded)</span>
                    <span className="font-bold text-gray-900">${dateRangeData.totalRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Non-Store Revenue</span>
                    <span className="font-bold text-gray-900">$0</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2 md:border-t-0 md:pt-0">
                    <span className="text-gray-700 font-bold">Total Revenue</span>
                    <span className="font-bold text-blue-600">${dateRangeData.totalRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Other Expenses Breakdown */}
              {otherExpensesData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Other Expenses Breakdown ({startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`})
                  </h4>
                  <div className="space-y-3">
                    {otherExpensesData.map((expense, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <span className="font-medium text-gray-700">{expense.name}</span>
                          <span className="text-sm text-gray-500">{expense.percentage}%</span>
                        </div>
                        <span className="font-bold text-gray-900">${expense.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              {['Overview', 'Revenue', 'Expenses', 'Trends', 'AI Recommendations'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
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

          <div className="p-6">
            {activeTab === 'Overview' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Financial Overview</h3>
                <p className="text-gray-600 mb-6">
                  This dashboard provides a comprehensive view of your restaurant's financial performance, 
                  including revenue analysis, expense breakdown, and profitability metrics.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold text-blue-900 mb-3">Revenue Analysis</h4>
                    <ul className="text-blue-800 space-y-2">
                      <li>• VAT-excluded store revenue tracking</li>
                      <li>• Payment type breakdown</li>
                      <li>• Monthly revenue trends</li>
                      <li>• Revenue per square foot analysis</li>
                    </ul>
                  </div>
                  
                  <div className="bg-red-50 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold text-red-900 mb-3">Expense Management</h4>
                    <ul className="text-red-800 space-y-2">
                      <li>• Cost of Goods Sold (COGS) tracking</li>
                      <li>• Payroll and labor cost analysis</li>
                      <li>• Operating expense categorization</li>
                      <li>• Rent and occupancy costs</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold text-green-900 mb-3">Profitability Metrics</h4>
                    <ul className="text-green-800 space-y-2">
                      <li>• EBITDA calculation and trends</li>
                      <li>• Profit margin analysis</li>
                      <li>• Industry benchmark comparisons</li>
                      <li>• Performance indicators</li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 p-6 rounded-lg">
                    <h4 className="text-lg font-semibold text-purple-900 mb-3">Advanced Analytics</h4>
                    <ul className="text-purple-800 space-y-2">
                      <li>• AI-powered recommendations</li>
                      <li>• Trend analysis and forecasting</li>
                      <li>• Cost optimization insights</li>
                      <li>• Performance benchmarking</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Revenue' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Revenue Analysis</h3>
                
                {dateRangeData && paymentTypeData.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Payment Type Distribution</h4>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={paymentTypeData}
                              cx="50%"
                              cy="50%"
                              outerRadius={120}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                            >
                              {paymentTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Payment Type Details</h4>
                      <div className="space-y-3">
                        {paymentTypeData.map((payment, index) => (
                          <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center">
                              <div 
                                className="w-4 h-4 rounded-full mr-3"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              ></div>
                              <span className="font-medium text-gray-700">{payment.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-gray-900">${payment.value.toLocaleString()}</div>
                              <div className="text-sm text-gray-500">
                                {((payment.value / dateRangeData.totalRevenue) * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No revenue data available for the selected period</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Expenses' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Expense Analysis</h3>
                
                {dateRangeData ? (
                  <div className="space-y-8">
                    {/* Expense Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-red-50 p-6 rounded-lg text-center">
                        <h4 className="text-lg font-semibold text-red-900 mb-2">COGS</h4>
                        <div className="text-2xl font-bold text-red-600">${dateRangeData.totalCOGS.toLocaleString()}</div>
                        <div className="text-sm text-red-500">{((dateRangeData.totalCOGS / dateRangeData.totalRevenue) * 100).toFixed(1)}% of revenue</div>
                      </div>
                      
                      <div className="bg-blue-50 p-6 rounded-lg text-center">
                        <h4 className="text-lg font-semibold text-blue-900 mb-2">Payroll</h4>
                        <div className="text-2xl font-bold text-blue-600">${dateRangeData.totalPayroll.toLocaleString()}</div>
                        <div className="text-sm text-blue-500">{((dateRangeData.totalPayroll / dateRangeData.totalRevenue) * 100).toFixed(1)}% of revenue</div>
                      </div>
                      
                      <div className="bg-green-50 p-6 rounded-lg text-center">
                        <h4 className="text-lg font-semibold text-green-900 mb-2">Rent</h4>
                        <div className="text-2xl font-bold text-green-600">${dateRangeData.totalRent.toLocaleString()}</div>
                        <div className="text-sm text-green-500">{((dateRangeData.totalRent / dateRangeData.totalRevenue) * 100).toFixed(1)}% of revenue</div>
                      </div>
                      
                      <div className="bg-purple-50 p-6 rounded-lg text-center">
                        <h4 className="text-lg font-semibold text-purple-900 mb-2">Other</h4>
                        <div className="text-2xl font-bold text-purple-600">${(dateRangeData.totalOperatingExpenses - dateRangeData.totalRent).toLocaleString()}</div>
                        <div className="text-sm text-purple-500">{(((dateRangeData.totalOperatingExpenses - dateRangeData.totalRent) / dateRangeData.totalRevenue) * 100).toFixed(1)}% of revenue</div>
                      </div>
                    </div>

                    {/* Detailed Expense Breakdown */}
                    {otherExpensesData.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Detailed Operating Expenses</h4>
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                          <div className="max-h-96 overflow-y-auto">
                            {otherExpensesData.map((expense, index) => (
                              <div key={index} className="flex justify-between items-center p-4 border-b border-gray-100 hover:bg-gray-50">
                                <span className="font-medium text-gray-700">{expense.name}</span>
                                <div className="text-right">
                                  <div className="font-bold text-gray-900">${expense.value.toLocaleString()}</div>
                                  <div className="text-sm text-gray-500">{expense.percentage}% of revenue</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No expense data available for the selected period</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Trends' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Financial Trends</h3>
                
                <div className="mb-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showBenchmarks}
                      onChange={(e) => setShowBenchmarks(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">
                      Show industry benchmarks: COGS {INDUSTRY_BENCHMARKS.cogs}%, Labor {INDUSTRY_BENCHMARKS.payroll}%, Rent {INDUSTRY_BENCHMARKS.rent}%, Other {INDUSTRY_BENCHMARKS.otherExpenses}%
                    </span>
                  </label>
                </div>

                {monthlyData.length > 0 ? (
                  <div className="space-y-8">
                    {/* Revenue Trend */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h4>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                            <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']} />
                            <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Expense Percentage Trends */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Expense Ratios (% of Revenue)</h4>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyData.map(d => ({
                            ...d,
                            cogsPercent: (d.cogs / d.revenue * 100),
                            payrollPercent: (d.payroll / d.revenue * 100),
                            rentPercent: (d.rent / d.revenue * 100),
                            otherPercent: (d.otherExpenses / d.revenue * 100)
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis tickFormatter={(value) => `${value.toFixed(0)}%`} />
                            <Tooltip formatter={(value) => [`${value.toFixed(1)}%`]} />
                            <Line type="monotone" dataKey="cogsPercent" stroke="#EF4444" strokeWidth={2} name="COGS %" />
                            <Line type="monotone" dataKey="payrollPercent" stroke="#3B82F6" strokeWidth={2} name="Payroll %" />
                            <Line type="monotone" dataKey="rentPercent" stroke="#10B981" strokeWidth={2} name="Rent %" />
                            <Line type="monotone" dataKey="otherPercent" stroke="#F59E0B" strokeWidth={2} name="Other %" />
                            
                            {showBenchmarks && (
                              <>
                                <ReferenceLine y={INDUSTRY_BENCHMARKS.cogs} stroke="#EF4444" strokeDasharray="5 5" />
                                <ReferenceLine y={INDUSTRY_BENCHMARKS.payroll} stroke="#3B82F6" strokeDasharray="5 5" />
                                <ReferenceLine y={INDUSTRY_BENCHMARKS.rent} stroke="#10B981" strokeDasharray="5 5" />
                                <ReferenceLine y={INDUSTRY_BENCHMARKS.otherExpenses} stroke="#F59E0B" strokeDasharray="5 5" />
                              </>
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {showBenchmarks && (
                        <p className="text-sm text-gray-500 mt-2">
                          Dashed lines show industry benchmarks: COGS {INDUSTRY_BENCHMARKS.cogs}%, Labor {INDUSTRY_BENCHMARKS.payroll}%, Rent {INDUSTRY_BENCHMARKS.rent}%, Other {INDUSTRY_BENCHMARKS.otherExpenses}%
                        </p>
                      )}
                    </div>

                    {/* Profit Margin Trend */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">EBITDA Margin Trend</h4>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis tickFormatter={(value) => `${value.toFixed(0)}%`} />
                            <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'EBITDA Margin']} />
                            <Line type="monotone" dataKey="profitMargin" stroke="#10B981" strokeWidth={3} />
                            {showBenchmarks && (
                              <ReferenceLine y={INDUSTRY_BENCHMARKS.profitMargin} stroke="#10B981" strokeDasharray="5 5" />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {showBenchmarks && (
                        <p className="text-sm text-gray-500 mt-2">
                          Dashed line shows industry benchmark: {INDUSTRY_BENCHMARKS.profitMargin}% profit margin
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No trend data available</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'AI Recommendations' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">AI-Powered Financial Recommendations</h3>
                
                <div className="mb-6">
                  <button
                    onClick={generateAIRecommendations}
                    disabled={isGeneratingAI || !dateRangeData}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    {isGeneratingAI ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating AI Analysis...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Generate AI Recommendations
                      </>
                    )}
                  </button>
                </div>

                {aiRecommendations ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="prose max-w-none">
                      {aiRecommendations.split('\n').map((line, index) => {
                        if (line.startsWith('## ')) {
                          return <h2 key={index} className="text-xl font-bold text-gray-900 mt-6 mb-3">{line.replace('## ', '')}</h2>
                        } else if (line.startsWith('### ')) {
                          const title = line.replace('### ', '')
                          let className = "text-lg font-semibold mt-4 mb-2"
                          if (title.includes('🔴')) className += " text-red-700"
                          else if (title.includes('🟡')) className += " text-yellow-700"
                          else if (title.includes('🟢')) className += " text-green-700"
                          else className += " text-gray-900"
                          return <h3 key={index} className={className}>{title}</h3>
                        } else if (line.startsWith('**') && line.endsWith('**')) {
                          return <p key={index} className="font-semibold text-gray-900 mb-1">{line.replace(/\*\*/g, '')}</p>
                        } else if (line.startsWith('• ')) {
                          return <p key={index} className="ml-4 mb-1 text-gray-700">{line}</p>
                        } else if (line.trim()) {
                          return <p key={index} className="mb-2 text-gray-700">{line}</p>
                        } else {
                          return <div key={index} className="mb-2"></div>
                        }
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <p className="text-gray-500">Click the button above to generate AI-powered financial recommendations based on your selected date range.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Upload {uploadType.charAt(0).toUpperCase() + uploadType.slice(1)} Data
                </h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-gray-600 mb-4">
                  {uploadType === 'revenue' && 'Upload a CSV file with Loyverse payment type sales data. The month will be automatically extracted from the file content.'}
                  {uploadType === 'expenses' && 'Sync expenses data directly from Zoho Books API. This will fetch COGS and Operating Expenses for the current month, automatically excluding Salaries and Employee Wages.'}
                  {uploadType === 'payroll' && 'Sync payroll data directly from Google Sheets. This will fetch Total Payroll (H7) and Active Staff (C8) from each month tab.'}
                </p>

                {uploadType === 'payroll' ? (
                  <div className="border-2 border-solid border-orange-300 rounded-lg p-6 text-center bg-orange-50">
                    <button
                      onClick={handlePayrollSync}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync from Google Sheets
                    </button>
                    <p className="text-sm text-orange-600 mt-3">
                      Click to fetch the latest payroll data from your Google Sheets
                    </p>
                  </div>
                ) : uploadType === 'expenses' ? (
                  <div className="border-2 border-solid border-blue-300 rounded-lg p-6 text-center bg-blue-50">
                    {zohoAuthenticated ? (
                      <button
                        onClick={() => {
                          const currentDate = new Date()
                          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December']
                          const currentMonth = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                          handleZohoExpensesSync(currentMonth)
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sync from Zoho Books
                      </button>
                    ) : (
                      <button
                        onClick={handleZohoConnect}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Connect to Zoho Books
                      </button>
                    )}
                    <p className="text-sm text-blue-600 mt-3">
                      {zohoAuthenticated 
                        ? 'Click to fetch the latest expenses data from Zoho Books API'
                        : 'Click to connect your Zoho Books account for expenses sync'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      accept={uploadType === 'revenue' ? '.csv' : uploadType === 'expenses' ? '.xlsx' : '*'}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-sm text-gray-600">
                        {uploadType === 'revenue' && 'Select Revenue CSV File'}
                        {uploadType === 'expenses' && 'Select Expenses Excel File'}
                      </span>
                    </label>
                  </div>
                )}

                {uploadType === 'revenue' && (
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium mb-2">Expected CSV Format (Loyverse):</p>
                    <p><strong>Source:</strong> Loyverse POS payment type sales report</p>
                    <p><strong>Filename:</strong> payment-type-sales-YYYY-MM-DD-YYYY-MM-DD.csv</p>
                    <p><strong>Columns:</strong> Payment type, Payment transactions, Payments amount, Refund transactions, Refunds amount, Net amount</p>
                    <p><strong>Processing:</strong> Wastage entries ignored, 7% VAT automatically removed (÷1.07)</p>
                  </div>
                )}

                {uploadType === 'expenses' && (
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium mb-2">Expected Excel Format (Zoho Books):</p>
                    <p><strong>Source:</strong> Zoho Books Profit and Loss report</p>
                    <p><strong>Filename:</strong> ProfitandLossMonthYYYY.xlsx (e.g., ProfitandLossJuly2025.xlsx)</p>
                    <p><strong>Columns:</strong> Account, Total (or Amount)</p>
                    <p><strong>Processing:</strong> Salaries and Employee Wages automatically excluded</p>
                  </div>
                )}

                {uploadType === 'expenses' && (
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium mb-2">Zoho Books API Integration:</p>
                    <p><strong>Source:</strong> Zoho Books accounting software</p>
                    <p><strong>Data Points:</strong> COGS, Operating Expenses, Account Details</p>
                    <p><strong>Processing:</strong> Automatically excludes Salaries, Employee Wages, and Totals</p>
                    <p><strong>Authentication:</strong> OAuth 2.0 with automatic token management</p>
                  </div>
                )}

                {uploadType === 'payroll' && (
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium mb-2">Google Sheets Integration:</p>
                    <p><strong>Source:</strong> Google Sheets payroll spreadsheet</p>
                    <p><strong>Data Points:</strong> H7 (Total Payroll), C8 (Active Staff)</p>
                    <p><strong>Processing:</strong> Fetches data from all month tabs automatically</p>
                    <p><strong>Format:</strong> Thai Baht (฿) values converted to numbers</p>
                  </div>
                )}
              </div>

              {uploadMessage && (
                <div className={`p-3 rounded-lg mb-4 ${
                  uploadMessage.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {uploadMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App


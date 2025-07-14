import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine } from 'recharts'
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
  const [data, setData] = useState(null)
  const [showBenchmarks, setShowBenchmarks] = useState(false)
  
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
    
    // Calculate percentages for trends
    const cogsPercent = totalRevenue > 0 ? (cogs / totalRevenue) * 100 : 0
    const payrollPercent = totalRevenue > 0 ? (payroll / totalRevenue) * 100 : 0
    const rentPercent = totalRevenue > 0 ? (rent / totalRevenue) * 100 : 0
    const otherExpensesPercent = totalRevenue > 0 ? (otherExpenses / totalRevenue) * 100 : 0
    
    // Get active staff data
    const staffInfo = staffData[month] || { active_staff: 0, payroll: payroll }
    const activeStaff = staffInfo.active_staff
    const avgPayrollPerStaff = activeStaff > 0 ? staffInfo.payroll / activeStaff : 0

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
      profitMargin: profitMargin,
      cogsPercent: cogsPercent,
      payrollPercent: payrollPercent,
      rentPercent: rentPercent,
      otherExpensesPercent: otherExpensesPercent,
      activeStaff: activeStaff,
      avgPayrollPerStaff: avgPayrollPerStaff
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
  const currentMonthData = data[endMonth] || {}

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

  // Prepare detailed other expenses breakdown for the selected range
  const getDetailedOtherExpenses = () => {
    const detailedExpenses = {}
    
    selectedMonths.forEach(month => {
      const monthData = data[month]
      if (monthData && monthData.operating_expense_details) {
        Object.entries(monthData.operating_expense_details).forEach(([category, amount]) => {
          if (category !== 'Rent Expense' && amount > 0) {
            detailedExpenses[category] = (detailedExpenses[category] || 0) + amount
          }
        })
      }
    })

    return Object.entries(detailedExpenses)
      .map(([name, value]) => ({
        name,
        value,
        percentage: rangeData.totalRevenue > 0 ? (value / rangeData.totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value) // Sort by value descending
  }

  const detailedOtherExpenses = getDetailedOtherExpenses()

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
    
    // Get staff data
    const staffInfo = staffData[month] || { active_staff: 0, payroll: payroll }
    const activeStaff = staffInfo.active_staff
    const avgPayrollPerStaff = activeStaff > 0 ? staffInfo.payroll / activeStaff : 0

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
      profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      cogsPercent: totalRevenue > 0 ? (cogs / totalRevenue) * 100 : 0,
      payrollPercent: totalRevenue > 0 ? (payroll / totalRevenue) * 100 : 0,
      rentPercent: totalRevenue > 0 ? (rent / totalRevenue) * 100 : 0,
      otherExpensesPercent: totalRevenue > 0 ? (otherExpenses / totalRevenue) * 100 : 0,
      activeStaff: activeStaff,
      avgPayrollPerStaff: avgPayrollPerStaff
    }
  }).filter(Boolean)

  // AI Recommendations based on selected data
  const generateAIRecommendations = () => {
    const avgCogsPercent = rangeData.totalRevenue > 0 ? (rangeData.totalCOGS / rangeData.totalRevenue) * 100 : 0
    const avgPayrollPercent = rangeData.totalRevenue > 0 ? (rangeData.totalPayroll / rangeData.totalRevenue) * 100 : 0
    const avgRentPercent = rangeData.totalRevenue > 0 ? (rangeData.totalRent / rangeData.totalRevenue) * 100 : 0
    const avgOtherExpensesPercent = rangeData.totalRevenue > 0 ? (rangeData.otherExpenses / rangeData.totalRevenue) * 100 : 0
    const profitMargin = rangeData.totalRevenue > 0 ? (rangeData.netProfit / rangeData.totalRevenue) * 100 : 0
    
    const recommendations = []
    
    // COGS Analysis
    if (avgCogsPercent > INDUSTRY_BENCHMARKS.cogs + 5) {
      recommendations.push({
        category: 'Cost of Goods Sold',
        priority: 'High',
        issue: `COGS at ${avgCogsPercent.toFixed(1)}% is significantly above industry benchmark of ${INDUSTRY_BENCHMARKS.cogs}%`,
        recommendations: [
          'Review supplier contracts and negotiate better pricing',
          'Implement portion control and reduce food waste',
          'Optimize menu engineering to focus on high-margin items',
          'Consider seasonal menu adjustments to reduce ingredient costs'
        ],
        potentialSavings: `Reducing COGS by 3% could save $${((rangeData.totalRevenue * 0.03) / rangeData.monthCount).toLocaleString()}/month`
      })
    } else if (avgCogsPercent < INDUSTRY_BENCHMARKS.cogs - 3) {
      recommendations.push({
        category: 'Cost of Goods Sold',
        priority: 'Medium',
        issue: `COGS at ${avgCogsPercent.toFixed(1)}% is below industry benchmark - opportunity to improve quality`,
        recommendations: [
          'Consider upgrading ingredient quality to justify premium pricing',
          'Expand menu offerings with higher-quality options',
          'Invest in premium ingredients for signature dishes'
        ],
        potentialSavings: 'Quality improvements could support 5-10% price increases'
      })
    }
    
    // Payroll Analysis
    if (avgPayrollPercent > INDUSTRY_BENCHMARKS.payroll + 5) {
      recommendations.push({
        category: 'Labor Costs',
        priority: 'High',
        issue: `Payroll at ${avgPayrollPercent.toFixed(1)}% is above industry benchmark of ${INDUSTRY_BENCHMARKS.payroll}%`,
        recommendations: [
          'Optimize staff scheduling based on peak hours analysis',
          'Cross-train employees to improve flexibility',
          'Implement productivity tracking and incentive programs',
          'Consider automation for repetitive tasks'
        ],
        potentialSavings: `Reducing payroll by 2% could save $${((rangeData.totalRevenue * 0.02) / rangeData.monthCount).toLocaleString()}/month`
      })
    }
    
    // Rent Analysis
    if (avgRentPercent > INDUSTRY_BENCHMARKS.rent + 2) {
      recommendations.push({
        category: 'Rent & Occupancy',
        priority: 'Medium',
        issue: `Rent at ${avgRentPercent.toFixed(1)}% is above industry benchmark of ${INDUSTRY_BENCHMARKS.rent}%`,
        recommendations: [
          'Negotiate lease terms during renewal',
          'Consider revenue-sharing arrangements with landlord',
          'Maximize space utilization with extended hours or catering',
          'Evaluate relocation to lower-cost areas if lease expires'
        ],
        potentialSavings: 'Rent reduction could improve margins by 1-2%'
      })
    }
    
    // EBITDA Analysis
    if (profitMargin < INDUSTRY_BENCHMARKS.profitMargin - 5) {
      recommendations.push({
        category: 'Overall Profitability',
        priority: 'Critical',
        issue: `Profit margin at ${profitMargin.toFixed(1)}% is below industry benchmark of ${INDUSTRY_BENCHMARKS.profitMargin}%`,
        recommendations: [
          'Implement comprehensive cost reduction program',
          'Review pricing strategy and consider selective increases',
          'Focus on high-margin menu items and upselling',
          'Improve operational efficiency across all areas'
        ],
        potentialSavings: `Reaching industry benchmark could add $${((rangeData.totalRevenue * (INDUSTRY_BENCHMARKS.profitMargin - profitMargin) / 100) / rangeData.monthCount).toLocaleString()}/month`
      })
    } else if (profitMargin > INDUSTRY_BENCHMARKS.profitMargin + 5) {
      recommendations.push({
        category: 'Growth Opportunities',
        priority: 'Low',
        issue: `Strong profit margin at ${profitMargin.toFixed(1)}% provides growth opportunities`,
        recommendations: [
          'Consider expansion to new locations',
          'Invest in marketing and customer acquisition',
          'Upgrade equipment and facilities for better customer experience',
          'Develop catering or delivery services'
        ],
        potentialSavings: 'Strong margins support strategic investments for growth'
      })
    }
    
    // Staff Efficiency Analysis
    const avgStaffCount = selectedMonths.reduce((sum, month) => {
      const staffInfo = staffData[month]
      return sum + (staffInfo ? staffInfo.active_staff : 0)
    }, 0) / selectedMonths.length
    
    const avgPayrollPerStaff = avgStaffCount > 0 ? (rangeData.totalPayroll / rangeData.monthCount) / avgStaffCount : 0
    
    if (avgPayrollPerStaff > 25000) {
      recommendations.push({
        category: 'Staff Efficiency',
        priority: 'Medium',
        issue: `Average payroll per staff at $${avgPayrollPerStaff.toLocaleString()}/month is high`,
        recommendations: [
          'Review staff productivity and performance metrics',
          'Optimize scheduling to match demand patterns',
          'Implement performance-based compensation',
          'Consider part-time vs full-time staff mix optimization'
        ],
        potentialSavings: 'Improved efficiency could reduce per-staff costs by 10-15%'
      })
    }
    
    return recommendations
  }

  const aiRecommendations = generateAIRecommendations()

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
      case 'AI Recommendations':
        return (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-semibold text-gray-900">
                AI Performance Analysis & Recommendations
              </h4>
              <div className="text-sm text-gray-600">
                Analysis Period: {startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`}
              </div>
            </div>
            
            {/* Performance Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
              <h5 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatPercentage(rangeData.totalRevenue > 0 ? (rangeData.totalCOGS / rangeData.totalRevenue) * 100 : 0)}
                  </div>
                  <div className="text-sm text-gray-600">COGS</div>
                  <div className="text-xs text-gray-500">Benchmark: {INDUSTRY_BENCHMARKS.cogs}%</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatPercentage(rangeData.totalRevenue > 0 ? (rangeData.totalPayroll / rangeData.totalRevenue) * 100 : 0)}
                  </div>
                  <div className="text-sm text-gray-600">Labor</div>
                  <div className="text-xs text-gray-500">Benchmark: {INDUSTRY_BENCHMARKS.payroll}%</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {formatPercentage(rangeData.totalRevenue > 0 ? (rangeData.totalRent / rangeData.totalRevenue) * 100 : 0)}
                  </div>
                  <div className="text-sm text-gray-600">Rent</div>
                  <div className="text-xs text-gray-500">Benchmark: {INDUSTRY_BENCHMARKS.rent}%</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatPercentage(rangeData.totalRevenue > 0 ? (rangeData.netProfit / rangeData.totalRevenue) * 100 : 0)}
                  </div>
                  <div className="text-sm text-gray-600">EBITDA</div>
                  <div className="text-xs text-gray-500">Benchmark: {INDUSTRY_BENCHMARKS.profitMargin}%</div>
                </div>
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="space-y-6">
              {aiRecommendations.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <div className="text-green-600 text-lg font-semibold mb-2">🎉 Excellent Performance!</div>
                  <p className="text-gray-700">Your restaurant is performing within or above industry benchmarks across all key metrics. Continue monitoring and consider growth opportunities.</p>
                </div>
              ) : (
                aiRecommendations.map((rec, index) => (
                  <div key={index} className={`border rounded-lg p-6 ${
                    rec.priority === 'Critical' ? 'border-red-300 bg-red-50' :
                    rec.priority === 'High' ? 'border-orange-300 bg-orange-50' :
                    rec.priority === 'Medium' ? 'border-yellow-300 bg-yellow-50' :
                    'border-green-300 bg-green-50'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <h6 className="text-lg font-semibold text-gray-900">{rec.category}</h6>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        rec.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                        rec.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                        rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {rec.priority} Priority
                      </span>
                    </div>
                    
                    <div className="mb-4">
                      <h7 className="font-medium text-gray-800">Issue:</h7>
                      <p className="text-gray-700 mt-1">{rec.issue}</p>
                    </div>
                    
                    <div className="mb-4">
                      <h7 className="font-medium text-gray-800">Recommendations:</h7>
                      <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                        {rec.recommendations.map((recommendation, idx) => (
                          <li key={idx}>{recommendation}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-white rounded p-3">
                      <h7 className="font-medium text-gray-800">Potential Impact:</h7>
                      <p className="text-gray-700 mt-1">{rec.potentialSavings}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      
      case 'Trends':
        return (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-semibold text-gray-900">
                Trends Analysis ({startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`})
              </h4>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={showBenchmarks}
                    onChange={(e) => setShowBenchmarks(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Show Industry Benchmarks
                </label>
              </div>
            </div>
            
            {/* Expense Percentages and Staff Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div>
                <h5 className="text-md font-semibold text-gray-800 mb-4">Expense Categories (% of Revenue)</h5>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis 
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                        domain={[0, 45]}
                      />
                      <Tooltip 
                        formatter={(value, name) => [formatPercentage(value), name]}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      
                      {/* Industry Benchmark Lines - Fixed implementation */}
                      {showBenchmarks && (
                        <>
                          <ReferenceLine 
                            y={INDUSTRY_BENCHMARKS.cogs} 
                            stroke="#F59E0B" 
                            strokeDasharray="5 5" 
                            strokeWidth={2}
                            label={{ value: `COGS ${INDUSTRY_BENCHMARKS.cogs}%`, position: "topRight" }}
                          />
                          <ReferenceLine 
                            y={INDUSTRY_BENCHMARKS.payroll} 
                            stroke="#8B5CF6" 
                            strokeDasharray="5 5" 
                            strokeWidth={2}
                            label={{ value: `Labor ${INDUSTRY_BENCHMARKS.payroll}%`, position: "topRight" }}
                          />
                          <ReferenceLine 
                            y={INDUSTRY_BENCHMARKS.rent} 
                            stroke="#6366F1" 
                            strokeDasharray="5 5" 
                            strokeWidth={2}
                            label={{ value: `Rent ${INDUSTRY_BENCHMARKS.rent}%`, position: "topRight" }}
                          />
                          <ReferenceLine 
                            y={INDUSTRY_BENCHMARKS.otherExpenses} 
                            stroke="#6B7280" 
                            strokeDasharray="5 5" 
                            strokeWidth={2}
                            label={{ value: `Other ${INDUSTRY_BENCHMARKS.otherExpenses}%`, position: "topRight" }}
                          />
                        </>
                      )}
                      
                      <Line type="monotone" dataKey="cogsPercent" stroke="#F59E0B" strokeWidth={2} name="COGS %" />
                      <Line type="monotone" dataKey="payrollPercent" stroke="#8B5CF6" strokeWidth={2} name="COL %" />
                      <Line type="monotone" dataKey="rentPercent" stroke="#6366F1" strokeWidth={2} name="Rent %" />
                      <Line type="monotone" dataKey="otherExpensesPercent" stroke="#6B7280" strokeWidth={2} name="Other Expenses %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {showBenchmarks && (
                  <div className="text-xs text-gray-500 mt-2">
                    Dashed lines show industry benchmarks: COGS {INDUSTRY_BENCHMARKS.cogs}%, Labor {INDUSTRY_BENCHMARKS.payroll}%, Rent {INDUSTRY_BENCHMARKS.rent}%, Other {INDUSTRY_BENCHMARKS.otherExpenses}%
                  </div>
                )}
              </div>

              <div>
                <h5 className="text-md font-semibold text-gray-800 mb-4">Staff & Payroll Efficiency</h5>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" tickFormatter={(value) => `${value}`} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'Active Staff') return [value, name]
                          return [formatCurrency(value), name]
                        }}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="activeStaff" stroke="#10B981" strokeWidth={2} name="Active Staff" />
                      <Line yAxisId="right" type="monotone" dataKey="avgPayrollPerStaff" stroke="#F59E0B" strokeWidth={2} name="Avg Payroll per Staff" />
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
                <h5 className="font-semibold text-gray-900 mb-2">Avg EBITDA</h5>
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
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                        fontSize={12}
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

            {/* Detailed Other Expenses Breakdown */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Other Expenses Breakdown ({startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {detailedOtherExpenses.map((expense, index) => (
                  <div key={expense.name} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-700 text-sm">{expense.name}</span>
                      <span className="text-sm font-bold text-gray-900">{formatPercentage(expense.percentage)}</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{formatCurrency(expense.value)}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-gray-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(expense.percentage * 10, 100)}%` }}
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">P&L Dashboard</h1>
          <p className="text-gray-600">Monthly Financial Analysis (VAT-Excluded Store Revenue)</p>
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

          {/* Summary Cards with Chart Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">Total Revenue ({totals.monthCount} months)</h3>
                <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/>
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold" style={{color: '#3B82F6'}}>{formatCurrency(totals.totalRevenue)}</div>
              <p className="text-xs text-gray-500 mt-1">
                VAT Excluded | Avg: {formatCurrency(totals.totalRevenue / totals.monthCount)}/month
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">Total Expenses ({totals.monthCount} months)</h3>
                <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold" style={{color: '#EF4444'}}>{formatCurrency(totals.totalExpenses)}</div>
              <p className="text-xs text-gray-500 mt-1">
                COGS: {formatCurrency(totals.totalCOGS)} | Payroll: {formatCurrency(totals.totalPayroll)} | Rent: {formatCurrency(totals.totalRent)}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">Total EBITDA ({totals.monthCount} months)</h3>
                <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold" style={{color: '#10B981'}}>{formatCurrency(totals.netProfit)}</div>
              <p className="text-xs text-gray-500 mt-1">
                Avg: {formatCurrency(totals.netProfit / totals.monthCount)}/month
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">Avg EBITDA ({totals.monthCount} months)</h3>
                <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                  </svg>
                </div>
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
                  <Bar dataKey="profit" fill="#10B981" name="EBITDA" />
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
            
            {/* Main 4 Key Metrics - Matching 12-Month Format */}
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`} Results
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Revenue */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Total Revenue ({rangeData.monthCount} {rangeData.monthCount === 1 ? 'month' : 'months'})</h3>
                  <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold" style={{color: '#3B82F6'}}>{formatCurrency(rangeData.totalRevenue)}</div>
                <p className="text-xs text-gray-500 mt-1">
                  VAT Excluded | Avg: {formatCurrency(rangeData.totalRevenue / rangeData.monthCount)}/month
                </p>
              </div>

              {/* Total Expenses */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Total Expenses ({rangeData.monthCount} {rangeData.monthCount === 1 ? 'month' : 'months'})</h3>
                  <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold" style={{color: '#EF4444'}}>{formatCurrency(rangeData.totalExpenses)}</div>
                <p className="text-xs text-gray-500 mt-1">
                  COGS: {formatCurrency(rangeData.totalCOGS)} | Payroll: {formatCurrency(rangeData.totalPayroll)} | Rent: {formatCurrency(rangeData.totalRent)}
                </p>
              </div>

              {/* Total EBITDA */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Total EBITDA ({rangeData.monthCount} {rangeData.monthCount === 1 ? 'month' : 'months'})</h3>
                  <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold" style={{color: '#10B981'}}>{formatCurrency(rangeData.netProfit)}</div>
                <p className="text-xs text-gray-500 mt-1">
                  Avg: {formatCurrency(rangeData.netProfit / rangeData.monthCount)}/month
                </p>
              </div>

              {/* Avg EBITDA */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500">Avg EBITDA ({rangeData.monthCount} {rangeData.monthCount === 1 ? 'month' : 'months'})</h3>
                  <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {formatPercentage(rangeData.totalRevenue > 0 ? (rangeData.netProfit / rangeData.totalRevenue) * 100 : 0)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  VAT Savings: {formatCurrency(rangeData.totalRevenue * 0.07)}
                </p>
              </div>
            </div>

            {/* Secondary Metrics - COGS, Payroll, Rent, Other Expenses */}
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* COGS */}
              <div className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">COGS</h4>
                  <div className="w-5 h-5 bg-gray-800 rounded flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2L3 7v11a1 1 0 001 1h12a1 1 0 001-1V7l-7-5zM9 9a1 1 0 112 0v4a1 1 0 11-2 0V9z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(rangeData.totalCOGS)}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {rangeData.totalRevenue > 0 ? formatPercentage((rangeData.totalCOGS / rangeData.totalRevenue) * 100) : '0%'}
                </p>
              </div>

              {/* Payroll (COL) */}
              <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Payroll (COL)</h4>
                  <div className="w-5 h-5 bg-gray-800 rounded flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-600">{formatCurrency(rangeData.totalPayroll)}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {rangeData.totalRevenue > 0 ? formatPercentage((rangeData.totalPayroll / rangeData.totalRevenue) * 100) : '0%'}
                </p>
              </div>

              {/* Rent */}
              <div className="p-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-500">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Rent</h4>
                  <div className="w-5 h-5 bg-gray-800 rounded flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-indigo-600">{formatCurrency(rangeData.totalRent)}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {rangeData.totalRevenue > 0 ? formatPercentage((rangeData.totalRent / rangeData.totalRevenue) * 100) : '0%'}
                </p>
              </div>

              {/* Other Expenses */}
              <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-500">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Other Expenses</h4>
                  <div className="w-5 h-5 bg-gray-800 rounded flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-600">{formatCurrency(rangeData.otherExpenses)}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {rangeData.totalRevenue > 0 ? formatPercentage((rangeData.otherExpenses / rangeData.totalRevenue) * 100) : '0%'}
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced Tabs - Overview, Trends, and AI Recommendations */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6">
                {['Overview', 'Trends', 'AI Recommendations'].map((tab) => (
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


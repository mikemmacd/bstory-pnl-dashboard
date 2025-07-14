import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine } from 'recharts'
import './App.css'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0']

// Sample financial data - this will be replaced by backend data
const sampleData = {
  'July 2024': { total_revenue: 4235814.757, cogs: 1200000, operating_expenses: 800000, payroll: 2495991.77, active_staff: 125 },
  'August 2024': { total_revenue: 4100000, cogs: 1150000, operating_expenses: 750000, payroll: 2513341.92, active_staff: 124 },
  'September 2024': { total_revenue: 4300000, cogs: 1220000, operating_expenses: 820000, payroll: 2466534.78, active_staff: 123 },
  'October 2024': { total_revenue: 4450000, cogs: 1250000, operating_expenses: 850000, payroll: 2513704.29, active_staff: 123 },
  'November 2024': { total_revenue: 4200000, cogs: 1180000, operating_expenses: 780000, payroll: 2647902.28, active_staff: 123 },
  'December 2024': { total_revenue: 4600000, cogs: 1300000, operating_expenses: 900000, payroll: 2708850.03, active_staff: 125 }
}

function App() {
  const [data, setData] = useState(sampleData)
  const [uploadMessage, setUploadMessage] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadType, setUploadType] = useState('')

  // Load data from backend on component mount
  useEffect(() => {
    loadDataFromBackend()
  }, [])

  const loadDataFromBackend = async () => {
    try {
      const response = await fetch('https://bstory-pnl-backend.onrender.com/api/data')
      const result = await response.json()
      
      if (result.success && result.data) {
        // Merge backend data with sample data
        const backendData = {}
        
        // Process revenue data
        if (result.data.revenue) {
          Object.entries(result.data.revenue).forEach(([month, data]) => {
            if (!backendData[month]) backendData[month] = {}
            backendData[month].total_revenue = data.amount
          })
        }
        
        // Process expense data
        if (result.data.expenses) {
          Object.entries(result.data.expenses).forEach(([month, data]) => {
            if (!backendData[month]) backendData[month] = {}
            backendData[month].cogs = data.cogs || 0
            backendData[month].operating_expenses = data.operating_expenses || 0
          })
        }
        
        // Process payroll data
        if (result.data.payroll) {
          Object.entries(result.data.payroll).forEach(([month, data]) => {
            if (!backendData[month]) backendData[month] = {}
            backendData[month].payroll = data.payroll || 0
            backendData[month].active_staff = data.active_staff || 0
          })
        }
        
        // Merge with existing data
        setData(prevData => ({ ...prevData, ...backendData }))
      }
    } catch (error) {
      console.error('Error loading data from backend:', error)
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    try {
      setUploadMessage('Processing file...')

      if (uploadType === 'revenue') {
        // Handle Loyverse CSV upload
        const csvContent = await file.text()
        const month = extractMonthFromFilename(file.name) || 'Current Month'
        
        const revenueAmount = processLoyverseCSV(csvContent)
        
        // Save to backend
        const response = await fetch('https://bstory-pnl-backend.onrender.com/api/revenue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month_year: month,
            revenue_amount: revenueAmount,
            source: 'loyverse'
          })
        })
        
        const result = await response.json()
        if (result.success) {
          setUploadMessage(`✅ Revenue data uploaded successfully! ${month}: $${revenueAmount.toLocaleString()}`)
          loadDataFromBackend() // Reload data
        } else {
          setUploadMessage(`❌ Error saving revenue data: ${result.error}`)
        }
        
      } else if (uploadType === 'expenses') {
        setUploadMessage('Expense upload functionality coming soon...')
        
      } else if (uploadType === 'payroll') {
        setUploadMessage('Payroll upload functionality coming soon...')
      }

    } catch (error) {
      console.error('Upload error:', error)
      setUploadMessage(`❌ Error uploading file: ${error.message}`)
    }

    event.target.value = ''
  }

  const processLoyverseCSV = (csvContent) => {
    const lines = csvContent.split('\n')
    let totalRevenue = 0
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const columns = line.split(',')
      if (columns.length >= 4) {
        const paymentType = columns[0]?.replace(/"/g, '').trim()
        const netAmount = parseFloat(columns[3]?.replace(/"/g, '').trim())
        
        if (paymentType !== 'Wastage' && !isNaN(netAmount)) {
          // Remove 7% VAT
          const vatExcluded = netAmount / 1.07
          totalRevenue += vatExcluded
        }
      }
    }
    
    return totalRevenue
  }

  const extractMonthFromFilename = (filename) => {
    const match = filename.match(/(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})/)
    if (match) {
      const startDate = new Date(match[1])
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
      return `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`
    }
    return null
  }

  // Calculate metrics for display
  const months = Object.keys(data).sort((a, b) => new Date(a) - new Date(b))
  const latestMonth = months[months.length - 1]
  const latestData = data[latestMonth] || {}

  const totalRevenue = latestData.total_revenue || 0
  const totalCOGS = latestData.cogs || 0
  const totalPayroll = latestData.payroll || 0
  const totalOperatingExpenses = latestData.operating_expenses || 0
  const netProfit = totalRevenue - totalCOGS - totalPayroll - totalOperatingExpenses

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">BStory P&L Dashboard</h1>
          <p className="text-gray-600">Latest Period: {latestMonth}</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Data Upload</h2>
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => { setUploadType('revenue'); setShowUploadModal(true) }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              Upload Revenue (Loyverse CSV)
            </button>
            <button
              onClick={() => { setUploadType('expenses'); setShowUploadModal(true) }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Upload Expenses (Zoho Books)
            </button>
            <button
              onClick={() => { setUploadType('payroll'); setShowUploadModal(true) }}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg"
            >
              Upload Payroll (Google Sheets)
            </button>
          </div>
          {uploadMessage && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-800">{uploadMessage}</p>
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Revenue</h3>
            <p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">COGS</h3>
            <p className="text-2xl font-bold text-red-600">${totalCOGS.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Payroll</h3>
            <p className="text-2xl font-bold text-blue-600">${totalPayroll.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Operating Expenses</h3>
            <p className="text-2xl font-bold text-orange-600">${totalOperatingExpenses.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Net Profit</h3>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${netProfit.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={months.map(month => ({
                month: month.split(' ')[0],
                revenue: data[month]?.total_revenue || 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Expense Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'COGS', value: totalCOGS },
                    { name: 'Payroll', value: totalPayroll },
                    { name: 'Operating Expenses', value: totalOperatingExpenses }
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">
                Upload {uploadType.charAt(0).toUpperCase() + uploadType.slice(1)} Data
              </h3>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="w-full p-2 border border-gray-300 rounded-lg mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App


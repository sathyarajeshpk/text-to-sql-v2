import React, { useState } from 'react'
import { Database, FileText, ClipboardPaste, Upload, Play, CheckCircle, AlertTriangle, Code, Table, X } from 'lucide-react'
import axios from 'axios'

const API_URL = 'http://localhost:8000'

function App() {
  const [activeTab, setActiveTab] = useState('upload')
  const [session, setSession] = useState(null)
  const [file, setFile] = useState(null)
  const [pastedData, setPastedData] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFileUpload = async () => {
    if (!file) return alert('Select a file first')
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    
    const endpoint = file.name.endsWith('.csv') ? 'csv' : 'excel'
    try {
      const res = await axios.post(`${API_URL}/api/upload/${endpoint}`, formData)
      setSession(res.data)
      alert('File uploaded!')
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setLoading(false)
  }

  const handlePaste = async () => {
    if (!pastedData.trim()) return alert('Paste some data first')
    setLoading(true)
    try {
      const res = await axios.post(`${API_URL}/api/paste/table`, {
        table_name: 'my_data',
        content: pastedData,
        format: 'auto',
        has_header: true
      })
      setSession(res.data)
      alert('Data processed!')
    } catch (err) {
      alert('Failed: ' + err.message)
    }
    setLoading(false)
  }

  const handleQuery = async () => {
    if (!query.trim() || !session) return alert('Enter a query and upload data first')
    setLoading(true)
    try {
      const res = await axios.post(`${API_URL}/api/query`, {
        session_id: session.session_id,
        query: query,
        validate: true
      })
      setResult(res.data)
    } catch (err) {
      alert('Query failed: ' + err.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-2">
        <Database className="w-8 h-8 text-blue-400" />
        Text-to-SQL v2
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 rounded ${activeTab === 'upload' ? 'bg-blue-600' : 'bg-slate-800'}`}>
          <Upload className="w-4 h-4 inline mr-1" /> Upload File
        </button>
        <button onClick={() => setActiveTab('paste')} className={`px-4 py-2 rounded ${activeTab === 'paste' ? 'bg-blue-600' : 'bg-slate-800'}`}>
          <ClipboardPaste className="w-4 h-4 inline mr-1" /> Paste Data
        </button>
      </div>

      {/* Upload Section */}
      {activeTab === 'upload' && (
        <div className="bg-slate-900 p-6 rounded-lg mb-6">
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files[0])} className="mb-4 block" />
          {file && <p className="text-sm text-slate-400 mb-4">Selected: {file.name}</p>}
          <button onClick={handleFileUpload} disabled={loading} className="bg-green-600 px-4 py-2 rounded disabled:opacity-50">
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      )}

      {/* Paste Section */}
      {activeTab === 'paste' && (
        <div className="bg-slate-900 p-6 rounded-lg mb-6">
          <textarea
            value={pastedData}
            onChange={(e) => setPastedData(e.target.value)}
            placeholder="Paste CSV, TSV, or JSON data here..."
            className="w-full h-40 bg-slate-800 p-3 rounded mb-4 font-mono text-sm"
          />
          <button onClick={handlePaste} disabled={loading} className="bg-purple-600 px-4 py-2 rounded disabled:opacity-50">
            {loading ? 'Processing...' : 'Process Data'}
          </button>
        </div>
      )}

      {/* Schema Display */}
      {session && (
        <div className="bg-slate-900 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Table className="w-5 h-5" /> Schema
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(session.schema).map(([table, cols]) => (
              <div key={table} className="bg-slate-800 p-3 rounded">
                <p className="font-semibold text-blue-400">{table}</p>
                <ul className="text-sm text-slate-400">
                  {cols.map(c => <li key={c.name}>{c.name} ({c.type})</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Query Section */}
      {session && (
        <div className="bg-slate-900 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Ask a Question</h2>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Show me all records"
            className="w-full bg-slate-800 p-3 rounded mb-4"
          />
          <button onClick={handleQuery} disabled={loading} className="bg-blue-600 px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50">
            <Play className="w-4 h-4" /> {loading ? 'Generating...' : 'Generate SQL'}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-slate-900 p-6 rounded-lg">
          <div className={`flex items-center gap-2 mb-4 ${result.is_valid ? 'text-green-400' : 'text-yellow-400'}`}>
            {result.is_valid ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span>{result.is_valid ? 'Valid' : 'Warning'} (Confidence: {Math.round(result.confidence * 100)}%)</span>
          </div>
          
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" /> Generated SQL
            </h3>
            <pre className="bg-slate-950 p-3 rounded overflow-x-auto">
              <code className="text-blue-300">{result.sql}</code>
            </pre>
          </div>

          {result.execution_result && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-2">Results</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {Object.keys(result.execution_result[0] || {}).map(k => (
                        <th key={k} className="text-left p-2 text-slate-400">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.execution_result.map((row, i) => (
                      <tr key={i} className="border-b border-slate-800">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="p-2">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
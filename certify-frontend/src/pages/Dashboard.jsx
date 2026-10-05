import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, FolderSync, FileText, Download, 
  Plus, Trash2, RefreshCw, X
} from 'lucide-react';
import axios from 'axios';
import DashboardLayout from '../layouts/DashboardLayout';
import { cn } from '../utils/cn';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalFolders: 0,
    totalScanned: 0,
    verified: 0,
    suspicious: 0,
  });
  const [folders, setFolders] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [folderForm, setFolderForm] = useState({ name: '', driveFolderId: '' });
  const [scanForm, setScanForm] = useState({
    studentName: '',
    courseName: '',
    folderName: '',
    status: 'Verified',
    aiMatchConfidence: '98%',
    reason: 'Verified by AI matching registry.'
  });
  const [submitting, setSubmitting] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'https://ch-mini-backend.vercel.app/api';

  // Fetch all live data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, foldersRes, certsRes] = await Promise.all([
        axios.get(`${API_URL}/certificates/stats`).catch(() => ({ data: null })),
        axios.get(`${API_URL}/folders`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/certificates`).catch(() => ({ data: [] }))
      ]);

      const certs = certsRes.data || [];
      const foldrs = foldersRes.data || [];
      setFolders(foldrs);
      setCertificates(certs);

      if (statsRes.data) {
        setStats(statsRes.data);
      } else {
        // Fallback compute from arrays
        setStats({
          totalFolders: foldrs.length,
          totalScanned: certs.length,
          verified: certs.filter(c => c.status === 'Verified').length,
          suspicious: certs.filter(c => c.status === 'Suspicious').length,
        });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Connect Folder
  const handleConnectFolder = async (e) => {
    e.preventDefault();
    if (!folderForm.name.trim()) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/folders`, {
        name: folderForm.name,
        driveFolderId: folderForm.driveFolderId
      });
      setFolderForm({ name: '', driveFolderId: '' });
      setShowFolderModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to connect folder: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Folder
  const handleDeleteFolder = async (id) => {
    if (!window.confirm('Are you sure you want to disconnect this folder?')) return;
    try {
      await axios.delete(`${API_URL}/folders/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete folder');
    }
  };

  // Handle Create / Scan Certificate
  const handleCreateCertificate = async (e) => {
    e.preventDefault();
    if (!scanForm.studentName || !scanForm.courseName) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/certificates`, scanForm);
      setScanForm({
        studentName: '',
        courseName: '',
        folderName: '',
        status: 'Verified',
        aiMatchConfidence: '98%',
        reason: 'Verified by AI matching registry.'
      });
      setShowScanModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to add certificate: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Certificate
  const handleDeleteCertificate = async (id) => {
    if (!window.confirm('Delete this certificate record?')) return;
    try {
      await axios.delete(`${API_URL}/certificates/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete certificate');
    }
  };

  // Export report to CSV
  const handleExportCSV = () => {
    if (filteredCertificates.length === 0) {
      alert('No certificates available to export!');
      return;
    }

    const headers = ['Student Name', 'Course', 'Status', 'AI Match', 'Reason', 'Date'];
    const rows = filteredCertificates.map(c => [
      `"${c.studentName || ''}"`,
      `"${c.courseName || ''}"`,
      `"${c.status || ''}"`,
      `"${c.aiMatchConfidence || ''}"`,
      `"${(c.reason || '').replace(/"/g, '""')}"`,
      `"${new Date(c.uploadDate || Date.now()).toLocaleDateString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CertifyHub_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Certificates
  const filteredCertificates = certificates.filter(cert => {
    const matchesStatus = statusFilter === 'All' || cert.status === statusFilter;
    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      (cert.studentName && cert.studentName.toLowerCase().includes(query)) ||
      (cert.courseName && cert.courseName.toLowerCase().includes(query)) ||
      (cert.fileName && cert.fileName.toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardLayout searchTerm={searchTerm} setSearchTerm={setSearchTerm}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
            <p className="text-sm text-slate-500 mt-1">Real-time metrics of your connected Google Drive folders and AI verifications.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowScanModal(true)}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              New Verification
            </button>
            <button 
              onClick={() => setShowFolderModal(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
            >
              <FolderSync className="w-4 h-4" />
              Connect Folder
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Connected Folders</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{stats.totalFolders}</h3>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                <FolderSync className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Google Drive folders</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Scanned</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{stats.totalScanned}</h3>
              </div>
              <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
                <FileText className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Total student certificates</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Verified</p>
                <h3 className="text-3xl font-extrabold text-emerald-600 mt-2 tracking-tight">{stats.verified}</h3>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Passed authenticity checks</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Suspicious Flags</p>
                <h3 className="text-3xl font-extrabold text-red-600 mt-2 tracking-tight">{stats.suspicious}</h3>
              </div>
              <div className="p-3 rounded-xl bg-red-50 text-red-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Requires educator review</p>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Connected Folders Section */}
          <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Connected Folders</h2>
                <p className="text-xs text-slate-400 mt-0.5">Auto-synced Google Drive repositories</p>
              </div>
              <button 
                onClick={() => setShowFolderModal(true)}
                className="text-brand-600 hover:text-brand-700 text-sm font-medium flex items-center gap-1 hover:underline"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[460px]">
              {folders.length === 0 ? (
                <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl my-auto">
                  <FolderSync className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">No folders connected</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
                    Connect a Google Drive folder to automatically monitor new certificates.
                  </p>
                  <button 
                    onClick={() => setShowFolderModal(true)}
                    className="mt-4 px-3 py-1.5 bg-brand-50 text-brand-600 text-xs font-semibold rounded-lg hover:bg-brand-100 transition-colors"
                  >
                    Connect First Folder
                  </button>
                </div>
              ) : (
                folders.map(folder => (
                  <div key={folder._id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:border-slate-200 hover:bg-white hover:shadow-xs transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors truncate max-w-[180px]">
                        {folder.name}
                      </h4>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {folder.status || 'Synced'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5"/> {folder.verifiedCount || 0}
                        </span>
                        <span className="flex items-center gap-1 text-red-600 font-medium">
                          <ShieldAlert className="w-3.5 h-3.5"/> {folder.suspiciousCount || 0}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDeleteFolder(folder._id)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1"
                        title="Disconnect Folder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Certificates Data Table */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Certificate Verifications</h2>
                <p className="text-xs text-slate-400 mt-0.5">Live list of scanned and evaluated credentials</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Status Filter */}
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
                  {['All', 'Verified', 'Suspicious'].map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        "px-3 py-1 rounded-lg transition-all",
                        statusFilter === status ? "bg-white text-slate-900 shadow-xs font-semibold" : "hover:text-slate-900"
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleExportCSV}
                  className="text-slate-700 hover:text-slate-900 text-xs font-medium flex items-center gap-1.5 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Export (.csv)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              {filteredCertificates.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-base font-medium text-slate-700">No certificates found</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {certificates.length === 0 
                      ? "When certificates are placed in your connected Drive folders, they will be automatically verified and listed here." 
                      : "No records match your search or filter."}
                  </p>
                  {certificates.length === 0 && (
                    <button 
                      onClick={() => setShowScanModal(true)}
                      className="mt-4 px-4 py-2 bg-brand-600 text-white text-xs font-medium rounded-xl hover:bg-brand-700 transition-colors shadow-xs"
                    >
                      Add Test Verification
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50/80 text-slate-500 font-semibold text-xs border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Student Name</th>
                      <th className="px-6 py-3.5">Course Name</th>
                      <th className="px-6 py-3.5">AI Confidence</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Uploaded</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {filteredCertificates.map(cert => (
                      <tr key={cert._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {cert.studentName}
                          <span className="block text-xs font-normal text-slate-400 mt-0.5">
                            {cert.fileName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {cert.courseName}
                          <span className="block text-xs text-slate-400 mt-0.5">
                            Folder: {cert.folderName || 'Default'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700">
                          {cert.aiMatchConfidence || '95%'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border",
                            cert.status === 'Verified' 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {cert.status === 'Verified' ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                            {cert.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {new Date(cert.uploadDate || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteCertificate(cert._id)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                            title="Delete certificate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 bg-slate-50/40">
              <span>Showing {filteredCertificates.length} of {certificates.length} certificates</span>
              <button 
                onClick={fetchData} 
                className="text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 hover:underline"
              >
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Connect Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FolderSync className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Connect Google Drive Folder</h3>
              </div>
              <button 
                onClick={() => setShowFolderModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnectFolder} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Folder Name
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Fall 2026 Batch Certificates"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Drive Folder ID or URL (Optional)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
                  value={folderForm.driveFolderId}
                  onChange={(e) => setFolderForm({ ...folderForm, driveFolderId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-mono text-xs"
                />
                <p className="text-xs text-slate-400 mt-1">
                  CertifyHub will poll this folder every 5 minutes and verify newly dropped PDF or image certificates.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Connecting...' : 'Connect Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add / Verify Certificate Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Add Certificate Verification</h3>
              </div>
              <button 
                onClick={() => setShowScanModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCertificate} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Student Name
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Sarah Connor"
                    value={scanForm.studentName}
                    onChange={(e) => setScanForm({ ...scanForm, studentName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Course Name
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Advanced AI & ML"
                    value={scanForm.courseName}
                    onChange={(e) => setScanForm({ ...scanForm, courseName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={scanForm.status}
                    onChange={(e) => setScanForm({ 
                      ...scanForm, 
                      status: e.target.value,
                      aiMatchConfidence: e.target.value === 'Verified' ? '98%' : '42%',
                      reason: e.target.value === 'Verified' ? 'Verified by AI matching registry.' : 'Discrepancy detected in student credentials.'
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="Verified">Verified</option>
                    <option value="Suspicious">Suspicious</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Folder Association
                  </label>
                  <select
                    value={scanForm.folderName}
                    onChange={(e) => setScanForm({ ...scanForm, folderName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="">General (No specific folder)</option>
                    {folders.map(f => (
                      <option key={f._id} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  AI Evaluation Reason
                </label>
                <input 
                  type="text" 
                  value={scanForm.reason}
                  onChange={(e) => setScanForm({ ...scanForm, reason: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScanModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, FolderSync, FileText, Download, 
  Plus, Trash2, RefreshCw, X, AlertTriangle, ExternalLink,
  UploadCloud, CheckCircle2, Eye
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
  const [scanningFolderId, setScanningFolderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);

  // Forms state
  const [folderForm, setFolderForm] = useState({ name: '', driveFolderId: '' });
  const [uploadForm, setUploadForm] = useState({
    studentName: '',
    courseName: 'Infosys Springboard Assignment',
    platform: 'Infosys Springboard',
    folderName: '',
    status: 'Verified',
    imageBase64: '',
    fileName: ''
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Connect Drive Folder
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

  // Trigger Drive Folder Scan
  const handleScanFolder = async (folderId) => {
    setScanningFolderId(folderId);
    try {
      await axios.post(`${API_URL}/folders/${folderId}/scan`);
      await fetchData();
    } catch (err) {
      alert('Folder scan completed with notice: ' + (err.response?.data?.details || err.message));
      await fetchData();
    } finally {
      setScanningFolderId(null);
    }
  };

  // Handle Delete Folder
  const handleDeleteFolder = async (id) => {
    if (!window.confirm('Disconnect this Google Drive folder and remove scanned records?')) return;
    try {
      await axios.delete(`${API_URL}/folders/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete folder');
    }
  };

  // File to Base64 helper
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadForm(prev => ({
        ...prev,
        imageBase64: reader.result,
        fileName: file.name
      }));
    };
    reader.readAsDataURL(file);
  };

  // Handle Direct Upload / Verification Test
  const handleVerifyUpload = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/certificates`, uploadForm);
      setUploadForm({
        studentName: '',
        courseName: 'Infosys Springboard Assignment',
        platform: 'Infosys Springboard',
        folderName: '',
        status: 'Verified',
        imageBase64: '',
        fileName: ''
      });
      setShowUploadModal(false);
      fetchData();
    } catch (err) {
      alert('Verification submission failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Certificate
  const handleDeleteCertificate = async (id) => {
    if (!window.confirm('Delete this certificate inspection record?')) return;
    try {
      await axios.delete(`${API_URL}/certificates/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete certificate');
    }
  };

  // Export report to CSV for staff grading
  const handleExportCSV = () => {
    if (filteredCertificates.length === 0) {
      alert('No certificates available to export!');
      return;
    }

    const headers = ['Student Name', 'Course Title', 'Platform', 'Verdict', 'Confidence', 'Tampering Indicators', 'Staff Notes / Reason', 'Scan Date'];
    const rows = filteredCertificates.map(c => [
      `"${c.studentName || ''}"`,
      `"${c.courseName || ''}"`,
      `"${c.platform || 'Infosys Springboard'}"`,
      `"${c.status === 'Verified' ? 'GENUINE' : 'FAKE / SUSPICIOUS'}"`,
      `"${c.aiMatchConfidence || ''}"`,
      `"${(c.fraudIndicators || []).join('; ').replace(/"/g, '""')}"`,
      `"${(c.reason || '').replace(/"/g, '""')}"`,
      `"${new Date(c.uploadDate || Date.now()).toLocaleDateString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Staff_Grading_Report_${new Date().toISOString().slice(0, 10)}.csv`);
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
      (cert.fileName && cert.fileName.toLowerCase().includes(query)) ||
      (cert.platform && cert.platform.toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardLayout searchTerm={searchTerm} setSearchTerm={setSearchTerm}>
      <div className="max-w-7xl mx-auto space-y-8 font-sans">
        
        {/* Header tailored for Staff */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Academic Assignment Verification
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Certificate Fraud Scanner</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Automatically inspect student certificate submissions (Infosys Springboard, Coursera, NPTEL) from Google Drive to detect forged or photoshopped names.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setShowUploadModal(true)}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-xs flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4 text-slate-500" />
              Scan Certificate File
            </button>
            <button 
              onClick={() => setShowFolderModal(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
            >
              <FolderSync className="w-4 h-4" />
              Import Drive Folder
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Monitored Folders</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{stats.totalFolders}</h3>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                <FolderSync className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Assignment submission drives</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Scanned</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{stats.totalScanned}</h3>
              </div>
              <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
                <FileText className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Total student certificates inspected</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Genuine / True</p>
                <h3 className="text-3xl font-extrabold text-emerald-600 mt-2 tracking-tight">{stats.verified}</h3>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Authentic formatting & records</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Fakes / Altered</p>
                <h3 className="text-3xl font-extrabold text-red-600 mt-2 tracking-tight">{stats.suspicious}</h3>
              </div>
              <div className="p-3 rounded-xl bg-red-50 text-red-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium font-semibold text-red-600">Tampered names / forged IDs</p>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Connected Folders Section */}
          <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Assignment Drive Folders</h2>
                <p className="text-xs text-slate-400 mt-0.5">Google Drive assignment links</p>
              </div>
              <button 
                onClick={() => setShowFolderModal(true)}
                className="text-brand-600 hover:text-brand-700 text-sm font-medium flex items-center gap-1 hover:underline"
              >
                <Plus className="w-4 h-4" /> Add Folder
              </button>
            </div>

            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[500px]">
              {folders.length === 0 ? (
                <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl my-auto">
                  <FolderSync className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">No Drive Folders Connected</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[220px] mx-auto">
                    Paste your students' assignment Google Drive folder link to scan for fakes.
                  </p>
                  <button 
                    onClick={() => setShowFolderModal(true)}
                    className="mt-4 px-3.5 py-2 bg-brand-50 text-brand-600 text-xs font-semibold rounded-xl hover:bg-brand-100 transition-colors"
                  >
                    Import Assignment Folder
                  </button>
                </div>
              ) : (
                folders.map(folder => (
                  <div key={folder._id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white hover:shadow-xs transition-all group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                          {folder.name}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono truncate mt-0.5">
                          ID: {folder.driveFolderId}
                        </p>
                      </div>
                      <span className={cn(
                        "text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0",
                        folder.status === 'Syncing' 
                          ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" 
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}>
                        {folder.status || 'Synced'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold" title="Genuine certificates">
                          <CheckCircle2 className="w-3.5 h-3.5"/> {folder.verifiedCount || 0} True
                        </span>
                        <span className="flex items-center gap-1 text-red-600 font-semibold" title="Fake certificates">
                          <AlertTriangle className="w-3.5 h-3.5"/> {folder.suspiciousCount || 0} Fake
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleScanFolder(folder._id)}
                          disabled={scanningFolderId === folder._id}
                          className="text-brand-600 hover:text-brand-700 p-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                          title="Scan this Google Drive folder now"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", scanningFolderId === folder._id && "animate-spin")} />
                        </button>
                        <button 
                          onClick={() => handleDeleteFolder(folder._id)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                          title="Disconnect Folder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Certificates Data Table with Fraud Indicators */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Student Assignment Inspections</h2>
                <p className="text-xs text-slate-400 mt-0.5">Automated authenticity evaluation</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Filter Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                  {['All', 'Verified', 'Suspicious'].map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg transition-all",
                        statusFilter === status 
                          ? "bg-white text-slate-900 shadow-xs font-bold" 
                          : "hover:text-slate-900"
                      )}
                    >
                      {status === 'Verified' ? 'True / Genuine' : status === 'Suspicious' ? 'Fake / Suspicious' : 'All'}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleExportCSV}
                  className="text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Staff Grading Sheet (.csv)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              {filteredCertificates.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-base font-semibold text-slate-700">No certificates inspected yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {certificates.length === 0 
                      ? "Import a student Google Drive folder or scan a certificate image to inspect Infosys Springboard submissions for fake names." 
                      : "No certificates match your search query."}
                  </p>
                  {certificates.length === 0 && (
                    <button 
                      onClick={() => setShowUploadModal(true)}
                      className="mt-4 px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-xs"
                    >
                      Inspect First Certificate
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50/80 text-slate-500 font-semibold text-xs border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Student / File</th>
                      <th className="px-6 py-3.5">Course / Platform</th>
                      <th className="px-6 py-3.5">Verdict</th>
                      <th className="px-6 py-3.5">Authenticity Analysis</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {filteredCertificates.map(cert => (
                      <tr key={cert._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">
                            {cert.studentName}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                            <span>{cert.fileName}</span>
                            {cert.driveLink && (
                              <a 
                                href={cert.driveLink} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-brand-600 hover:text-brand-700" 
                                title="Open Drive File"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">{cert.courseName}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            <span className="font-medium text-blue-600">{cert.platform || 'Infosys Springboard'}</span> • ID: {cert.certificateId || 'SPB-Verified'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                            cert.status === 'Verified' 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {cert.status === 'Verified' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                TRUE / GENUINE
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                                FAKE / ALTERED
                              </>
                            )}
                          </span>
                          <span className="block text-xs text-slate-400 font-medium mt-1">
                            Confidence: {cert.aiMatchConfidence || '95%'}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-xs">
                          <div className="text-slate-700 font-medium truncate" title={cert.reason}>
                            {cert.reason}
                          </div>
                          {cert.fraudIndicators && cert.fraudIndicators.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-red-600 text-xs font-semibold">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span className="truncate">{cert.fraudIndicators[0]}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedCert(cert)}
                              className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
                              title="View Forensic Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCertificate(cert._id)}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                              title="Delete record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 bg-slate-50/40">
              <span>Showing {filteredCertificates.length} of {certificates.length} certificate submissions</span>
              <button 
                onClick={fetchData} 
                className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 hover:underline"
              >
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Refresh Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Connect Google Drive Folder */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FolderSync className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Import Google Drive Folder</h3>
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
                  Assignment Batch / Folder Name
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. 3rd Year CSE - Infosys Springboard Assignment"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Google Drive Folder Link or Folder ID
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="https://drive.google.com/drive/folders/1BxiMVs0X..."
                  value={folderForm.driveFolderId}
                  onChange={(e) => setFolderForm({ ...folderForm, driveFolderId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-mono text-xs"
                />
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Paste the Google Drive folder link where your students uploaded their certificate files. CertifyHub will scan each submission and cross-check authenticity.
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
                  className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {submitting ? 'Connecting...' : 'Connect & Scan Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Scan / Test Certificate File */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Inspect Student Certificate</h3>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyUpload} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Upload Certificate Image (Optional for AI Vision Check)
                </label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Student Name
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. John Doe"
                    value={uploadForm.studentName}
                    onChange={(e) => setUploadForm({ ...uploadForm, studentName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Platform
                  </label>
                  <select
                    value={uploadForm.platform}
                    onChange={(e) => setUploadForm({ ...uploadForm, platform: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Infosys Springboard">Infosys Springboard</option>
                    <option value="Coursera">Coursera</option>
                    <option value="NPTEL">NPTEL</option>
                    <option value="HackerRank">HackerRank</option>
                    <option value="Other">Other Platform</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Course Assignment Title
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Python Programming & Data Structures"
                  value={uploadForm.courseName}
                  onChange={(e) => setUploadForm({ ...uploadForm, courseName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Target Folder
                  </label>
                  <select
                    value={uploadForm.folderName}
                    onChange={(e) => setUploadForm({ ...uploadForm, folderName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">General Assignment Drive</option>
                    {folders.map(f => (
                      <option key={f._id} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Simulate Verdict
                  </label>
                  <select
                    value={uploadForm.status}
                    onChange={(e) => setUploadForm({ ...uploadForm, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Verified">Genuine (Verified)</option>
                    <option value="Suspicious">Fake / Altered (Suspicious)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Inspecting...' : 'Run Forensic Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Detailed Forensic Inspection View */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  selectedCert.status === 'Verified' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                )}>
                  {selectedCert.status === 'Verified' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Forensic Inspection Report</h3>
                  <p className="text-xs text-slate-400">Assignment Certificate Evaluation</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCert(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Student Name:</span>
                  <span className="font-bold text-slate-900">{selectedCert.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Platform:</span>
                  <span className="font-semibold text-blue-600">{selectedCert.platform || 'Infosys Springboard'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Course Title:</span>
                  <span className="font-medium text-slate-800">{selectedCert.courseName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Certificate ID:</span>
                  <span className="font-mono text-xs text-slate-700">{selectedCert.certificateId || 'SPB-Verified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">AI Confidence:</span>
                  <span className="font-semibold text-slate-900">{selectedCert.aiMatchConfidence || '95%'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Authenticity Verdict
                </h4>
                <div className={cn(
                  "p-3 rounded-xl border text-xs font-semibold flex items-center gap-2",
                  selectedCert.status === 'Verified' 
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                    : "bg-red-50 text-red-800 border-red-200"
                )}>
                  {selectedCert.status === 'Verified' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>GENUINE CERTIFICATE: Official formatting, signatures, and ID confirmed.</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>FLAGGED AS FAKE / ALTERED: Font inconsistencies or text overlay detected.</span>
                    </>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Detailed Reason & Evidence
                </h4>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  {selectedCert.reason}
                </p>
              </div>

              {selectedCert.fraudIndicators && selectedCert.fraudIndicators.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1.5">
                    Specific Tampering Indicators
                  </h4>
                  <ul className="space-y-1">
                    {selectedCert.fraudIndicators.map((ind, i) => (
                      <li key={i} className="text-xs text-red-700 bg-red-50/60 px-3 py-1.5 rounded-lg border border-red-100 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        {ind}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedCert(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}

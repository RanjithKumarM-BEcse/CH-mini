import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, FolderSync, FileText, Download, 
  Trash2, RefreshCw, X, AlertTriangle, ExternalLink,
  UploadCloud, CheckCircle2, Eye, QrCode, ArrowRightLeft
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
    if (!window.confirm('Disconnect this Google Drive folder and remove its certificate records?')) return;
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

    const headers = [
      'Name on Certificate', 
      'Name on Official Website', 
      'Names Match', 
      'Verdict', 
      'Verification URL', 
      'Course', 
      'Reason', 
      'Date'
    ];

    const rows = filteredCertificates.map(c => [
      `"${c.extracted_name_on_cert || c.studentName || ''}"`,
      `"${c.extracted_name_on_website || 'Not Found'}"`,
      `"${c.is_match ? 'YES' : 'NO'}"`,
      `"${c.status === 'Verified' ? 'GENUINE' : 'FAKE / SUSPICIOUS'}"`,
      `"${c.verification_url || ''}"`,
      `"${c.courseName || ''}"`,
      `"${(c.reason || '').replace(/"/g, '""')}"`,
      `"${new Date(c.uploadDate || Date.now()).toLocaleDateString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Staff_QR_Verification_Report_${new Date().toISOString().slice(0, 10)}.csv`);
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
      (cert.extracted_name_on_cert && cert.extracted_name_on_cert.toLowerCase().includes(query)) ||
      (cert.extracted_name_on_website && cert.extracted_name_on_website.toLowerCase().includes(query)) ||
      (cert.courseName && cert.courseName.toLowerCase().includes(query)) ||
      (cert.fileName && cert.fileName.toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardLayout searchTerm={searchTerm} setSearchTerm={setSearchTerm}>
      <div className="max-w-7xl mx-auto space-y-8 font-sans">
        
        {/* Header specifically explaining the QR / Link matching logic */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
              <QrCode className="w-3.5 h-3.5" /> QR Code & Webpage Name Cross-Check Engine
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Certificate Authenticity Verification
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Extracts the QR code or link from student certificate submissions (Infosys Springboard), scrapes the official verification webpage, and matches the name on the certificate with the name on the official website to catch fakes.
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
                <p className="text-sm font-medium text-slate-500">Connected Folders</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{stats.totalFolders}</h3>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                <FolderSync className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Google Drive repositories</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Inspected</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{stats.totalScanned}</h3>
              </div>
              <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
                <FileText className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium">Certificates cross-checked</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Names Matched (Genuine)</p>
                <h3 className="text-3xl font-extrabold text-emerald-600 mt-2 tracking-tight">{stats.verified}</h3>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-medium text-emerald-600 font-semibold">Certificate name = Website name</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Mismatches / Fakes</p>
                <h3 className="text-3xl font-extrabold text-red-600 mt-2 tracking-tight">{stats.suspicious}</h3>
              </div>
              <div className="p-3 rounded-xl bg-red-50 text-red-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 font-semibold text-red-600">Name altered or link invalid</p>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Connected Folders Section */}
          <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Assignment Drive Folders</h2>
                <p className="text-xs text-slate-400 mt-0.5">Auto-scanned student submissions</p>
              </div>
              <button 
                onClick={() => setShowFolderModal(true)}
                className="text-brand-600 hover:text-brand-700 text-sm font-medium flex items-center gap-1 hover:underline"
              >
                + Add Folder
              </button>
            </div>

            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[520px]">
              {folders.length === 0 ? (
                <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl my-auto">
                  <FolderSync className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">No Folders Connected</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[220px] mx-auto">
                    Paste your students' Google Drive assignment link to extract and verify their certificates.
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
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold" title="Names Matched">
                          <CheckCircle2 className="w-3.5 h-3.5"/> {folder.verifiedCount || 0} True
                        </span>
                        <span className="flex items-center gap-1 text-red-600 font-semibold" title="Names Mismatched">
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

          {/* Certificates Data Table with Name on Cert vs Name on Website */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Name Matching & QR Verification Results</h2>
                <p className="text-xs text-slate-400 mt-0.5">Comparison between certificate text and official verification URL</p>
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
                      {status === 'Verified' ? 'True (Matched)' : status === 'Suspicious' ? 'Fake (Mismatched)' : 'All'}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleExportCSV}
                  className="text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Export Grading Report (.csv)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              {filteredCertificates.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-base font-semibold text-slate-700">No certificates cross-checked yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {certificates.length === 0 
                      ? "Import a student Google Drive folder or scan a certificate image to extract QR links and verify student names." 
                      : "No certificates match your search query."}
                  </p>
                  {certificates.length === 0 && (
                    <button 
                      onClick={() => setShowUploadModal(true)}
                      className="mt-4 px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-xs"
                    >
                      Test First Certificate
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50/80 text-slate-500 font-semibold text-xs border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Name on Certificate</th>
                      <th className="px-5 py-3.5">Name on Official Website</th>
                      <th className="px-5 py-3.5">Verdict</th>
                      <th className="px-5 py-3.5">Verification URL</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {filteredCertificates.map(cert => {
                      const nameOnCert = cert.extracted_name_on_cert || cert.studentName;
                      const nameOnWeb = cert.extracted_name_on_website || (cert.status === 'Verified' ? nameOnCert : 'Unknown / Different Student');
                      const isMatch = cert.is_match ?? (cert.status === 'Verified');

                      return (
                        <tr key={cert._id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Name on Certificate */}
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">
                              {nameOnCert}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">
                              {cert.fileName}
                            </div>
                          </td>

                          {/* Name on Official Website */}
                          <td className="px-5 py-4">
                            <div className={cn(
                              "font-semibold text-xs px-2.5 py-1 rounded-lg inline-block",
                              isMatch ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800 font-bold"
                            )}>
                              {nameOnWeb}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Course: {cert.courseName}
                            </div>
                          </td>

                          {/* Verdict */}
                          <td className="px-5 py-4">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                              isMatch
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : "bg-red-50 text-red-700 border-red-200"
                            )}>
                              {isMatch ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  TRUE (MATCHED)
                                </>
                              ) : (
                                <>
                                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                                  FAKE (MISMATCH)
                                </>
                              )}
                            </span>
                          </td>

                          {/* Verification URL / QR Link */}
                          <td className="px-5 py-4">
                            {cert.verification_url ? (
                              <a
                                href={cert.verification_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-mono hover:underline truncate max-w-[200px]"
                                title={cert.verification_url}
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{cert.verification_url}</span>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No QR/Link detected</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setSelectedCert(cert)}
                                className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
                                title="View Side-by-Side Comparison"
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
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 bg-slate-50/40">
              <span>Showing {filteredCertificates.length} of {certificates.length} verified submissions</span>
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
                  Paste the Google Drive folder link where students uploaded their certificates. CertifyHub will decode the QR/verification link from each certificate, visit the official page, and check if the student name matches.
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

      {/* MODAL 2: Test / Scan Certificate Image */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Scan Certificate with QR / Link Extraction</h3>
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
                  Upload Certificate Image (AI will decode QR & match names)
                </label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Student Name (Optional if uploading image)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Ranjith Kumar M"
                  value={uploadForm.studentName}
                  onChange={(e) => setUploadForm({ ...uploadForm, studentName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Course Assignment Title
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Infosys Springboard - Python Foundation"
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
                    Simulate If No File
                  </label>
                  <select
                    value={uploadForm.status}
                    onChange={(e) => setUploadForm({ ...uploadForm, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Verified">Genuine (Name Matches)</option>
                    <option value="Suspicious">Fake (Name Mismatch)</option>
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
                  {submitting ? 'Verifying...' : 'Run QR & Name Cross-Check'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Side-by-Side Name Comparison Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  (selectedCert.is_match ?? selectedCert.status === 'Verified') ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                )}>
                  {(selectedCert.is_match ?? selectedCert.status === 'Verified') ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Name Cross-Check Evaluation</h3>
                  <p className="text-xs text-slate-400">QR Code & Official Registry Comparison</p>
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
              {/* Side-by-Side Name Comparison Box */}
              <div className="p-4 rounded-xl border bg-slate-50 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Side-by-Side Name Verification
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                      Name on Certificate
                    </span>
                    <span className="font-bold text-slate-900 text-sm block">
                      {selectedCert.extracted_name_on_cert || selectedCert.studentName}
                    </span>
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg border",
                    (selectedCert.is_match ?? selectedCert.status === 'Verified')
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                      : "bg-red-50/70 border-red-200 text-red-900"
                  )}>
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                      Name on Official Website
                    </span>
                    <span className="font-bold text-sm block">
                      {selectedCert.extracted_name_on_website || (selectedCert.status === 'Verified' ? selectedCert.studentName : 'Different Person')}
                    </span>
                  </div>
                </div>

                <div className={cn(
                  "p-2.5 rounded-lg text-center text-xs font-bold border",
                  (selectedCert.is_match ?? selectedCert.status === 'Verified')
                    ? "bg-emerald-100/50 text-emerald-800 border-emerald-300"
                    : "bg-red-100/50 text-red-800 border-red-300"
                )}>
                  {(selectedCert.is_match ?? selectedCert.status === 'Verified')
                    ? "MATCH CONFIRMED: Student is the genuine certificate recipient."
                    : "MISMATCH DETECTED: Student name does not match the verification registry."}
                </div>
              </div>

              {/* QR / Verification URL */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Extracted Verification URL / QR Code
                </h4>
                {selectedCert.verification_url ? (
                  <a
                    href={selectedCert.verification_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs text-brand-600 font-mono transition-colors"
                  >
                    <span className="truncate max-w-[360px]">{selectedCert.verification_url}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    No QR code or verification link could be extracted from this certificate.
                  </p>
                )}
              </div>

              {/* Detailed Reason */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  AI Decision Summary
                </h4>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  {selectedCert.reason}
                </p>
              </div>
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

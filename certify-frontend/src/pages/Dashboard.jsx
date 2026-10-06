import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, CheckCircle2, Download, RefreshCw, 
  ExternalLink, Upload, FolderSync, Plus, Trash2, Sparkles, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import DashboardLayout from '../layouts/DashboardLayout';
import { cn } from '../utils/cn';

export default function Dashboard() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [driveUrl, setDriveUrl] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showImportView, setShowImportView] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'https://ch-mini-backend.vercel.app/api';

  // Load existing results
  const loadCertificates = async () => {
    try {
      const res = await axios.get(`${API_URL}/certificates`);
      setCertificates(res.data || []);
      if (!res.data || res.data.length === 0) {
        setShowImportView(true);
      }
    } catch (err) {
      console.error('Failed to load certificates:', err);
      setShowImportView(true);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Scan from Google Drive Link
  const handleDriveScan = async (e) => {
    e.preventDefault();
    if (!driveUrl.trim()) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Create/register folder
      const folderRes = await axios.post(`${API_URL}/folders`, {
        name: 'Assignment Submissions',
        driveFolderId: driveUrl.trim()
      });

      // 2. Scan folder
      if (folderRes.data?._id) {
        const scanRes = await axios.post(`${API_URL}/folders/${folderRes.data._id}/scan`);
        if (scanRes.data?.result?.filesProcessed === 0) {
          setErrorMessage('Scan completed, but 0 certificate files were found in this Google Drive folder. Please ensure the folder has image/PDF certificates and is set to "Anyone with the link can view".');
        }
      }

      await loadCertificates();
      setShowImportView(false);
      setDriveUrl('');
    } catch (err) {
      const msg = err.response?.data?.details || err.response?.data?.error || err.message;
      setErrorMessage(`Drive Scan: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle Direct Multi-File Upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    setErrorMessage('');
  };

  const handleScanFiles = async () => {
    if (selectedFiles.length === 0) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // Helper to process PDF or image files cleanly
      const processFile = async (file) => {
        // If it's a PDF and PDF.js is available, extract all text and render page 1
        if ((file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) && window.pdfjsLib) {
          try {
            if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            // 1. EXTRACT ALL EMBEDDED TEXT FROM THE PDF DOCUMENT
            let pdfText = '';
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              try {
                const pageItem = await pdf.getPage(pageNum);
                const textContent = await pageItem.getTextContent();
                const pageStrings = textContent.items.map(item => item.str).join(' ');
                pdfText += pageStrings + '\n';
              } catch (textErr) {
                console.warn('PDF text extraction notice:', textErr.message);
              }
            }

            // 2. Render Page 1 to optimized canvas for sharp QR code decoding
            const page = await pdf.getPage(1);
            const initialViewport = page.getViewport({ scale: 1.0 });
            const maxDim = 1200;
            const scale = Math.min(maxDim / initialViewport.width, maxDim / initialViewport.height, 2.0);
            const viewport = page.getViewport({ scale: Math.max(scale, 1.2) });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            const renderedBase64 = canvas.toDataURL('image/jpeg', 0.85);

            return { 
              name: file.name, 
              base64: renderedBase64,
              certificateText: pdfText.trim()
            };
          } catch (pdfErr) {
            console.warn('PDF.js render fallback:', pdfErr.message);
          }
        }

        if (file.type && file.type.startsWith('image/')) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxDim = 1200;
                let width = img.width;
                let height = img.height;
                if (width > maxDim || height > maxDim) {
                  if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                  } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                  }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
                resolve({ name: file.name, base64: compressedBase64, certificateText: '' });
              };
              img.onerror = () => resolve({ name: file.name, base64: e.target.result, certificateText: '' });
              img.src = e.target.result;
            };
            reader.readAsDataURL(file);
          });
        }

        // Raw fallback
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ name: file.name, base64: reader.result, certificateText: '' });
          reader.readAsDataURL(file);
        });
      };

      const convertedFiles = await Promise.all(selectedFiles.map(processFile));

      // Send batch to backend
      await axios.post(`${API_URL}/certificates/scan-batch`, {
        files: convertedFiles
      });

      await loadCertificates();
      setShowImportView(false);
      setSelectedFiles([]);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setErrorMessage(`File Scan Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // One-click demo test batch
  const handleLoadDemo = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      await axios.post(`${API_URL}/certificates/demo`);
      await loadCertificates();
      setShowImportView(false);
    } catch (err) {
      setErrorMessage('Failed to load demo: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Delete single item
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this certificate result?')) return;
    try {
      await axios.delete(`${API_URL}/certificates/${id}`);
      setCertificates(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      alert('Failed to delete item');
    }
  };

  // Clear all records from database
  const handleClearAll = async () => {
    if (!window.confirm('Clear all verification records from the table?')) return;
    try {
      await axios.delete(`${API_URL}/certificates/clear-all`);
      setCertificates([]);
      setShowImportView(true);
    } catch (err) {
      alert('Failed to clear records: ' + (err.response?.data?.error || err.message));
    }
  };

  // Clear all and start fresh batch
  const handleStartNewBatch = () => {
    setShowImportView(true);
    setErrorMessage('');
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredCertificates.length === 0) return;

    const headers = ['Student Name (on Certificate)', 'Name on Official Website', 'Verdict', 'Official Verification Link', 'Reason'];
    const rows = filteredCertificates.map(c => [
      `"${c.extracted_name_on_cert || c.studentName || ''}"`,
      `"${c.extracted_name_on_website || (c.status === 'Verified' ? c.studentName : 'Mismatch')}"`,
      `"${c.status === 'Verified' ? 'GENUINE' : 'SUSPICIOUS / FAKE'}"`,
      `"${c.verification_url || ''}"`,
      `"${(c.reason || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Certificate_Verification_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Counts
  const genuineCount = certificates.filter(c => c.status === 'Verified').length;
  const suspiciousCount = certificates.filter(c => c.status === 'Suspicious').length;

  const filteredCertificates = certificates.filter(c => {
    if (statusFilter === 'Verified') return c.status === 'Verified';
    if (statusFilter === 'Suspicious') return c.status === 'Suspicious';
    return true;
  });

  if (initialLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-brand-600" />
          <span>Loading verification portal...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ERROR / NOTICE BANNER */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Scan Notice:</span>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="bg-white border border-brand-200 rounded-2xl p-8 text-center shadow-sm space-y-4 animate-pulse">
            <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">
              Scanning Certificates in Progress...
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Extracting QR codes & links, scraping official webpages, and matching student names to catch fakes.
            </p>
          </div>
        )}

        {/* STEP 1: IMPORT FROM DRIVE OR FILE */}
        {!loading && (showImportView || certificates.length === 0) && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="text-center max-w-xl mx-auto">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Import Student Certificates
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Select your student certificate files or paste a Google Drive folder link to scan for genuine vs fake submissions.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 pt-2">
              
              {/* Option A: Google Drive Folder */}
              <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 flex flex-col justify-between space-y-4 hover:border-brand-300 transition-colors">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FolderSync className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Option A: Google Drive Folder</h3>
                  <p className="text-xs text-slate-500">
                    Paste the shared Google Drive folder link containing the student certificates.
                  </p>
                  <form onSubmit={handleDriveScan} className="space-y-3 pt-2">
                    <input 
                      type="text" 
                      required
                      placeholder="https://drive.google.com/drive/folders/..." 
                      value={driveUrl}
                      onChange={(e) => setDriveUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-white"
                    />
                    <button
                      type="submit"
                      disabled={loading || !driveUrl.trim()}
                      className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <FolderSync className="w-4 h-4" />
                      Scan Google Drive Folder
                    </button>
                  </form>
                </div>
              </div>

              {/* Option B: Choose Certificate Files directly */}
              <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 flex flex-col justify-between space-y-4 hover:border-brand-300 transition-colors">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Option B: Select Certificate Files Directly</h3>
                  <p className="text-xs text-slate-500">
                    Select certificate images or PDFs directly from your computer (select multiple files at once).
                  </p>
                  
                  <div className="pt-2 space-y-3">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*,.pdf" 
                      onChange={handleFileUpload}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 cursor-pointer"
                    />

                    {selectedFiles.length > 0 && (
                      <p className="text-xs font-semibold text-emerald-600">
                        ✓ {selectedFiles.length} file(s) selected
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleScanFiles}
                      disabled={loading || selectedFiles.length === 0}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      Scan Selected Certificate(s)
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Demo Button */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-400">Want to test the results table right away?</span>
              <button
                type="button"
                onClick={handleLoadDemo}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Load Sample Test Batch
              </button>
            </div>

            {certificates.length > 0 && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowImportView(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                >
                  ← Back to Scanned Results
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: RESULTS VIEW (GENUINE & SUSPICIOUS TABLE) */}
        {!loading && certificates.length > 0 && !showImportView && (
          <div className="space-y-4">

            {/* Top Bar: Counts & Actions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              {/* Summary Counts */}
              <div className="flex items-center gap-3">
                <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold">Genuine Students: {genuineCount}</span>
                </div>

                <div className="px-3.5 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-bold">Suspicious / Fake: {suspiciousCount}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Excel (.csv)
                </button>
                <button
                  onClick={handleStartNewBatch}
                  className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Scan New Folder / Files
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-3 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  title="Clear all records from table"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Table
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
              {[
                { label: `All Students (${certificates.length})`, val: 'All' },
                { label: `Genuine (${genuineCount})`, val: 'Verified' },
                { label: `Suspicious / Fake (${suspiciousCount})`, val: 'Suspicious' }
              ].map(t => (
                <button
                  key={t.val}
                  onClick={() => setStatusFilter(t.val)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                    statusFilter === t.val 
                      ? "bg-slate-900 text-white shadow-xs" 
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Simple Result Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Student Name (on Certificate)</th>
                      <th className="px-5 py-3.5">Name on Official Website</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Verification Link / Proof</th>
                      <th className="px-5 py-3.5">Reason</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredCertificates.map(cert => {
                      const nameOnCert = cert.extracted_name_on_cert || cert.studentName;
                      const nameOnWeb = cert.extracted_name_on_website || (cert.status === 'Verified' ? nameOnCert : 'Different Student / Unknown');
                      const isGenuine = cert.status === 'Verified';

                      return (
                        <tr key={cert._id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Student Name on Cert */}
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {nameOnCert}
                            <span className="block text-[11px] font-normal text-slate-400">
                              {cert.fileName}
                            </span>
                          </td>

                          {/* Name on Official Website */}
                          <td className="px-5 py-3.5">
                            <span className={cn(
                              "text-xs font-bold px-2 py-1 rounded-lg",
                              isGenuine ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                            )}>
                              {nameOnWeb}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border",
                              isGenuine 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : "bg-red-50 text-red-700 border-red-200"
                            )}>
                              {isGenuine ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  GENUINE
                                </>
                              ) : (
                                <>
                                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                                  FAKE / SUSPICIOUS
                                </>
                              )}
                            </span>
                          </td>

                          {/* Link */}
                          <td className="px-5 py-3.5">
                            {cert.verification_url ? (
                              <a 
                                href={cert.verification_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-mono hover:underline truncate max-w-[180px]"
                                title={cert.verification_url}
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{cert.verification_url}</span>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No link detected</span>
                            )}
                          </td>

                          {/* Reason */}
                          <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs truncate" title={cert.reason}>
                            {cert.reason}
                          </td>

                          {/* Delete */}
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => handleDelete(cert._id)}
                              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

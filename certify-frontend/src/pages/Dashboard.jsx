import React from 'react';
import { ShieldAlert, ShieldCheck, FolderSync, FileText, ArrowRight, Download } from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { cn } from '../utils/cn';

const metrics = [
  { label: 'Connected Folders', value: '3', icon: FolderSync, trend: '+1 this week', color: 'text-brand-600', bg: 'bg-brand-50' },
  { label: 'Total Scanned', value: '1,248', icon: FileText, trend: '+124 this week', color: 'text-slate-600', bg: 'bg-slate-100' },
  { label: 'Verified', value: '1,180', icon: ShieldCheck, trend: '94.5% success', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Suspicious', value: '68', icon: ShieldAlert, trend: 'Needs review', color: 'text-red-600', bg: 'bg-red-50' },
];

const recentFolders = [
  { id: 1, name: 'Web Dev Bootcamp 2024', status: 'Syncing...', lastSync: 'Just now', verified: 45, suspicious: 2 },
  { id: 2, name: 'Data Science Fall Cohort', status: 'Synced', lastSync: '2 hours ago', verified: 120, suspicious: 5 },
  { id: 3, name: 'UX/UI Certification', status: 'Synced', lastSync: '1 day ago', verified: 89, suspicious: 0 },
];

const recentCertificates = [
  { id: 'CERT-001', student: 'Alice Johnson', course: 'Web Dev Bootcamp 2024', status: 'Verified', match: '98%', date: 'Oct 01, 2024' },
  { id: 'CERT-002', student: 'Bob Smith', course: 'Web Dev Bootcamp 2024', status: 'Suspicious', match: '45%', date: 'Oct 01, 2024' },
  { id: 'CERT-003', student: 'Charlie Davis', course: 'Data Science Fall', status: 'Verified', match: '100%', date: 'Sep 30, 2024' },
  { id: 'CERT-004', student: 'Diana Prince', course: 'UX/UI Certification', status: 'Verified', match: '99%', date: 'Sep 29, 2024' },
];

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
            <p className="text-sm text-slate-500 mt-1">Real-time metrics of your automated certificate verification.</p>
          </div>
          <button className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2">
            <FolderSync className="w-4 h-4" />
            Import Folder
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <div key={metric.label} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{metric.value}</h3>
                </div>
                <div className={cn("p-3 rounded-lg", metric.bg, metric.color)}>
                  <metric.icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-4 font-medium">{metric.trend}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Active Folders Section */}
          <div className="xl:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Active Folders</h2>
              <button className="text-brand-600 hover:text-brand-700 text-sm font-medium flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-3">
              {recentFolders.map(folder => (
                <div key={folder.id} className="p-4 rounded-lg border border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white hover:shadow-sm transition-all cursor-pointer group">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-slate-900 group-hover:text-brand-600 transition-colors">{folder.name}</h4>
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded-full",
                      folder.status === 'Syncing...' ? "bg-brand-100 text-brand-700 animate-pulse" : "bg-slate-100 text-slate-600"
                    )}>
                      {folder.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium text-emerald-600"><ShieldCheck className="w-3.5 h-3.5"/> {folder.verified}</span>
                    <span className="flex items-center gap-1 font-medium text-red-600"><ShieldAlert className="w-3.5 h-3.5"/> {folder.suspicious}</span>
                    <span className="ml-auto text-slate-400">{folder.lastSync}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Certificates Data Table */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Recent Verifications</h2>
              <button className="text-slate-600 hover:text-slate-900 text-sm font-medium flex items-center gap-2 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                <Download className="w-4 h-4" /> Export Report
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/80 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Course</th>
                    <th className="px-6 py-4">AI Match</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {recentCertificates.map(cert => (
                    <tr key={cert.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{cert.student}</td>
                      <td className="px-6 py-4">{cert.course}</td>
                      <td className="px-6 py-4 font-medium">{cert.match}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                          cert.status === 'Verified' 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {cert.status === 'Verified' ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                          {cert.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{cert.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 text-center bg-slate-50/50 mt-auto">
              <button className="text-brand-600 hover:text-brand-700 text-sm font-medium transition-colors">View full verification log</button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

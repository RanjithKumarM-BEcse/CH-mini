import React from 'react';
import { Link } from 'react-router-dom';
import { FileCheck, ShieldCheck, Zap, FolderSync } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 text-brand-600 font-bold text-xl">
          <FileCheck className="w-6 h-6" />
          CertifyHub
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign In</Link>
          <Link to="/login" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-8 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6">
          Automate Certificate Verification <br className="hidden md:block"/> with <span className="text-brand-600">AI Precision</span>
        </h1>
        <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
          Connect your Google Drive and let our AI automatically scan, cross-check, and verify student certificates in seconds. Say goodbye to manual reviews.
        </p>
        <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 text-lg font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200">
          Start Verifying for Free
          <Zap className="w-5 h-5" />
        </Link>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 text-left">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
              <FolderSync className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Google Drive Sync</h3>
            <p className="text-slate-600 text-sm">Simply point CertifyHub to your Drive folder. We'll automatically watch for new certificate uploads.</p>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">AI Cross-Checking</h3>
            <p className="text-slate-600 text-sm">Our AI extracts names and verification links, then browses the web to ensure they match perfectly.</p>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Automated Reports</h3>
            <p className="text-slate-600 text-sm">Download comprehensive Excel reports separating verified students from suspicious submissions.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

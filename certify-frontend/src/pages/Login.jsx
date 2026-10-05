import React from 'react';
import { FileCheck } from 'lucide-react';

export default function Login() {
  
  const handleGoogleLogin = () => {
    // In the real implementation, this will redirect to our backend's Google OAuth route
    // window.location.href = `${process.env.REACT_APP_API_URL}/auth/google`;
    alert("This will redirect to Google OAuth once you provide your Google Cloud Client ID!");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 text-center">
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600">
            <FileCheck className="w-8 h-8" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to CertifyHub</h2>
        <p className="text-slate-500 mb-8 text-sm">Sign in to connect your Google Drive and start verifying certificates.</p>

        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium text-slate-700 mb-6"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <div className="text-xs text-slate-400">
          By signing in, you agree to our Terms of Service and Privacy Policy. We will request access to read your Google Drive folders.
        </div>
        
      </div>
    </div>
  );
}

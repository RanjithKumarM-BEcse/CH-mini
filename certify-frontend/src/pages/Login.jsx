import React, { useState } from 'react';
import { FileCheck } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleGoogleSuccess = async (credentialResponse) => {
    const success = await login(credentialResponse);
    if (success) {
      navigate('/dashboard');
    } else {
      setError('Failed to authenticate with the server. Please try again.');
    }
  };

  const handleGoogleError = () => {
    setError('Google Login failed. Please try again.');
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

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-center mb-6">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap
            shape="rectangular"
            theme="outline"
            size="large"
          />
        </div>

        <div className="text-xs text-slate-400">
          By signing in, you agree to our Terms of Service and Privacy Policy. We will request access to read your Google Drive folders.
        </div>
        
      </div>
    </div>
  );
}

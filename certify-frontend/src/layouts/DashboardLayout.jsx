import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileCheck, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DashboardLayout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    return user?.email ? user.email[0].toUpperCase() : 'U';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Clean Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5 text-brand-600 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
              <FileCheck className="w-5 h-5" />
            </div>
            CertifyHub
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              {user?.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.name || 'User avatar'} 
                  className="w-8 h-8 rounded-full ring-2 ring-brand-100 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs ring-2 ring-brand-50">
                  {getInitials()}
                </div>
              )}
              <span className="hidden sm:inline text-xs font-semibold text-slate-700">
                {user?.name || user?.email || 'Educator'}
              </span>
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors border border-slate-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, FolderSync, FileCheck, LogOut, Search
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../context/AuthContext';

export default function DashboardLayout({ children, searchTerm, setSearchTerm }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Connected Folders', path: '/folders', icon: FolderSync },
    { name: 'Certificates', path: '/certificates', icon: FileCheck },
  ];

  // Compute user initials or fallback
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
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <Link to="/dashboard" className="flex items-center gap-2 text-brand-600 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
              <FileCheck className="w-5 h-5" />
            </div>
            CertifyHub
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                location.pathname === item.path
                  ? "bg-brand-50 text-brand-600 font-semibold shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3.5 py-2.5 w-full text-left rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-xs z-10">
          <div className="flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-xl w-80 md:w-96 border border-transparent focus-within:border-brand-300 focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
              placeholder="Search student, course, file..." 
              className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-800 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* User Profile */}
            <div className="flex items-center gap-3 pl-3">
              {user?.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.name || 'User avatar'} 
                  className="w-9 h-9 rounded-full ring-2 ring-brand-100 object-cover shadow-xs"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm ring-2 ring-brand-50 shadow-xs">
                  {getInitials()}
                </div>
              )}
              <div className="hidden md:block text-left">
                <div className="text-sm font-semibold text-slate-800 leading-none">
                  {user?.name || 'Educator'}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">
                  {user?.email || 'Logged In'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

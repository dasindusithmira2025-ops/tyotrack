
import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckSquare, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Clock,
  Users,
  FileText,
  Building2,
  FolderOpen,
  Layers3,
  FileJson,
  Wrench
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserRole } from '../types';
import { api } from '../services/api';
import { AnimatePresence, motion } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');
  const devModeActive = localStorage.getItem('tyo_dev_mode_active') === '1';
  
  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout and clear local state anyway.
    } finally {
      localStorage.removeItem('tyo_user');
      localStorage.removeItem('tyo_dev_mode_active');
      navigate('/login');
    }
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: [UserRole.EMPLOYEE, UserRole.COMPANY_ADMIN] },
    { label: 'Companies', icon: Building2, path: '/companies', roles: [UserRole.SUPER_ADMIN] },
    
    // Company Admin Navigation
    { label: 'Approvals', icon: CheckSquare, path: '/approvals', roles: [UserRole.COMPANY_ADMIN] },
    { label: 'Employees', icon: Users, path: '/employees', roles: [UserRole.COMPANY_ADMIN] },
    { label: 'Workspaces', icon: Layers3, path: '/workspaces', roles: [UserRole.COMPANY_ADMIN] },
    { label: 'Projects', icon: FolderOpen, path: '/projects', roles: [UserRole.COMPANY_ADMIN] },
    { label: 'Time Policies', icon: FileJson, path: '/policies', roles: [UserRole.COMPANY_ADMIN] },
    { label: 'Reports', icon: BarChart3, path: '/reports', roles: [UserRole.COMPANY_ADMIN] },
    
    // Employee Navigation
    { label: 'Detailed Reports', icon: FileText, path: '/detailed-reports', roles: [UserRole.EMPLOYEE] },
    
    // Shared
    { label: 'Settings', icon: Settings, path: '/settings', roles: [UserRole.EMPLOYEE, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="relative min-h-screen md:h-screen flex flex-col md:flex-row text-slate-200 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 ambient-grid opacity-25" />
      <div className="pointer-events-none absolute -top-16 left-[20%] h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl float-orb" />
      <div className="pointer-events-none absolute top-[20%] -right-12 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl float-orb delay" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-[35%] h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl float-orb slow" />

      {/* Mobile Header */}
      <div className="md:hidden glass-surface p-4 flex items-center justify-between sticky top-0 z-30 shadow-xl m-2 rounded-2xl">
        <div className="flex items-center gap-2 font-bold text-xl text-white font-display">
          <Clock className="w-6 h-6 text-cyan-300" />
          <span className="accent-text">TyoTrack</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="text-slate-200 p-2 -mr-2 hover:bg-slate-800/60 rounded-lg transition-colors"
          aria-label="Open Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:sticky top-0 h-screen w-72 md:w-72 glass-surface md:rounded-none md:border-l-0 md:border-y-0 text-slate-300 p-4 flex flex-col transition-transform duration-300 ease-in-out z-50 overflow-y-auto shadow-2xl md:shadow-none border-r border-white/10",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Sidebar Header (Logo + Close) */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2 font-bold text-2xl text-white font-display">
            <Clock className="w-8 h-8 text-cyan-300" />
            <span className="accent-text">TyoTrack</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="md:hidden text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close Menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 px-2 mb-8 p-3 rounded-xl border border-white/10 bg-slate-900/40 soft-ring">
          <div className="w-10 h-10 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-300 font-bold border border-cyan-400/30 shadow-[0_0_15px_rgba(34,211,238,0.25)] shrink-0">
            {user.name?.[0] || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-medium text-sm truncate">{user.name}</p>
            <p className="text-xs text-slate-400 capitalize truncate">
              {user.role?.replace('_', ' ').toLowerCase()}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5">
          {filteredNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-cyan-500/20 to-indigo-500/25 text-white border border-cyan-400/35 shadow-[0_10px_30px_rgba(14,116,144,0.2)]"
                  : "text-slate-300 border border-transparent hover:bg-slate-800/60 hover:text-white hover:border-white/10"
              )}
            >
              <span className={cn(
                "absolute left-1 h-5 w-1 rounded-full bg-cyan-300 transition-opacity",
                location.pathname === item.path ? "opacity-100" : "opacity-0"
              )} />
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {devModeActive && (
            <NavLink
              to="/dev-mode"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-white border border-amber-400/35"
                  : "text-amber-200 border border-amber-400/20 hover:bg-amber-500/10 hover:text-white"
              )}
            >
              <Wrench className="w-5 h-5 shrink-0" />
              <span>Dev Mode</span>
            </NavLink>
          )}
        </nav>

        {/* Footer */}
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-300 border border-transparent hover:bg-rose-500/10 hover:border-rose-300/30 hover:text-rose-200 mt-6 md:mt-auto transition-all"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="relative flex-1 min-w-0 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

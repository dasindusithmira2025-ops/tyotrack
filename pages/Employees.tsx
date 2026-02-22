
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { User } from '../types';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';
import { User as UserIcon, Lock, Settings2, X, Shield, Plus, Mail, Eye, EyeOff } from 'lucide-react';

interface EmployeeWithProfile extends User {
  profile: {
    backdateLimitDays: number;
  }
}

export const Employees = () => {
  const [employees, setEmployees] = useState<EmployeeWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithProfile | null>(null);
  const [backdateDays, setBackdateDays] = useState(7);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', password: '' });
  const [showNewEmployeePassword, setShowNewEmployeePassword] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState<EmployeeWithProfile | null>(null);
  const [credentialForm, setCredentialForm] = useState({ name: '', password: '' });
  const [showCredentialPassword, setShowCredentialPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  
  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await api.getEmployees(user.companyId);
      setEmployees(data);
    } catch (e) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const openCredentialsEditor = (emp: EmployeeWithProfile) => {
    setEditingCredentials(emp);
    setCredentialForm({ name: emp.name, password: '' });
    setShowCredentialPassword(false);
  };

  const handleSaveCredentials = async () => {
    if (!editingCredentials) {
      return;
    }

    const trimmedName = credentialForm.name.trim();
    if (trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    if (credentialForm.password && credentialForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSavingCredentials(true);
    try {
      await api.updateUser(editingCredentials.id, { name: trimmedName });

      if (credentialForm.password) {
        await api.changePassword(editingCredentials.id, undefined, credentialForm.password);
      }

      toast.success('Employee credentials updated');
      setEditingCredentials(null);
      setCredentialForm({ name: '', password: '' });
      await loadEmployees();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update employee credentials');
    } finally {
      setSavingCredentials(false);
    }
  };

  const openSettings = (emp: EmployeeWithProfile) => {
    setEditingEmployee(emp);
    setBackdateDays(emp.profile.backdateLimitDays);
  };

  const saveSettings = async () => {
    if (!editingEmployee) return;
    try {
      await api.updateEmployeeProfile(editingEmployee.id, { backdateLimitDays: backdateDays });
      toast.success('Employee settings updated');
      setEditingEmployee(null);
      loadEmployees();
    } catch (e) {
      toast.error('Failed to update settings');
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEmployee(user.companyId, newEmployee.name, newEmployee.email, newEmployee.password);
      toast.success('Employee created successfully');
      setIsAddEmployeeOpen(false);
      setNewEmployee({ name: '', email: '', password: '' });
      loadEmployees();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create employee');
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Employees</h1>
            <p className="text-slate-400">Manage your team members and their permissions.</p>
          </div>
          <Button onClick={() => setIsAddEmployeeOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Employee
          </Button>
        </header>

        <div className="glass-surface panel-lift rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-center">Backdate Limit</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                           <UserIcon className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-white">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{emp.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-900/20 text-blue-300 border border-blue-900/30">
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono bg-slate-800 px-2 py-1 rounded text-slate-300">
                        {emp.profile.backdateLimitDays} days
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="secondary" 
                          className="h-8 px-3 text-xs" 
                          onClick={() => openCredentialsEditor(emp)}
                          title="Edit Name and Password"
                        >
                          <Lock className="w-3 h-3 mr-1" /> Access
                        </Button>
                        <Button 
                          variant="outline" 
                          className="h-8 px-3 text-xs border-slate-700 hover:bg-slate-800"
                          onClick={() => openSettings(emp)}
                          title="Configure"
                        >
                          <Settings2 className="w-3 h-3 mr-1" /> Config
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Employee Modal */}
      {isAddEmployeeOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button onClick={() => setIsAddEmployeeOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5"/></button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                <UserIcon className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">New Employee</h2>
            </div>
            
            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    required 
                    placeholder="Jane Doe" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-9 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={newEmployee.name} 
                    onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input 
                    type="email" 
                    required 
                    placeholder="jane@company.com" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-9 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={newEmployee.email} 
                    onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input 
                    type={showNewEmployeePassword ? "text" : "password"} 
                    required 
                    placeholder="********" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-9 pr-10 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={newEmployee.password} 
                    onChange={e => setNewEmployee({...newEmployee, password: e.target.value})} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewEmployeePassword((prev) => !prev)}
                    className="absolute right-2 top-1.5 p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showNewEmployeePassword ? "Hide password" : "Show password"}
                  >
                    {showNewEmployeePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <Button type="submit" className="w-full mt-4">Create Employee</Button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Credentials Modal */}
      {editingCredentials && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button
              onClick={() => setEditingCredentials(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-cyan-500/10 rounded-lg text-cyan-400">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Edit Access</h2>
            </div>
            <p className="text-xs text-slate-400 mb-6 ml-12">
              Update employee name and password directly in the product.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-9 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={credentialForm.name}
                    onChange={(e) => setCredentialForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  New Password
                  <span className="ml-1 text-xs text-slate-500">(optional)</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type={showCredentialPassword ? 'text' : 'password'}
                    placeholder="Leave empty to keep existing password"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-9 pr-10 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={credentialForm.password}
                    onChange={(e) => setCredentialForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCredentialPassword((prev) => !prev)}
                    className="absolute right-2 top-1.5 p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showCredentialPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCredentialPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setEditingCredentials(null)}>
                  Cancel
                </Button>
                <Button className="flex-1" isLoading={savingCredentials} onClick={handleSaveCredentials}>
                  Save Access
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 relative animate-in fade-in zoom-in duration-200 border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
             <button 
              onClick={() => setEditingEmployee(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-accent/20 rounded-lg text-accent">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Permissions</h3>
                <p className="text-xs text-slate-400">{editingEmployee.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Backdate Limit (Days)
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Restrict how many days in the past this employee can submit or edit time entries.
                </p>
                <div className="flex items-center gap-3">
                   <input 
                    type="range" 
                    min="1" 
                    max="60" 
                    value={backdateDays}
                    onChange={(e) => setBackdateDays(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="w-12 text-center bg-slate-800 py-1 rounded text-sm text-white font-mono border border-slate-700">
                    {backdateDays}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setEditingEmployee(null)}>Cancel</Button>
              <Button className="flex-1" onClick={saveSettings}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

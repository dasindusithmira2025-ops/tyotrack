
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { Company, User } from '../types';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';
import { Building2, Plus, User as UserIcon, X, MapPin, Loader2, Shield, Lock, Mail, Eye, EyeOff, Pencil } from 'lucide-react';

interface CompanyWithAdmins extends Company {
  admins?: User[];
}

export const Companies = () => {
  const [companies, setCompanies] = useState<CompanyWithAdmins[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showCompanyPassword, setShowCompanyPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [adminEditForm, setAdminEditForm] = useState({ name: '', password: '' });
  const [showAdminEditPassword, setShowAdminEditPassword] = useState(false);
  const [savingAdminEdit, setSavingAdminEdit] = useState(false);
  
  // Forms
  const [newCompany, setNewCompany] = useState({ name: '', email: '', password: '' });
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const allCompanies = await api.getAllCompanies();
      
      // Fetch admins for each company to display them in the card
      const companiesWithAdmins = await Promise.all(
        allCompanies.map(async (comp) => {
          const admins = await api.getCompanyAdmins(comp.id);
          return { ...comp, admins };
        })
      );
      
      setCompanies(companiesWithAdmins);
    } catch (e) {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Pass email and password along with name
      await api.createCompany(newCompany.name, newCompany.email, newCompany.password);
      toast.success('Company created successfully');
      setIsAddCompanyOpen(false);
      setNewCompany({ name: '', email: '', password: '' });
      loadData();
    } catch (e) {
      toast.error('Failed to create company');
    }
  };

  const openAdminModal = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setIsAddAdminOpen(true);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    try {
      await api.createCompanyAdmin(selectedCompanyId, newAdmin.name, newAdmin.email, newAdmin.password);
      toast.success(`Admin assigned to company`);
      setIsAddAdminOpen(false);
      setNewAdmin({ name: '', email: '', password: '' });
      loadData(); // Refresh to show new admin in list
    } catch (e: any) {
      toast.error(e.message || 'Failed to create admin');
    }
  };

  const openEditAdminModal = (admin: User) => {
    setEditingAdmin(admin);
    setAdminEditForm({ name: admin.name, password: '' });
    setShowAdminEditPassword(false);
  };

  const handleUpdateAdmin = async () => {
    if (!editingAdmin) {
      return;
    }

    const trimmedName = adminEditForm.name.trim();
    if (trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    if (adminEditForm.password && adminEditForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSavingAdminEdit(true);
    try {
      await api.updateUser(editingAdmin.id, { name: trimmedName });

      if (adminEditForm.password) {
        await api.changePassword(editingAdmin.id, undefined, adminEditForm.password);
      }

      toast.success('Admin credentials updated');
      setEditingAdmin(null);
      setAdminEditForm({ name: '', password: '' });
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update admin');
    } finally {
      setSavingAdminEdit(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Companies</h1>
            <p className="text-slate-400">Manage tenant companies and assign their administrators.</p>
          </div>
          <Button onClick={() => setIsAddCompanyOpen(true)} className="gap-2 bg-purple-600 hover:bg-purple-500">
            <Plus className="w-4 h-4" />
            Add Company
          </Button>
        </header>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {companies.map(company => (
              <div key={company.id} className="glass-surface panel-lift rounded-xl p-6 shadow-sm hover:border-slate-700 transition-colors flex flex-col h-full">
                
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700 shadow-inner">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{company.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        {company.timezone}
                        {company.email && <span className="text-slate-600 mx-1">|</span>}
                        {company.email && <span className="text-slate-400">{company.email}</span>}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => openAdminModal(company.id)}>
                     <UserIcon className="w-3 h-3 mr-1" />
                     Assign Admin
                  </Button>
                </div>

                {/* Admins List */}
                <div className="mb-4 flex-1">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Assigned Admins</h4>
                  {company.admins && company.admins.length > 0 ? (
                    <div className="space-y-2">
                      {company.admins.map(admin => (
                        <div key={admin.id} className="flex items-center gap-2 text-sm bg-slate-950/50 p-2 rounded border border-slate-800">
                          <div className="w-6 h-6 rounded-full bg-purple-900/30 text-purple-300 flex items-center justify-center text-xs font-bold border border-purple-900/50">
                            {admin.name[0]}
                          </div>
                          <span className="text-slate-300">{admin.name}</span>
                          <span className="text-slate-600 text-xs ml-auto">{admin.email}</span>
                          <button
                            type="button"
                            onClick={() => openEditAdminModal(admin)}
                            className="text-slate-400 hover:text-cyan-300 transition-colors"
                            title="Edit admin access"
                            aria-label={`Edit ${admin.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600 italic py-2 border border-dashed border-slate-800 rounded p-2 text-center">
                      No admins assigned yet.
                    </div>
                  )}
                </div>

                {/* Policies Footer */}
                <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 mt-auto">
                  <div>
                     <span className="block text-slate-500 mb-1 font-medium">Evening Shift</span>
                     <span className="text-white font-mono">{company.eveningStart} - {company.eveningEnd}</span>
                  </div>
                  <div>
                     <span className="block text-slate-500 mb-1 font-medium">Night Shift</span>
                     <span className="text-white font-mono">{company.nightStart} - {company.nightEnd}</span>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Add New Company Placeholder Card */}
            <button 
              onClick={() => setIsAddCompanyOpen(true)}
              className="border-2 border-dashed border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-white hover:border-slate-600 hover:bg-slate-900/50 transition-all group min-h-[250px]"
            >
              <div className="w-12 h-12 rounded-full bg-slate-900 group-hover:bg-purple-600 group-hover:text-white flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-medium">Create New Company</span>
            </button>
          </div>
        )}
      </div>

      {/* Add Company Modal */}
      {isAddCompanyOpen && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6 relative border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button onClick={() => setIsAddCompanyOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5"/></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                <Building2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Create Tenant</h2>
            </div>
            
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Company Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Acme Corp" 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-purple-500 outline-none" 
                  value={newCompany.name} 
                  onChange={e => setNewCompany({...newCompany, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Company Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input 
                    type="email" 
                    required 
                    placeholder="contact@company.com" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-9 text-white focus:ring-2 focus:ring-purple-500 outline-none" 
                    value={newCompany.email} 
                    onChange={e => setNewCompany({...newCompany, email: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Company Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input 
                    type={showCompanyPassword ? "text" : "password"} 
                    required 
                    placeholder="********" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 pl-9 pr-10 text-white focus:ring-2 focus:ring-purple-500 outline-none" 
                    value={newCompany.password} 
                    onChange={e => setNewCompany({...newCompany, password: e.target.value})} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowCompanyPassword((prev) => !prev)}
                    className="absolute right-2 top-1.5 p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showCompanyPassword ? "Hide password" : "Show password"}
                  >
                    {showCompanyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Default credentials for company portal access.</p>
              </div>
              
              <Button type="submit" className="w-full mt-4 bg-purple-600 hover:bg-purple-500">Create Company</Button>
            </form>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {isAddAdminOpen && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button onClick={() => setIsAddAdminOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5"/></button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Assign Admin</h2>
            </div>
            <p className="text-xs text-slate-400 mb-6 ml-12">Create a new Company Admin account for this tenant.</p>
            
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                <input type="text" required placeholder="John Doe" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
                <input type="email" required placeholder="admin@company.com" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={newAdmin.email} onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    required
                    placeholder="********"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 pr-10 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newAdmin.password}
                    onChange={e => setNewAdmin({...newAdmin, password: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((prev) => !prev)}
                    className="absolute right-2 top-1.5 p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showAdminPassword ? "Hide password" : "Show password"}
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full mt-4">Assign Admin</Button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button
              onClick={() => setEditingAdmin(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-cyan-500/10 rounded-lg text-cyan-400">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Edit Admin Access</h2>
            </div>
            <p className="text-xs text-slate-400 mb-6 ml-12">
              Update admin name and password directly in the product.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                  value={adminEditForm.name}
                  onChange={(e) => setAdminEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  New Password
                  <span className="ml-1 text-xs text-slate-500">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminEditPassword ? "text" : "password"}
                    placeholder="Leave empty to keep existing password"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 pr-10 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={adminEditForm.password}
                    onChange={(e) => setAdminEditForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminEditPassword((prev) => !prev)}
                    className="absolute right-2 top-1.5 p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showAdminEditPassword ? "Hide password" : "Show password"}
                  >
                    {showAdminEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setEditingAdmin(null)}>
                  Cancel
                </Button>
                <Button className="flex-1" isLoading={savingAdminEdit} onClick={handleUpdateAdmin}>
                  Save Access
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};




import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { Project, Workspace } from '../types';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';
import { Folder, Plus, Archive, PlayCircle, X, Building2 } from 'lucide-react';
import { cn } from '../lib/utils';

export const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  
  // Form State
  const [newProject, setNewProject] = useState({
    name: '',
    workspaceId: '',
    color: '#3b82f6'
  });

  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');

  const loadData = async () => {
    setLoading(true);
    try {
      const ws = await api.getWorkspaces(user.companyId);
      const ps = await api.getAllCompanyProjects(user.companyId);
      setProjects(ps);
      setWorkspaces(ws);
      if (ws.length > 0) {
        setNewProject(prev => ({ ...prev, workspaceId: ws[0].id }));
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.workspaceId) {
      toast.error('Create or select a workspace first');
      return;
    }
    try {
      await api.createProject(newProject.workspaceId, newProject.name, newProject.color);
      toast.success('Project created successfully');
      setIsModalOpen(false);
      setNewProject(prev => ({ ...prev, name: '' }));
      loadData();
    } catch (e) {
      toast.error('Failed to create project');
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const workspace = await api.createWorkspace(user.companyId, newWorkspaceName);
      toast.success('Workspace created successfully');
      setIsWorkspaceModalOpen(false);
      setNewWorkspaceName('');
      setNewProject(prev => ({ ...prev, workspaceId: workspace.id }));
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create workspace');
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      await api.toggleProjectStatus(id);
      loadData();
    } catch (e) {
      toast.error('Failed to update project status');
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Project Management</h1>
            <p className="text-slate-400">Control work categories and assignments.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsWorkspaceModalOpen(true)} className="gap-2">
              <Building2 className="w-4 h-4" />
              New Workspace
            </Button>
            <Button onClick={() => setIsModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>
        </header>

        <div className="glass-surface panel-lift rounded-xl shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold">
                <tr>
                  <th className="px-6 py-4">Project Name</th>
                  <th className="px-6 py-4">Workspace</th>
                  <th className="px-6 py-4 text-center">Color</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {projects.map(project => {
                  const wsName = workspaces.find(w => w.id === project.workspaceId)?.name || 'Unknown';
                  return (
                    <tr key={project.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                         <Folder className="w-4 h-4 text-slate-500" />
                         {project.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 border border-slate-700">
                          {wsName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="w-4 h-4 rounded-full mx-auto ring-2 ring-slate-800" style={{ backgroundColor: project.color }} />
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-bold border",
                          project.status === 'ACTIVE' 
                            ? "bg-emerald-900/20 text-emerald-400 border-emerald-900/30" 
                            : "bg-slate-700/50 text-slate-400 border-slate-600"
                        )}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => toggleStatus(project.id)}
                          title={project.status === 'ACTIVE' ? 'Archive Project' : 'Activate Project'}
                        >
                          {project.status === 'ACTIVE' ? <Archive className="w-4 h-4 text-slate-400" /> : <PlayCircle className="w-4 h-4 text-emerald-400" />}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
             <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-6">Create Project</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Project Name</label>
                <input 
                  type="text" 
                  required 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-accent outline-none"
                  value={newProject.name}
                  onChange={e => setNewProject({...newProject, name: e.target.value})}
                />
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-300 mb-1">Workspace</label>
                 <select 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-accent outline-none"
                    value={newProject.workspaceId}
                    onChange={e => setNewProject({...newProject, workspaceId: e.target.value})}
                    disabled={workspaces.length === 0}
                 >
                   {workspaces.length === 0 && <option value="">No workspace available</option>}
                   {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                 </select>
                 {workspaces.length === 0 && (
                  <p className="text-xs text-amber-400 mt-1">Create a workspace first.</p>
                 )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Color Marker</label>
                <div className="flex gap-2">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewProject({...newProject, color: c})}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        newProject.color === c ? "border-white scale-110" : "border-transparent opacity-70 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full mt-2">Create Project</Button>
            </form>
          </div>
        </div>
      )}

      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button
              onClick={() => setIsWorkspaceModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-6">Create Workspace</h3>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Workspace Name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-accent outline-none"
                  value={newWorkspaceName}
                  onChange={e => setNewWorkspaceName(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full mt-2">Create Workspace</Button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};


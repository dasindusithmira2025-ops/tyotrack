import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { Project, Workspace } from '../types';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';
import { Archive, Building2, PlayCircle, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';

export const Workspaces = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');

  const loadData = async () => {
    setLoading(true);
    try {
      const [workspaceList, projectList] = await Promise.all([
        api.getAllWorkspaces(user.companyId),
        api.getAllCompanyProjects(user.companyId)
      ]);
      setWorkspaces(workspaceList);
      setProjects(projectList);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const projectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach((project) => {
      if (!project.workspaceId) return;
      counts[project.workspaceId] = (counts[project.workspaceId] ?? 0) + 1;
    });
    return counts;
  }, [projects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createWorkspace(user.companyId, newName);
      toast.success('Workspace created');
      setNewName('');
      setIsCreateOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create workspace');
    }
  };

  const toggleStatus = async (workspace: Workspace) => {
    try {
      await api.updateWorkspaceStatus(
        workspace.id,
        workspace.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'
      );
      toast.success(
        workspace.status === 'ACTIVE'
          ? 'Workspace archived'
          : 'Workspace activated'
      );
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workspace');
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Workspaces</h1>
            <p className="text-slate-400">Create and manage company workspaces.</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Workspace
          </Button>
        </header>

        <div className="glass-surface panel-lift rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold">
                <tr>
                  <th className="px-6 py-4">Workspace</th>
                  <th className="px-6 py-4 text-center">Projects</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {workspaces.map((workspace) => (
                  <tr key={workspace.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        {workspace.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-300">
                      {projectCounts[workspace.id] ?? 0}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'px-2 py-1 rounded text-xs font-bold border',
                          workspace.status === 'ACTIVE'
                            ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600'
                        )}
                      >
                        {workspace.status ?? 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatus(workspace)}
                        title={workspace.status === 'ACTIVE' ? 'Archive Workspace' : 'Activate Workspace'}
                      >
                        {workspace.status === 'ACTIVE' ? (
                          <Archive className="w-4 h-4 text-slate-400" />
                        ) : (
                          <PlayCircle className="w-4 h-4 text-emerald-400" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && workspaces.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No workspaces found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-6">Create Workspace</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Workspace Name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-accent outline-none"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
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


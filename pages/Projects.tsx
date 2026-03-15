import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { Project, User, Workspace } from '../types';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';
import { Folder, Plus, Archive, PlayCircle, X, Building2, Users, CheckSquare, Square } from 'lucide-react';
import { cn } from '../lib/utils';

export const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [assignmentProject, setAssignmentProject] = useState<Project | null>(null);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const [newProject, setNewProject] = useState({
    name: '',
    workspaceId: '',
    color: '#3b82f6'
  });

  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');

  const loadData = async () => {
    setLoading(true);
    try {
      const [ws, ps, employeeList] = await Promise.all([
        api.getWorkspaces(user.companyId),
        api.getAllCompanyProjects(user.companyId),
        api.getEmployees(user.companyId)
      ]);

      setProjects(ps);
      setWorkspaces(ws);
      setEmployees(employeeList);
      if (ws.length > 0) {
        setNewProject(prev => ({ ...prev, workspaceId: prev.workspaceId || ws[0].id }));
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
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
      await loadData();
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
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create workspace');
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      await api.toggleProjectStatus(id);
      await loadData();
    } catch (e) {
      toast.error('Failed to update project status');
    }
  };

  const openAssignmentModal = async (project: Project) => {
    setAssignmentProject(project);
    setAssignedUserIds([]);
    setIsAssignmentModalOpen(true);
    setAssignmentLoading(true);

    try {
      const userIds = await api.getProjectAssignments(project.id);
      setAssignedUserIds(userIds);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load project assignments');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const toggleAssignedUser = (userId: string) => {
    setAssignedUserIds((prev) => (
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    ));
  };

  const handleSaveAssignments = async () => {
    if (!assignmentProject) {
      return;
    }

    setAssignmentSaving(true);
    try {
      await api.updateProjectAssignments(assignmentProject.id, assignedUserIds);
      toast.success('Project assignments updated');
      setIsAssignmentModalOpen(false);
      setAssignmentProject(null);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save assignments');
    } finally {
      setAssignmentSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Project Management</h1>
            <p className="text-slate-400">Control work categories and employee assignments.</p>
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
                  <th className="px-6 py-4 text-center">Assigned Employees</th>
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
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex min-w-12 justify-center rounded-md border border-cyan-900/40 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-200">
                          {project.assignedEmployeeCount ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'px-2 py-1 rounded text-xs font-bold border',
                          project.status === 'ACTIVE'
                            ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600'
                        )}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1"
                            onClick={() => void openAssignmentModal(project)}
                          >
                            <Users className="w-4 h-4" />
                            Assign
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStatus(project.id)}
                            title={project.status === 'ACTIVE' ? 'Archive Project' : 'Activate Project'}
                          >
                            {project.status === 'ACTIVE' ? <Archive className="w-4 h-4 text-slate-400" /> : <PlayCircle className="w-4 h-4 text-emerald-400" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {projects.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">No projects found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
                  onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Workspace</label>
                <select
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-accent outline-none"
                  value={newProject.workspaceId}
                  onChange={e => setNewProject({ ...newProject, workspaceId: e.target.value })}
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
                      onClick={() => setNewProject({ ...newProject, color: c })}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        newProject.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'
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

      {isAssignmentModalOpen && assignmentProject && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-lg p-6 relative border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button
              onClick={() => setIsAssignmentModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-white">Assign Employees</h3>
              <p className="text-sm text-slate-400 mt-1">
                Only assigned employees will see <span className="text-white font-semibold">{assignmentProject.name}</span> when adding time entries.
              </p>
            </div>

            {assignmentLoading ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                Loading assignments...
              </div>
            ) : employees.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                No employees available for assignment.
              </div>
            ) : (
              <div className="space-y-3">
                {employees.map((employee) => {
                  const selected = assignedUserIds.includes(employee.id);
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => toggleAssignedUser(employee.id)}
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-left transition-colors flex items-center justify-between gap-3',
                        selected
                          ? 'border-cyan-500/50 bg-cyan-500/10'
                          : 'border-slate-700 bg-slate-950 hover:border-slate-500'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{employee.name}</p>
                        <p className="text-sm text-slate-400 truncate">{employee.email}</p>
                      </div>
                      <div className="shrink-0 text-cyan-300">
                        {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-800 pt-4">
              <p className="text-sm text-slate-400">
                Assigned: <span className="font-semibold text-white">{assignedUserIds.length}</span>
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setIsAssignmentModalOpen(false)}>Cancel</Button>
                <Button onClick={() => void handleSaveAssignments()} isLoading={assignmentSaving}>Save Assignments</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

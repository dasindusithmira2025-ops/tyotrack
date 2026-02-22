import React, { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { Project, Workspace, TimeEntry, EntryStatus } from '../types';
import { Button } from '../components/ui/Button';
import { Time24Input } from '../components/ui/Time24Input';
import { toast } from 'sonner';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTime, formatDate, cn, isValid24HourTime, dateKeyFromLocalDate } from '../lib/utils';

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    workspaceId: '',
    projectId: '',
    startTime: '09:00',
    endTime: '17:00',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');

  const projectNameById = useMemo(
    () =>
      allProjects.reduce((acc, project) => {
        acc[project.id] = project.name;
        return acc;
      }, {} as Record<string, string>),
    [allProjects]
  );

  const getProjectName = (projectId: string) => projectNameById[projectId] ?? "Unknown Project";

  // Fetch Data
  useEffect(() => {
    const load = async () => {
      const w = await api.getWorkspaces(user.companyId);
      const allCompanyProjects = await api.getAllCompanyProjects(user.companyId);
      setWorkspaces(w);
      setAllProjects(allCompanyProjects);
      // Pre-fetch first workspace projects for simplicity
      if (w.length > 0) {
        const p = await api.getProjects(w[0].id);
        setProjects(p);
        setFormData(prev => ({ ...prev, workspaceId: w[0].id, projectId: p[0]?.id || '' }));
      }
      const e = await api.getTimeEntries(user.id, user.companyId);
      setEntries(e);
    };
    load();
  }, []);

  const handleWorkspaceChange = async (wid: string) => {
    setFormData(prev => ({ ...prev, workspaceId: wid, projectId: '' }));
    const p = await api.getProjects(wid);
    setProjects(p);
    setFormData(prev => ({ ...prev, projectId: p[0]?.id || '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    setIsSubmitting(true);
    try {
      if (!formData.workspaceId || !formData.projectId) {
        throw new Error("Please select workspace and project.");
      }

      if (!isValid24HourTime(formData.startTime) || !isValid24HourTime(formData.endTime)) {
        throw new Error("Time must be in 24-hour format (HH:mm).");
      }

      if (formData.startTime === formData.endTime) {
        throw new Error("End time must be after start time.");
      }

      const selectedDateKey = dateKeyFromLocalDate(selectedDate);
      await api.createTimeEntry(
        user.id,
        formData.workspaceId,
        formData.projectId,
        selectedDateKey,
        formData.startTime,
        formData.endTime,
        formData.notes
      );
      toast.success('Time entry created!');
      setIsModalOpen(false);
      
      // Refresh
      const newEntries = await api.getTimeEntries(user.id, user.companyId);
      setEntries(newEntries);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calendar Logic
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 = Sun
  
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const openModal = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => changeMonth(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={() => changeMonth(1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-800 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="bg-slate-900 p-2 text-center text-xs font-semibold text-slate-400 uppercase">
            {d}
          </div>
        ))}
        {days.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="bg-slate-900 h-32 md:h-40" />;
          
          const dateStr = dateKeyFromLocalDate(date);
          const dayEntries = entries.filter(e => e.date === dateStr);
          const totalHours = dayEntries.reduce((sum, entry) => sum + entry.totalHours, 0);
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div 
              key={idx} 
              className={cn(
                "bg-slate-900 h-32 md:h-40 p-2 border-t border-transparent hover:bg-slate-800 transition-colors cursor-pointer group flex flex-col",
                isToday && "bg-blue-900/20"
              )}
              onDoubleClick={() => openModal(date)}
            >
              <div className="flex justify-between items-start">
                <span className={cn(
                  "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                  isToday ? "bg-accent text-white" : "text-slate-400"
                )}>
                  {date.getDate()}
                </span>
                {dayEntries.length > 0 && (
                  <span className={cn(
                    "text-[11px] font-extrabold",
                    dayEntries.some((entry) => entry.status === EntryStatus.PENDING) ? "text-amber-300" : "text-emerald-300"
                  )}>
                    {totalHours.toFixed(1)}h
                  </span>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); openModal(date); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                >
                  <Plus className="w-3 h-3 text-slate-400" />
                </button>
              </div>
              
              <div className="mt-1 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                {dayEntries.map(e => (
                  <div key={e.id} className="text-xs bg-blue-900/40 text-blue-200 p-1 rounded truncate border-l-2 border-blue-500">
                    {formatTime(e.startTime)} - {getProjectName(e.projectId)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Entry Modal */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200 border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-bold mb-1 text-white">Add Time Entry</h3>
            <p className="text-sm text-slate-400 mb-6">{formatDate(selectedDate)} (24h format)</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Workspace</label>
                <select 
                  className="w-full rounded-lg border-slate-700 bg-slate-950 border p-2 text-sm focus:ring-2 focus:ring-accent text-slate-200"
                  value={formData.workspaceId}
                  onChange={(e) => handleWorkspaceChange(e.target.value)}
                  required
                >
                  <option value="">Select Workspace</option>
                  {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Project</label>
                <select 
                  className="w-full rounded-lg border-slate-700 bg-slate-950 border p-2 text-sm focus:ring-2 focus:ring-accent text-slate-200"
                  value={formData.projectId}
                  onChange={(e) => setFormData({...formData, projectId: e.target.value})}
                  required
                >
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Start</label>
                  <Time24Input
                    className="w-full rounded-lg border-slate-700 bg-slate-950 border p-2 text-sm text-slate-200"
                    value={formData.startTime}
                    onChange={(value) => setFormData({...formData, startTime: value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">End</label>
                  <Time24Input
                    className="w-full rounded-lg border-slate-700 bg-slate-950 border p-2 text-sm text-slate-200"
                    value={formData.endTime}
                    onChange={(value) => setFormData({...formData, endTime: value})}
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Ends next day if &lt; Start</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes (Optional)</label>
                <textarea 
                  className="w-full rounded-lg border-slate-700 bg-slate-950 border p-2 text-sm text-slate-200"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" isLoading={isSubmitting}>Save Entry</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};


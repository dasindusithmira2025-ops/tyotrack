import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { TimeEntry, Project, User, EntryStatus, UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Download, Calendar, Briefcase, Filter, Moon, Sun } from 'lucide-react';
import { formatDate, formatTime, formatDateTime24, cn, dateKeyFromLocalDate } from '../lib/utils';
import { toast } from 'sonner';
import { buildCsv, downloadCsv } from '../lib/csv';

export const DetailedReports = () => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(dateKeyFromLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [endDate, setEndDate] = useState(dateKeyFromLocalDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Since this page is now restricted to Employees, we only fetch THEIR entries.
        // If an Admin somehow accessed this, they would only see their own entries too (if any).
        const [allEntries, allProjects] = await Promise.all([
          api.getTimeEntries(user.id, user.companyId),
          api.getAllCompanyProjects(user.companyId)
        ]);

        setProjects(allProjects);
        setEntries(allEntries);
      } catch (err) {
        toast.error('Failed to load report data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.companyId, user.id]);

  // Filtering Logic
  const filteredEntries = entries.filter(entry => {
    const matchesDate = entry.date >= startDate && entry.date <= endDate;
    const matchesProject = selectedProject ? entry.projectId === selectedProject : true; 
    const matchesStatus = selectedStatus ? entry.status === selectedStatus : true;
    
    return matchesDate && matchesProject && matchesStatus;
  }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || id;

  const handleExport = () => {
    if (filteredEntries.length === 0) {
      toast.error('No rows to export');
      return;
    }

    const headers = [
      'Date',
      'Project',
      'Start Time',
      'End Time',
      'Total Hours',
      'Evening Hours',
      'Night Hours',
      'Status',
      'Notes'
    ];

    const rows = filteredEntries.map((entry) => [
      entry.date,
      getProjectName(entry.projectId),
      formatTime(entry.startTime),
      formatTime(entry.endTime),
      entry.totalHours.toFixed(2),
      entry.eveningHours.toFixed(2),
      entry.nightHours.toFixed(2),
      entry.status,
      entry.notes ?? ''
    ]);

    const content = buildCsv(headers, rows);
    const filename = `detailed-report_${startDate}_to_${endDate}.csv`;
    downloadCsv(filename, content);
    toast.success(`Exported ${filteredEntries.length} rows to ${filename}`);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">My Detailed Report</h1>
            <p className="text-slate-400">View and export your time entry history.</p>
          </div>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </header>

        {/* Filters Bar */}
        <div className="glass-surface panel-lift rounded-xl p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Date Range</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                   <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
                   <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-2 text-sm text-white focus:ring-2 focus:ring-accent outline-none"
                   />
                </div>
                <span className="text-slate-600 text-center">-</span>
                <div className="relative flex-1">
                   <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
                   <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-2 text-sm text-white focus:ring-2 focus:ring-accent outline-none"
                   />
                </div>
              </div>
            </div>

             {/* Project Filter */}
             <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Project</label>
              <div className="relative">
                <Briefcase className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-2 text-sm text-white focus:ring-2 focus:ring-accent outline-none appearance-none"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">All Projects</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

             {/* Status Filter */}
             <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
              <div className="relative">
                <Filter className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-2 text-sm text-white focus:ring-2 focus:ring-accent outline-none appearance-none"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value={EntryStatus.APPROVED}>Approved</option>
                  <option value={EntryStatus.PENDING}>Pending</option>
                  <option value={EntryStatus.REJECTED}>Rejected</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="glass-surface panel-lift rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Time Interval</th>
                  <th className="px-6 py-4 text-right">Total Hrs</th>
                  <th className="px-6 py-4 text-center">Breakdown</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-400">{formatDate(entry.date)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-900/20 text-blue-300 border border-blue-900/30">
                        {getProjectName(entry.projectId)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">{entry.totalHours.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                         {entry.eveningHours > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-900/20 text-orange-400 border border-orange-900/30 flex items-center gap-1" title="Evening Hours">
                              <Sun className="w-3 h-3" /> {entry.eveningHours}
                            </span>
                         )}
                         {entry.nightHours > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-900/20 text-indigo-400 border border-indigo-900/30 flex items-center gap-1" title="Night Hours">
                              <Moon className="w-3 h-3" /> {entry.nightHours}
                            </span>
                         )}
                         {entry.eveningHours === 0 && entry.nightHours === 0 && <span className="text-slate-600 text-xs">-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <span className={cn(
                          "px-2 py-1 rounded text-xs font-bold border",
                          entry.status === EntryStatus.APPROVED ? "bg-emerald-900/20 text-emerald-400 border-emerald-900/30" :
                          entry.status === EntryStatus.REJECTED ? "bg-red-900/20 text-red-400 border-red-900/30" :
                          "bg-amber-900/20 text-amber-400 border-amber-900/30"
                        )}>
                          {entry.status}
                        </span>
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No entries found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-slate-800/30 p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <span>Showing {filteredEntries.length} entries</span>
            <span>Generated at {formatDateTime24(new Date())}</span>
          </div>
        </div>
      </div>
    </Layout>
  );
};


import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { TimeEntry, Project, Workspace, EntryStatus, User } from '../types';
import { cn, formatDate, formatTime, dateKeyFromLocalDate } from '../lib/utils';
import { Calendar, Table2, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';
import { buildCsv, downloadCsv } from '../lib/csv';

export const Reports = () => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  
  // Date Filters (Default to this month)
  const today = new Date();
  const firstDay = dateKeyFromLocalDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDay = dateKeyFromLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  
  const [dateRange, setDateRange] = useState({ start: firstDay, end: lastDay });

  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [allEntries, ws, ps, empList] = await Promise.all([
          api.getTimeEntries(undefined, user.companyId),
          api.getWorkspaces(user.companyId),
          api.getAllCompanyProjects(user.companyId),
          api.getEmployees(user.companyId)
        ]);

        // Create Employee Map
        const empMap = empList.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {} as Record<string, User>);
        setEmployees(empMap);

        // Filter by date range AND Approved status for accurate reporting
        const filtered = allEntries.filter(e => 
          e.date >= dateRange.start && 
          e.date <= dateRange.end &&
          e.status === EntryStatus.APPROVED // Strict Check for Reports
        ).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        
        setEntries(filtered);
        setProjects(ps);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [dateRange, user.companyId]);

  const grandTotal = entries.reduce((sum, item) => sum + item.totalHours, 0);

  const handleExport = () => {
    if (entries.length === 0) {
      toast.error('No rows to export');
      return;
    }

    const headers = [
      'Date',
      'Employee',
      'Project',
      'Start Time',
      'End Time',
      'Total Hours',
      'Evening Hours',
      'Night Hours',
      'Status',
      'Notes'
    ];

    const rows = entries.map((entry) => {
      const employeeName = employees[entry.userId]?.name || 'Unknown';
      const projectName = projects.find((project) => project.id === entry.projectId)?.name || entry.projectId;

      return [
        entry.date,
        employeeName,
        projectName,
        formatTime(entry.startTime),
        formatTime(entry.endTime),
        entry.totalHours.toFixed(2),
        entry.eveningHours.toFixed(2),
        entry.nightHours.toFixed(2),
        entry.status,
        entry.notes ?? ''
      ];
    });

    const content = buildCsv(headers, rows);
    const filename = `approved-report_${dateRange.start}_to_${dateRange.end}.csv`;
    downloadCsv(filename, content);
    toast.success(`Exported ${entries.length} rows to ${filename}`);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Reports</h1>
            <p className="text-slate-400">Detailed view of <span className="text-emerald-400 font-medium">approved</span> time entries.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleExport} variant="outline" className="gap-2 h-10">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 glass-surface panel-lift rounded-lg px-3 py-1.5 h-auto sm:h-10">
               <Calendar className="w-4 h-4 text-slate-400" />
               <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent text-sm text-white focus:outline-none w-full sm:w-28"
               />
               <span className="text-slate-500">-</span>
               <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent text-sm text-white focus:outline-none w-full sm:w-28"
               />
            </div>
          </div>
        </header>

        {/* Totals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm">Total Approved Hours</p>
              <p className="text-3xl font-bold text-white mt-2">{grandTotal.toFixed(2)}</p>
           </div>
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm">Approved Evening</p>
              <p className="text-3xl font-bold text-orange-400 mt-2">
                {entries.reduce((sum, i) => sum + i.eveningHours, 0).toFixed(2)}
              </p>
           </div>
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm">Approved Night</p>
              <p className="text-3xl font-bold text-indigo-400 mt-2">
                {entries.reduce((sum, i) => sum + i.nightHours, 0).toFixed(2)}
              </p>
           </div>
        </div>

        {/* --- DETAILED VIEW (Single View) --- */}
        <div className="glass-surface panel-lift rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4 font-bold text-emerald-400">Time In</th>
                  <th className="px-6 py-4 font-bold text-slate-200">Time Out</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {entries.map((entry) => {
                  const empName = employees[entry.userId]?.name || 'Unknown';
                  const projectName = projects.find(p => p.id === entry.projectId)?.name || entry.projectId;
                  
                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-400 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="px-6 py-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs">
                            {empName[0]}
                          </div>
                          {empName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/20 text-blue-300 border border-blue-900/30">
                          {projectName}
                        </span>
                      </td>
                      {/* Time In Column */}
                      <td className="px-6 py-4 font-mono text-emerald-400 font-medium">
                         {formatTime(entry.startTime)}
                      </td>
                      {/* Time Out Column */}
                      <td className="px-6 py-4 font-mono text-slate-300">
                         {formatTime(entry.endTime)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-white bg-slate-800/10">
                        {entry.totalHours.toFixed(2)}h
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <Table2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      No approved entries found for the selected range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
           <div className="bg-slate-800/30 p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <span>Showing {entries.length} records</span>
            <span>Sorted by latest entry</span>
          </div>
        </div>

      </div>
    </Layout>
  );
};
    

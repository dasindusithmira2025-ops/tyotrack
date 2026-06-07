
import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { EmployeeHoursReportRow } from '../types';
import { formatDate, dateKeyFromLocalDate } from '../lib/utils';
import { Calendar, Table2, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from 'sonner';

export const Reports = () => {
  const [rows, setRows] = useState<EmployeeHoursReportRow[]>([]);
  const [totals, setTotals] = useState({ totalHours: 0, eveningHours: 0, nightHours: 0 });
  const [loading, setLoading] = useState(true);
  
  // Date Filters (Default to the last 30 days so recent seeded/demo rows stay visible)
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - 30);
  const firstDay = dateKeyFromLocalDate(defaultStart);
  const lastDay = dateKeyFromLocalDate(today);
  
  const [dateRange, setDateRange] = useState({ start: firstDay, end: lastDay });

  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const report = await api.getEmployeeHoursReport(user.companyId, dateRange.start, dateRange.end);
        setRows(report.rows);
        setTotals(report.totals);
      } catch (e) {
        console.error(e);
        setRows([]);
        setTotals({ totalHours: 0, eveningHours: 0, nightHours: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [dateRange, user.companyId]);

  const handleExport = async () => {
    if (rows.length === 0) {
      toast.error('No rows to export');
      return;
    }

    try {
      const { blob, filename } = await api.getEmployeeHoursReportExcel(
        user.companyId,
        dateRange.start,
        dateRange.end
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} rows to ${filename}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export report');
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Reports</h1>
            <p className="text-slate-400">Daily employee summary of <span className="text-emerald-400 font-medium">approved</span> time entries.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleExport} variant="outline" className="gap-2 h-10">
              <Download className="w-4 h-4" />
              Export Excel
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
              <p className="text-3xl font-bold text-white mt-2">{totals.totalHours.toFixed(2)}</p>
           </div>
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm">Approved Evening</p>
              <p className="text-3xl font-bold text-orange-400 mt-2">
                {totals.eveningHours.toFixed(2)}
              </p>
           </div>
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm">Approved Night</p>
              <p className="text-3xl font-bold text-indigo-400 mt-2">
                {totals.nightHours.toFixed(2)}
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
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Evening</th>
                  <th className="px-6 py-4 text-right">Night</th>
                  <th className="px-6 py-4 text-right">Total Hours (Summed)</th>
                  <th className="px-6 py-4 text-right">Evening Hours (Summed)</th>
                  <th className="px-6 py-4 text-right">Night Hours (Summed)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {rows.map((row) => {
                  const empName = row.user?.name || 'Unknown Employee';
                  
                  return (
                    <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-400 whitespace-nowrap">{row.date ? formatDate(row.date) : '-'}</td>
                      <td className="px-6 py-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs">
                            {empName[0] || '?'}
                          </div>
                          {empName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {row.locationName}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-white bg-slate-800/10">
                        {row.totalHours.toFixed(2)}h
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-orange-300">
                        {row.eveningHours.toFixed(2)}h
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-indigo-300">
                        {row.nightHours.toFixed(2)}h
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-300 bg-slate-800/10">
                        {row.totalHoursSummed.toFixed(2)}h
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-orange-200">
                        {row.eveningHoursSummed.toFixed(2)}h
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-indigo-200">
                        {row.nightHoursSummed.toFixed(2)}h
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                      <Table2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      No approved entries found for the selected range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
           <div className="bg-slate-800/30 p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <span>Showing {rows.length} daily location summaries</span>
            <span>Summed columns include all locations for the employee and day</span>
          </div>
        </div>

      </div>
    </Layout>
  );
};
    

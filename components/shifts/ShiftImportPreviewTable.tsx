import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ShiftImportPreviewResult } from '../../types/shifts';
import { Button } from '../ui/Button';

interface ShiftImportPreviewTableProps {
  preview: ShiftImportPreviewResult | null;
  onConfirm: () => Promise<void> | void;
  onClear: () => void;
  isConfirming?: boolean;
}

export const ShiftImportPreviewTable: React.FC<ShiftImportPreviewTableProps> = ({ preview, onConfirm, onClear, isConfirming }) => {
  if (!preview) return null;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Import Preview</h3>
          <p className="text-sm text-slate-400">{preview.fileName} • {preview.validCount} valid rows • {preview.errorCount} errors</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClear}>Clear</Button>
          <Button type="button" onClick={() => void onConfirm()} isLoading={isConfirming} disabled={preview.validCount === 0}>
            Confirm Import
          </Button>
        </div>
      </div>

      {preview.rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {preview.rows.map((row) => (
                <tr key={`${row.sourceRowNumber}-${row.workerId}`}>
                  <td className="px-4 py-3">{row.sourceRowNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{row.workerName}</p>
                    <p className="text-xs text-slate-500">{row.workerEmail}</p>
                  </td>
                  <td className="px-4 py-3">{row.date} • {row.dayOfWeek}</td>
                  <td className="px-4 py-3">{row.isDayOff ? 'Day Off' : row.location || 'Unassigned'}</td>
                  <td className="px-4 py-3">{row.isDayOff ? 'Free' : `${row.startTime} - ${row.endTime}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview.errors.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <div className="flex items-center gap-2 text-rose-300 mb-3">
            <AlertCircle className="w-4 h-4" />
            <h4 className="font-semibold">Import Errors</h4>
          </div>
          <div className="space-y-2 text-sm text-slate-200">
            {preview.errors.map((error) => (
              <div key={`${error.rowNumber}-${error.code}`} className="rounded-lg border border-rose-500/20 bg-slate-950/40 p-3">
                <p className="font-semibold text-white">Row {error.rowNumber} • {error.code}</p>
                <p className="text-slate-400 mt-1">{error.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {preview.errorCount === 0 && preview.validCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200">
          <CheckCircle2 className="w-4 h-4" />
          All uploaded rows are valid and ready to import.
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { ShiftRecord } from '../../types/shifts';
import { Button } from '../ui/Button';

interface ShiftTableProps {
  shifts: ShiftRecord[];
  onEdit: (shift: ShiftRecord) => void;
  onDelete: (shift: ShiftRecord) => Promise<void> | void;
}

export const ShiftTable: React.FC<ShiftTableProps> = ({ shifts, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/30">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Week Range</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Reminder</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-200">
          {shifts.map((shift) => (
            <tr key={shift.id}>
              <td className="px-4 py-3">
                <p className="font-semibold text-white">{shift.workerName}</p>
                <p className="text-xs text-slate-500">{shift.workerEmail}</p>
              </td>
              <td className="px-4 py-3">{shift.date} • {shift.dayOfWeek}</td>
              <td className="px-4 py-3">{shift.weekRange}</td>
              <td className="px-4 py-3">{shift.isDayOff ? 'Day Off' : shift.location || 'Unassigned'}</td>
              <td className="px-4 py-3">{shift.isDayOff ? 'Free' : `${shift.startTime} - ${shift.endTime}`}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${shift.notificationSent ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/60 text-slate-300'}`}>
                  {shift.notificationSent ? 'Sent' : 'Pending'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(shift)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void onDelete(shift)}>
                    <Trash2 className="w-4 h-4 text-rose-300" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {shifts.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No shifts found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

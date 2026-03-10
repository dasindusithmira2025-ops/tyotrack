import React from 'react';
import type { ShiftRecord } from '../../types/shifts';

interface ShiftUpcomingListProps {
  title: string;
  shifts: ShiftRecord[];
}

export const ShiftUpcomingList: React.FC<ShiftUpcomingListProps> = ({ title, shifts }) => {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-sm text-slate-400">Read-only shift view for the selected week.</p>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">{shifts.length} items</span>
      </div>

      <div className="space-y-3">
        {shifts.map((shift) => (
          <article key={shift.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">{shift.dayOfWeek}, {shift.date}</p>
                <p className="text-xs text-slate-500">{shift.weekRange}</p>
              </div>
              <div className="text-sm text-slate-200 font-semibold">
                {shift.isDayOff ? 'Day Off' : `${shift.startTime} - ${shift.endTime}`}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 ${shift.isDayOff ? 'bg-amber-500/15 text-amber-200' : 'bg-cyan-500/15 text-cyan-200'}`}>
                {shift.isDayOff ? 'Day Off' : shift.location || 'Unassigned location'}
              </span>
              <span className={`rounded-full px-2.5 py-1 ${shift.notificationSent ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>
                {shift.notificationSent ? 'Reminder Sent' : 'Reminder Pending'}
              </span>
            </div>
          </article>
        ))}
        {shifts.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-500">No shifts scheduled for this week.</div>}
      </div>
    </section>
  );
};

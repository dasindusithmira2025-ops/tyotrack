import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import type { User } from '../../types';
import type { ShiftMutationInput, ShiftRecord } from '../../types/shifts';

interface ShiftManualFormProps {
  employees: User[];
  initialValue?: Partial<ShiftRecord>;
  onSubmit: (input: ShiftMutationInput) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

function deriveWeekRange(date: string): string {
  if (!date) return '';
  const ref = new Date(`${date}T00:00:00`);
  const day = ref.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const start = new Date(ref);
  start.setDate(ref.getDate() + offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const format = (value: Date) => value.toLocaleDateString('en-GB');
  return `${format(start)} - ${format(end)}`;
}

function deriveDayOfWeek(date: string): string {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
}

export const ShiftManualForm: React.FC<ShiftManualFormProps> = ({
  employees,
  initialValue,
  onSubmit,
  onCancel,
  submitLabel = 'Save Shift',
  isSubmitting
}) => {
  const [form, setForm] = useState<ShiftMutationInput>({
    workerId: '',
    date: '',
    weekRange: '',
    dayOfWeek: '',
    location: '',
    startTime: '09:00',
    endTime: '17:00',
    isDayOff: false
  });

  useEffect(() => {
    if (!initialValue) return;
    setForm({
      workerId: initialValue.workerId || '',
      date: initialValue.date || '',
      weekRange: initialValue.weekRange || '',
      dayOfWeek: initialValue.dayOfWeek || '',
      location: initialValue.location || '',
      startTime: initialValue.startTime || '09:00',
      endTime: initialValue.endTime || '17:00',
      isDayOff: Boolean(initialValue.isDayOff)
    });
  }, [initialValue]);

  useEffect(() => {
    if (!form.date) return;
    setForm((current) => ({
      ...current,
      dayOfWeek: deriveDayOfWeek(form.date),
      weekRange: deriveWeekRange(form.date)
    }));
  }, [form.date]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === form.workerId),
    [employees, form.workerId]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      location: form.location?.trim() || null,
      startTime: form.isDayOff ? null : form.startTime || null,
      endTime: form.isDayOff ? null : form.endTime || null
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Worker</label>
        <select
          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-cyan-400 outline-none"
          value={form.workerId}
          onChange={(event) => setForm((current) => ({ ...current, workerId: event.target.value }))}
          required
        >
          <option value="">Select employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} ({employee.email})
            </option>
          ))}
        </select>
        {selectedEmployee && <p className="text-xs text-slate-500 mt-1">{selectedEmployee.email}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Exact Date</label>
          <input
            type="date"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-cyan-400 outline-none"
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Day Of Week</label>
          <input
            type="text"
            value={form.dayOfWeek || ''}
            readOnly
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-slate-300"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Week Range</label>
        <input
          type="text"
          value={form.weekRange || ''}
          readOnly
          className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-slate-300"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
        <input
          type="text"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-cyan-400 outline-none"
          value={form.location || ''}
          onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
          placeholder="Main Office"
        />
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={Boolean(form.isDayOff)}
          onChange={(event) => setForm((current) => ({ ...current, isDayOff: event.target.checked }))}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400"
        />
        Mark as Day Off
      </label>

      {!form.isDayOff && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Start Time</label>
            <input
              type="time"
              value={form.startTime || ''}
              onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-cyan-400 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">End Time</label>
            <input
              type="time"
              value={form.endTime || ''}
              onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-cyan-400 outline-none"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">If end time is earlier than start, it will be treated as overnight.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="flex-1" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

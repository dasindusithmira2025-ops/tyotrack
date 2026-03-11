import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { ShiftManualForm } from '../components/shifts/ShiftManualForm';
import { ShiftUploadDropzone } from '../components/shifts/ShiftUploadDropzone';
import { ShiftImportPreviewTable } from '../components/shifts/ShiftImportPreviewTable';
import { ShiftTable } from '../components/shifts/ShiftTable';
import { ShiftEditModal } from '../components/shifts/ShiftEditModal';
import { api } from '../services/api';
import { shiftsApi } from '../services/shiftsApi';
import type { ShiftImportPreviewResult, ShiftMutationInput, ShiftRecord } from '../types/shifts';
import type { User } from '../types';

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getLocalWeekDates(referenceDate: string) {
  const input = new Date(`${referenceDate}T00:00:00`);
  const base = startOfLocalDay(input);
  const day = base.getDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(base);
  start.setDate(base.getDate() + offsetToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    startDate: formatDateKey(start),
    endDate: formatDateKey(end)
  };
}

export const Schedules = () => {
  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');
  const [employees, setEmployees] = useState<User[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [preview, setPreview] = useState<ShiftImportPreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ShiftRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(true);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [weekAnchorDate, setWeekAnchorDate] = useState(formatDateKey(new Date()));

  const loadData = async () => {
    setLoading(true);
    try {
      const [employeeList, shiftList, reminderSettings] = await Promise.all([
        api.getEmployees(user.companyId),
        shiftsApi.list({ tenantId: user.companyId }),
        shiftsApi.getReminderSettings(user.companyId)
      ]);
      setEmployees(employeeList);
      setShifts(shiftList.filter((shift) => shift.status === 'ACTIVE'));
      setEmailRemindersEnabled(reminderSettings.emailRemindersEnabled);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!employees.length) {
      setSelectedWorkerId('');
      return;
    }

    if (!selectedWorkerId || !employees.some((employee) => employee.id === selectedWorkerId)) {
      setSelectedWorkerId(employees[0].id);
    }
  }, [employees, selectedWorkerId]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedWorkerId) ?? null,
    [employees, selectedWorkerId]
  );

  const weekDates = useMemo(() => getLocalWeekDates(weekAnchorDate), [weekAnchorDate]);

  const sortedShifts = useMemo(
    () => [...shifts].sort((a, b) => `${a.date}${a.startTime || ''}`.localeCompare(`${b.date}${b.startTime || ''}`)),
    [shifts]
  );

  const handleCreate = async (input: ShiftMutationInput) => {
    setSubmitting(true);
    try {
      await shiftsApi.create({ ...input, tenantId: user.companyId });
      toast.success('Shift created');
      setShowCreate(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (input: ShiftMutationInput) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      await shiftsApi.update(editing.id, input);
      toast.success('Shift updated');
      setEditing(null);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (shift: ShiftRecord) => {
    const confirmed = window.confirm(`Soft-delete the shift for ${shift.workerName} on ${shift.date}?`);
    if (!confirmed) return;
    try {
      await shiftsApi.remove(shift.id);
      toast.success('Shift deleted');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete shift');
    }
  };

  const handleFileSelected = async (file: File) => {
    setUploading(true);
    try {
      const result = await shiftsApi.previewImport(file, user.companyId);
      setPreview(result);
      toast.success('Import preview ready');
    } catch (error: any) {
      toast.error(error.message || 'Failed to preview import');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setConfirmingImport(true);
    try {
      await shiftsApi.confirmImport(preview.rows, preview.fileName, user.companyId);
      toast.success('Shifts imported');
      setPreview(null);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to import shifts');
    } finally {
      setConfirmingImport(false);
    }
  };

  const handleClearScheduleWeek = async () => {
    if (!selectedEmployee) {
      toast.error('Select an employee first');
      return;
    }

    const confirmed = window.confirm(
      `Clear all shifts for ${selectedEmployee.name} between ${weekDates.startDate} and ${weekDates.endDate}? This action soft-deletes matching shifts.`
    );
    if (!confirmed) return;

    setBulkDeleteBusy(true);
    try {
      const result = await shiftsApi.bulkDelete({
        tenantId: user.companyId,
        workerId: selectedEmployee.id,
        startDate: weekDates.startDate,
        endDate: weekDates.endDate
      });
      toast.success(`${result.affectedCount} shift(s) cleared for the selected week`);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear schedule for selected week');
    } finally {
      setBulkDeleteBusy(false);
    }
  };

  const handleToggleEmailReminders = async () => {
    setSettingsBusy(true);
    const nextValue = !emailRemindersEnabled;
    try {
      const settings = await shiftsApi.updateReminderSettings(nextValue, user.companyId);
      setEmailRemindersEnabled(settings.emailRemindersEnabled);
      toast.success(settings.emailRemindersEnabled ? '1-hour email reminders enabled' : '1-hour email reminders disabled');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update reminder setting');
    } finally {
      setSettingsBusy(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Weekly Shift Scheduling</h1>
            <p className="text-slate-400">Create, import, edit, and soft-delete employee shifts without touching the existing time-entry flow.</p>
          </div>
          <Button onClick={() => setShowCreate((value) => !value)} className="gap-2 self-start lg:self-auto">
            <Plus className="w-4 h-4" />
            {showCreate ? 'Hide Manual Form' : 'Manual Entry'}
          </Button>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
            <div>
              <p className="text-sm font-semibold text-white mb-2">Enable 1-Hour Email Reminders</p>
              <button
                type="button"
                onClick={() => void handleToggleEmailReminders()}
                disabled={settingsBusy}
                className={`relative inline-flex h-10 w-20 items-center rounded-full border transition-colors ${
                  emailRemindersEnabled ? 'border-emerald-400/40 bg-emerald-500/30' : 'border-slate-700 bg-slate-800'
                } ${settingsBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                aria-pressed={emailRemindersEnabled}
              >
                <span
                  className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform ${
                    emailRemindersEnabled ? 'translate-x-10' : 'translate-x-1'
                  }`}
                />
              </button>
              <p className="text-xs text-slate-400 mt-2">
                {emailRemindersEnabled ? 'Email reminders are active for due shifts.' : 'Email reminders are globally disabled.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Employee</label>
              <select
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-cyan-400 outline-none"
                value={selectedWorkerId}
                onChange={(event) => setSelectedWorkerId(event.target.value)}
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Week Anchor Date</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={weekAnchorDate}
                  onChange={(event) => setWeekAnchorDate(event.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-cyan-400 outline-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => void handleClearScheduleWeek()}
                  isLoading={bulkDeleteBusy}
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Week
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">Clears {weekDates.startDate} to {weekDates.endDate} for selected employee.</p>
            </div>
          </div>
        </section>

        {showCreate && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-5">
            <h2 className="text-lg font-bold text-white mb-4">Create Shift</h2>
            <ShiftManualForm employees={employees} onSubmit={handleCreate} submitLabel="Create Shift" isSubmitting={submitting} />
          </section>
        )}

        <ShiftUploadDropzone onFileSelected={handleFileSelected} isUploading={uploading} />
        <ShiftImportPreviewTable preview={preview} onConfirm={handleConfirmImport} onClear={() => setPreview(null)} isConfirming={confirmingImport} />

        <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-cyan-500/15 p-3 text-cyan-300">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">All Shifts</h2>
              <p className="text-sm text-slate-400">Full company schedule, including imported and manual records.</p>
            </div>
          </div>
          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">Loading shifts...</div>
          ) : (
            <ShiftTable shifts={sortedShifts} onEdit={setEditing} onDelete={handleDelete} />
          )}
        </section>
      </div>

      <ShiftEditModal shift={editing} employees={employees} isSubmitting={submitting} onClose={() => setEditing(null)} onSubmit={handleUpdate} />
    </Layout>
  );
};

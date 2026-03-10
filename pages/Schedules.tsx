import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, Plus } from 'lucide-react';
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [employeeList, shiftList] = await Promise.all([
        api.getEmployees(user.companyId),
        shiftsApi.list({ tenantId: user.companyId })
      ]);
      setEmployees(employeeList);
      setShifts(shiftList.filter((shift) => shift.status === 'ACTIVE'));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

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

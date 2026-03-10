import React from 'react';
import { X } from 'lucide-react';
import type { User } from '../../types';
import type { ShiftRecord, ShiftMutationInput } from '../../types/shifts';
import { ShiftManualForm } from './ShiftManualForm';

interface ShiftEditModalProps {
  shift: ShiftRecord | null;
  employees: User[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (input: ShiftMutationInput) => Promise<void> | void;
}

export const ShiftEditModal: React.FC<ShiftEditModalProps> = ({ shift, employees, isSubmitting, onClose, onSubmit }) => {
  if (!shift) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-xl p-6 relative border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300" aria-label="Close edit modal">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold text-white mb-1">Edit Shift</h3>
        <p className="text-sm text-slate-400 mb-6">Update the selected shift without affecting the rest of the schedule.</p>
        <ShiftManualForm
          employees={employees}
          initialValue={shift}
          onSubmit={onSubmit}
          onCancel={onClose}
          submitLabel="Save Changes"
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
};

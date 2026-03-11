import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { ShiftUpcomingList } from '../components/shifts/ShiftUpcomingList';
import { shiftsApi } from '../services/shiftsApi';
import type { ShiftRecord } from '../types/shifts';
import { enableBrowserNotifications } from '../services/browserNotifications';

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalShiftDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getLocalWeekRange(reference: Date, weekOffset = 0) {
  const base = startOfLocalDay(reference);
  const day = base.getDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(base);
  start.setDate(base.getDate() + offsetToMonday + weekOffset * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start, end };
}

function isWithinRange(target: Date, range: { start: Date; end: Date }) {
  return target >= range.start && target <= range.end;
}

export const MyShifts = () => {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationBusy, setNotificationBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const currentRange = getLocalWeekRange(new Date());
        const nextRange = getLocalWeekRange(new Date(), 1);
        const upcoming = await shiftsApi.list({
          startDate: formatDateKey(currentRange.start),
          endDate: formatDateKey(nextRange.end)
        });
        setShifts(upcoming);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load shifts');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const currentWeekRange = useMemo(() => getLocalWeekRange(new Date()), []);
  const nextWeekRange = useMemo(() => getLocalWeekRange(new Date(), 1), []);

  const currentWeek = useMemo(
    () =>
      shifts.filter((shift) => {
        const shiftDate = parseLocalShiftDate(shift.date);
        return isWithinRange(shiftDate, currentWeekRange);
      }),
    [shifts, currentWeekRange]
  );

  const nextWeek = useMemo(
    () =>
      shifts.filter((shift) => {
        const shiftDate = parseLocalShiftDate(shift.date);
        return isWithinRange(shiftDate, nextWeekRange);
      }),
    [shifts, nextWeekRange]
  );

  const handleEnableNotifications = async () => {
    setNotificationBusy(true);
    try {
      const outcome = await enableBrowserNotifications();
      toast.success(outcome);
    } catch (error: any) {
      toast.error(error.message || 'Failed to enable browser notifications');
    } finally {
      setNotificationBusy(false);
    }
  };

  const browserPermission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">My Upcoming Shifts</h1>
            <p className="text-slate-400">Read-only view of the current week and next week, including explicit Day Off entries.</p>
          </div>
          <Button type="button" variant="outline" className="gap-2 self-start lg:self-auto" onClick={() => void handleEnableNotifications()} isLoading={notificationBusy}>
            {browserPermission === 'granted' ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            Browser Notification
          </Button>
        </header>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
          Browser notifications are optional. If you deny permission, the scheduling pages still work normally and reminder emails continue independently.
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-500">Loading upcoming shifts...</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ShiftUpcomingList title="Current Week" shifts={currentWeek} />
            <ShiftUpcomingList title="Next Week" shifts={nextWeek} />
          </div>
        )}
      </div>
    </Layout>
  );
};


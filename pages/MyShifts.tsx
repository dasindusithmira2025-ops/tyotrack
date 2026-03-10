import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { ShiftUpcomingList } from '../components/shifts/ShiftUpcomingList';
import { shiftsApi } from '../services/shiftsApi';
import type { ShiftRecord } from '../types/shifts';
import { enableBrowserNotifications } from '../services/browserNotifications';

export const MyShifts = () => {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationBusy, setNotificationBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const upcoming = await shiftsApi.list({ upcomingOnly: true });
        setShifts(upcoming);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load shifts');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const currentWeekStart = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(today.getDate() + offset);
    return start.toISOString().slice(0, 10);
  }, []);

  const currentWeek = useMemo(
    () => shifts.filter((shift) => shift.weekStartDate === currentWeekStart),
    [shifts, currentWeekStart]
  );

  const nextWeek = useMemo(
    () => shifts.filter((shift) => shift.weekStartDate !== currentWeekStart),
    [shifts, currentWeekStart]
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

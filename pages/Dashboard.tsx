
import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { TimeEntry, EntryStatus, Workspace, Project, UserRole, User } from '../types';
import { Clock, Moon, Sun, CheckCircle, ChevronLeft, ChevronRight, X, Plus, Building2, Users, FileText, Check, Activity, PieChart, Folder } from 'lucide-react';
import { cn, getGreeting, formatTime, formatDate, isValid24HourTime, dateKeyFromLocalDate } from '../lib/utils';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Time24Input } from '../components/ui/Time24Input';
import { toast } from 'sonner';

// --- Components ---

const StatCard = ({ label, value, icon: Icon, colorClass, delay, isAlert }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className={cn(
      "bg-slate-900 p-3 sm:p-4 md:p-5 rounded-xl border shadow-sm relative overflow-hidden",
      isAlert ? "border-amber-500/50 shadow-amber-900/20" : "border-slate-800"
    )}
  >
    <div className="relative z-10 flex items-start justify-between gap-2">
      <div>
        <p className="text-slate-400 text-[11px] sm:text-xs md:text-sm font-medium leading-tight">{label}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className={cn("text-lg sm:text-xl md:text-2xl font-bold", isAlert ? "text-amber-400" : "text-slate-100")}>{value}</p>
          {isAlert && <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
        </div>
      </div>
      <div className={cn("p-2 sm:p-2.5 md:p-3 rounded-lg bg-opacity-10 relative z-10 shrink-0", colorClass)}>
        <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6", colorClass.replace('bg-', 'text-'))} />
      </div>
    </div>
    {isAlert && (
      <div className="absolute inset-0 bg-amber-500/5 z-0 animate-pulse" />
    )}
  </motion.div>
);

const StatusLegend = () => (
  <div className="flex items-center gap-4 text-xs font-medium text-slate-400 mt-6 justify-center border-t border-slate-800 pt-4 w-full">
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
      <span>Approved</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
      <span>Pending</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
      <span>Rejected</span>
    </div>
  </div>
);

export const Dashboard = () => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('tyo_user') || '{}');
  const isEmployee = user.role === UserRole.EMPLOYEE;
  const isAdmin = user.role === UserRole.COMPANY_ADMIN;

  // Calendar State (Employee)
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [companyName, setCompanyName] = useState('');

  // Admin Stats State
  const [adminStats, setAdminStats] = useState({
    activeEmployees: 0,
    activeProjects: 0,
    totalHoursMonth: 0,
    pendingApprovals: 0,
    pendingEntriesList: [] as TimeEntry[],
    employees: {} as Record<string, User>
  });

  // Form State
  const [formData, setFormData] = useState({
    workspaceId: '',
    projectId: '',
    startTime: '09:00',
    endTime: '17:00',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      if (!user.companyId && user.role === UserRole.SUPER_ADMIN) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const data = await api.getTimeEntries(isEmployee ? user.id : undefined, user.companyId!);
      setEntries(data);

      let companyProjectList: Project[] = [];
      if (user.companyId) {
        const [company, projectsForCompany] = await Promise.all([
          api.getCompany(user.companyId),
          api.getAllCompanyProjects(user.companyId)
        ]);
        companyProjectList = projectsForCompany;
        setAllProjects(projectsForCompany);
        if (company) setCompanyName(company.name);
      }

      if (isEmployee) {
        const ws = await api.getWorkspaces(user.companyId);
        setWorkspaces(ws);
        if (ws.length > 0) {
          const ps = await api.getProjects(ws[0].id);
          setProjects(ps);
          setFormData(prev => ({ ...prev, workspaceId: ws[0].id, projectId: ps[0]?.id || '' }));
        }
      }

      if (isAdmin) {
        const empList = await api.getEmployees(user.companyId);
        
        const empMap = empList.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {} as Record<string, User>);
        const pending = data.filter(e => e.status === EntryStatus.PENDING);
        
        const now = new Date();
        const startOfMonthKey = dateKeyFromLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
        
        const approvedEntries = data.filter(e => e.status === EntryStatus.APPROVED);
        const monthlyHours = approvedEntries
          .filter(e => e.date >= startOfMonthKey)
          .reduce((sum, e) => sum + e.totalHours, 0);

        setAdminStats({
          activeEmployees: empList.length,
          activeProjects: companyProjectList.filter(p => p.status === 'ACTIVE').length,
          pendingApprovals: pending.length,
          totalHoursMonth: monthlyHours,
          pendingEntriesList: pending.sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, 5),
          employees: empMap
        });
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id, user.companyId, isEmployee, isAdmin]);

  // Admin Actions
  const handleQuickApprove = async (id: string) => {
    try {
      await api.updateEntryStatus(id, EntryStatus.APPROVED);
      toast.success('Entry approved');
      fetchData();
    } catch (e) {
      toast.error('Failed to approve');
    }
  };

  const handleQuickReject = async (id: string) => {
    try {
      await api.updateEntryStatus(id, EntryStatus.REJECTED);
      toast.success('Entry rejected');
      fetchData();
    } catch (e) {
      toast.error('Failed to reject');
    }
  };

  const handleWorkspaceChange = async (wid: string) => {
    setFormData(prev => ({ ...prev, workspaceId: wid, projectId: '' }));
    const p = await api.getProjects(wid);
    setProjects(p);
    setFormData(prev => ({ ...prev, projectId: p[0]?.id || '' }));
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    setIsSubmitting(true);
    try {
      if (!formData.workspaceId || !formData.projectId) {
        throw new Error("Please select workspace and project.");
      }

      if (!isValid24HourTime(formData.startTime) || !isValid24HourTime(formData.endTime)) {
        throw new Error("Time must be in 24-hour format (HH:mm).");
      }

      if (formData.startTime === formData.endTime) {
        throw new Error("End time must be after start time.");
      }

      const selectedDateKey = dateKeyFromLocalDate(selectedDate);
      const todayKey = dateKeyFromLocalDate(new Date());
      if (selectedDateKey > todayKey) {
        throw new Error("Cannot add entries for future dates.");
      }

      await api.createTimeEntry(
        user.id,
        formData.workspaceId,
        formData.projectId,
        selectedDateKey,
        formData.startTime,
        formData.endTime,
        formData.notes
      );
      toast.success('Time entry submitted!');
      setShowAddForm(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowAddForm(false);
  };

  const handleDateDoubleClick = (date: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const targetDate = new Date(date);
    targetDate.setHours(0,0,0,0);

    if (targetDate > today) {
      toast.error("Cannot add entries for future dates.");
      return;
    }
    setSelectedDate(date);
    setShowAddForm(true);
  };

  // Calendar Logic
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 = Sun
  
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));

  // --- STATS CALCULATION (Employee Specific) ---
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonthKey = dateKeyFromLocalDate(startOfMonth);
  const startOfWeekKey = dateKeyFromLocalDate(startOfWeek);

  const approvedEntries = entries.filter(e => e.status === EntryStatus.APPROVED);
  const thisMonthApproved = approvedEntries.filter(e => e.date >= startOfMonthKey);
  const thisWeekApproved = approvedEntries.filter(e => e.date >= startOfWeekKey);

  const totalHoursMonth = thisMonthApproved.reduce((acc, curr) => acc + curr.totalHours, 0);
  const totalHoursWeek = thisWeekApproved.reduce((acc, curr) => acc + curr.totalHours, 0);
  const totalEvening = thisMonthApproved.reduce((acc, curr) => acc + curr.eveningHours, 0);
  const totalNight = thisMonthApproved.reduce((acc, curr) => acc + curr.nightHours, 0);

  // --- Status Color Helper ---
  const getDayStatus = (dayEntries: TimeEntry[]) => {
    if (dayEntries.length === 0) return null;
    if (dayEntries.some(e => e.status === EntryStatus.REJECTED)) return 'bg-red-500 shadow-red-500/50';
    if (dayEntries.some(e => e.status === EntryStatus.PENDING)) return 'bg-amber-500 shadow-amber-500/50';
    return 'bg-emerald-500 shadow-emerald-500/50';
  };

  const selectedDayEntries = entries.filter(e => e.date === dateKeyFromLocalDate(selectedDate));
  const selectedDayApprovedHours = selectedDayEntries
    .filter((entry) => entry.status === EntryStatus.APPROVED)
    .reduce((sum, entry) => sum + entry.totalHours, 0);

  const projectNameById = useMemo(
    () =>
      allProjects.reduce((acc, project) => {
        acc[project.id] = project.name;
        return acc;
      }, {} as Record<string, string>),
    [allProjects]
  );

  const getProjectName = (projectId: string) => projectNameById[projectId] ?? "Unknown Project";

  return (
    <Layout>
      <div className="max-w-6xl mx-auto pb-20">
        <header className="mb-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-white">{getGreeting()}, {user.name.split(' ')[0]}</h1>
            <div className="flex items-center gap-2 text-slate-400 mt-1">
              {companyName && (
                <div className="flex items-center gap-1.5 bg-blue-900/20 px-2.5 py-0.5 rounded-full border border-blue-900/30 text-blue-300 text-xs font-semibold">
                  <Building2 className="w-3 h-3" />
                  {companyName}
                </div>
              )}
              <span className="text-sm">Here's your {isAdmin ? 'operational' : 'time tracking'} summary.</span>
            </div>
          </div>
        </header>

        {/* Stats Row */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 animate-pulse mb-8">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 sm:h-28 md:h-32 bg-slate-800 rounded-xl"></div>)}
          </div>
        ) : (
          <>
            {isEmployee && (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
                <StatCard label="Approved (Month)" value={totalHoursMonth.toFixed(1)} icon={Clock} colorClass="bg-blue-500/20 text-blue-400" delay={0} />
                <StatCard label="Approved (Week)" value={totalHoursWeek.toFixed(1)} icon={CheckCircle} colorClass="bg-emerald-500/20 text-emerald-400" delay={0.1} />
                <StatCard label="Approved Evening" value={totalEvening.toFixed(1)} icon={Sun} colorClass="bg-orange-500/20 text-orange-400" delay={0.2} />
                <StatCard label="Approved Night" value={totalNight.toFixed(1)} icon={Moon} colorClass="bg-indigo-500/20 text-indigo-400" delay={0.3} />
              </div>
            )}
            
            {isAdmin && (
               <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
                <StatCard label="Total Employees" value={adminStats.activeEmployees} icon={Users} colorClass="bg-blue-500/20 text-blue-400" delay={0} />
                <StatCard label="Active Projects" value={adminStats.activeProjects} icon={Folder} colorClass="bg-indigo-500/20 text-indigo-400" delay={0.1} />
                <StatCard 
                  label="Pending Entries" 
                  value={adminStats.pendingApprovals} 
                  icon={Clock} 
                  colorClass="bg-amber-500/20 text-amber-400" 
                  delay={0.2}
                  isAlert={adminStats.pendingApprovals > 0} 
                />
                <StatCard label="Approved Hours (Month)" value={adminStats.totalHoursMonth.toFixed(1)} icon={Activity} colorClass="bg-emerald-500/20 text-emerald-400" delay={0.3} />
              </div>
            )}
          </>
        )}

        {/* --- MAIN CONTENT AREA --- */}
        {isEmployee && (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            
            {/* DETAILS PANEL (Left on Desktop, Bottom on Mobile) */}
            <div className="w-full md:w-96 shrink-0 order-2 md:order-1 flex flex-col gap-4">
              <div className="glass-surface panel-lift rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[500px] h-full">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-800 bg-slate-950/50">
                  <h2 className="text-xl font-bold text-white">{formatDate(selectedDate)}</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Daily Total: <span className="text-white font-mono">{selectedDayEntries.reduce((a,b) => a + b.totalHours, 0).toFixed(2)}h</span>
                  </p>
                  <p className="text-slate-400 text-sm">
                    Approved: <span className="text-emerald-300 font-extrabold">{selectedDayApprovedHours.toFixed(2)}h</span>
                  </p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {selectedDayEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-800 rounded-xl m-2">
                      <Clock className="w-8 h-8 text-slate-700 mb-2" />
                      <p className="text-slate-500 text-sm">No entries yet.</p>
                    </div>
                  ) : (
                    selectedDayEntries.map(entry => (
                      <div key={entry.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl group hover:border-slate-700 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                            entry.status === 'APPROVED' ? "bg-emerald-900/30 text-emerald-400" : 
                            entry.status === 'REJECTED' ? "bg-red-900/30 text-red-400" : 
                            "bg-amber-900/30 text-amber-400"
                          )}>
                            {entry.status}
                          </span>
                          <span className="text-white font-bold text-lg">{entry.totalHours.toFixed(2)}h</span>
                        </div>
                        
                        <p className="text-slate-100 font-semibold text-sm mb-1">{getProjectName(entry.projectId)}</p>
                        
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-2">
                          <Clock className="w-3 h-3" />
                          {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                        </div>

                        {(entry.eveningHours > 0 || entry.nightHours > 0) && (
                          <div className="flex gap-2 mt-2 pt-2 border-t border-slate-800/50">
                            {entry.eveningHours > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-950/30 px-1.5 py-0.5 rounded">
                                <Sun className="w-3 h-3" /> {entry.eveningHours}h
                              </span>
                            )}
                            {entry.nightHours > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-950/30 px-1.5 py-0.5 rounded">
                                <Moon className="w-3 h-3" /> {entry.nightHours}h
                              </span>
                            )}
                          </div>
                        )}
                        
                        {entry.notes && <p className="text-xs text-slate-500 mt-2 italic border-l-2 border-slate-800 pl-2">"{entry.notes}"</p>}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer / Popup Trigger */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/30">
                  <Button 
                    onClick={() => setShowAddForm(true)} 
                    className="w-full py-3 border-2 border-dashed border-slate-700 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add New Entry
                  </Button>
                  <p className="text-[11px] text-slate-500 mt-2 text-center">
                    Entry form uses 24-hour format (HH:mm).
                  </p>
                </div>
              </div>
            </div>

            {/* CALENDAR GRID (Right on Desktop, Top on Mobile) */}
            <div className="flex-1 order-1 md:order-2 w-full">
              <div className="bg-[#0f1420] rounded-2xl shadow-2xl border border-slate-800 p-6 md:p-8">
                {/* Calendar Header */}
                <div className="flex justify-between items-center mb-8">
                  <h3 className="font-bold text-xl text-white tracking-tight">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-800 text-slate-400" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
                       <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-800 text-slate-400" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
                       <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-y-6">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {d}
                    </div>
                  ))}
                  
                  {days.map((date, idx) => {
                    if (!date) return <div key={`empty-${idx}`} />;

                    const dateStr = dateKeyFromLocalDate(date);
                    const dayEntries = entries.filter(e => e.date === dateStr);
                    const totalHours = dayEntries.reduce((sum, entry) => sum + entry.totalHours, 0);
                    const statusClass = getDayStatus(dayEntries);
                    const isSelected = selectedDate.toDateString() === date.toDateString();
                    const isToday = new Date().toDateString() === date.toDateString();

                    return (
                      <div key={idx} className="flex flex-col items-center">
                        <button
                          onClick={() => handleDateClick(date)}
                          onDoubleClick={() => handleDateDoubleClick(date)}
                          className={cn(
                            "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-200 relative group",
                            isSelected 
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105" 
                              : "text-slate-300 hover:bg-slate-800/50 hover:text-white",
                            isToday && !isSelected && "bg-slate-800/80 text-white border border-slate-700"
                          )}
                        >
                          {date.getDate()}
                          {statusClass && (
                             <div className={cn("absolute -bottom-1 w-1.5 h-1.5 rounded-full shadow-sm", statusClass)} />
                          )}
                        </button>
                        <span className={cn(
                          "text-[11px] mt-1 font-extrabold leading-none tracking-wide", 
                          dayEntries.length === 0
                            ? "text-transparent"
                            : dayEntries.some((entry) => entry.status === EntryStatus.PENDING)
                              ? "text-amber-300"
                              : "text-emerald-300"
                        )}>
                          {dayEntries.length === 0 ? "0.0h" : `${totalHours.toFixed(1)}h`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <StatusLegend />
              </div>
            </div>
          </div>
        )}

        {isEmployee && showAddForm && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 pt-16 sm:pt-4 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-lg p-6 relative animate-in fade-in zoom-in duration-200 border border-slate-800 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
              <button
                onClick={() => setShowAddForm(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl font-bold mb-1 text-white">Add Time Entry</h3>
              <p className="text-sm text-slate-400 mb-6">{formatDate(selectedDate)} (24h format)</p>

              <form onSubmit={handleCreateEntry} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Workspace</label>
                  <select
                    className="w-full rounded-lg border-slate-700 bg-slate-950 border p-2 text-sm focus:ring-2 focus:ring-accent text-slate-200"
                    value={formData.workspaceId}
                    onChange={(e) => handleWorkspaceChange(e.target.value)}
                    required
                  >
                    <option value="">Select Workspace</option>
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Project</label>
                  <select
                    className="w-full rounded-lg border-slate-700 bg-slate-950 border p-2 text-sm focus:ring-2 focus:ring-accent text-slate-200"
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    required
                  >
                    <option value="">Select Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Start (HH:mm)</label>
                    <Time24Input
                      className="w-full rounded-lg border-slate-700 bg-slate-950 border p-2 text-sm text-slate-200"
                      value={formData.startTime}
                      onChange={(value) => setFormData({ ...formData, startTime: value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">End (HH:mm)</label>
                    <Time24Input
                      className="w-full rounded-lg border-slate-700 bg-slate-950 border p-2 text-sm text-slate-200"
                      value={formData.endTime}
                      onChange={(value) => setFormData({ ...formData, endTime: value })}
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Ends next day if less than start.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Notes (Optional)</label>
                  <textarea
                    className="w-full rounded-lg border-slate-700 bg-slate-950 border p-2 text-sm text-slate-200"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                    Save Entry
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- ADMIN DASHBOARD --- */}
        {isAdmin && (
          <div className="space-y-6">
            
            {/* 1. PENDING ENTRIES PANEL (Primary Focus) */}
            <div className={cn(
              "bg-slate-900 border rounded-xl overflow-hidden shadow-sm transition-all",
              adminStats.pendingApprovals > 0 ? "border-amber-900/40 shadow-amber-900/10" : "border-slate-800"
            )}>
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
                  <div className="flex items-center gap-3">
                     <div className={cn("p-2 rounded-lg", adminStats.pendingApprovals > 0 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")}>
                        {adminStats.pendingApprovals > 0 ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                     </div>
                     <div>
                        <h3 className="font-bold text-lg text-white">Pending Entries Review</h3>
                        <p className="text-sm text-slate-400">
                           {adminStats.pendingApprovals > 0 
                             ? `${adminStats.pendingApprovals} entries require your attention.` 
                             : "All time entries are reviewed and approved."}
                        </p>
                     </div>
                  </div>
                  {adminStats.pendingApprovals > 0 && (
                     <Button size="sm" variant="outline" onClick={() => {}}>View All</Button>
                  )}
               </div>

               <div className="p-0">
                  {adminStats.pendingApprovals === 0 ? (
                     <div className="p-12 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-emerald-900/20 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                           <Check className="w-8 h-8" />
                        </div>
                        <h4 className="text-white font-medium text-lg">You're all caught up!</h4>
                        <p className="text-slate-500 mt-1">Great job keeping the operations smooth.</p>
                     </div>
                  ) : (
                     <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-slate-800/30 text-xs uppercase text-slate-500 font-semibold border-b border-slate-800">
                              <tr>
                                 <th className="px-6 py-3">Employee</th>
                                 <th className="px-6 py-3">Date</th>
                                 <th className="px-6 py-3">Project</th>
                                 <th className="px-6 py-3">Duration</th>
                                 <th className="px-6 py-3 text-right">Actions</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-800 text-slate-300">
                              {adminStats.pendingEntriesList.map(entry => {
                                 const emp = adminStats.employees[entry.userId];
                                 return (
                                    <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                                       <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white">
                                             {emp?.name?.[0]}
                                          </div>
                                          {emp?.name || 'Unknown'}
                                       </td>
                                       <td className="px-6 py-4 font-mono text-slate-400">{formatDate(entry.date)}</td>
                                       <td className="px-6 py-4">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/20 text-blue-300 border border-blue-900/30">
                                             {getProjectName(entry.projectId)}
                                          </span>
                                       </td>
                                       <td className="px-6 py-4 font-bold text-white">{entry.totalHours.toFixed(2)}h</td>
                                       <td className="px-6 py-4 text-right">
                                          <div className="flex justify-end gap-2">
                                             <button 
                                                onClick={() => handleQuickReject(entry.id)}
                                                className="p-1.5 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded transition-colors" title="Reject">
                                                <X className="w-4 h-4" />
                                             </button>
                                             <button 
                                                onClick={() => handleQuickApprove(entry.id)}
                                                className="p-1.5 hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-400 rounded transition-colors" title="Approve">
                                                <Check className="w-4 h-4" />
                                             </button>
                                          </div>
                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     </div>
                  )}
               </div>
            </div>

            {/* 2. OPERATIONAL CHARTS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               
               {/* Submission Status Breakdown */}
               <div className="glass-surface panel-lift rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                     <PieChart className="w-5 h-5 text-slate-400" />
                     Submission Status
                  </h3>
                  <div className="relative h-48 flex items-center justify-center">
                     {/* Mock Donut Chart CSS */}
                     <div className="w-32 h-32 rounded-full border-[12px] border-emerald-500/20 border-t-emerald-500 border-l-amber-500 border-r-emerald-500 rotate-45 relative">
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                           <span className="text-2xl font-bold text-white">92%</span>
                           <span className="text-[10px] text-slate-500 uppercase tracking-wide">Completion</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex justify-center gap-4 mt-4 text-xs">
                     <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-slate-400">Approved</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-slate-400">Pending</span>
                     </div>
                  </div>
               </div>

               {/* Weekly Trend (Mock) */}
               <div className="md:col-span-2 glass-surface panel-lift rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Weekly Activity Trend</h3>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Last 7 Days</span>
                  </div>
                  <div className="h-48 flex items-end gap-2 justify-between px-2">
                    {[45, 60, 30, 80, 50, 20, 10].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="w-full max-w-[40px] bg-blue-600/20 group-hover:bg-blue-600/40 rounded-t-lg relative transition-all" style={{ height: `${h}%` }}>
                           <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">{h}h</div>
                        </div>
                        <span className="text-xs text-slate-500">Day {i+1}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            {/* 3. Project Distribution (Lower Priority) */}
            <div className="glass-surface panel-lift rounded-xl p-6 shadow-sm">
               <h3 className="text-lg font-bold text-white mb-6">Project Distribution</h3>
               <div className="space-y-4">
                  {[
                    { name: 'Frontend Revamp', val: 45, color: 'bg-blue-500' },
                    { name: 'Backend Migration', val: 30, color: 'bg-emerald-500' },
                    { name: 'Design System', val: 15, color: 'bg-amber-500' },
                    { name: 'Other', val: 10, color: 'bg-slate-500' }
                  ].map((p) => (
                    <div key={p.name}>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>{p.name}</span>
                        <span>{p.val}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${p.color}`} style={{ width: `${p.val}%` }}></div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};


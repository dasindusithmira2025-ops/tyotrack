import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Eye, EyeOff, Lock, Shield, User } from 'lucide-react';
import { toast } from 'sonner';

export const Settings = () => {
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('tyo_user') || '{}'));
  const [profileName, setProfileName] = useState(currentUser.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = profileName.trim();
    if (trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await api.updateUser(currentUser.id, { name: trimmedName });
      const nextUser = { ...currentUser, name: updated.name };
      setCurrentUser(nextUser);
      localStorage.setItem('tyo_user', JSON.stringify(nextUser));
      toast.success('Profile updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentUser.id, currentPassword, newPassword);
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white">Account Settings</h1>
          <p className="text-slate-400">Manage your profile and security preferences.</p>
        </header>

        {/* Profile Card */}
        <div className="glass-surface panel-lift rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
               <User className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{currentUser.name}</h2>
              <p className="text-slate-400">{currentUser.email}</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                {currentUser.role?.replace('_', ' ').toLowerCase()}
              </span>
            </div>
          </div>

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-accent outline-none"
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" isLoading={savingProfile}>
                Save Profile
              </Button>
            </div>
          </form>
        </div>

        {/* Security / Password Card */}
        <div className="glass-surface panel-lift rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Security</h3>
              <p className="text-sm text-slate-400">Update your password</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input 
                  type={showCurrentPassword ? "text" : "password"}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-10 text-white focus:ring-2 focus:ring-accent outline-none"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="********"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-2 top-1.5 p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input 
                    type={showNewPassword ? "text" : "password"}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-10 text-white focus:ring-2 focus:ring-accent outline-none"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="********"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-2 top-1.5 p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-10 text-white focus:ring-2 focus:ring-accent outline-none"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="********"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2 top-1.5 p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" isLoading={loading} className="w-full md:w-auto">
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

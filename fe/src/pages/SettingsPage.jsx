import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LockKeyhole, SlidersHorizontal } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';

function SettingsPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('config');
  const [usersLiveActivityEnabled, setUsersLiveActivityEnabled] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [error, setError] = useState('');

  const loadAdminSettings = async () => {
    setLoadingConfig(true);
    try {
      const { data } = await api.get('/settings/admin');
      setUsersLiveActivityEnabled(Boolean(data?.settings?.ui?.usersLiveActivityEnabled));
      setError('');
    } catch (err) {
      if (err?.response?.status === 404) {
        setError('Settings API is not available. Restart backend to load latest routes.');
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadAdminSettings();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const saveConfig = async () => {
    setSavingConfig(true);
    setConfigMessage('');
    try {
      const { data } = await api.patch('/settings/admin', { usersLiveActivityEnabled });
      setUsersLiveActivityEnabled(Boolean(data?.settings?.ui?.usersLiveActivityEnabled));
      setConfigMessage(data?.message || 'Settings saved successfully');
      setError('');
    } catch (err) {
      if (err?.response?.status === 404) {
        setError('Settings API is not available. Restart backend to load latest routes.');
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordMessage('');
    try {
      const { data } = await api.post('/auth/change-password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage(data?.message || 'Password updated successfully. Use new credentials on your next login.');
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="page">
      <PageHeader
        title="Admin Settings"
        subtitle="Control user-facing live activity and manage your admin account security."
      />

      {error ? <p className="error-text">{error}</p> : null}
      {configMessage ? <p className="success-text">{configMessage}</p> : null}
      {passwordMessage ? <p className="success-text">{passwordMessage}</p> : null}

      <article className="card">
        <div className="settings-tabs" role="tablist" aria-label="Settings tabs">
          <button
            className={`settings-tab ${activeTab === 'config' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'config'}
            onClick={() => setActiveTab('config')}
          >
            <SlidersHorizontal size={14} />
            System Config
          </button>
          <button
            className={`settings-tab ${activeTab === 'password' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'password'}
            onClick={() => setActiveTab('password')}
          >
            <LockKeyhole size={14} />
            Change Password
          </button>
        </div>

        {activeTab === 'config' ? (
          <div className="settings-panel">
            {loadingConfig ? <p className="muted-text">Loading settings...</p> : null}

            <div className="setting-row">
              <div>
                <h4>Live Activity for Users</h4>
                <p className="muted-text">
                  Admin can always see the Live Activity panel. This switch controls visibility for non-admin users.
                </p>
              </div>
              <button
                type="button"
                className={`switch ${usersLiveActivityEnabled ? 'on' : 'off'}`}
                onClick={() => setUsersLiveActivityEnabled((prev) => !prev)}
                aria-pressed={usersLiveActivityEnabled}
                aria-label="Toggle live activity visibility for users"
              >
                <span />
              </button>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={loadAdminSettings} disabled={loadingConfig || savingConfig}>
                Reset
              </button>
              <button type="button" className="btn btn-primary" onClick={saveConfig} disabled={savingConfig}>
                {savingConfig ? 'Saving...' : 'Save Config'}
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === 'password' ? (
          <form className="grid-form settings-panel" onSubmit={submitPassword}>
            <label>
              Current Password
              <input
                type="password"
                minLength={8}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                required
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                minLength={8}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                required
              />
            </label>
            <label>
              Confirm Password
              <input
                type="password"
                minLength={8}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                required
              />
            </label>
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                {savingPassword ? 'Saving...' : 'Save Password'}
              </button>
            </div>
          </form>
        ) : null}
      </article>
    </section>
  );
}

export default SettingsPage;

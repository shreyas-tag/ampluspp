import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Copy, LockKeyhole, SlidersHorizontal, Webhook } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { formatSmartDateTime } from '../utils/dateFormat';

const initialWebhookMeta = {
  source: 'NONE',
  configured: false,
  enabled: false,
  isActive: false,
  keyPreview: 'Not configured',
  lastReceivedAt: null,
  endpointPath: '/api/leads/webform',
  headerName: 'x-webhook-key'
};

function SettingsPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('config');
  const [usersLiveActivityEnabled, setUsersLiveActivityEnabled] = useState(false);
  const [wordpressWebhookEnabled, setWordpressWebhookEnabled] = useState(false);
  const [wordpressWebhookKey, setWordpressWebhookKey] = useState('');
  const [webhookMeta, setWebhookMeta] = useState(initialWebhookMeta);
  const [copyMessage, setCopyMessage] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [error, setError] = useState('');

  const webhookEndpoint = useMemo(() => {
    const base = String(import.meta.env.VITE_API_BASE_URL || api.defaults.baseURL || '').replace(/\/$/, '');
    if (!base) return webhookMeta.endpointPath;
    return `${base}/leads/webform`;
  }, [webhookMeta.endpointPath]);

  const applyAdminSettings = (settingsPayload) => {
    setUsersLiveActivityEnabled(Boolean(settingsPayload?.ui?.usersLiveActivityEnabled));
    const wordpress = settingsPayload?.integrations?.wordpress || initialWebhookMeta;
    setWordpressWebhookEnabled(Boolean(wordpress.enabled));
    setWebhookMeta({
      source: wordpress.source || 'NONE',
      configured: Boolean(wordpress.configured),
      enabled: Boolean(wordpress.enabled),
      isActive: Boolean(wordpress.isActive),
      keyPreview: wordpress.keyPreview || 'Not configured',
      lastReceivedAt: wordpress.lastReceivedAt || null,
      endpointPath: wordpress.endpointPath || '/api/leads/webform',
      headerName: wordpress.headerName || 'x-webhook-key'
    });
  };

  const loadAdminSettings = async () => {
    setLoadingConfig(true);
    try {
      const { data } = await api.get('/settings/admin');
      applyAdminSettings(data?.settings || {});
      setWordpressWebhookKey('');
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
      const payload = {
        usersLiveActivityEnabled,
        wordpressWebhookEnabled
      };
      if (wordpressWebhookKey.trim()) payload.wordpressWebhookKey = wordpressWebhookKey.trim();

      const { data } = await api.patch('/settings/admin', payload);
      applyAdminSettings(data?.settings || {});
      setWordpressWebhookKey('');
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

  const clearWebhookKey = async () => {
    setSavingConfig(true);
    setConfigMessage('');
    try {
      const { data } = await api.patch('/settings/admin', { clearWordpressWebhookKey: true });
      applyAdminSettings(data?.settings || {});
      setWordpressWebhookKey('');
      setConfigMessage('Webhook key cleared successfully');
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingConfig(false);
    }
  };

  const copyToClipboard = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied`);
      setTimeout(() => setCopyMessage(''), 1500);
    } catch (_err) {
      setCopyMessage('Copy not supported in this browser');
      setTimeout(() => setCopyMessage(''), 1500);
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

            <div className="setting-row setting-stack">
              <div className="setting-row-head">
                <div>
                  <h4>WordPress Contact Form Webhook</h4>
                  <p className="muted-text">Configure the secure key and setup values to receive contact form leads automatically.</p>
                </div>
                <div className="stat-chip-row">
                  <span className={`tag ${webhookMeta.configured ? 'status-completed' : 'status-pending'}`}>
                    Configured: {webhookMeta.configured ? 'Yes' : 'No'}
                  </span>
                  <span className={`tag ${webhookMeta.isActive ? 'status-completed' : 'status-pending'}`}>
                    Active: {webhookMeta.isActive ? 'Yes' : 'No'}
                  </span>
                  <span className="tag neutral">Source: {webhookMeta.source}</span>
                </div>
              </div>

              <div className="setting-grid">
                <label>
                  Webhook Key
                  <input
                    type="password"
                    value={wordpressWebhookKey}
                    placeholder="Enter new shared key"
                    onChange={(e) => setWordpressWebhookKey(e.target.value)}
                  />
                  <small className="muted-text">Saved key preview: {webhookMeta.keyPreview}</small>
                </label>

                <div className="setting-row setting-row-inline">
                  <div>
                    <h4>Webhook Enabled</h4>
                    <p className="muted-text">Disable temporarily to stop WordPress lead intake without deleting the key.</p>
                  </div>
                  <button
                    type="button"
                    className={`switch ${wordpressWebhookEnabled ? 'on' : 'off'}`}
                    onClick={() => setWordpressWebhookEnabled((prev) => !prev)}
                    aria-pressed={wordpressWebhookEnabled}
                    aria-label="Toggle WordPress webhook"
                  >
                    <span />
                  </button>
                </div>
              </div>

              <div className="setting-instructions">
                <h4>
                  <Webhook size={14} />
                  Setup Instructions
                </h4>
                <ol>
                  <li>
                    In WordPress form webhook/plugin, set URL to:
                    <span className="setting-code">
                      <code>{webhookEndpoint}</code>
                      <button type="button" className="btn btn-secondary btn-compact" onClick={() => copyToClipboard(webhookEndpoint, 'Webhook URL')}>
                        <Copy size={12} />
                        Copy
                      </button>
                    </span>
                  </li>
                  <li>
                    Add request header:
                    <span className="setting-code">
                      <code>{webhookMeta.headerName}: &lt;your-shared-key&gt;</code>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={() => copyToClipboard(webhookMeta.headerName, 'Header name')}
                      >
                        <Copy size={12} />
                        Copy
                      </button>
                    </span>
                  </li>
                  <li>
                    Send JSON payload with required fields:
                    <code className="setting-inline-code">companyName, contactPerson, mobileNumber</code> and optional fields:
                    <code className="setting-inline-code">
                      promoterName, businessConstitutionType, address, taluka, district, state, projectLandDetail, partnersDirectorsGender,
                      promoterCasteCategory, manufacturingDetails, investmentBuildingConstruction, investmentLand, investmentPlantMachinery,
                      totalInvestment, bankLoanIfAny, financeBankLoanPercent, financeOwnContributionPercent, projectType,
                      availedSubsidyPreviously, projectSpecificAsk
                    </code>
                    .
                  </li>
                </ol>
                <p className="muted-text">
                  Last webhook received: {webhookMeta.lastReceivedAt ? formatSmartDateTime(webhookMeta.lastReceivedAt) : 'No payload received yet'}
                </p>
                {copyMessage ? <p className="success-text">{copyMessage}</p> : null}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={loadAdminSettings} disabled={loadingConfig || savingConfig}>
                Reset
              </button>
              <button type="button" className="btn btn-secondary" onClick={clearWebhookKey} disabled={savingConfig || !webhookMeta.configured}>
                Clear Webhook Key
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

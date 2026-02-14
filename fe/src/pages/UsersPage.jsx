import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocketEvents } from '../context/SocketContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const initialForm = {
  name: '',
  email: '',
  password: '',
  role: 'USER'
};

function UsersPage() {
  const { isAdmin } = useAuth();
  const { lastEvent } = useSocketEvents();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmState, setConfirmState] = useState({ isOpen: false, userId: null, isActive: false });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, lastEvent]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const createUser = async (event) => {
    event.preventDefault();
    try {
      await api.post('/users', form);
      setForm(initialForm);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const toggleUser = async () => {
    try {
      await api.patch(`/users/${confirmState.userId}`, { isActive: !confirmState.isActive });
      setConfirmState({ isOpen: false, userId: null, isActive: false });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <section className="page">
      <PageHeader
        title="User Administration"
        subtitle="Role-based access management and account activation control."
        actionLabel="Add User"
        onAction={() => setShowCreate(true)}
      />

      {error ? <p className="error-text">{error}</p> : null}

      <article className="card">
        <div className="section-head">
          <h3>System Users</h3>
          <span className="table-count">{users.length} records</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="tag neutral">{user.role}</span>
                  </td>
                  <td>
                    <span className={`tag ${user.isActive ? 'cold' : 'hot'}`}>{user.isActive ? 'ACTIVE' : 'DISABLED'}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setConfirmState({ isOpen: true, userId: user._id, isActive: user.isActive })}
                    >
                      {user.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <Modal isOpen={showCreate} title="Create User" onClose={() => setShowCreate(false)}>
        <form className="grid-form" onSubmit={createUser}>
          <label>
            Full Name
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} required />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </label>
          <label>
            Role
            <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create User
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.isActive ? 'Disable user?' : 'Enable user?'}
        message={
          confirmState.isActive
            ? 'This user will lose system access until re-enabled.'
            : 'This user will regain access to the system.'
        }
        confirmLabel={confirmState.isActive ? 'Disable' : 'Enable'}
        onConfirm={toggleUser}
        onCancel={() => setConfirmState({ isOpen: false, userId: null, isActive: false })}
      />
    </section>
  );
}

export default UsersPage;

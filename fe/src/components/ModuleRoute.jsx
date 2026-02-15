import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ModuleRoute({ moduleKey, children }) {
  const { isAdmin, hasModuleAccess } = useAuth();

  if (isAdmin) return children;
  if (hasModuleAccess(moduleKey)) return children;

  return <Navigate to="/" replace />;
}

export default ModuleRoute;

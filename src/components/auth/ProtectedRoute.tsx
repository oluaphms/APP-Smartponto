import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { User } from '../../../types';

export type AllowedRole = 'employee' | 'admin' | 'hr' | 'supervisor';

export interface ProtectedRouteProps {
  user: User | null;
  allowedRoles: AllowedRole[];
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Proteção de rota por perfil (RBAC).
 * Redireciona para redirectTo quando o usuário não possui nenhum dos papéis permitidos.
 * Uso: rotas administrativas com allowedRoles={['admin', 'hr']}.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  user,
  allowedRoles,
  children,
  redirectTo = '/employee/dashboard',
}) => {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  const hasRole = allowedRoles.includes(user.role as AllowedRole);
  if (!hasRole) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

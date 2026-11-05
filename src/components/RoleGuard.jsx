import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAccessToken, getAuthUser } from "../utils/authSession";

export default function RoleGuard({ allowedRoles = [], children }) {
  const location = useLocation();

  // Read the session from localStorage OR sessionStorage.
  const token = getAccessToken();
  const user = getAuthUser();

  const role =
    user?.isAdmin === true
      ? "admin"
      : String(user?.role || "customer").toLowerCase();

  // No valid saved session: redirect to login.
  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // Prevent users from opening dashboards outside their role.
  if (!allowedRoles.includes(role)) {
    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    }

    if (role === "moderator") {
      return <Navigate to="/moderator" replace />;
    }

    return <Navigate to="/" replace />;
  }

  return children ?? <Outlet />;
}
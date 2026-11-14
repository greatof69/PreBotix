
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import {
  getAccessToken,
  getAuthUser,
} from "../utils/authSession";

export default function RoleGuard({ allowedRoles = [], children }) {
  const location = useLocation();

  const [user, setUser] = useState(() => getAuthUser());

  useEffect(() => {
    const syncUser = () => {
      setUser(getAuthUser());
    };

    window.addEventListener(
      "prebotix:user-updated",
      syncUser
    );

    return () => {
      window.removeEventListener(
        "prebotix:user-updated",
        syncUser
      );
    };
  }, []);

  const token = getAccessToken();

  const role =
    user?.isAdmin === true
      ? "admin"
      : String(user?.role || "customer").toLowerCase();

  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

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

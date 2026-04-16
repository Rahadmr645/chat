import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./components/dashboard/Dashboard";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import { useAuth } from "./hooks/useAuth.js";
import "./App.css";

function ProtectedApp() {
  const { user, token, logout, updateCurrentUser } = useAuth();

  return (
    <div className="appShell">
      <Dashboard
        currentUser={user}
        token={token}
        onLogout={logout}
        onProfileUpdate={updateCurrentUser}
      />
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="authLoading">Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="authLoading">Loading...</div>;
  }

  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <ProtectedApp />
          </RequireAuth>
        }
      />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
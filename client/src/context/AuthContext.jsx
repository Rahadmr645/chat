import { useEffect, useState } from "react";
import { apiRequest } from "../services/api.js";
import { AuthContext } from "./authContext.js";

const TOKEN_KEY = "chatapp_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest({ path: "/api/auth/me", token });
        setUser(data.user);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [token]);

  const setSession = (nextToken, nextUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  };

  const register = async (payload) => {
    const data = await apiRequest({
      method: "POST",
      path: "/api/auth/register",
      body: payload,
    });
    setSession(data.token, data.user);
    return data.user;
  };

  const login = async (payload) => {
    const data = await apiRequest({
      method: "POST",
      path: "/api/auth/login",
      body: payload,
    });
    setSession(data.token, data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isAuthenticated: Boolean(user),
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
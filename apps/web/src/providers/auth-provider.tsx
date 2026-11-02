"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type {
  AuthUser,
  LoginResponse,
  RefreshResponse,
  RegisterResponse,
} from "@/types/auth";

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (values: RegisterValues) => Promise<void>;
  logout: () => void;
  authRequest: <T>(path: string, options?: RequestOptions) => Promise<T>;
};

type RegisterValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "medcore_access_token";
const REFRESH_KEY = "medcore_refresh_token";
const USER_KEY = "medcore_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const tokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const saveTokens = useCallback((access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    tokenRef.current = access;
    setAccessToken(access);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    tokenRef.current = null;
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        tokenRef.current = storedToken;
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser) as AuthUser);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshAccessToken = useCallback(async () => {
    // Refresh tokens are single use, so parallel requests share one refresh.
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = (async () => {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (!refreshToken) return null;

        try {
          const response = await apiRequest<RefreshResponse>("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          });
          saveTokens(response.accessToken, response.refreshToken);
          return response.accessToken;
        } catch {
          return null;
        }
      })().finally(() => {
        refreshPromiseRef.current = null;
      });
    }

    return refreshPromiseRef.current;
  }, [saveTokens]);

  const authRequest = useCallback(
    async <T,>(path: string, options: RequestOptions = {}): Promise<T> => {
      const { body, ...rest } = options;
      const send = (token: string | null) =>
        apiRequest<T>(path, {
          ...rest,
          token,
          body: body === undefined ? undefined : JSON.stringify(body),
        });

      try {
        return await send(tokenRef.current);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;

        const newToken = await refreshAccessToken();

        if (!newToken) {
          clearSession();
          throw new ApiError(
            "Your session has expired. Please sign in again.",
            401,
          );
        }

        return send(newToken);
      }
    },
    [refreshAccessToken, clearSession],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      saveTokens(response.accessToken, response.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      setUser(response.user);
    },
    [saveTokens],
  );

  const register = useCallback(async (values: RegisterValues) => {
    const response = await apiRequest<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(values),
    });

    if (!response.user) {
      throw new Error("Registration succeeded but no user was returned.");
    }
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    const token = tokenRef.current;

    // Revoke the refresh token on the server, but never block sign out on it.
    if (token && refreshToken) {
      apiRequest("/auth/logout", {
        method: "POST",
        token,
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined);
    }

    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        register,
        logout,
        authRequest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

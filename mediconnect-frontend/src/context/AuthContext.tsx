import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import api, { fetchCsrfToken } from '../services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'user' | 'doctor' | 'admin';
  mfaEnabled: boolean;
  lastLogin?: string;
}

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: 'user' | 'doctor';
}

interface LoginResult {
  requiresOTP?: boolean;
  mfaRequired?: boolean;
  mfaToken?: string;
  userId?: string;
  email?: string;
  passwordExpired?: boolean;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    otp?: string
  ) => Promise<LoginResult>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verify the current session by loading the profile (cookie-based auth)
  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: User }>('/users/profile');
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await fetchCsrfToken();
      } catch {
        // ignore; will retry on first mutating request
      }
      await checkAuth();
      setLoading(false);
    };
    init();
  }, [checkAuth]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      otp?: string
    ): Promise<LoginResult> => {
      const { data } = await api.post<LoginResult>('/auth/login', {
        email,
        password,
        ...(otp ? { otp } : {}),
      });
      if (data.user) {
        setUser(data.user);
      }
      return data;
    },
    []
  );

  const register = useCallback(async (data: RegisterData): Promise<void> => {
    await api.post('/auth/register', data);
    // Backend does not issue a token on register; user must log in.
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, checkAuth, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

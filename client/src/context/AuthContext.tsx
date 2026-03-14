import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { navigationService } from '../api/navigationService';
import {
  User,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ApiResponse,
} from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Register navigate with the navigation service so Axios interceptors
  // can use React Router instead of window.location
  useEffect(() => {
    navigationService.setNavigate(navigate);
  }, [navigate]);

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        // Decode the JWT payload (base64url) to check expiration
        const payloadB64 = storedToken.split('.')[1];
        if (payloadB64) {
          const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as {
            exp?: number;
          };
          const isExpired = payload.exp ? payload.exp * 1000 < Date.now() : false;
          if (!isExpired) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser) as User);
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (data: LoginRequest) => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      data,
    );
    const { token: jwt, user: loggedInUser } = res.data.data!;
    localStorage.setItem('token', jwt);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setToken(jwt);
    setUser(loggedInUser);
    navigate('/');
  };

  const register = async (data: RegisterRequest) => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/register',
      data,
    );
    const { token: jwt, user: newUser } = res.data.data!;
    localStorage.setItem('token', jwt);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(jwt);
    setUser(newUser);
    navigate('/');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

import { createContext } from 'react';
import type { User, SessionPayload, Role } from '../lib/types';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  mfaEnrollmentRequired: boolean;
  login: (identifier: string, password: string, mfaCode?: string) => Promise<SessionPayload>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  isStaff: boolean;
  isCitizen: boolean;
  hasRole: (...roles: Role[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);


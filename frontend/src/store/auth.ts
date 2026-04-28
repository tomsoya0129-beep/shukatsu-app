import { create } from "zustand";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type { User } from "../api/types";

const TOKEN_KEY = "token";
const USER_KEY = "user";

// Write to both localStorage (fast sync read) and IndexedDB (survives ITP
// better on iOS Safari PWA). We hydrate from localStorage synchronously so the
// app renders without flashing the login page, then reconcile with IDB in case
// localStorage was wiped but IDB survived.

function readLocalUser(): User | null {
  try {
    const s = localStorage.getItem(USER_KEY);
    return s ? (JSON.parse(s) as User) : null;
  } catch {
    return null;
  }
}

function readLocalToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function persistAuth(user: User, token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* private mode or storage disabled */
  }
  try {
    await idbSet(TOKEN_KEY, token);
    await idbSet(USER_KEY, user);
  } catch {
    /* ignore */
  }
}

async function clearPersistedAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  try {
    await idbDel(TOKEN_KEY);
    await idbDel(USER_KEY);
  } catch {
    /* ignore */
  }
}

interface AuthState {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setUser: (user: User) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: readLocalUser(),
  token: readLocalToken(),
  hydrated: false,
  setAuth: (user, token) => {
    void persistAuth(user, token);
    set({ user, token, hydrated: true });
  },
  clearAuth: () => {
    void clearPersistedAuth();
    set({ user: null, token: null, hydrated: true });
  },
  setUser: (user) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
    void idbSet(USER_KEY, user).catch(() => {});
    set({ user });
  },
}));

// Async hydration from IndexedDB. If localStorage was empty but IDB has the
// token (iOS Safari nuked localStorage), we restore it.
(async () => {
  try {
    const [idbToken, idbUser] = await Promise.all([
      idbGet<string>(TOKEN_KEY),
      idbGet<User>(USER_KEY),
    ]);
    const current = useAuth.getState();
    if (!current.token && idbToken && idbUser) {
      // Restore from IDB
      try {
        localStorage.setItem(TOKEN_KEY, idbToken);
        localStorage.setItem(USER_KEY, JSON.stringify(idbUser));
      } catch {
        /* ignore */
      }
      useAuth.setState({ token: idbToken, user: idbUser, hydrated: true });
    } else if (current.token && !idbToken) {
      // Mirror current localStorage state into IDB for future resilience
      await idbSet(TOKEN_KEY, current.token);
      if (current.user) await idbSet(USER_KEY, current.user);
      useAuth.setState({ hydrated: true });
    } else {
      useAuth.setState({ hydrated: true });
    }
  } catch {
    useAuth.setState({ hydrated: true });
  }
})();

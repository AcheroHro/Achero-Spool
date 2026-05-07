import { nanoid } from 'nanoid';
import { DrawingState } from '../store/useStore';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;
const APPS_SCRIPT_TOKEN = import.meta.env.VITE_APPS_SCRIPT_TOKEN as string | undefined;

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  createdAt: string;
}

export interface SpoolRecord {
  id: string;
  projectId: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  drawingData: DrawingState;
  bom?: unknown;
  createdAt: string;
  updatedAt: string;
}

type ApiAction =
  | 'listProjects'
  | 'listSpools'
  | 'createProject'
  | 'deleteProject'
  | 'createSpool'
  | 'updateSpool';

const USER_STORAGE_KEY = 'achero_spool_user';

function ensureConfigured() {
  if (!APPS_SCRIPT_URL) {
    throw new Error('Falta configurar VITE_APPS_SCRIPT_URL en .env.local');
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createLocalUser(email: string): AppUser {
  const normalized = normalizeEmail(email);
  const displayName = normalized.split('@')[0] || normalized;
  return {
    uid: normalized,
    email: normalized,
    displayName,
    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff`
  };
}

export function getStoredUser(): AppUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppUser;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

export function storeUser(user: AppUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(USER_STORAGE_KEY);
}

function buildPayload(action: ApiAction, data: Record<string, unknown>) {
  return {
    action,
    token: APPS_SCRIPT_TOKEN || '',
    ...data
  };
}

function jsonp<T>(payload: Record<string, unknown>): Promise<T> {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const callbackName = `__acheroSheets_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(APPS_SCRIPT_URL!);
    url.searchParams.set('payload', JSON.stringify(payload));
    url.searchParams.set('callback', callbackName);

    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Tiempo de espera agotado consultando Google Sheets'));
    }, 20000);

    function cleanup() {
      window.clearTimeout(timeout);
      script.remove();
      delete (window as unknown as Record<string, unknown>)[callbackName];
    }

    (window as unknown as Record<string, unknown>)[callbackName] = (response: unknown) => {
      cleanup();
      const result = response as { ok?: boolean; error?: string; data?: T };
      if (!result.ok) {
        reject(new Error(result.error || 'Error desconocido de Apps Script'));
        return;
      }
      resolve(result.data as T);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('No se pudo conectar con Apps Script'));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function postNoPopup(payload: Record<string, unknown>) {
  ensureConfigured();
  const body = new URLSearchParams();
  body.set('payload', JSON.stringify(payload));

  await fetch(APPS_SCRIPT_URL!, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body
  });
}

export const sheetsApi = {
  async listProjects(user: AppUser) {
    return jsonp<ProjectRecord[]>(
      buildPayload('listProjects', { ownerId: user.uid, ownerEmail: user.email })
    );
  },

  async listSpools(user: AppUser, projectId: string) {
    return jsonp<SpoolRecord[]>(
      buildPayload('listSpools', { ownerId: user.uid, ownerEmail: user.email, projectId })
    );
  },

  async createProject(user: AppUser, name: string) {
    const project: ProjectRecord = {
      id: nanoid(),
      name,
      ownerId: user.uid,
      ownerEmail: user.email,
      createdAt: new Date().toISOString()
    };
    return jsonp<ProjectRecord>(buildPayload('createProject', { project }));
  },

  async deleteProject(user: AppUser, projectId: string) {
    await jsonp<{ deleted: boolean }>(buildPayload('deleteProject', {
      ownerId: user.uid,
      ownerEmail: user.email,
      projectId
    }));
  },

  async createSpool(user: AppUser, projectId: string, name: string, drawingData: DrawingState) {
    const now = new Date().toISOString();
    const spool: SpoolRecord = {
      id: nanoid(),
      projectId,
      name,
      ownerId: user.uid,
      ownerEmail: user.email,
      drawingData,
      createdAt: now,
      updatedAt: now
    };
    return jsonp<SpoolRecord>(buildPayload('createSpool', { spool }));
  },

  async updateSpool(user: AppUser, spool: Pick<SpoolRecord, 'id' | 'projectId' | 'drawingData' | 'bom'>) {
    await postNoPopup(buildPayload('updateSpool', {
      ownerId: user.uid,
      ownerEmail: user.email,
      spool: {
        ...spool,
        updatedAt: new Date().toISOString()
      }
    }));
  }
};

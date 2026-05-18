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
  | 'updateSpool'
  | 'deleteSpool'
  | 'renameSpool';

const USER_STORAGE_KEY = 'achero_spool_user';
const BACKUP_KEY_PREFIX = 'achero_spool_backup_';

// ─── Auth helpers ────────────────────────────────────────────────────────────

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

// ─── Offline backup helpers ───────────────────────────────────────────────────

export function saveLocalBackup(spoolId: string, data: DrawingState) {
  try {
    localStorage.setItem(
      `${BACKUP_KEY_PREFIX}${spoolId}`,
      JSON.stringify({ data, savedAt: new Date().toISOString() })
    );
  } catch {
    // localStorage puede estar lleno — ignorar silenciosamente
  }
}

export function getLocalBackup(spoolId: string): { data: DrawingState; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(`${BACKUP_KEY_PREFIX}${spoolId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLocalBackup(spoolId: string) {
  localStorage.removeItem(`${BACKUP_KEY_PREFIX}${spoolId}`);
}

// ─── Projects / Spools list cache (for offline mode) ─────────────────────────

const PROJECTS_CACHE_PREFIX = 'achero_spool_projects_';
const SPOOLS_CACHE_PREFIX   = 'achero_spool_spools_';

/** Tipo ligero: sólo metadatos de spool, sin drawingData (que puede pesar mucho). */
export type SpoolMeta = Pick<
  SpoolRecord,
  'id' | 'projectId' | 'name' | 'ownerId' | 'ownerEmail' | 'createdAt' | 'updatedAt'
>;

export function saveLocalProjectsCache(userId: string, projects: ProjectRecord[]) {
  try {
    localStorage.setItem(
      `${PROJECTS_CACHE_PREFIX}${userId}`,
      JSON.stringify({ projects, cachedAt: new Date().toISOString() })
    );
  } catch { /* ignore */ }
}

export function getLocalProjectsCache(
  userId: string
): { projects: ProjectRecord[]; cachedAt: string } | null {
  try {
    const raw = localStorage.getItem(`${PROJECTS_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveLocalSpoolsCache(projectId: string, spools: SpoolRecord[]) {
  try {
    // Sólo guardamos metadatos, no drawingData (espacio en localStorage)
    const slim: SpoolMeta[] = spools.map(({ id, projectId: pid, name, ownerId, ownerEmail, createdAt, updatedAt }) => ({
      id, projectId: pid, name, ownerId, ownerEmail, createdAt, updatedAt
    }));
    localStorage.setItem(
      `${SPOOLS_CACHE_PREFIX}${projectId}`,
      JSON.stringify({ spools: slim, cachedAt: new Date().toISOString() })
    );
  } catch { /* ignore */ }
}

export function getLocalSpoolsCache(projectId: string): SpoolMeta[] | null {
  try {
    const raw = localStorage.getItem(`${SPOOLS_CACHE_PREFIX}${projectId}`);
    if (!raw) return null;
    return JSON.parse(raw).spools as SpoolMeta[];
  } catch { return null; }
}

// ─── API transport ────────────────────────────────────────────────────────────

function buildPayload(action: ApiAction, data: Record<string, unknown>) {
  return {
    action,
    token: APPS_SCRIPT_TOKEN || '',
    ...data
  };
}

async function request<T>(payload: Record<string, unknown>): Promise<T> {
  ensureConfigured();

  try {
    const response = await fetch(APPS_SCRIPT_URL!, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json() as { ok?: boolean; error?: string; data?: T };
    if (!result.ok) {
      throw new Error(result.error || 'Error desconocido de Apps Script');
    }
    return result.data as T;
  } catch (error) {
    console.error('API Error:', error);
    // Si falla fetch (posible CORS), intentamos JSONP como último recurso solo si el payload no es gigante
    const payloadStr = JSON.stringify(payload);
    if (payloadStr.length < 4000) {
      return jsonpFallback<T>(payload);
    }
    throw new Error('No se pudo conectar con Apps Script. El dibujo puede ser demasiado grande para el transporte actual.');
  }
}

function jsonpFallback<T>(payload: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const callbackName = `__acheroSheets_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(APPS_SCRIPT_URL!);
    url.searchParams.set('payload', JSON.stringify(payload));
    url.searchParams.set('callback', callbackName);

    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Tiempo de espera agotado (JSONP Fallback)'));
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
        reject(new Error(result.error || 'Error en respuesta JSONP'));
        return;
      }
      resolve(result.data as T);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('No se pudo conectar con Apps Script (JSONP Error)'));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

/** Reintenta una vez antes de propagar el error. */
async function requestWithRetry<T>(payload: Record<string, unknown>, retries = 1): Promise<T> {
  try {
    return await request<T>(payload);
  } catch (err) {
    if (retries > 0) return requestWithRetry<T>(payload, retries - 1);
    throw err;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const sheetsApi = {
  async listProjects(user: AppUser) {
    return requestWithRetry<ProjectRecord[]>(
      buildPayload('listProjects', { ownerId: user.uid, ownerEmail: user.email })
    );
  },

  async listSpools(user: AppUser, projectId: string) {
    return requestWithRetry<SpoolRecord[]>(
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
    return requestWithRetry<ProjectRecord>(buildPayload('createProject', { project }));
  },

  async deleteProject(user: AppUser, projectId: string) {
    await requestWithRetry<{ deleted: boolean }>(buildPayload('deleteProject', {
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
    return requestWithRetry<SpoolRecord>(buildPayload('createSpool', { spool }));
  },

  async updateSpool(user: AppUser, spool: Pick<SpoolRecord, 'id' | 'projectId' | 'drawingData' | 'bom'>) {
    await requestWithRetry<{ updated: boolean }>(buildPayload('updateSpool', {
      ownerId: user.uid,
      ownerEmail: user.email,
      spool: {
        ...spool,
        updatedAt: new Date().toISOString()
      }
    }));
  },

  async deleteSpool(user: AppUser, spoolId: string) {
    await requestWithRetry<{ deleted: boolean }>(buildPayload('deleteSpool', {
      ownerId: user.uid,
      spoolId
    }));
  },

  async renameSpool(user: AppUser, spoolId: string, newName: string) {
    await requestWithRetry<{ renamed: boolean }>(buildPayload('renameSpool', {
      ownerId: user.uid,
      spoolId,
      newName
    }));
  }
};

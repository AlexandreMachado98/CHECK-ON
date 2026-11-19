import * as Network from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { appLogin, currentSession, loadSession, logout as apiLogout, onSessionChange, SessionEndedError } from './api';
import { cleanupPhotos, downloadBootstrap, enqueue, discard, readBootstrap, readQueue, syncQueue } from './outbox';
import { keys, writeJson } from './storage';
import type { Bootstrap, QueuedInspection, SessionUser } from './types';
import type { SyncSummary } from './sync-core';

/** Dados com mais de 15 minutos são atualizados sozinhos quando há internet. */
const STALE_MS = 15 * 60 * 1000;
const RETRY_MS = 2 * 60 * 1000;

type AppStateValue = {
  ready: boolean;
  user: SessionUser | null;
  /** Mensagem mostrada na tela de login quando a sessão terminou sozinha (ex.: acesso bloqueado). */
  sessionMessage: string | null;
  login: (companyCode: string, matricula: string) => Promise<void>;
  logout: () => Promise<void>;
  online: boolean;
  bootstrap: Bootstrap | null;
  loadingBootstrap: boolean;
  bootstrapError: string | null;
  refreshBootstrap: () => Promise<void>;
  queue: QueuedInspection[];
  syncing: boolean;
  lastSync: SyncSummary | null;
  sync: () => Promise<SyncSummary | null>;
  addToQueue: (item: QueuedInspection) => Promise<void>;
  discardFromQueue: (clientId: string) => Promise<void>;
};

const Context = createContext<AppStateValue | null>(null);

export function useApp(): AppStateValue {
  const value = useContext(Context);
  if (!value) throw new Error('useApp fora do AppProvider');
  return value;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedInspection[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncSummary | null>(null);
  const network = Network.useNetworkState();
  // isInternetReachable pode vir indefinido no início: só considera offline quando o aparelho diz que não há conexão.
  const online = network.isConnected !== false && network.isInternetReachable !== false;
  const userRef = useRef<SessionUser | null>(null);
  userRef.current = user;

  const handleError = useCallback((error: unknown) => {
    if (error instanceof SessionEndedError) setSessionMessage(error.message);
  }, []);

  // Sessão salva no aparelho: o motorista continua conectado mesmo sem internet.
  useEffect(() => {
    let alive = true;
    loadSession().then(async (session) => {
      if (!alive) return;
      if (session) {
        const [cached, stored] = await Promise.all([readBootstrap(session.user.id), readQueue(session.user.id)]);
        setBootstrap(cached);
        setQueue(stored);
        setUser(session.user);
      }
      setReady(true);
    });
    const unsubscribe = onSessionChange((session) => {
      if (!session) {
        setUser(null);
        setBootstrap(null);
        setQueue([]);
      } else setUser(session.user);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const refreshQueue = useCallback(async () => {
    const id = userRef.current?.id;
    if (id) setQueue(await readQueue(id));
  }, []);

  const refreshBootstrap = useCallback(async () => {
    const id = userRef.current?.id;
    if (!id) return;
    setLoadingBootstrap(true);
    try {
      setBootstrap(await downloadBootstrap(id));
      setBootstrapError(null);
    } catch (error) {
      handleError(error);
      setBootstrapError(error instanceof Error ? error.message : 'Não foi possível atualizar os dados.');
    } finally {
      setLoadingBootstrap(false);
    }
  }, [handleError]);

  const sync = useCallback(async () => {
    const id = userRef.current?.id;
    if (!id) return null;
    setSyncing(true);
    try {
      const summary = await syncQueue(id);
      setLastSync(summary);
      if (summary.sent > 0) {
        // Inspeção enviada pode ter aberto NC ou mudado o status do veículo.
        refreshBootstrap();
        cleanupPhotos(id);
      }
      return summary;
    } catch (error) {
      handleError(error);
      return null;
    } finally {
      await refreshQueue();
      setSyncing(false);
    }
  }, [handleError, refreshBootstrap, refreshQueue]);

  const login = useCallback(async (companyCode: string, matricula: string) => {
    const session = await appLogin(companyCode, matricula);
    await writeJson(keys.lastCompanyCode, companyCode);
    setSessionMessage(null);
    const [cached, stored] = await Promise.all([readBootstrap(session.user.id), readQueue(session.user.id)]);
    setBootstrap(cached);
    setQueue(stored);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    setSessionMessage(null);
    await apiLogout();
  }, []);

  const addToQueue = useCallback(
    async (item: QueuedInspection) => {
      const id = userRef.current?.id;
      if (!id) return;
      await enqueue(id, item);
      await refreshQueue();
      if (online) sync();
    },
    [online, refreshQueue, sync],
  );

  const discardFromQueue = useCallback(
    async (clientId: string) => {
      const id = userRef.current?.id;
      if (!id) return;
      await discard(id, clientId);
      await refreshQueue();
    },
    [refreshQueue],
  );

  // Ao entrar, ao voltar a internet e ao abrir o app: atualiza os dados e envia a fila.
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const bootstrapRef = useRef(bootstrap);
  bootstrapRef.current = bootstrap;
  const catchUp = useCallback(() => {
    if (!userRef.current || !onlineRef.current || !currentSession()) return;
    const downloadedAt = bootstrapRef.current?.downloadedAt;
    if (!downloadedAt || Date.now() - new Date(downloadedAt).getTime() > STALE_MS) refreshBootstrap();
    sync();
  }, [refreshBootstrap, sync]);

  useEffect(() => {
    if (user && online) catchUp();
  }, [user?.id, online, catchUp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') catchUp();
    });
    return () => subscription.remove();
  }, [catchUp]);

  const hasPending = queue.some((item) => item.state === 'PENDING');
  useEffect(() => {
    if (!hasPending || !online) return;
    const timer = setInterval(() => sync(), RETRY_MS);
    return () => clearInterval(timer);
  }, [hasPending, online, sync]);

  const value = useMemo<AppStateValue>(
    () => ({
      ready, user, sessionMessage, login, logout, online, bootstrap, loadingBootstrap, bootstrapError,
      refreshBootstrap, queue, syncing, lastSync, sync, addToQueue, discardFromQueue,
    }),
    [ready, user, sessionMessage, login, logout, online, bootstrap, loadingBootstrap, bootstrapError,
      refreshBootstrap, queue, syncing, lastSync, sync, addToQueue, discardFromQueue],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

import { useState, useCallback, useEffect, useRef } from 'react';

interface DepState {
  installed: boolean;
  version: string | null;
  path: string | null;
  installHint: string;
}

export interface DependencyStatus {
  node: DepState;
  nats: DepState;
  docker: DepState;
  dockerImage: DepState;
  allReady: boolean;
}

const EMPTY_DEP: DepState = { installed: false, version: null, path: null, installHint: '' };
const EMPTY_STATUS: DependencyStatus = {
  node: EMPTY_DEP,
  nats: EMPTY_DEP,
  docker: EMPTY_DEP,
  dockerImage: EMPTY_DEP,
  allReady: false,
};

export function useDependencyCheck() {
  const [status, setStatus] = useState<DependencyStatus>(EMPTY_STATUS);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkDeps = useCallback(async () => {
    try {
      if (!window.__TAURI_INTERNALS__) {
        // Dev mode — pretend everything is ready
        setStatus({
          node: { installed: true, version: 'dev', path: '/dev', installHint: '' },
          nats: { installed: true, version: 'dev', path: '/dev', installHint: '' },
          docker: { installed: true, version: 'dev', path: '/dev', installHint: '' },
          dockerImage: { installed: true, version: 'dev', path: null, installHint: '' },
          allReady: true,
        });
        setChecking(false);
        return;
      }
      const { invoke } = await import('@tauri-apps/api/core');
      const raw = await invoke<{
        node: { installed: boolean; version: string | null; path: string | null; install_hint: string };
        nats: { installed: boolean; version: string | null; path: string | null; install_hint: string };
        docker: { installed: boolean; version: string | null; path: string | null; install_hint: string };
        docker_image: { installed: boolean; version: string | null; path: string | null; install_hint: string };
        all_ready: boolean;
      }>('check_dependencies');

      setStatus({
        node: { installed: raw.node.installed, version: raw.node.version, path: raw.node.path, installHint: raw.node.install_hint },
        nats: { installed: raw.nats.installed, version: raw.nats.version, path: raw.nats.path, installHint: raw.nats.install_hint },
        docker: { installed: raw.docker.installed, version: raw.docker.version, path: raw.docker.path, installHint: raw.docker.install_hint },
        dockerImage: { installed: raw.docker_image.installed, version: raw.docker_image.version, path: raw.docker_image.path, installHint: raw.docker_image.install_hint },
        allReady: raw.all_ready,
      });
    } catch {
      // Keep current state
    } finally {
      setChecking(false);
    }
  }, []);

  const installDep = useCallback(async (depName: string) => {
    if (!window.__TAURI_INTERNALS__) return;
    setInstalling(depName);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('install_dependency', { depName });
      await checkDeps(); // Refresh status after install
    } catch (err) {
      console.error('[fusio] Install failed:', err);
    } finally {
      setInstalling(null);
    }
  }, [checkDeps]);

  const openDockerDownload = useCallback(async () => {
    if (!window.__TAURI_INTERNALS__) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_docker_download');
    } catch {
      // fallback
      window.open('https://www.docker.com/products/docker-desktop/', '_blank');
    }
  }, []);

  // Check on mount
  useEffect(() => {
    checkDeps();
  }, [checkDeps]);

  // Poll every 5s while not all ready (catches Docker Desktop being launched)
  useEffect(() => {
    if (!status.allReady) {
      pollRef.current = setInterval(checkDeps, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [status.allReady, checkDeps]);

  return { status, checking, installing, checkDeps, installDep, openDockerDownload };
}

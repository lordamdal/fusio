import { useState, useEffect, useCallback } from 'react';

interface WalletState {
  address: string | null;
  hasKeypair: boolean;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, hasKeypair: false });
  const [loading, setLoading] = useState(true);

  const loadWallet = useCallback(async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const has = await invoke<boolean>('has_keypair');
        if (has) {
          const key = await invoke<string | null>('load_keypair');
          setWallet({ address: key ? key.slice(0, 16) + '...' : null, hasKeypair: true });
        } else {
          setWallet({ address: null, hasKeypair: false });
        }
      } else {
        // localStorage fallback for dev
        const stored = localStorage.getItem('fusio_wallet');
        if (stored) {
          setWallet({ address: stored.slice(0, 16) + '...', hasKeypair: true });
        }
      }
    } catch {
      const stored = localStorage.getItem('fusio_wallet');
      if (stored) {
        setWallet({ address: stored.slice(0, 16) + '...', hasKeypair: true });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const generateKeypair = useCallback(async () => {
    // Generate a mock keypair for dev/demo
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

    try {
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('store_keypair', { privateKeyHex: hex });
      } else {
        localStorage.setItem('fusio_wallet', hex);
      }
    } catch {
      localStorage.setItem('fusio_wallet', hex);
    }

    setWallet({ address: hex.slice(0, 16) + '...', hasKeypair: true });
    return hex;
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  return { wallet, loading, generateKeypair, loadWallet };
}

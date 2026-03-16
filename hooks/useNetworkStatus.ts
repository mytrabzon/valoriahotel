import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
}

/**
 * İnternet bağlantı durumunu döner. null = henüz bilinmiyor.
 */
export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: null,
    isInternetReachable: null,
    type: null,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((info) => {
      setState({
        isConnected: info.isConnected ?? null,
        isInternetReachable: info.isInternetReachable ?? null,
        type: info.type ?? null,
      });
    });

    NetInfo.fetch().then((info) => {
      setState({
        isConnected: info.isConnected ?? null,
        isInternetReachable: info.isInternetReachable ?? null,
        type: info.type ?? null,
      });
    });

    return () => unsubscribe();
  }, []);

  return state;
}

/** Bağlantı yoksa true (offline) */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  if (isConnected === null) return false;
  if (!isConnected) return true;
  return isInternetReachable === false;
}

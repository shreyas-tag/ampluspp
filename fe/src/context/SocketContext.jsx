import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [lastEvent, setLastEvent] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!token || !user?._id) {
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    socket.on('app:event', (event) => {
      setLastEvent(event);
      setEvents((prev) => [event, ...prev].slice(0, 20));

      if (typeof window !== 'undefined' && Notification.permission === 'granted') {
        new Notification(event.title, { body: event.message });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user?._id]);

  const requestBrowserNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.requestPermission();
  };

  const value = useMemo(
    () => ({
      lastEvent,
      events,
      requestBrowserNotificationPermission
    }),
    [lastEvent, events]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocketEvents = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocketEvents must be used inside SocketProvider');
  return context;
};

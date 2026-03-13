import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Module-level singleton — one connection shared across all components.
// Created on first import; never disconnected while the app is alive.
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  autoConnect: true,
});

export function useSocket() {
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect()    { setConnected(true); }
    function onDisconnect() { setConnected(false); }

    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);

    // Sync immediately in case we mounted after the connect event fired
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect',    onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket, connected };
}

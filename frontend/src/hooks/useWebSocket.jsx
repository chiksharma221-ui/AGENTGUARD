import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

export const useWebSocket = (customPath = '/ws/approvals') => {
  const { token, isAuthenticated } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED'); // CONNECTING, OPEN, CLOSING, CLOSED, DISCONNECTED
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;

  const getWsUrl = useCallback(() => {
    const rawWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    // ensure no double slashes
    const baseUrl = rawWsUrl.replace(/\/+$/, '');
    const cleanPath = customPath.startsWith('/') ? customPath : `/${customPath}`;
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${baseUrl}${cleanPath}${tokenParam}`;
  }, [customPath, token]);

  const connect = useCallback(() => {
    if (!isAuthenticated) {
      setConnectionStatus('DISCONNECTED');
      setIsConnected(false);
      return;
    }

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('CONNECTING');

    try {
      const url = getWsUrl();
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('OPEN');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLastMessage(parsed);
          setMessages((prev) => [...prev.slice(-99), parsed]); // keep last 100 messages
        } catch {
          const rawData = { text: event.data, timestamp: new Date().toISOString() };
          setLastMessage(rawData);
          setMessages((prev) => [...prev.slice(-99), rawData]);
        }
      };

      ws.onerror = () => {
        setConnectionStatus('ERROR');
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('CLOSED');

        // Auto-reconnect with exponential backoff if authenticated and not a normal clean closure
        if (isAuthenticated && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 15000);
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      setConnectionStatus('CLOSED');
      setIsConnected(false);
    }
  }, [isAuthenticated, getWsUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socketRef.current) {
      socketRef.current.close(1000, 'User initiated disconnect');
      socketRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('DISCONNECTED');
  }, []);

  const sendMessage = useCallback((data) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      socketRef.current.send(payload);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  return {
    messages,
    lastMessage,
    connectionStatus,
    isConnected,
    sendMessage,
    reconnect: connect,
  };
};

export default useWebSocket;

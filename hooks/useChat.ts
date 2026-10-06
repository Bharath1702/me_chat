"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PublicMessage, PublicMedia } from "@/lib/services/message-service";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

type UseChatReturn = {
  connectionState: ConnectionState;
  partnerOnline: boolean;
  partnerTyping: boolean;
  messages: PublicMessage[];
  setMessages: React.Dispatch<React.SetStateAction<PublicMessage[]>>;
  hasMore: boolean;
  loadingMore: boolean;
  incomingCallSignal: any;
  sendCallSignal: (signal: any) => void;
  sendMessage: (content: string, media?: PublicMedia | null, replyToId?: string) => void;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string, forEveryone?: boolean) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
  loadMoreMessages: () => Promise<void>;
  markAsRead: () => void;
};

export function useChat(currentUserId: string): UseChatReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [incomingCallSignal, setIncomingCallSignal] = useState<any>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const connectSocketRef = useRef<() => void>(() => {});

  // Load initial 50 messages via REST
  useEffect(() => {
    let isMounted = true;
    async function initMessages() {
      try {
        const res = await fetch("/api/messages?limit=50", { credentials: "same-origin" });
        const data = await res.json();
        if (isMounted && data.ok) {
          setMessages(data.messages);
          setHasMore(data.hasMore);
        }
      } catch (err) {
        console.error("[useChat] Error fetching initial messages:", err);
      }
    }
    initMessages();
    return () => {
      isMounted = false;
    };
  }, []);

  // Setup WebSocket connection with automatic exponential backoff reconnect
  const connectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const customWsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = customWsUrl || `${protocol}//${window.location.host}/api/ws`;

    setConnectionState((prev) => (prev === "connecting" ? "connecting" : "reconnecting"));

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "presence": {
            setPartnerOnline(data.status === "online");
            break;
          }

          case "call_signal": {
            if (data.signal) {
              setIncomingCallSignal(data.signal);
            }
            break;
          }

          case "typing": {
            setPartnerTyping(!!data.isTyping);
            if (data.isTyping) {
              if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
              typingTimerRef.current = setTimeout(() => {
                setPartnerTyping(false);
              }, 4000);
            }
            break;
          }

          case "new_message": {
            const newMsg: PublicMessage = data.message;
            setMessages((prev) => {
              // Deduplicate
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            break;
          }

          case "message_ack": {
            const { clientMessageId, message: canonical } = data;
            setMessages((prev) =>
              prev.map((m) =>
                m.clientMessageId === clientMessageId || m.id === clientMessageId ? canonical : m
              )
            );
            break;
          }

          case "message_error": {
            const { clientMessageId } = data;
            setMessages((prev) =>
              prev.map((m) =>
                m.clientMessageId === clientMessageId ? { ...m, status: "sending" } : m
              )
            );
            break;
          }

          case "message_delivered": {
            const { messageId } = data;
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? { ...m, status: "delivered" } : m))
            );
            break;
          }

          case "messages_delivered": {
            setMessages((prev) =>
              prev.map((m) =>
                m.senderId === currentUserId && m.status === "sent"
                  ? { ...m, status: "delivered" }
                  : m
              )
            );
            break;
          }

          case "messages_read": {
            setMessages((prev) =>
              prev.map((m) =>
                m.senderId === currentUserId
                  ? { ...m, status: "read", readAt: new Date().toISOString() }
                  : m
              )
            );
            break;
          }

          case "message_updated": {
            const updated: PublicMessage = data.message;
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            );
            break;
          }
        }
      } catch (err) {
        console.error("[useChat] Error processing WS payload:", err);
      }
    };

    ws.onclose = () => {
      setConnectionState("disconnected");
      socketRef.current = null;

      // Exponential backoff reconnect: 1s, 2s, 4s, capped at 10s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
      reconnectAttemptsRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        if (socketRef.current === null) {
          connectSocketRef.current();
        }
      }, delay);
    };

    ws.onerror = (err) => {
      console.error("[useChat] WS error:", err);
    };
  }, [currentUserId]);

  useEffect(() => {
    connectSocketRef.current = connectSocket;
  }, [connectSocket]);

  useEffect(() => {
    const timer = setTimeout(() => {
      connectSocket();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connectSocket]);

  const sendMessage = useCallback((content: string, media?: PublicMedia | null, replyToId?: string) => {
    const isMedia = !!media;
    if (!isMedia && (!content || !content.trim())) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const clientMessageId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    let msgType: "text" | "emoji" | "image" | "audio" = "text";
    if (media) {
      msgType = media.mimeType.startsWith("audio/") ? "audio" : "image";
    }

    const optimisticMsg: PublicMessage = {
      id: clientMessageId,
      coupleId: "",
      senderId: currentUserId,
      receiverId: "",
      type: msgType,
      content: content ? content.trim() : "",
      media: media || null,
      status: "sending",
      isEdited: false,
      isDeleted: false,
      deletedForEveryone: false,
      reactions: [],
      createdAt: now,
      updatedAt: now,
      readAt: null,
      deliveredAt: null,
      clientMessageId,
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    socketRef.current.send(
      JSON.stringify({
        type: "send_message",
        content: content ? content.trim() : "",
        clientMessageId,
        media: media || undefined,
        replyToId,
      })
    );
  }, [currentUserId]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)));
      }
    } catch (err) {
      console.error("[useChat] Error editing message:", err);
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string, forEveryone = false) => {
    try {
      const res = await fetch(`/api/messages/${messageId}?forEveryone=${forEveryone}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)));
      }
    } catch (err) {
      console.error("[useChat] Error deleting message:", err);
    }
  }, []);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)));
      }
    } catch (err) {
      console.error("[useChat] Error toggling reaction:", err);
    }
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "typing", isTyping }));
    }
  }, []);

  const sendCallSignal = useCallback((signal: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "call_signal", signal }));
    }
  }, []);

  const markAsRead = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "mark_read" }));
    }
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);

    const oldestId = messages[0].id;
    try {
      const res = await fetch(`/api/messages?limit=50&before=${oldestId}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(data.hasMore);
      }
    } catch (err) {
      console.error("[useChat] Error loading more messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, messages]);

  return {
    connectionState,
    partnerOnline,
    partnerTyping,
    messages,
    setMessages,
    hasMore,
    loadingMore,
    incomingCallSignal,
    sendCallSignal,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    sendTyping,
    loadMoreMessages,
    markAsRead,
  };
}

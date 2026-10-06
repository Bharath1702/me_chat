"use client";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { LogoMark } from "@/components/ui/Logo";
import { useChat } from "@/hooks/useChat";
import { FullscreenImageViewer } from "@/components/chat/FullscreenImageViewer";
import { AudioRecorder } from "@/components/chat/AudioRecorder";
import { CustomAudioPlayer } from "@/components/chat/CustomAudioPlayer";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import { SearchModal } from "@/components/chat/SearchModal";
import { SettingsModal } from "@/components/chat/SettingsModal";
import { ReactionsModal } from "@/components/chat/ReactionsModal";
import type { PublicMedia, PublicMessage } from "@/lib/services/message-service";
import { formatLocalTime, groupMessagesByDate } from "@/lib/utils/date";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
  type DragEvent,
  type ChangeEvent,
  type TouchEvent,
} from "react";

const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🔥"];

interface ChatShellProps {
  currentUserId: string;
  currentUserName: string;
  partnerName: string;
}

export function ChatShell({ currentUserId, currentUserName, partnerName }: ChatShellProps) {
  const {
    connectionState,
    partnerOnline,
    partnerTyping,
    messages,
    hasMore,
    loadingMore,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    sendTyping,
    loadMoreMessages,
    markAsRead,
  } = useChat(currentUserId);

  const [inputContent, setInputContent] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Iteration 4 interactive states
  const [replyingTo, setReplyingTo] = useState<PublicMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<PublicMessage | null>(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [reactionMenuMessageId, setReactionMenuMessageId] = useState<string | null>(null);
  const [selectedReactionModalMessage, setSelectedReactionModalMessage] = useState<PublicMessage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Touch & Swipe states
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Media upload & preview states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; alt?: string } | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const previousMessagesLength = useRef(messages.length);

  // Sound chime helper
  const playNotificationSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // AudioContext policy fallback
    }
  };

  // Sound & Browser Notification trigger
  useEffect(() => {
    if (messages.length > previousMessagesLength.current) {
      const latest = messages[messages.length - 1];
      if (latest && latest.senderId !== currentUserId) {
        playNotificationSound();

        if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(partnerName, {
            body: latest.type === "text" ? latest.content : latest.type === "image" ? "📷 Photo message" : "🎙️ Voice message",
            icon: "/favicon.ico",
          });
        }
      }
    }
    previousMessagesLength.current = messages.length;
  }, [messages, currentUserId, partnerName, soundEnabled]);

  // Auto-scroll logic
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
      setUnreadCount(0);
    }
  };

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;

    if (el.scrollTop < 60 && hasMore && !loadingMore) {
      const oldScrollHeight = el.scrollHeight;
      loadMoreMessages().then(() => {
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop =
              messagesContainerRef.current.scrollHeight - oldScrollHeight;
          }
        });
      });
    }

    const threshold = 120;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distanceToBottom < threshold;
    setIsNearBottom(near);

    if (near) {
      setUnreadCount(0);
      markAsRead();
    }
  };

  // Initial scroll to bottom & scroll on new message
  useEffect(() => {
    if (messages.length > 0) {
      // Small timeout ensures DOM layout and media image heights have rendered
      const timer = setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 50);
      markAsRead();
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Handle mobile keyboard focus & viewport resize (especially iOS Safari)
  const handleInputFocus = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      window.scrollTo(0, 0);
    }, 300);
  };

  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport) {
        window.scrollTo(0, 0);
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportResize);
      return () => {
        window.visualViewport?.removeEventListener("resize", handleViewportResize);
      };
    }
  }, []);

  const handleInputChange = (val: string) => {
    setInputContent(val);
    sendTyping(true);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  // Process File upload to Object Storage via server upload proxy
  const processAndUploadFile = async (
    file: File,
    kind: "image" | "audio",
    extraMeta?: { duration?: number }
  ) => {
    setMediaUploadError(null);
    setIsUploading(true);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);

      setUploadProgress(40);

      const uploadRes = await fetch("/api/media/upload", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.ok) {
        throw new Error(uploadData.error || "Failed to upload media file.");
      }

      setUploadProgress(85);

      // Extract image dimensions if image
      let width: number | undefined;
      let height: number | undefined;
      if (kind === "image") {
        try {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          await new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          });
          width = img.width;
          height = img.height;
        } catch {
          // fallback
        }
      }

      const mediaPayload: PublicMedia = {
        storageKey: uploadData.storageKey,
        url: uploadData.publicUrl,
        mimeType: file.type,
        size: file.size,
        fileName: file.name,
        width: width || null,
        height: height || null,
        duration: extraMeta?.duration || null,
      };

      // 3. Send Message over WebSocket with media attachment directly
      sendMessage("", mediaPayload);
      setInputContent("");
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      setIsUploading(false);
      setUploadProgress(100);

      setTimeout(() => scrollToBottom("smooth"), 50);
    } catch (err: unknown) {
      console.error("[ChatShell] Media upload error:", err);
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setMediaUploadError(msg);
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMediaUploadError("Please select a valid image file (JPEG, PNG, WebP, GIF).");
      return;
    }

    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  // Clipboard Paste Image interceptor
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setSelectedImageFile(file);
          setImagePreviewUrl(URL.createObjectURL(file));
        }
        break;
      }
    }
  };

  const dragCounterRef = useRef(0);

  // Drag & Drop handlers with counter to prevent lag/flicker over child elements
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    } else {
      setMediaUploadError("Please drop a valid image file (JPEG, PNG, WebP, GIF).");
    }
  };

  const handleCopy = (msg: PublicMessage) => {
    if (msg.content) {
      navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (selectedImageFile) {
      processAndUploadFile(selectedImageFile, "image");
      return;
    }

    if (!inputContent.trim()) return;

    // Edit mode: update existing message instead of sending a new one
    if (editingMessage) {
      editMessage(editingMessage.id, inputContent.trim());
      setEditingMessage(null);
      setInputContent("");
      sendTyping(false);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      return;
    }

    // Send new message, include replyToId if replying
    sendMessage(inputContent, null, replyingTo?.id);
    setInputContent("");
    setReplyingTo(null);
    sendTyping(false);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

    setTimeout(() => scrollToBottom("smooth"), 50);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="flex h-dvh w-full flex-col bg-ink-950 text-mist relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink-950/90 backdrop-blur-md border-2 border-dashed border-teal-soft p-6 text-center animate-fade-up pointer-events-none">
          <span className="text-4xl mb-3">🖼️</span>
          <p className="font-serif text-2xl text-mist">Drop image here</p>
          <p className="text-xs text-mist-dim mt-1">Send photo to {partnerName}</p>
        </div>
      )}

      {/* Fullscreen Image Viewer Modal */}
      {fullscreenImage && (
        <FullscreenImageViewer
          src={fullscreenImage.url}
          alt={fullscreenImage.alt}
          onClose={() => setFullscreenImage(null)}
        />
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Search & Settings Modals */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectMessage={(msgId) => {
          setHighlightedMessageId(msgId);
          const el = document.getElementById(`msg-${msgId}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => setHighlightedMessageId(null), 2500);
        }}
      />

      {/* Reactions Modal */}
      {selectedReactionModalMessage && (
        <ReactionsModal
          isOpen={!!selectedReactionModalMessage}
          onClose={() => setSelectedReactionModalMessage(null)}
          reactions={selectedReactionModalMessage.reactions}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          partnerName={partnerName}
          onRemoveReaction={(emoji) => {
            toggleReaction(selectedReactionModalMessage.id, emoji);
            setSelectedReactionModalMessage(null);
          }}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUserName={currentUserName}
        partnerName={partnerName}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
      />

      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-ink-900/60 px-4 sm:px-6 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-teal-soft/20 to-plum/20 border border-white/10 text-teal-soft font-serif font-medium text-lg">
            {partnerName.charAt(0).toUpperCase()}
            <span
              className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-ink-900 ${
                partnerOnline ? "bg-teal-soft" : "bg-mist-dim/40"
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-rose-soft text-sm">❤️</span>
              <h1 className="font-semibold text-mist leading-tight">{partnerName}</h1>
            </div>
            <p className="text-xs font-medium">
              {partnerTyping ? (
                <span className="text-plum animate-pulse-soft">typing...</span>
              ) : partnerOnline ? (
                <span className="text-teal-soft">🟢 online</span>
              ) : (
                <span className="text-mist-dim/60">offline</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search conversation"
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-mist-dim hover:text-mist hover:bg-white/10 transition text-sm"
          >
            🔍
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-mist-dim hover:text-mist hover:bg-white/10 transition text-sm"
          >
            ⚙️
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionState === "connected"
                  ? "bg-teal-soft"
                  : connectionState === "reconnecting" || connectionState === "connecting"
                  ? "bg-amber-400 animate-ping"
                  : "bg-rose-soft"
              }`}
            />
            <span className="capitalize text-mist-dim">{connectionState}</span>
          </div>

          <LogoutButton id="chat-logout" />
        </div>
      </header>

      {/* Main Chat Messages Container */}
      <main
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="chat-canvas flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-3 relative"
      >
        {loadingMore && (
          <div className="text-center text-xs text-mist-dim py-2">
            Loading older messages...
          </div>
        )}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 glass max-w-sm mx-auto p-6 rounded-3xl border border-white/10">
            <LogoMark className="h-10 w-10 text-teal-soft" />
            <h2 className="font-serif text-xl text-mist">Your Private Corner</h2>
            <p className="text-xs text-mist-dim">
              This space is just for you and {partnerName}. Send a text, photo or voice note to start!
            </p>
          </div>
        ) : (
          groupMessagesByDate(messages).map((group) => (
            <div key={group.dateKey} className="space-y-3">
              {/* WhatsApp-style Date Divider */}
              <div className="my-4 flex items-center justify-center">
                <span className="rounded-full border border-white/10 bg-ink-900/90 px-3.5 py-1 text-[11px] font-medium text-mist-dim shadow-sm backdrop-blur-md">
                  {group.label}
                </span>
              </div>

              {group.messages.map((msg) => {
                const isMe = msg.senderId === currentUserId;
                const senderName = isMe ? currentUserName : partnerName;
                const initial = senderName ? senderName.charAt(0).toUpperCase() : "?";
                const isMenuOpen = activeMenuMessageId === msg.id;
                const isReactionOpen = reactionMenuMessageId === msg.id;
                const isHighlighted = highlightedMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`group/msg relative flex flex-col transition-colors duration-500 p-1 rounded-2xl ${
                      isMe ? "items-end" : "items-start"
                    } ${isHighlighted ? "bg-teal-soft/20 ring-2 ring-teal-soft/50" : ""}`}
                  >
                    {/* Sender Name & Avatar Badge */}
                    <div
                      className={`flex items-center gap-1.5 mb-1 px-1 text-xs text-mist-dim/80 font-medium ${
                        isMe ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-teal-soft uppercase border border-white/10">
                        {initial}
                      </span>
                      <span>{senderName}</span>
                    </div>

                    {/* Quick Reactions Bar Popover */}
                    {/* Quick Reactions Bar Popover */}
                    {isReactionOpen && (
                      <div
                        className={`absolute -top-10 z-30 flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-900/95 px-3 py-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 ${
                          isMe ? "right-0" : "left-0"
                        }`}
                      >
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              toggleReaction(msg.id, emoji);
                              setReactionMenuMessageId(null);
                            }}
                            className="text-lg hover:scale-125 transition transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Message Container Bubble with Swipe-to-Reply & Hold-for-Options */}
                    <div
                      className={`relative flex items-center gap-1.5 group/bubble transition-transform duration-150 ${
                        isMe ? "flex-row-reverse" : "flex-row"
                      }`}
                      style={{
                        transform:
                          swipingMessageId === msg.id && swipeOffset > 0
                            ? `translateX(${isMe ? -Math.min(swipeOffset, 70) : Math.min(swipeOffset, 70)}px)`
                            : "none",
                        WebkitUserSelect: "none",
                        userSelect: "none",
                      }}
                      onTouchStart={(e: TouchEvent) => {
                        // Prevent Chrome's default text selection on long-press
                        e.preventDefault();
                        const touch = e.touches[0];
                        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                        setSwipingMessageId(msg.id);

                        // Long press hold handler (500ms hold opens menu)
                        longPressTimerRef.current = setTimeout(() => {
                          if (!msg.isDeleted) {
                            setActiveMenuMessageId(msg.id);
                            if (navigator.vibrate) navigator.vibrate(40);
                          }
                        }, 500);
                      }}
                      onTouchMove={(e: TouchEvent) => {
                        if (!touchStartPosRef.current) return;
                        const touch = e.touches[0];
                        const deltaX = touch.clientX - touchStartPosRef.current.x;
                        const deltaY = touch.clientY - touchStartPosRef.current.y;

                        // Cancel long press if user moves finger
                        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                        }

                        // Swipe direction: own messages = right-to-left (negative deltaX), partner = left-to-right (positive deltaX)
                        if (isMe) {
                          if (deltaX < 0 && Math.abs(deltaY) < 30) {
                            setSwipeOffset(Math.abs(deltaX));
                          }
                        } else {
                          if (deltaX > 0 && Math.abs(deltaY) < 30) {
                            setSwipeOffset(deltaX);
                          }
                        }
                      }}
                      onTouchEnd={() => {
                        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

                        if (swipingMessageId === msg.id && swipeOffset > 50 && !msg.isDeleted) {
                          setReplyingTo(msg);
                          if (navigator.vibrate) navigator.vibrate(20);
                        }

                        setSwipingMessageId(null);
                        setSwipeOffset(0);
                        touchStartPosRef.current = null;
                      }}
                    >
                      <div
                        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl p-2.5 text-sm leading-relaxed ${
                          msg.isDeleted
                            ? "bg-white/5 text-mist-dim italic border border-white/5 rounded-2xl"
                            : isMe
                            ? "bg-gradient-to-r from-teal-deep to-teal-soft text-ink-950 font-medium rounded-br-xs shadow-md"
                            : "glass text-mist border border-white/10 rounded-bl-xs"
                        }`}
                      >
                        {/* Reply Preview Header — tap to scroll to original message */}
                        {msg.replyTo && !msg.isDeleted && (
                          <div
                            className="mb-2 p-2 rounded-xl bg-black/20 border-l-2 border-teal-soft text-xs text-mist-dim space-y-0.5 cursor-pointer active:bg-black/30 transition"
                            onClick={() => {
                              const targetId = msg.replyTo!.messageId;
                              const el = document.getElementById(`msg-${targetId}`);
                              if (el) {
                                el.scrollIntoView({ behavior: "smooth", block: "center" });
                                setHighlightedMessageId(targetId);
                                setTimeout(() => setHighlightedMessageId(null), 2500);
                              }
                            }}
                          >
                            <p className="font-semibold text-teal-soft">Replying to message</p>
                            <p className="line-clamp-1 italic">{msg.replyTo.content}</p>
                          </div>
                        )}

                        {/* Image Message */}
                        {!msg.isDeleted && msg.type === "image" && msg.media && (
                          <div className="mb-1 overflow-hidden rounded-xl bg-black/20">
                            <img
                              src={msg.media.url}
                              alt="Shared media"
                              onClick={() => setFullscreenImage({ url: msg.media!.url, alt: "Shared photo" })}
                              className="max-h-72 w-full object-cover cursor-pointer transition hover:opacity-90"
                            />
                          </div>
                        )}

                        {/* Audio Message */}
                        {!msg.isDeleted && msg.type === "audio" && msg.media && (
                          <CustomAudioPlayer
                            src={msg.media.url}
                            duration={msg.media.duration}
                            isMe={isMe}
                          />
                        )}

                        {/* Text Content */}
                        {msg.content && <p className="px-1">{msg.content}</p>}

                        {/* Edited Marker */}
                        {msg.isEdited && !msg.isDeleted && (
                          <span className="text-[10px] opacity-60 ml-2 font-normal">
                            (edited)
                          </span>
                        )}
                      </div>

                      {/* Three Dots Action Menu Trigger & Dropdown Modal Container */}
                      {!msg.isDeleted && (
                        <div className="relative flex items-center shrink-0">
                          <button
                            onClick={() => {
                              setActiveMenuMessageId(isMenuOpen ? null : msg.id);
                              setReactionMenuMessageId(null);
                            }}
                            className="opacity-0 group-hover/msg:opacity-100 text-mist-dim hover:text-mist p-1.5 rounded-lg transition hover:bg-white/5"
                            aria-label="Message options"
                          >
                            ⋮
                          </button>

                          {/* Dropdown Action Menu positioned next to the three dots icon */}
                          {isMenuOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setActiveMenuMessageId(null)}
                              />
                              <div
                                className={`absolute z-40 w-44 rounded-2xl border border-white/10 bg-ink-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in duration-150 top-1/2 -translate-y-1/2 ${
                                  isMe ? "right-full mr-2" : "left-full ml-2"
                                }`}
                              >
                                <button
                                  onClick={() => {
                                    setReplyingTo(msg);
                                    setActiveMenuMessageId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-mist hover:bg-white/10 rounded-xl transition flex items-center gap-2"
                                >
                                  <span>↪️</span> Reply
                                </button>
                                <button
                                  onClick={() => {
                                    setReactionMenuMessageId(msg.id);
                                    setActiveMenuMessageId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-mist hover:bg-white/10 rounded-xl transition flex items-center gap-2"
                                >
                                  <span>❤️</span> React
                                </button>
                                {msg.content && (
                                  <button
                                    onClick={() => handleCopy(msg)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-mist hover:bg-white/10 rounded-xl transition flex items-center gap-2"
                                  >
                                    <span>📋</span> {copiedId === msg.id ? "Copied" : "Copy"}
                                  </button>
                                )}
                                {isMe && msg.type === "text" && (
                                  <button
                                    onClick={() => {
                                      setEditingMessage(msg);
                                      setInputContent(msg.content);
                                      setActiveMenuMessageId(null);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-mist hover:bg-white/10 rounded-xl transition flex items-center gap-2"
                                  >
                                    <span>✏️</span> Edit
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    deleteMessage(msg.id, false);
                                    setActiveMenuMessageId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-rose-soft hover:bg-white/10 rounded-xl transition flex items-center gap-2"
                                >
                                  <span>🗑️</span> Delete for me
                                </button>

                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reactions Pill Display with Modal Click Trigger */}
                    {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (
                      <div className="flex gap-1 mt-1 px-1">
                        <button
                          type="button"
                          onClick={() => setSelectedReactionModalMessage(msg)}
                          className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full border border-white/10 transition cursor-pointer"
                        >
                          {msg.reactions.map((r, i) => (
                            <span key={i}>{r.emoji}</span>
                          ))}
                          <span className="text-[10px] text-mist-dim ml-0.5 font-semibold">
                            {msg.reactions.length}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Status and 12-hour Local Timestamp with AM/PM */}
                    <div
                      className={`flex items-center gap-1 mt-1 text-[11px] text-mist-dim/70 px-1 ${
                        isMe ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span>{formatLocalTime(msg.createdAt)}</span>
                      {isMe && (
                        <span className="ml-0.5">
                          {msg.status === "sending" && "⌛"}
                          {msg.status === "sent" && "✓"}
                          {msg.status === "delivered" && "✓✓"}
                          {msg.status === "read" && <span className="text-teal-soft">✓✓</span>}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        {!isNearBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className={`fixed right-6 z-20 flex items-center gap-2 rounded-full glass border border-teal-soft/30 bg-ink-900/90 px-4 py-2 text-xs text-teal-soft shadow-xl backdrop-blur-md hover:bg-ink-800 ${
              replyingTo || editingMessage ? "bottom-32" : "bottom-20"
            }`}
          >
            <span>↓ {unreadCount > 0 ? `${unreadCount} new message(s)` : "Latest messages"}</span>
          </button>
        )}
      </main>

      {/* Replying Banner Bar */}
      {replyingTo && (
        <div className="border-t border-white/10 bg-ink-900/95 px-4 py-2 flex items-center justify-between gap-2 animate-fade-up">
          <div className="border-l-2 border-teal-soft pl-3 text-xs">
            <p className="font-semibold text-teal-soft">Replying to message</p>
            <p className="text-mist-dim line-clamp-1 italic">{replyingTo.content || "Media"}</p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-mist-dim hover:text-mist text-xs font-semibold px-2 py-1"
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Editing Banner Bar */}
      {editingMessage && (
        <div className="border-t border-white/10 bg-ink-900/95 px-4 py-2 flex items-center justify-between gap-2 animate-fade-up">
          <div className="border-l-2 border-plum pl-3 text-xs">
            <p className="font-semibold text-plum">Editing message</p>
            <p className="text-mist-dim line-clamp-1">{editingMessage.content}</p>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputContent("");
            }}
            className="text-mist-dim hover:text-mist text-xs font-semibold px-2 py-1"
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Media Upload Error Alert */}
      {mediaUploadError && (
        <div className="bg-rose-soft/10 border-t border-rose-soft/30 px-4 py-2 text-xs text-rose-soft flex justify-between items-center">
          <span>{mediaUploadError}</span>
          <button type="button" onClick={() => setMediaUploadError(null)} className="underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Image Preview Banner */}
      {imagePreviewUrl && (
        <div className="border-t border-white/10 bg-ink-900/95 p-3 flex items-center justify-between gap-3 animate-fade-up min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img src={imagePreviewUrl} alt="Preview" className="h-14 w-14 rounded-xl object-cover border border-white/10 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-mist truncate max-w-full">{selectedImageFile?.name || "Pasted image"}</p>
              <p className="text-[11px] text-mist-dim">Ready to send</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedImageFile(null);
                setImagePreviewUrl(null);
              }}
              className="px-3 py-1.5 text-xs text-mist-dim hover:text-mist rounded-xl hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isUploading}
              className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-teal-soft to-teal-deep text-ink-950 rounded-xl hover:brightness-110 shadow-md whitespace-nowrap"
            >
              {isUploading ? `Uploading ${uploadProgress}%` : "Send Photo"}
            </button>
          </div>
        </div>
      )}

      {/* Audio Recorder Panel */}
      {isRecordingAudio && (
        <div className="border-t border-white/10 bg-ink-900/95 p-3">
          <AudioRecorder
            onConfirm={(blob, duration) => {
              setIsRecordingAudio(false);
              const audioFile = new File([blob], "voice_message.webm", { type: blob.type });
              processAndUploadFile(audioFile, "audio", { duration });
            }}
            onCancel={() => setIsRecordingAudio(false)}
          />
        </div>
      )}

      {/* Message Composer Footer */}
      {!isRecordingAudio && !imagePreviewUrl && (
        <footer className="shrink-0 border-t border-white/5 bg-ink-900/80 p-3 sm:p-4 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload photo"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-mist transition hover:border-teal-soft/40 hover:text-teal-soft"
            >
              <span className="text-lg">＋</span>
            </button>

            <div className="relative flex-1">
              {showEmojiPicker && (
                <EmojiPicker
                  onSelectEmoji={(emoji) => {
                    setInputContent((prev) => prev + emoji);
                  }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
              <input
                type="text"
                value={inputContent}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={handleInputFocus}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={`Message ${partnerName}... (or paste image)`}
                className="w-full rounded-2xl border border-white/10 bg-ink-950/70 pl-4 pr-10 py-2.5 text-base sm:text-sm text-mist placeholder:text-mist-dim/50 focus:border-teal-soft/50 focus:outline-none focus:ring-2 focus:ring-teal-soft/20"
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                aria-label="Toggle emoji picker"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-mist-dim hover:text-mist transition"
              >
                😊
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsRecordingAudio(true)}
              aria-label="Record audio message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-mist transition hover:border-teal-soft/40 hover:text-teal-soft"
            >
              <span className="text-lg">🎙️</span>
            </button>

            <button
              type="submit"
              disabled={(!inputContent.trim() && !selectedImageFile) || connectionState !== "connected"}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-teal-soft to-teal-deep text-ink-950 font-bold shadow-md transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ➤
            </button>
          </form>
        </footer>
      )}
    </div>
  );
}

"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';

const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Strip SDP lines that some browsers reject
function sanitizeSdp(sdp: string): string {
  const lines = sdp.split('\n');

  const badPts = new Set<string>();
  for (const line of lines) {
    const m = line.trim().match(/^a=rtpmap:(\d+)\s+(ulpfec|red)\//i);
    if (m) badPts.add(m[1]);
  }
  // Cascade: remove RTX whose apt= references a bad PT
  for (const line of lines) {
    const m = line.trim().match(/^a=fmtp:(\d+)\s+apt=(\d+)/);
    if (m && badPts.has(m[2])) badPts.add(m[1]);
  }

  return lines
    .filter((line) => {
      const t = line.trim();
      // Keep a=ssrc: and a=ssrc-group: — they are required for track/stream mapping
      for (const pt of badPts) {
        if (
          t.startsWith(`a=rtpmap:${pt} `) ||
          t.startsWith(`a=fmtp:${pt} `) ||
          t.startsWith(`a=rtcp-fb:${pt} `)
        ) return false;
      }
      return true;
    })
    .map((line) => {
      if (badPts.size > 0 && line.trim().startsWith('m=')) {
        const parts = line.trimEnd().split(' ');
        if (parts.length > 3) {
          return parts.filter((p, i) => i < 3 || !badPts.has(p)).join(' ');
        }
      }
      return line;
    })
    .join('\n');
}

type Status = 'waiting' | 'connecting' | 'playing' | 'ended';
type ChatMsg = { from: string; name: string; text: string; ts: number; self?: boolean };

const STATUS_CONFIG: Record<Status, { label: string; color: string; pulse: boolean }> = {
  waiting:    { label: 'Waiting for host…',  color: 'text-yellow-400', pulse: true  },
  connecting: { label: 'Connecting…',        color: 'text-blue-400',   pulse: true  },
  playing:    { label: 'Live',               color: 'text-red-400',    pulse: true  },
  ended:      { label: 'Stream ended',       color: 'text-gray-400',   pulse: false },
};

export default function LiveViewer({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: session } = useSession();
  const router = useRouter();
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<Status>('waiting');
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Host name (received from server) ──
  const [hostName, setHostName] = useState('');

  // ── Chat state ──
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [viewerProfileName, setViewerProfileName] = useState('');
  const viewerName = viewerProfileName || session?.user?.email?.split('@')[0] || 'Viewer';

  // ── Fetch viewer's profile name from DB ──
  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => { if (data?.name) setViewerProfileName(data.name); })
      .catch(() => {});
  }, [session?.user?.email]);

  useEffect(() => {
    let aborted = false;
    let socket: Socket | null = null;

    (async () => {
      await fetch('/api/socket').catch(() => {});
      if (aborted) return;

      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001', {
        transports: ['websocket'],
      });
      socketRef.current = socket;

      function joinStream() {
        setStatus('connecting');
        socket!.emit('live:viewer-join', { id });
      }

      socket.on('connect', joinStream);
      socket.on('live:host-ready', ({ hostName: name }: { hostName?: string }) => {
        if (name) setHostName(name);
        joinStream();
      });
      socket.on('live:host-info', ({ hostName: name }: { hostName: string }) => {
        if (name) setHostName(name);
      });

      socket.on('live:offer', async ({ sdp, hostId }: { sdp: string; hostId: string }) => {
        if (aborted) return;
        if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }

        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        pc.ontrack = (e) => {
          if (!remoteRef.current) return;
          if (e.streams?.[0]) {
            remoteRef.current.srcObject = e.streams[0];
          } else {
            let ms = remoteRef.current.srcObject as MediaStream | null;
            if (!ms) { ms = new MediaStream(); remoteRef.current.srcObject = ms; }
            ms.addTrack(e.track);
          }
          remoteRef.current.play().catch(() => {});
          setStatus('playing');
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) socket!.emit('live:ice', { to: hostId, candidate: e.candidate });
        };

        pc.onconnectionstatechange = () => {
          if (['disconnected', 'failed'].includes(pc.connectionState)) setStatus('ended');
        };

        await pc.setRemoteDescription({ type: 'offer', sdp: sanitizeSdp(sdp) });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket!.emit('live:answer', { to: hostId, sdp: answer.sdp });
      });

      socket.on('live:ice', async ({ candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
        if (pcRef.current) await pcRef.current.addIceCandidate(candidate).catch(() => {});
      });

      socket.on('live:ended', () => setStatus('ended'));

      // Receive chat messages
      socket.on('live:chat', (msg: ChatMsg) => {
        setMessages((prev) => [...prev, msg]);
      });
    })();

    return () => {
      aborted = true;
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleMouseMove() {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (status === 'playing') {
      controlsTimer.current = window.setTimeout(() => setShowControls(false), 3000);
    }
  }

  function toggleMute() {
    const next = !muted;
    if (remoteRef.current) remoteRef.current.muted = next;
    setMuted(next);
  }

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  }

  const isLoggedIn = !!session?.user;

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) return;
    const text = chatInput.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit('live:chat', { id, name: viewerName, text });
    setMessages((prev) => [...prev, { from: 'self', name: viewerName, text, ts: Date.now(), self: true }]);
    setChatInput('');
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gray-950 flex flex-col"
      onMouseMove={handleMouseMove}
    >
      {/* ── Top bar ── */}
      <div className={`flex items-center justify-between px-5 py-3 bg-gray-900/90 border-b border-gray-800/60 backdrop-blur-md z-10 transition-opacity duration-300 ${status === 'playing' && !showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">{hostName ? `${hostName}'s Stream` : 'Live Stream'}</span>
            <div className="flex items-center gap-1.5">
              {cfg.pulse && <span className={`w-1.5 h-1.5 rounded-full ${status === 'playing' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500 animate-bounce'}`} />}
              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700/60 rounded-xl">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-gray-400 text-xs font-mono truncate max-w-[180px]">{id}</span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Left: Video */}
        <div className="flex-1 flex items-center justify-center relative min-w-0">
          <div className={`relative w-full max-w-5xl aspect-video rounded-2xl overflow-hidden shadow-2xl ring-1 ${status === 'playing' ? 'ring-red-500/30 shadow-red-500/5' : 'ring-gray-800'}`}>
            <video
              ref={remoteRef}
              className={`w-full h-full object-cover transition-opacity duration-500 ${status === 'playing' ? 'opacity-100' : 'opacity-0'}`}
              playsInline
              autoPlay
              muted
            />

            {/* Waiting / Connecting overlay */}
            {status !== 'playing' && (
              <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center gap-4">
                {status === 'ended' ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                      <svg className="w-9 h-9 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold text-lg">Stream Ended</p>
                      <p className="text-gray-400 text-sm mt-1">The host has ended this live stream</p>
                    </div>
                    <button onClick={() => router.push('/')} className="mt-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm transition-all">
                      Back to Feed
                    </button>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-2 border-gray-700 border-t-violet-500 animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-medium">{status === 'connecting' ? 'Connecting to stream…' : 'Waiting for host to go live…'}</p>
                      <p className="text-gray-500 text-sm mt-1">This page will update automatically</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Live badge */}
            {status === 'playing' && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-600/95 backdrop-blur-sm rounded-lg">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                <span className="text-white text-xs font-bold tracking-wide">LIVE</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat panel */}
        {chatOpen && status !== 'ended' && (
          <div className="w-80 flex-shrink-0 flex flex-col bg-gray-900/80 border border-gray-800/60 rounded-2xl overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-white text-sm font-semibold">Live Chat</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="p-1 text-gray-500 hover:text-white rounded transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <svg className="w-8 h-8 text-gray-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-gray-600 text-xs">No messages yet</p>
                  <p className="text-gray-700 text-[10px]">Say hi to the streamer!</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.self ? 'justify-end' : ''}`}>
                  <div className={`max-w-[85%] px-3 py-1.5 rounded-xl ${m.self ? 'bg-violet-600/80 text-white' : 'bg-gray-800 text-gray-200'}`}>
                    {!m.self && <p className="text-[10px] font-semibold text-violet-400 mb-0.5">{m.name}</p>}
                    <p className="text-xs break-words">{m.text}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            {isLoggedIn ? (
              <form onSubmit={sendChat} className="p-3 border-t border-gray-800/60">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Say something…"
                    maxLength={500}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600 text-white rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 border-t border-gray-800/60">
                <button
                  onClick={() => router.push('/login')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs text-gray-300 hover:text-white transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign in to chat
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div className={`flex items-center justify-center gap-3 px-6 py-4 bg-gray-900/90 border-t border-gray-800/60 backdrop-blur-md transition-opacity duration-300 ${status === 'playing' && !showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Mute */}
        <button
          onClick={toggleMute}
          disabled={status !== 'playing'}
          title={muted ? 'Unmute' : 'Mute'}
          className={`flex flex-col items-center gap-1 p-3.5 rounded-2xl transition-all disabled:opacity-30 ${muted ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            {muted
              ? <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              : <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            }
          </svg>
          <span className="text-[10px] font-medium">{muted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="flex flex-col items-center gap-1 p-3.5 rounded-2xl bg-gray-800 hover:bg-gray-700 text-white transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {fullscreen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            }
          </svg>
          <span className="text-[10px] font-medium">{fullscreen ? 'Exit' : 'Fullscreen'}</span>
        </button>

        {/* Chat toggle */}
        {!chatOpen && status !== 'ended' && (
          <button
            onClick={() => setChatOpen(true)}
            title="Open chat"
            className="flex flex-col items-center gap-1 p-3.5 rounded-2xl bg-gray-800 hover:bg-gray-700 text-white transition-all relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-[10px] font-medium">Chat</span>
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">{messages.length > 99 ? '99+' : messages.length}</span>
            )}
          </button>
        )}

        {/* Leave */}
        <button
          onClick={() => router.push('/')}
          className="flex flex-col items-center gap-1 px-6 py-3.5 bg-red-700 hover:bg-red-600 active:scale-95 text-white rounded-2xl transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="text-[10px] font-bold">Leave</span>
        </button>
      </div>
    </div>
  );
}

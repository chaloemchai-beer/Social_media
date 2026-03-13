"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

function rid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

type ChatMsg = { from: string; name: string; text: string; ts: number; self?: boolean };

export default function GoLivePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [streamId] = useState(rid);
  const [stage, setStage] = useState<'preview' | 'live' | 'ended'>('preview');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [liveTime, setLiveTime] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [liveUrl, setLiveUrl] = useState('');
  const localRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const timerRef = useRef<number | null>(null);
  const stageRef = useRef<'preview' | 'live' | 'ended'>('preview');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [saving, setSaving] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // ── Device testing state ──
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState('');
  const [selectedVideo, setSelectedVideo] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [micWorking, setMicWorking] = useState(false);
  const [camWorking, setCamWorking] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // ── Chat state ──
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Profile name (fetched from DB, not session) ──
  const [profileName, setProfileName] = useState('');
  const hostName = profileName || session?.user?.email?.split('@')[0] || 'You';
  const hostInitial = hostName.charAt(0).toUpperCase();

  useEffect(() => {
    setLiveUrl(`${window.location.origin}/live/${streamId}`);
  }, [streamId]);

  // ── Enumerate devices ──
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
    } catch {}
  }, []);

  // ── Audio level monitoring ──
  const startAudioMonitor = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let peakDetected = false;

      function tick() {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = Math.min(avg / 80, 1);
        setAudioLevel(normalized);
        if (normalized > 0.05 && !peakDetected) {
          peakDetected = true;
          setMicWorking(true);
        }
        animFrameRef.current = requestAnimationFrame(tick);
      }
      tick();
    } catch {}
  }, []);

  const stopAudioMonitor = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close().catch(() => {});
    analyserRef.current = null;
    audioCtxRef.current = null;
  }, []);

  // ── Start preview with optional device IDs ──
  const startPreview = useCallback(async (audioId?: string, videoId?: string) => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    stopAudioMonitor();
    setCamWorking(false);
    setMicWorking(false);
    setAudioLevel(0);

    try {
      const constraints: MediaStreamConstraints = {
        audio: audioId ? { deviceId: { exact: audioId } } : true,
        video: videoId ? { deviceId: { exact: videoId } } : true,
      };
      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = ms;

      // Track which devices are active
      const audioTrack = ms.getAudioTracks()[0];
      const videoTrack = ms.getVideoTracks()[0];
      if (audioTrack) {
        setSelectedAudio(audioTrack.getSettings().deviceId || '');
        setMicWorking(false); // will be set to true once signal detected
      }
      if (videoTrack) {
        setSelectedVideo(videoTrack.getSettings().deviceId || '');
        setCamWorking(true);
        setCameraError(false);
      }

      if (localRef.current) {
        localRef.current.srcObject = ms;
        await localRef.current.play().catch(() => {});
      }

      startAudioMonitor(ms);
      await enumerateDevices();
    } catch {
      setCameraError(true);
    }
  }, [enumerateDevices, startAudioMonitor, stopAudioMonitor]);

  // ── Fetch profile name from DB ──
  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => { if (data?.name) setProfileName(data.name); })
      .catch(() => {});
  }, [session?.user?.email]);

  // ── Socket setup ──
  useEffect(() => {
    startPreview();

    let aborted = false;
    let socket: Socket | null = null;

    (async () => {
      await fetch('/api/socket').catch(() => {});
      if (aborted) return;

      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
        transports: ['websocket'],
      });
      socketRef.current = socket;

      socket.on('live:viewer-joined', async ({ viewerId }: { viewerId: string }) => {
        if (!streamRef.current || stageRef.current !== 'live') return;

        const pc = new RTCPeerConnection({ iceServers });
        pcsRef.current.set(viewerId, pc);
        setViewerCount(pcsRef.current.size);

        // Use screen video track if screen sharing, otherwise camera
        const screenVideoTrack = screenStreamRef.current?.getVideoTracks()[0];
        const audioTracks = streamRef.current.getAudioTracks();
        const videoTrack = screenVideoTrack || streamRef.current.getVideoTracks()[0];
        const tracksToSend = [...audioTracks, ...(videoTrack ? [videoTrack] : [])];
        tracksToSend.forEach((t) => pc.addTrack(t, streamRef.current!));

        pc.onicecandidate = (e) => {
          if (e.candidate) socket!.emit('live:ice', { to: viewerId, candidate: e.candidate });
        };

        pc.onconnectionstatechange = () => {
          if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
            pc.close();
            pcsRef.current.delete(viewerId);
            setViewerCount(pcsRef.current.size);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket!.emit('live:offer', { to: viewerId, sdp: offer.sdp });
      });

      socket.on('live:answer', async ({ viewerId, sdp }: { viewerId: string; sdp: string }) => {
        const pc = pcsRef.current.get(viewerId);
        if (pc && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription({ type: 'answer', sdp }).catch(() => {});
        }
      });

      socket.on('live:ice', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
        const pc = pcsRef.current.get(from);
        if (pc) await pc.addIceCandidate(candidate).catch(() => {});
      });

      // Receive chat messages from viewers
      socket.on('live:chat', (msg: ChatMsg) => {
        setMessages((prev) => [...prev, msg]);
      });
    })();

    return () => {
      aborted = true;
      stopAll();
      stopAudioMonitor();
      socket?.disconnect();
      socketRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    stageRef.current = stage;
    if (stage === 'live') {
      timerRef.current = window.setInterval(() => setLiveTime((t) => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function startRecording(stream: MediaStream) {
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start(1000);
    recorderRef.current = recorder;
  }

  function goLive() {
    if (stage !== 'preview') return;
    stopAudioMonitor();
    setStage('live');
    socketRef.current?.emit('live:start', { id: streamId, hostName });
    if (streamRef.current) startRecording(streamRef.current);
  }

  async function toggleScreenShare() {
    if (screenSharing) {
      // Stop screen share, revert to camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setScreenSharing(false);

      // Restore camera video to the local preview
      if (localRef.current && streamRef.current) {
        localRef.current.srcObject = streamRef.current;
      }

      // Replace track in all peer connections back to camera
      const camTrack = streamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        pcsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(camTrack).catch(() => {});
        });
      }
    } else {
      // Start screen share
      try {
        const screenMs = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = screenMs;
        setScreenSharing(true);

        const screenTrack = screenMs.getVideoTracks()[0];

        // Show screen in local preview
        if (localRef.current) {
          // Combine screen video with camera audio for preview
          const combined = new MediaStream([
            screenTrack,
            ...(streamRef.current?.getAudioTracks() || []),
          ]);
          localRef.current.srcObject = combined;
        }

        // Replace video track in all peer connections
        pcsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack).catch(() => {});
        });

        // Handle user clicking browser's "Stop sharing" button
        screenTrack.onended = () => {
          toggleScreenShare(); // revert to camera
        };
      } catch {
        // User cancelled the screen picker
      }
    }
  }

  function stopAll() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    setViewerCount(0);
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach((t) => t.stop()); screenStreamRef.current = null; }
    setScreenSharing(false);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (localRef.current) localRef.current.srcObject = null;
  }

  async function saveRecording(durationSecs: number) {
    if (!chunksRef.current.length) return;
    setSaving(true);
    try {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const fd = new FormData();
      fd.append('file', blob, `live-${streamId}.webm`);
      fd.append('type', 'live');
      fd.append('title', `Live stream – ${new Date().toLocaleString()}`);
      fd.append('duration', String(durationSecs));
      await fetch('/api/profile/media', { method: 'POST', body: fd });
    } catch { /* non-critical */ } finally {
      setSaving(false);
      chunksRef.current = [];
    }
  }

  function endLive() {
    socketRef.current?.emit('live:end', { id: streamId });
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    saveRecording(liveTime);
    stopAll();
    setStage('ended');
  }

  function toggleMic() {
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !micOn; });
    setMicOn((v) => !v);
  }
  function toggleCam() {
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !camOn; });
    setCamOn((v) => !v);
  }

  function copyLink() {
    navigator.clipboard.writeText(liveUrl || `${window.location.origin}/live/${streamId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user) return;
    const text = chatInput.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit('live:chat', { id: streamId, name: hostName, text });
    setMessages((prev) => [...prev, { from: 'self', name: hostName, text, ts: Date.now(), self: true }]);
    setChatInput('');
  }

  function handleDeviceChange(kind: 'audio' | 'video', deviceId: string) {
    if (kind === 'audio') {
      startPreview(deviceId, selectedVideo || undefined);
    } else {
      startPreview(selectedAudio || undefined, deviceId);
    }
  }

  /* ── Ended screen ── */
  if (stage === 'ended') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-5 ring-2 ring-gray-700">
            <svg className="w-9 h-9 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Stream Ended</h2>
          <p className="text-gray-400 text-sm mb-1">Duration: <span className="text-white font-mono font-semibold">{formatTime(liveTime)}</span></p>
          {saving ? (
            <p className="text-violet-400 text-xs mb-8 flex items-center gap-1.5 justify-center">
              <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              Saving recording to your profile…
            </p>
          ) : (
            <p className="text-gray-500 text-xs mb-8">Recording saved to your profile.</p>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push('/')} className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-sm transition-all">
              Back to Feed
            </button>
            <button onClick={() => { setStage('preview'); setLiveTime(0); setMessages([]); startPreview(); }} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm transition-all font-medium">
              Go Live Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-900/90 border-b border-gray-800/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">
              {stage === 'preview' ? 'Ready to go live' : `${hostName}'s Stream`}
            </span>
            {stage === 'live' && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-red-600 rounded-full text-white text-xs font-bold">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  LIVE
                </span>
                <span className="text-gray-400 text-xs font-mono tabular-nums">{formatTime(liveTime)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stage === 'live' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
              <span className="text-white text-xs font-medium">{viewerCount} watching</span>
            </div>
          )}
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-violet-500/50 rounded-xl text-sm text-gray-300 hover:text-white transition-all"
          >
            {copied ? (
              <><svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-green-400 text-xs">Copied!</span></>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span className="text-xs">Share Link</span></>
            )}
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Left: Video + device testing */}
        <div className={`flex flex-col flex-1 min-w-0 ${stage === 'live' && chatOpen ? '' : ''}`}>
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-full max-w-4xl">
              <div className={`relative aspect-video rounded-2xl overflow-hidden shadow-2xl ring-1 ${stage === 'live' ? 'ring-red-500/50 shadow-red-500/10' : 'ring-gray-800'}`}>
                <video
                  ref={localRef}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${!screenSharing ? 'scale-x-[-1]' : ''} ${camOn || screenSharing ? 'opacity-100' : 'opacity-0'}`}
                  playsInline
                  muted
                />

                {(!camOn || cameraError) && !screenSharing && (
                  <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center gap-3">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-2xl shadow-violet-500/30">
                      <span className="text-4xl font-bold text-white">{hostInitial}</span>
                    </div>
                    <p className="text-gray-400 text-sm">{cameraError ? 'Camera not available' : 'Camera is off'}</p>
                  </div>
                )}

                {stage === 'preview' && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-xs text-gray-300 font-medium">
                    Preview — only you can see this
                  </div>
                )}
                {stage === 'live' && (
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600/95 backdrop-blur-sm rounded-lg">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      <span className="text-white text-xs font-bold tracking-wide">LIVE</span>
                    </div>
                    {screenSharing && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/95 backdrop-blur-sm rounded-lg">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-white text-xs font-bold">SCREEN</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1.5 bg-black/70 backdrop-blur-sm rounded-xl">
                  {!micOn && (
                    <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                    </svg>
                  )}
                  <span className="text-white text-xs font-medium">{hostName}</span>
                  <span className="text-violet-400 text-xs">(Host)</span>
                </div>
              </div>

              {/* ── Device Testing Panel (preview only) ── */}
              {stage === 'preview' && (
                <div className="mt-4 space-y-3">
                  {/* Device status indicators */}
                  <div className="flex gap-3">
                    <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border ${camWorking ? 'bg-green-950/30 border-green-800/50' : 'bg-red-950/30 border-red-800/50'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${camWorking ? 'bg-green-600' : 'bg-red-600'}`}>
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                        </svg>
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${camWorking ? 'text-green-400' : 'text-red-400'}`}>
                          {camWorking ? 'Camera working' : 'Camera unavailable'}
                        </p>
                        <p className="text-gray-500 text-[10px]">
                          {camWorking
                            ? streamRef.current?.getVideoTracks()[0]?.label || 'Active'
                            : 'Check permissions'}
                        </p>
                      </div>
                    </div>

                    <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border ${micWorking ? 'bg-green-950/30 border-green-800/50' : 'bg-yellow-950/30 border-yellow-800/50'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${micWorking ? 'bg-green-600' : 'bg-yellow-600'}`}>
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${micWorking ? 'text-green-400' : 'text-yellow-400'}`}>
                          {micWorking ? 'Microphone working' : 'Speak to test mic'}
                        </p>
                        {/* Audio level meter */}
                        <div className="mt-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-75 ${audioLevel > 0.6 ? 'bg-red-500' : audioLevel > 0.3 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${audioLevel * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Device selectors */}
                  <div className="flex gap-3">
                    {videoDevices.length > 1 && (
                      <div className="flex-1">
                        <label className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold mb-1 block">Camera</label>
                        <select
                          value={selectedVideo}
                          onChange={(e) => handleDeviceChange('video', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-violet-500"
                        >
                          {videoDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {audioDevices.length > 1 && (
                      <div className="flex-1">
                        <label className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold mb-1 block">Microphone</label>
                        <select
                          value={selectedAudio}
                          onChange={(e) => handleDeviceChange('audio', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-violet-500"
                        >
                          {audioDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 8)}`}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Share URL bar */}
                  {liveUrl && (
                    <div className="flex items-center gap-2 p-3 bg-gray-900 border border-gray-800 rounded-xl">
                      <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="flex-1 text-gray-500 text-xs truncate">{liveUrl}</span>
                      <button onClick={copyLink} className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors flex-shrink-0">
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Chat panel (live only) */}
        {stage === 'live' && chatOpen && (
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
                  <p className="text-gray-700 text-[10px]">Chat with your viewers</p>
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
          </div>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div className="flex items-center justify-center gap-3 px-6 py-4 bg-gray-900/90 border-t border-gray-800/60 backdrop-blur-md">
        {/* Mic */}
        <button
          onClick={toggleMic}
          title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          className={`flex flex-col items-center gap-1 p-3.5 rounded-2xl transition-all ${micOn ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            {micOn
              ? <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              : <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
            }
          </svg>
          <span className="text-[10px] font-medium">{micOn ? 'Mute' : 'Unmute'}</span>
        </button>

        {/* Camera */}
        <button
          onClick={toggleCam}
          title={camOn ? 'Stop video' : 'Start video'}
          className={`flex flex-col items-center gap-1 p-3.5 rounded-2xl transition-all ${camOn ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            {camOn
              ? <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
              : <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
            }
          </svg>
          <span className="text-[10px] font-medium">{camOn ? 'Stop Vid' : 'Start Vid'}</span>
        </button>

        {/* Screen Share (live only) */}
        {stage === 'live' && (
          <button
            onClick={toggleScreenShare}
            title={screenSharing ? 'Stop screen share' : 'Share screen'}
            className={`flex flex-col items-center gap-1 p-3.5 rounded-2xl transition-all ${screenSharing ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] font-medium">{screenSharing ? 'Stop Share' : 'Screen'}</span>
          </button>
        )}

        {/* Chat toggle (live only) */}
        {stage === 'live' && !chatOpen && (
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

        {/* Go Live / End */}
        {stage === 'preview' ? (
          <button
            onClick={goLive}
            disabled={!camWorking && !micWorking}
            className="flex flex-col items-center gap-1 px-8 py-3.5 bg-red-600 hover:bg-red-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-red-600 text-white rounded-2xl transition-all font-semibold shadow-lg shadow-red-600/30"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" className="opacity-30" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            <span className="text-xs font-bold tracking-wide">GO LIVE</span>
          </button>
        ) : (
          <button
            onClick={endLive}
            className="flex flex-col items-center gap-1 px-8 py-3.5 bg-red-700 hover:bg-red-600 active:scale-95 text-white rounded-2xl transition-all shadow-lg shadow-red-600/20"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
            <span className="text-xs font-bold tracking-wide">END LIVE</span>
          </button>
        )}
      </div>
    </div>
  );
}

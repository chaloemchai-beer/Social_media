"use client";
import React, { useEffect, useRef, useState } from 'react';

function rid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function GoLivePage() {
  const [streamId, setStreamId] = useState(rid());
  const [started, setStarted] = useState(false);
  const localRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { stopLive(); }, []);

  async function startLive() {
    if (started) return;
    setStarted(true);
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    const ms = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localRef.current) {
      localRef.current.srcObject = ms;
      localRef.current.muted = true;
      await localRef.current.play().catch(() => {});
    }
    ms.getTracks().forEach((t) => pc.addTrack(t, ms));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        fetch('/api/live/offer-candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: streamId, candidate: e.candidate }),
        });
      }
    };

    const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);
    await fetch('/api/live/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: streamId, sdp: offer.sdp }),
    });

    // Poll for answer and answer ICE candidates
    pollRef.current = window.setInterval(async () => {
      try {
        const ans = await fetch(`/api/live/answer?id=${streamId}`).then((r) => r.json());
        if (ans?.answer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription({ type: 'answer', sdp: ans.answer });
        }
        const { candidates } = await fetch(`/api/live/answer-candidates?id=${streamId}`).then((r) => r.json());
        for (const c of candidates || []) {
          try { await pc.addIceCandidate(c); } catch {}
        }
      } catch {}
    }, 1200);
  }

  function stopLive() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (pcRef.current) { pcRef.current.getSenders().forEach((s) => s.track?.stop()); pcRef.current.close(); pcRef.current = null; }
    if (localRef.current && localRef.current.srcObject) {
      (localRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      localRef.current.srcObject = null;
    }
    setStarted(false);
  }

  const liveUrl = typeof window !== 'undefined' ? `${window.location.origin}/live/${streamId}` : `/live/${streamId}`;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Go Live</h1>
      <p className="text-sm text-gray-600 mb-4">Share this link for viewers to watch your live stream.</p>
      <div className="flex items-center gap-2 mb-4">
        <input className="flex-1 border rounded px-3 py-2" value={liveUrl} readOnly />
        <button className="px-3 py-2 bg-gray-100 rounded" onClick={() => { navigator.clipboard.writeText(liveUrl); }}>Copy</button>
      </div>
      <div className="mb-4">
        <video ref={localRef} className="w-full bg-black rounded" playsInline muted />
      </div>
      {!started ? (
        <button className="px-4 py-2 rounded bg-red-600 text-white" onClick={startLive}>Start Live</button>
      ) : (
        <button className="px-4 py-2 rounded bg-gray-600 text-white" onClick={stopLive}>Stop</button>
      )}
    </div>
  );
}


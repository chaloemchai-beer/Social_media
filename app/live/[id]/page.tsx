"use client";
import React, { useEffect, useRef, useState } from 'react';

const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function LiveViewer({ params }: { params: { id: string } }) {
  const { id } = params;
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<'waiting'|'connecting'|'playing'|'ended'>('waiting');

  useEffect(() => {
    let stop = false;
    let pollTimer: number | null = null;
    async function setup() {
      setStatus('connecting');
      // wait for offer
      let offer: string | null = null;
      for (let i = 0; i < 20 && !offer && !stop; i++) {
        const res = await fetch(`/api/live/offer?id=${id}`).then((r) => r.json());
        offer = res?.offer || null;
        if (!offer) await new Promise((r) => setTimeout(r, 1000));
      }
      if (!offer || stop) { setStatus('waiting'); return; }

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      pc.ontrack = (e) => {
        if (remoteRef.current && e.streams?.[0]) {
          remoteRef.current.srcObject = e.streams[0];
          remoteRef.current.play().catch(() => {});
          setStatus('playing');
        }
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          fetch('/api/live/answer-candidates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, candidate: e.candidate }),
          });
        }
      };

      await pc.setRemoteDescription({ type: 'offer', sdp: offer });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await fetch('/api/live/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, sdp: answer.sdp }),
      });

      // Poll for broadcaster ICE candidates
      pollTimer = window.setInterval(async () => {
        try {
          const { candidates } = await fetch(`/api/live/offer-candidates?id=${id}`).then((r) => r.json());
          for (const c of candidates || []) {
            try { await pc.addIceCandidate(c); } catch {}
          }
        } catch {}
      }, 1000);
    }
    setup();
    return () => {
      stop = true;
      if (pollTimer) clearInterval(pollTimer);
      if (pcRef.current) pcRef.current.close();
    };
  }, [id]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Live</h1>
      <p className="text-sm text-gray-600 mb-4">Status: {status}</p>
      <video ref={remoteRef} className="w-full bg-black rounded" playsInline controls />
      {status === 'waiting' && (
        <p className="text-gray-500 mt-3">Waiting for streamer to go live...</p>
      )}
    </div>
  );
}


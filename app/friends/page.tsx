"use client";

import Header from "@/components/Header";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Person = {
  email: string;
  name: string;
  avatarUrl: string | null;
  bio?: string | null;
  location?: string | null;
  friendStatus?: string | null; // null | 'sent' | 'received' | 'accepted'
  createdAt?: string;
};

type Tab = "requests" | "friends" | "discover";

function Avatar({ person, size = 48 }: { person: Person; size?: number }) {
  const initial = person.name.charAt(0).toUpperCase();
  return person.avatarUrl ? (
    <div className="rounded-xl overflow-hidden flex-shrink-0" style={{ width: size, height: size }}>
      <Image src={person.avatarUrl} alt={person.name} width={size} height={size} className="w-full h-full object-cover" unoptimized />
    </div>
  ) : (
    <div className="rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initial}
    </div>
  );
}

function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function FriendsPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("requests");
  const [friends, setFriends] = useState<Person[]>([]);
  const [requests, setRequests] = useState<Person[]>([]);
  const [discover, setDiscover] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<Set<string>>(new Set());

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const loadFriends = useCallback(async () => {
    const res = await fetch("/api/friends");
    if (res.ok) setFriends(await res.json());
  }, []);

  const loadRequests = useCallback(async () => {
    const res = await fetch("/api/friends/requests");
    if (res.ok) setRequests(await res.json());
  }, []);

  const loadDiscover = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      if (res.ok) setDiscover(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadRequests();
    loadFriends();
    loadDiscover();
  }, [status, loadRequests, loadFriends, loadDiscover]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadDiscover(debouncedSearch);
  }, [debouncedSearch, status, loadDiscover]);

  function busy(email: string) { return acting.has(email); }
  function setBusy(email: string, on: boolean) {
    setActing((s) => { const c = new Set(s); on ? c.add(email) : c.delete(email); return c; });
  }

  async function sendRequest(email: string) {
    setBusy(email, true);
    try {
      const res = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toEmail: email }) });
      if (res.ok) {
        setDiscover((d) => d.map((p) => p.email === email ? { ...p, friendStatus: "sent" } : p));
        await loadFriends();
        await loadRequests();
      }
    } finally { setBusy(email, false); }
  }

  async function acceptRequest(email: string) {
    setBusy(email, true);
    try {
      const res = await fetch("/api/friends", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromEmail: email }) });
      if (res.ok) {
        setRequests((r) => r.filter((p) => p.email !== email));
        await loadFriends();
        await loadDiscover(debouncedSearch);
      }
    } finally { setBusy(email, false); }
  }

  async function declineRequest(email: string) {
    setBusy(email, true);
    try {
      await fetch(`/api/friends?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      setRequests((r) => r.filter((p) => p.email !== email));
      await loadDiscover(debouncedSearch);
    } finally { setBusy(email, false); }
  }

  async function removeFriend(email: string) {
    setBusy(email, true);
    try {
      await fetch(`/api/friends?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      setFriends((f) => f.filter((p) => p.email !== email));
      await loadDiscover(debouncedSearch);
    } finally { setBusy(email, false); }
  }

  function openChat(email: string) {
    window.dispatchEvent(new CustomEvent("open-chat-with", { detail: { email } }));
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "requests", label: "Requests", count: requests.length || undefined },
    { key: "friends", label: "Friends", count: friends.length || undefined },
    { key: "discover", label: "Discover" },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Friends</h1>
          <p className="text-gray-400 text-sm mt-1">Connect with people you know</p>
        </div>

        {/* Tabs + search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800/60 rounded-2xl p-1">
            {TABS.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === key ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20" : "text-gray-400 hover:text-white"}`}
              >
                {label}
                {count !== undefined && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === key ? "bg-white/20 text-white" : "bg-gray-800 text-gray-300"}`}>{count}</span>
                )}
              </button>
            ))}
          </div>

          {tab === "discover" && (
            <div className="flex-1 flex items-center gap-2 bg-gray-900 border border-gray-800/60 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-violet-500/40 transition-all">
              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent outline-none text-white placeholder-gray-500 text-sm w-full"
                placeholder="Search people…"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── REQUESTS ── */}
        {tab === "requests" && (
          <>
            {requests.length === 0 ? (
              <Empty icon="👥" title="No pending requests" sub="When someone sends you a friend request, it'll appear here." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {requests.map((p) => (
                  <div key={p.email} className="flex items-start gap-3 p-4 bg-gray-900 border border-gray-800/60 rounded-2xl">
                    <Avatar person={p} size={52} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-gray-500 text-xs truncate">{p.email}</p>
                      {p.bio && <p className="text-gray-400 text-xs mt-1 line-clamp-1">{p.bio}</p>}
                      <div className="flex gap-2 mt-3">
                        <button
                          disabled={busy(p.email)}
                          onClick={() => acceptRequest(p.email)}
                          className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold transition-all"
                        >
                          {busy(p.email) ? "…" : "Confirm"}
                        </button>
                        <button
                          disabled={busy(p.email)}
                          onClick={() => declineRequest(p.email)}
                          className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-all"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── FRIENDS ── */}
        {tab === "friends" && (
          <>
            {friends.length === 0 ? (
              <Empty icon="✨" title="No friends yet" sub="Head to Discover to find people you know." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {friends.map((p) => (
                  <div key={p.email} className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800/60 rounded-2xl group">
                    <Avatar person={p} size={52} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-gray-500 text-xs truncate">{p.email}</p>
                      {p.location && <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{p.location}</p>}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => openChat(p.email)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                        Message
                      </button>
                      <button
                        disabled={busy(p.email)}
                        onClick={() => removeFriend(p.email)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-red-900/50 disabled:opacity-60 text-gray-400 hover:text-red-400 rounded-xl text-xs font-medium transition-all"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── DISCOVER ── */}
        {tab === "discover" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <span className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : discover.length === 0 ? (
              <Empty icon="🔍" title="No users found" sub="Try a different search." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {discover.map((p) => (
                  <div key={p.email} className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800/60 rounded-2xl">
                    <Avatar person={p} size={52} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-gray-500 text-xs truncate">{p.email}</p>
                      {p.bio && <p className="text-gray-400 text-xs mt-1 line-clamp-1">{p.bio}</p>}
                      {p.location && <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{p.location}</p>}
                    </div>
                    <FriendButton
                      status={p.friendStatus || null}
                      loading={busy(p.email)}
                      onAdd={() => sendRequest(p.email)}
                      onMessage={() => openChat(p.email)}
                      onRemove={() => removeFriend(p.email)}
                      onCancel={() => declineRequest(p.email)}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FriendButton({ status, loading, onAdd, onMessage, onRemove, onCancel }: {
  status: string | null;
  loading: boolean;
  onAdd: () => void;
  onMessage: () => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  if (status === "accepted") {
    return (
      <div className="flex flex-col gap-2 flex-shrink-0">
        <button onClick={onMessage} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium transition-all">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
          Message
        </button>
        <button disabled={loading} onClick={onRemove} className="px-3 py-1.5 bg-gray-800 hover:bg-red-900/50 disabled:opacity-60 text-gray-400 hover:text-red-400 rounded-xl text-xs font-medium transition-all">
          Unfriend
        </button>
      </div>
    );
  }
  if (status === "sent") {
    return (
      <button disabled={loading} onClick={onCancel} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-gray-300 rounded-xl text-xs font-medium transition-all flex-shrink-0">
        Cancel request
      </button>
    );
  }
  if (status === "received") {
    return (
      <div className="flex flex-col gap-2 flex-shrink-0">
        <button disabled={loading} onClick={onAdd} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold transition-all">
          Confirm
        </button>
        <button disabled={loading} onClick={onCancel} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-gray-300 rounded-xl text-xs font-medium transition-all">
          Decline
        </button>
      </div>
    );
  }
  return (
    <button disabled={loading} onClick={onAdd} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold transition-all flex-shrink-0 shadow-lg shadow-violet-600/20">
      {loading ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
      Add friend
    </button>
  );
}

function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-3xl">{icon}</div>
      <p className="text-white font-semibold">{title}</p>
      <p className="text-gray-500 text-sm max-w-xs">{sub}</p>
    </div>
  );
}

"use client";

import Header from "@/components/Header";
import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ProfileFeed from "@/components/ProfileFeed";

type Profile = {
  email: string;
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
  coverUrl?: string;
  friendsCount?: number;
};

type MediaItem = {
  id: string;
  type: string;
  url: string;
  title?: string | null;
  duration?: number | null;
  createdAt: string;
};

const TABS = ["Posts", "Photos", "Videos", "About"] as const;
type Tab = (typeof TABS)[number];

function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

export default function ProfilePage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Posts");

  // Photos + Videos
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const locRef = useRef<HTMLInputElement>(null);
  const webRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  async function loadProfile() {
    const res = await fetch("/api/profile");
    if (res.ok) setProfile(await res.json());
  }
  useEffect(() => { if (status === "authenticated") loadProfile(); }, [status]);

  const loadMedia = useCallback(async (email: string) => {
    setMediaLoading(true);
    try {
      const [photosRes, videosRes, liveRes, postsRes] = await Promise.all([
        fetch("/api/profile/media?type=photo"),
        fetch("/api/profile/media?type=video"),
        fetch("/api/profile/media?type=live"),
        fetch(`/api/post?email=${encodeURIComponent(email)}`),
      ]);

      // Uploaded photos
      const uploaded: MediaItem[] = photosRes.ok ? await photosRes.json() : [];

      // Photos from posts
      const postItems: MediaItem[] = [];
      if (postsRes.ok) {
        const posts: { _id: string; imageUrls?: string[]; imageUrl?: string | null; createdAt: string }[] = await postsRes.json();
        for (const p of posts) {
          const urls = p.imageUrls?.length ? p.imageUrls : p.imageUrl ? [p.imageUrl] : [];
          for (const url of urls) {
            postItems.push({ id: `post-${p._id}-${url}`, type: "photo", url, createdAt: p.createdAt });
          }
        }
      }

      // Merge + sort newest first, dedup by url
      const seen = new Set<string>();
      const allPhotos = [...uploaded, ...postItems].filter((p) => {
        if (seen.has(p.url)) return false;
        seen.add(p.url);
        return true;
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setPhotos(allPhotos);

      if (videosRes.ok && liveRes.ok) {
        const vids = await videosRes.json();
        const live = await liveRes.json();
        setVideos([...live, ...vids]);
      }
    } finally {
      setMediaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email && (activeTab === "Photos" || activeTab === "Videos")) {
      loadMedia(session.user.email);
    }
  }, [status, activeTab, loadMedia, session?.user?.email]);

  async function uploadImage(type: "avatar" | "cover", file: File) {
    const fd = new FormData();
    fd.append("type", type);
    fd.append("file", file);
    const res = await fetch("/api/profile/upload", { method: "POST", body: fd });
    if (res.ok) setProfile((await res.json()).profile);
  }

  async function uploadMedia(mediaType: "photo" | "video", file: File) {
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", mediaType);
      fd.append("title", file.name.replace(/\.[^.]+$/, ""));
      await fetch("/api/profile/media", { method: "POST", body: fd });
      await loadMedia();
    } finally {
      setUploadingMedia(false);
    }
  }

  async function deleteMedia(id: string) {
    if (!id.startsWith("post-")) {
      await fetch(`/api/profile/media?id=${id}`, { method: "DELETE" });
    }
    setPhotos((p) => p.filter((x) => x.id !== id));
    setVideos((v) => v.filter((x) => x.id !== id));
    if (lightbox?.id === id) setLightbox(null);
  }

  async function saveProfile() {
    const body = {
      name: nameRef.current?.value || "",
      bio: bioRef.current?.value || "",
      location: locRef.current?.value || "",
      website: webRef.current?.value || "",
    };
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { setProfile(await res.json()); setEditing(false); }
  }

  const displayName =
    profile?.name || session?.user?.name || session?.user?.email?.split("@")[0] || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />

      {/* ── Cover ── */}
      <div className="relative h-56 md:h-80 bg-gradient-to-br from-violet-900 via-gray-900 to-gray-950 overflow-hidden">
        {profile?.coverUrl && (
          <Image key={profile.coverUrl} src={profile.coverUrl} alt="Cover" fill style={{ objectFit: "cover" }} unoptimized className="opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
        <label className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 hover:bg-gray-800 border border-gray-700/60 backdrop-blur-sm rounded-xl text-gray-300 hover:text-white text-xs font-medium cursor-pointer transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Edit cover
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("cover", f); }} />
        </label>
      </div>

      {/* ── Profile card ── */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="-mt-16 md:-mt-20 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl ring-4 ring-gray-950 bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-white text-4xl font-bold shadow-2xl shadow-violet-500/20 overflow-hidden">
                {profile?.avatarUrl ? (
                  <Image key={profile.avatarUrl} src={profile.avatarUrl} alt="Avatar" fill style={{ objectFit: "cover" }} unoptimized />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <label className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-lg">
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("avatar", f); }} />
              </label>
            </div>

            {/* Name + meta */}
            <div className="flex-1 pb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{displayName}</h1>
              <p className="text-gray-400 text-sm mt-0.5">{profile?.email || session?.user?.email}</p>
              {profile?.bio && <p className="text-gray-300 text-sm mt-2 max-w-md leading-relaxed">{profile.bio}</p>}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {profile?.location && (
                  <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {profile.location}
                  </span>
                )}
                {profile?.website && (
                  <a href={/^https?:\/\//.test(profile.website) ? profile.website : `https://${profile.website}`} target="_blank" className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-xs transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    {profile.website}
                  </a>
                )}
                {!!profile?.friendsCount && (
                  <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
                    {profile.friendsCount} friends
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pb-2 flex-shrink-0">
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700/60 hover:border-violet-500/40 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit profile
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-violet-600/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add to story
              </button>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="mt-6 flex items-center gap-1 border-b border-gray-800/60">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all relative ${activeTab === tab ? "text-violet-400" : "text-gray-500 hover:text-gray-300"}`}>
                {tab}
                {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="mt-5 pb-10">

          {/* POSTS */}
          {activeTab === "Posts" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 space-y-4">
                <div className="bg-gray-900/80 border border-gray-800/60 rounded-2xl p-4">
                  <h3 className="font-semibold text-white mb-3">Intro</h3>
                  {profile?.bio ? <p className="text-gray-300 text-sm leading-relaxed">{profile.bio}</p> : <p className="text-gray-500 text-sm">Add a bio to tell people more about you.</p>}
                  <div className="mt-4 space-y-2.5">
                    {profile?.location && (
                      <div className="flex items-center gap-2.5 text-gray-400 text-sm">
                        <svg className="w-4 h-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Lives in <span className="text-gray-200">{profile.location}</span>
                      </div>
                    )}
                    {profile?.website && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <svg className="w-4 h-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        <a href={/^https?:\/\//.test(profile.website) ? profile.website : `https://${profile.website}`} target="_blank" className="text-violet-400 hover:text-violet-300 transition-colors truncate">{profile.website}</a>
                      </div>
                    )}
                    {!!profile?.friendsCount && (
                      <div className="flex items-center gap-2.5 text-gray-400 text-sm">
                        <svg className="w-4 h-4 flex-shrink-0 text-gray-500" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
                        <span className="text-gray-200">{profile.friendsCount}</span> friends
                      </div>
                    )}
                  </div>
                  <button onClick={() => setEditing(true)} className="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700/60 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all">Edit details</button>
                </div>
              </div>
              <div className="md:col-span-2 space-y-4">
                {session?.user?.email && <ProfileFeed email={session.user.email} />}
              </div>
            </div>
          )}

          {/* PHOTOS */}
          {activeTab === "Photos" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-lg">Your Photos</h2>
                <label className={`flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all cursor-pointer shadow-lg shadow-violet-600/20 ${uploadingMedia ? "opacity-60 pointer-events-none" : ""}`}>
                  {uploadingMedia ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  )}
                  Add photos
                  <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    for (const f of files) await uploadMedia("photo", f);
                  }} />
                </label>
              </div>

              {mediaLoading ? (
                <div className="flex items-center justify-center py-20">
                  <span className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-gray-500 text-sm">No photos yet. Upload your first one!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-800 cursor-pointer" onClick={() => setLightbox(photo)}>
                      <Image src={photo.url} alt={photo.title || "photo"} fill style={{ objectFit: "cover" }} unoptimized className="transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMedia(photo.id); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-600 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIDEOS */}
          {activeTab === "Videos" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-lg">Your Videos</h2>
                <label className={`flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all cursor-pointer shadow-lg shadow-violet-600/20 ${uploadingMedia ? "opacity-60 pointer-events-none" : ""}`}>
                  {uploadingMedia ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  )}
                  Upload video
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia("video", f); }} />
                </label>
              </div>

              {mediaLoading ? (
                <div className="flex items-center justify-center py-20">
                  <span className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg>
                  </div>
                  <p className="text-gray-500 text-sm">No videos yet. Upload one or go live — recordings save here automatically.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {videos.map((video) => (
                    <div key={video.id} className="group relative bg-gray-900 border border-gray-800/60 rounded-2xl overflow-hidden cursor-pointer" onClick={() => setLightbox(video)}>
                      <div className="aspect-video bg-gray-800 flex items-center justify-center relative">
                        <video src={video.url} className="w-full h-full object-cover" preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        </div>
                        {video.type === "live" && (
                          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-red-600/90 rounded-lg">
                            <span className="w-1.5 h-1.5 bg-white rounded-full" />
                            <span className="text-white text-[10px] font-bold">LIVE</span>
                          </div>
                        )}
                        {video.duration && (
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-mono rounded">
                            {formatDuration(video.duration)}
                          </span>
                        )}
                      </div>
                      <div className="p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{video.title || (video.type === "live" ? "Live recording" : "Video")}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{new Date(video.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMedia(video.id); }}
                          className="flex-shrink-0 w-7 h-7 bg-gray-800 hover:bg-red-600/80 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABOUT */}
          {activeTab === "About" && (
            <div className="max-w-xl space-y-4">
              <div className="bg-gray-900/80 border border-gray-800/60 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-white">About</h3>
                {[
                  { label: "Bio", value: profile?.bio },
                  { label: "Location", value: profile?.location },
                  { label: "Website", value: profile?.website },
                  { label: "Email", value: profile?.email || session?.user?.email },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-gray-200 text-sm">{value || <span className="text-gray-600 italic">Not set</span>}</p>
                  </div>
                ))}
                <button onClick={() => setEditing(true)} className="mt-2 w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700/60 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all">Edit details</button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center text-white transition-all" onClick={() => setLightbox(null)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            {lightbox.type === "photo" ? (
              <div className="relative w-full" style={{ maxHeight: "85vh" }}>
                <img src={lightbox.url} alt={lightbox.title || "photo"} className="max-w-full max-h-[85vh] mx-auto rounded-2xl object-contain" />
              </div>
            ) : (
              <video src={lightbox.url} controls autoPlay className="w-full max-h-[85vh] rounded-2xl bg-black" />
            )}
            {lightbox.title && (
              <p className="text-center text-gray-300 text-sm mt-3">{lightbox.title}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editing && profile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">Edit profile</h3>
              <button onClick={() => setEditing(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Name</label>
                <input defaultValue={profile.name || ""} ref={nameRef} className="w-full bg-gray-800 border border-gray-700/60 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all placeholder-gray-600" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Bio</label>
                <textarea defaultValue={profile.bio || ""} ref={bioRef} rows={3} className="w-full bg-gray-800 border border-gray-700/60 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all placeholder-gray-600 resize-none" placeholder="Tell people about yourself..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Location</label>
                  <input defaultValue={profile.location || ""} ref={locRef} className="w-full bg-gray-800 border border-gray-700/60 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all placeholder-gray-600" placeholder="City, Country" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Website</label>
                  <input defaultValue={profile.website || ""} ref={webRef} className="w-full bg-gray-800 border border-gray-700/60 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all placeholder-gray-600" placeholder="yoursite.com" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all">Cancel</button>
              <button onClick={saveProfile} className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-600/20">Save changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

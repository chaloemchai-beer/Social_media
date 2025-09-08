"use client";

import Header from "@/components/Header";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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

export default function ProfilePage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const locRef = useRef<HTMLInputElement>(null);
  const webRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  async function loadProfile() {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const p = await res.json();
      setProfile(p);
    }
  }
  useEffect(() => { if (status === 'authenticated') loadProfile(); }, [status]);

  async function uploadImage(type: 'avatar' | 'cover', file: File) {
    const fd = new FormData();
    fd.append('type', type);
    fd.append('file', file);
    const res = await fetch('/api/profile/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      setProfile(data.profile);
    }
  }

  async function saveProfile() {
    const body: any = {
      name: nameRef.current?.value || '',
      bio: bioRef.current?.value || '',
      location: locRef.current?.value || '',
      website: webRef.current?.value || '',
    };
    const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      const p = await res.json();
      setProfile(p); setEditing(false);
    }
  }

  const displayName = profile?.name || session?.user?.name || (session?.user?.email?.split('@')[0] || '');

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      {/* Cover */}
      <div className="relative h-72 md:h-96 bg-gradient-to-b from-slate-400 to-slate-600">
        {profile?.coverUrl && (
          <Image src={profile.coverUrl} alt="Cover" fill style={{ objectFit: 'cover' }} />
        )}
        <div className="absolute right-4 bottom-4">
          <label className="bg-white/90 hover:bg-white text-sm px-3 py-1 rounded cursor-pointer shadow">
            Edit cover photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (f) uploadImage('cover', f);
            }} />
          </label>
        </div>
      </div>

      {/* Profile header */}
      <div className="max-w-5xl mx-auto px-4 -mt-20 md:-mt-24 relative z-10">
        <div className="bg-white rounded-lg shadow p-4 overflow-visible">
          <div className="flex items-end gap-4">
            <div className="relative w-32 h-32 -mt-16 md:-mt-20 rounded-full ring-4 ring-white bg-blue-500 flex items-center justify-center text-white text-3xl font-bold z-20">
              {profile?.avatarUrl ? (
                <Image src={profile.avatarUrl} alt="Avatar" fill className="rounded-full" style={{ objectFit: 'cover' }} />
              ) : (
                <span>{displayName?.charAt(0)?.toUpperCase() || 'U'}</span>
              )}
              <label className="absolute bottom-1 right-1 bg-white/90 text-xs px-2 py-1 rounded cursor-pointer shadow">
                Edit
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]; if (f) uploadImage('avatar', f);
                }} />
              </label>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{displayName}</h1>
              {!!profile?.friendsCount && (
                <p className="text-gray-600 text-sm">{profile.friendsCount} friends</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded bg-blue-600 text-white text-sm">Add to story</button>
              <button className="px-3 py-2 rounded bg-gray-200 text-sm" onClick={() => setEditing(true)}>Edit profile</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 border-t pt-2 text-sm text-gray-600 flex gap-4">
            <span className="font-semibold text-blue-600">Posts</span>
            <span className="cursor-default">About</span>
            <span className="cursor-default">Friends</span>
            <span className="cursor-default">Photos</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Intro</h3>
            {profile?.bio ? <p className="text-gray-700 text-sm">{profile.bio}</p> : <p className="text-gray-500 text-sm">Add a short bio to tell people more about you.</p>}
            {profile?.location && <p className="text-gray-600 text-sm mt-2">📍 Lives in {profile.location}</p>}
            {profile?.website && (
              <p className="text-blue-600 text-sm mt-1">
                <a href={/^https?:\/\//.test(profile.website) ? profile.website : `https://${profile.website}`} target="_blank">{profile.website}</a>
              </p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="md:col-span-2 space-y-4">
          {/* Reuse composer + user-only feed */}
          {session?.user?.email && (
            <>
              {/* We could reuse InputBox here if desired, but Feed already renders it on home. */}
              <ProfileFeed email={session.user.email} />
            </>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && profile && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setEditing(false)}>
          <div className="bg-white rounded-lg shadow p-4 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Edit profile</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700">Name</label>
                <input defaultValue={profile.name || ''} ref={nameRef} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Bio</label>
                <textarea defaultValue={profile.bio || ''} ref={bioRef} className="w-full border rounded px-3 py-2" rows={3} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700">Location</label>
                  <input defaultValue={profile.location || ''} ref={locRef} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Website</label>
                  <input defaultValue={profile.website || ''} ref={webRef} className="w-full border rounded px-3 py-2" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 text-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="px-3 py-2 bg-blue-600 text-white rounded text-sm" onClick={saveProfile}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import SearchIcon from "@mui/icons-material/Search";
import HeaderIcon from "./common/HeaderIcon";
import HomeIcon from "@mui/icons-material/Home";
import EmojiFlagsIcon from "@mui/icons-material/EmojiFlags";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import PeopleIcon from "@mui/icons-material/People";
import GridViewIcon from "@mui/icons-material/GridView";
import MessageIcon from "@mui/icons-material/Message";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import Dropdown from "./common/Dropdown";
import { useRouter } from "next/navigation";

const Header = () => {
  const { data: session } = useSession();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [notifCount] = useState(3);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fallbackAvatar = "https://avatars.githubusercontent.com/u/1?v=4";
  const profileImage = avatarUrl || session?.user?.image || fallbackAvatar;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setAvatarUrl(data?.avatarUrl || null);
          if (data?.name && typeof data.name === 'string') setDisplayName(data.name);
        }
      } catch { }
    }
    if (session?.user?.email) load();
    return () => { cancelled = true; };
  }, [session?.user?.email]);

  // Close notification panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = (options: { callbackUrl: string }) => {
    nextAuthSignOut(options);
  };

  return (
    <div className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800/60 flex items-center px-4 h-14 gap-4">
      {/* Left — Logo + Search */}
      <div className="flex items-center gap-3 w-64 flex-shrink-0">
        <div
          className="w-9 h-9 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-shadow"
          onClick={() => router.push("/")}
        >
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15H9V8h2v9zm4 0h-2V8h2v9z" />
          </svg>
        </div>
        <span className="text-white font-bold text-lg hidden md:block tracking-tight">SocialHub</span>
        <div className="flex items-center gap-2 bg-gray-800/80 border border-gray-700/60 rounded-xl px-3 py-1.5 flex-1 min-w-0 focus-within:ring-2 focus-within:ring-violet-500/40 transition-all">
          <SearchIcon className="text-gray-500 flex-shrink-0" style={{ fontSize: 15 }} />
          <input
            className="bg-transparent outline-none text-white placeholder-gray-500 text-sm w-full"
            type="text"
            placeholder="Search..."
          />
        </div>
      </div>

      {/* Center — Nav icons */}
      <div className="flex justify-center flex-grow">
        <div className="flex items-center gap-1">
          <button onClick={() => router.push("/")}>
            <HeaderIcon active Icon={HomeIcon} />
          </button>
          <HeaderIcon Icon={EmojiFlagsIcon} />
          <button onClick={() => router.push("/live/go")}>
            <HeaderIcon Icon={PlayCircleIcon} />
          </button>
          <HeaderIcon Icon={ShoppingCartIcon} />
          <HeaderIcon Icon={PeopleIcon} />
        </div>
      </div>

      {/* Right — Actions + Profile */}
      <div className="flex items-center gap-2 w-64 justify-end flex-shrink-0">
        <button
          onClick={() => router.push('/live/go')}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-xl text-white text-xs font-bold transition-all shadow-lg shadow-red-600/30"
        >
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          Go Live
        </button>

        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('open-chat-widget'));
            }
          }}
          className="hidden xl:flex p-2 bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 rounded-xl text-gray-400 hover:text-white transition-all hover:shadow-lg"
        >
          <MessageIcon style={{ fontSize: 20 }} />
        </button>

        {/* Notification button with panel */}
        <div ref={notifRef} className="hidden xl:block relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="flex p-2 bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 rounded-xl text-gray-400 hover:text-white transition-all relative"
          >
            <NotificationsIcon style={{ fontSize: 20 }} />
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-violet-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-gray-900">
                {notifCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <span className="font-semibold text-white text-sm">Notifications</span>
                <button className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Mark all read</button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {[
                  { icon: '👍', text: 'Someone liked your post', time: '2m ago' },
                  { icon: '💬', text: 'New comment on your post', time: '15m ago' },
                  { icon: '🔁', text: 'Someone shared your post', time: '1h ago' },
                ].map((n, i) => (
                  <button key={i} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-800/60 transition-colors text-left">
                    <span className="text-xl flex-shrink-0 mt-0.5">{n.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200">{n.text}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.time}</p>
                    </div>
                    <span className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0 mt-2" />
                  </button>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-gray-800">
                <button className="w-full text-center text-sm text-violet-400 hover:text-violet-300 py-1 transition-colors">
                  See all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        <button className="hidden xl:flex p-2 bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 rounded-xl text-gray-400 hover:text-white transition-all">
          <GridViewIcon style={{ fontSize: 20 }} />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
          <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-violet-500/50 flex-shrink-0 hover:ring-violet-400 transition-all cursor-pointer" onClick={() => router.push('/profile')}>
            <Image
              src={profileImage}
              alt={session?.user?.name || "Profile"}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          <p className="hidden xl:block text-sm font-medium text-white whitespace-nowrap max-w-[100px] truncate">
            {displayName || session?.user?.name || session?.user?.email || "Guest"}
          </p>
          <Dropdown signOut={handleSignOut} />
        </div>
      </div>
    </div>
  );
};

export default Header;

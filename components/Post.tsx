import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ChatIcon from "@mui/icons-material/Chat";
import ShareIcon from "@mui/icons-material/Share";
import Image from "next/image";
import { useSession } from "next-auth/react";
import React from "react";

type PostProps = {
  id: string;
  name: string;
  message: string;
  email: string;
  images?: string[]; // Multiple images
  videoUrl?: string | null;
  postImage?: string | null; // Back-compat single image
  profileImage?: string; // Optional user avatar
  feelingType?: string;
  feelingValue?: string;
  feelingEmoji?: string;
  timestamp: string;
  reactionCounts?: Partial<Record<'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad' | 'angry', number>>;
  currentUserReaction?: string | null;
  initialCommentCount?: number;
  shareCount?: number;
  sharedFrom?: {
    _id: string;
    name?: string | null;
    email: string;
    text: string;
    imageUrl?: string | null;
    imageUrls?: string[];
    videoUrl?: string | null;
    createdAt: string;
  };
};

type Reply = { _id?: string; email: string; name?: string; text: string; createdAt: string; likes?: number; avatarUrl?: string | null };
type Comment = { _id?: string; email: string; name?: string; text: string; createdAt: string; likes?: number; avatarUrl?: string | null; replies?: Reply[] };

const Post: React.FC<PostProps> = ({ id, name, message, email, images, videoUrl, postImage, profileImage, feelingType, feelingValue, feelingEmoji, timestamp, reactionCounts = {}, currentUserReaction = null, initialCommentCount = 0, shareCount = 0, sharedFrom }) => {
  const { data: session } = useSession();
  const date = new Date(timestamp);
  const formattedDate = formatRelativeTime(date);
  const feelingText = buildFeelingText({ feelingType, feelingValue, feelingEmoji });
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const hoverTimer = React.useRef<number | null>(null);

  function openPicker() {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setPickerOpen(true);
  }

  function scheduleClosePicker(delay = 220) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      setPickerOpen(false);
      hoverTimer.current = null;
    }, delay);
  }
  const [myReaction, setMyReaction] = React.useState<string | null>(currentUserReaction);
  const [counts, setCounts] = React.useState<typeof reactionCounts>(reactionCounts);

  const [showComments, setShowComments] = React.useState(false);
  const [comments, setComments] = React.useState<Comment[] | null>(null);
  const [commentInput, setCommentInput] = React.useState("");
  const [commentCount, setCommentCount] = React.useState(initialCommentCount);
  const [commentBusy, setCommentBusy] = React.useState(false);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [replyFor, setReplyFor] = React.useState<string | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareText, setShareText] = React.useState("");
  const [shareBusy, setShareBusy] = React.useState(false);
  const [shareTotal, setShareTotal] = React.useState(shareCount);
  const [meAvatar, setMeAvatar] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMeAvatar(data?.avatarUrl || null);
      } catch { }
    }
    loadMe();
    return () => { cancelled = true; };
  }, []);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxImages, setLightboxImages] = React.useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  function openLightbox(imgs: string[] = [], startIndex = 0) {
    if (!imgs || imgs.length === 0) return;
    setLightboxImages(imgs);
    setLightboxIndex(Math.min(Math.max(0, startIndex), imgs.length - 1));
    setLightboxOpen(true);
  }
  function closeLightbox() {
    setLightboxOpen(false);
  }
  function nextLightbox() {
    setLightboxIndex((i) => (i + 1) % lightboxImages.length);
  }
  function prevLightbox() {
    setLightboxIndex((i) => (i - 1 + lightboxImages.length) % lightboxImages.length);
  }
  React.useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowRight' && lightboxImages.length > 1) {
        setLightboxIndex((i) => (i + 1) % lightboxImages.length);
      } else if (e.key === 'ArrowLeft' && lightboxImages.length > 1) {
        setLightboxIndex((i) => (i - 1 + lightboxImages.length) % lightboxImages.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, lightboxImages.length]);

  const fetchComments = React.useCallback(async () => {
    try {
      setCommentsLoading(true);
      const res = await fetch(`/api/post/${id}/comment`);
      if (!res.ok) throw new Error('Failed to load comments');
      const data = await res.json();
      setComments(data.comments || []);
    } catch (e) {
      console.error(e);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  // When opening comments, fetch if not loaded yet
  React.useEffect(() => {
    if (showComments && comments === null) {
      void fetchComments();
    }
  }, [showComments, comments, fetchComments]);

  async function setReaction(type: string | null) {
    try {
      const res = await fetch(`/api/post/${id}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error('Reaction failed');
      const data = await res.json();
      setMyReaction(data.currentUserReaction);
      setCounts(data.reactionCounts || {});
    } catch (e) {
      console.error(e);
    } finally {
      setPickerOpen(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Post Header */}
      <div className="p-5 bg-white mt-5 rounded-t-2xl shadow-sm">
        <div className="flex items-center space-x-2">
          {profileImage ? (
            <div className="flex justify-center items-center">
              <div className="rounded-full overflow-hidden">
                <Image
                  alt="Profile Picture"
                  src={profileImage}
                  width={80}
                  height={80}
                  className="cursor-pointer hover:opacity-90 w-[40px] h-[40px] object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
              {name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
          <div>
            <p className="font-medium">
              {name}
              {feelingText ? (
                <span className="text-gray-600 font-normal"> {feelingText}</span>
              ) : null}
            </p>
            <p className="text-xs text-gray-400">{formattedDate}</p>
          </div>
        </div>

        {/* Post Message */}
        {message && <p className="pt-4">{message}</p>}
      </div>

      {/* Media */}
      {videoUrl ? (
        <div className="bg-black">
          <video className="w-full max-h-[480px]" src={videoUrl} controls />
        </div>
      ) : images && images.length > 0 ? (
        <div className="bg-white">
          {images.length === 1 ? (
            <div className="relative h-56 md:h-96 cursor-zoom-in" onClick={() => openLightbox(images, 0)}>
              <Image src={images[0]} alt="Post Image" fill style={{ objectFit: "cover" }} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {images.slice(0, 4).map((src, idx) => (
                <div key={idx} className="relative h-40 md:h-56 cursor-zoom-in" onClick={() => openLightbox(images, idx)}>
                  <Image src={src} alt={`Post Image ${idx + 1}`} fill style={{ objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : postImage ? (
        <div className="relative h-56 md:h-96 bg-white cursor-zoom-in" onClick={() => openLightbox([postImage], 0)}>
          <Image src={postImage} alt="Post Image" fill style={{ objectFit: "cover" }} />
        </div>
      ) : null}

      {/* Shared original content */}
      {sharedFrom && (
        <div className="bg-white border rounded-xl mx-4 mt-3 overflow-hidden">
          <div className="px-4 pt-3 text-sm text-gray-600">
            <span className="font-semibold">{sharedFrom.name || sharedFrom.email.split('@')[0]}</span>
            <span className="ml-2 text-gray-500">{formatRelativeTime(new Date(sharedFrom.createdAt))}</span>
          </div>
          {sharedFrom.text && <div className="px-4 py-2 text-gray-800">{sharedFrom.text}</div>}
          {sharedFrom.videoUrl ? (
            <div className="bg-black">
              <video className="w-full max-h-[480px]" src={sharedFrom.videoUrl} controls />
            </div>
          ) : sharedFrom.imageUrls && sharedFrom.imageUrls.length > 0 ? (
            <div className="bg-white">
              {sharedFrom.imageUrls.length === 1 ? (
                <div className="relative h-56 md:h-96 cursor-zoom-in" onClick={() => openLightbox(sharedFrom.imageUrls || [], 0)}>
                  <Image src={sharedFrom.imageUrls[0]} alt="Shared Image" fill style={{ objectFit: "cover" }} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  {sharedFrom.imageUrls.slice(0, 4).map((src, idx) => (
                    <div key={idx} className="relative h-40 md:h-56 cursor-zoom-in" onClick={() => openLightbox(sharedFrom.imageUrls || [], idx)}>
                      <Image src={src} alt={`Shared Image ${idx + 1}`} fill style={{ objectFit: "cover" }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : sharedFrom.imageUrl ? (
            <div className="relative h-56 md:h-96 bg-white cursor-zoom-in" onClick={() => openLightbox([sharedFrom.imageUrl!], 0)}>
              <Image src={sharedFrom.imageUrl} alt="Shared Image" fill style={{ objectFit: "cover" }} />
            </div>
          ) : null}
        </div>
      )}

      {/* Reactions summary */}
      <div className="bg-white px-4 pt-2 text-sm text-gray-600 flex items-center gap-3">
        {totalReactions(counts) > 0 && (
          <div className="flex items-center gap-1">
            {topReactions(counts).map((k) => (
              <span key={k} title={k}>
                {getReactionEmoji(k)}
              </span>
            ))}
            <span>{totalReactions(counts)}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-4">
          {shareTotal > 0 && <span className="text-gray-500">{shareTotal} share{shareTotal > 1 ? 's' : ''}</span>}
          {commentCount > 0 && <span className="text-gray-500">{commentCount} comment{commentCount > 1 ? 's' : ''}</span>}
        </div>
      </div>

      {/* No preview: comments load only when expanded */}

      {/* Post Footer */}
      <div
        className="relative flex justify-between items-center rounded-b-2xl bg-white shadow-md text-gray-600 border-t"
        onMouseLeave={() => scheduleClosePicker()}
        onMouseEnter={() => openPicker()}
      >
        <button
          onClick={() => (myReaction ? setReaction(null) : setReaction('like'))}
          onMouseEnter={() => openPicker()}
          onMouseLeave={() => scheduleClosePicker()}
          className={`flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer ${myReaction ? 'text-blue-600 font-medium' : ''}`}
        >
          <ThumbUpIcon className="h4" />
          <p className="text-xs sm:text-base">{myReaction ? capitalize(myReaction) : 'Like'}</p>
        </button>
        <button onClick={() => { const next = !showComments; setShowComments(next); if (next && comments === null) void fetchComments(); }} className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer">
          <ChatIcon className="h4" />
          <p className="text-xs sm:text-base">Comment</p>
        </button>
        <button
          onClick={() => setShareOpen((v) => !v)}
          className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer"
        >
          <ShareIcon className="h4" />
          <p className="text-xs sm:text-base">Share</p>
        </button>

        {pickerOpen && (
          <div
            onMouseEnter={() => openPicker()}
            onMouseLeave={() => scheduleClosePicker()}
            className="absolute bottom-full mb-2 left-3 bg-white rounded-full shadow-lg border px-2 py-1 flex gap-2"
          >
            {['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'].map((k) => (
              <button
                key={k}
                onClick={() => setReaction(k)}
                className="text-2xl hover:scale-110 transition"
                title={capitalize(k)}
              >
                {getReactionEmoji(k)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Share composer */}
      {shareOpen && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setShareBusy(true);
            try {
              const res = await fetch(`/api/post/${id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: shareText.trim() }),
              });
              if (!res.ok) throw new Error('Share failed');
              const data = await res.json();
              setShareTotal(data.shareCount ?? (shareTotal + 1));
              setShareText('');
              setShareOpen(false);
            } catch (e) {
              console.error(e);
            } finally {
              setShareBusy(false);
            }
          }}
          className="bg-white px-4 pb-4 pt-2 border-t flex items-center gap-2"
        >
          <input
            className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring"
            placeholder="Say something about this..."
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
          />
          <button disabled={shareBusy} className={`px-3 py-2 rounded-full text-white text-sm ${shareBusy ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {shareBusy ? 'Sharing...' : 'Share'}
          </button>
        </form>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="bg-white px-4 pb-4 pt-2 border-t">
          {commentsLoading ? (
            <p className="text-sm text-gray-500">Loading comments...</p>
          ) : (comments?.length || 0) === 0 ? (
            <p className="text-sm text-gray-500">No comments yet</p>
          ) : (
            <div className="space-y-2">
              {comments!.map((c, idx) => (
                <div key={(c._id as any) || idx} className="flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    {c.avatarUrl ? (
                      <div className="flex justify-center items-center">
                        <div className="rounded-full overflow-hidden">
                          <Image
                            src={c.avatarUrl} alt={c.name || c.email}
                            width={80}
                            height={80}
                            className="cursor-pointer hover:opacity-90 w-[40px] h-[40px] object-cover"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                        {(c.name || c.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="bg-gray-100 rounded-2xl px-3 py-2 flex-1">
                      <div className="text-xs text-gray-700 font-semibold">{c.name || c.email.split('@')[0]}</div>
                      <div className="text-sm text-gray-800">{c.text}</div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-600">
                        <span>{formatRelativeTime(new Date(c.createdAt))}</span>
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/post/${id}/comment/${c._id}/like`, { method: 'POST' });
                              if (!res.ok) throw new Error('like failed');
                              const data = await res.json();
                              setComments((prev) =>
                                (prev || []).map((x) => (x._id === c._id ? { ...x, likes: data.likes } : x))
                              );
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        >
                          Like
                        </button>
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => {
                            setReplyFor((c._id as any) || String(idx));
                            setReplyText("");
                          }}
                        >
                          Reply
                        </button>
                        {c.likes ? <span className="text-gray-500">{c.likes} like{(c.likes || 0) > 1 ? 's' : ''}</span> : null}
                      </div>
                      {/* Replies list */}
                      {c.replies && c.replies.length > 0 && (
                        <div className="mt-2 pl-4 space-y-2">
                          {c.replies.map((r, ridx) => (
                            <div key={(r._id as any) || ridx} className="flex items-start gap-2">
                              {r.avatarUrl ? (
                                <div className="flex justify-center items-center">
                                  <div className="rounded-full overflow-hidden">
                                    <Image
                                      src={r.avatarUrl} alt={r.name || r.email}
                                      width={80}
                                      height={80}
                                      className="cursor-pointer hover:opacity-90 w-[40px] h-[40px] object-cover"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-semibold">
                                  {(r.name || r.email).charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="bg-gray-100 rounded-2xl px-3 py-2">
                                <div className="text-xs text-gray-700 font-semibold">{r.name || r.email.split('@')[0]}</div>
                                <div className="text-sm text-gray-800">{r.text}</div>
                                <div className="text-[10px] text-gray-500 mt-1">{formatRelativeTime(new Date(r.createdAt))}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Reply input */}
                      {replyFor === c._id && (
                        <form
                          className="mt-2 flex items-center gap-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!replyText.trim()) return;
                            try {
                              const res = await fetch(`/api/post/${id}/comment/${c._id}/reply`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text: replyText.trim() }),
                              });
                              if (!res.ok) throw new Error('reply failed');
                              const data = await res.json();
                              setComments((prev) =>
                                (prev || []).map((x) => (x._id === c._id ? { ...x, replies: [...(x.replies || []), data.reply] } : x))
                              );
                              setReplyText("");
                              setReplyFor(null);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        >
                          {meAvatar ? (
                            <Image src={meAvatar} alt="Me" width={28} height={28} className="rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-xs font-semibold">
                              {(session?.user?.name || session?.user?.email || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <input
                            className="flex-1 border rounded-full px-3 py-1 text-sm"
                            placeholder="Write a reply..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                          <button className="text-sm px-3 py-1 rounded-full bg-blue-600 text-white disabled:bg-blue-300" disabled={!replyText.trim()}>
                            Reply
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!commentInput.trim()) return;
              setCommentBusy(true);
              try {
                const res = await fetch(`/api/post/${id}/comment`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: commentInput.trim() }),
                });
                if (!res.ok) throw new Error('Failed to comment');
                const data = await res.json();
                setComments((prev) => (prev ? [...prev, data.comment] : [data.comment]));
                setCommentCount((n) => n + 1);
                setCommentInput("");
              } catch (e) {
                console.error(e);
              } finally {
                setCommentBusy(false);
              }
            }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring"
              placeholder="Write a comment..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
            />
            <button
              disabled={!commentInput.trim() || commentBusy}
              className={`px-3 py-2 rounded-full text-white text-sm ${!commentInput.trim() || commentBusy ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {commentBusy ? 'Posting...' : 'Post'}
            </button>
          </form>
        </div>
      )}

      {/* Lightbox overlay */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closeLightbox}>
          <button aria-label="Close" className="absolute top-4 right-4 text-white text-2xl" onClick={(e) => { e.stopPropagation(); closeLightbox(); }}>×</button>
          {lightboxImages.length > 1 && (
            <button className="absolute left-4 text-white text-3xl select-none" onClick={(e) => { e.stopPropagation(); prevLightbox(); }}>
              ‹
            </button>
          )}
          <div className="relative w-full h-full max-w-6xl max-h-[90vh] px-6" onClick={(e) => e.stopPropagation()}>
            <Image src={lightboxImages[lightboxIndex]} alt="Full Image" fill style={{ objectFit: 'contain' }} />
          </div>
          {lightboxImages.length > 1 && (
            <button className="absolute right-4 text-white text-3xl select-none" onClick={(e) => { e.stopPropagation(); nextLightbox(); }}>
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Post;

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = (date.getTime() - now.getTime()) / 1000; // seconds
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(diff);

  if (abs < 60) return rtf.format(Math.round(diff), "second");
  const minutes = diff / 60;
  if (Math.abs(minutes) < 60) return rtf.format(Math.round(minutes), "minute");
  const hours = minutes / 60;
  if (Math.abs(hours) < 24) return rtf.format(Math.round(hours), "hour");
  const days = hours / 24;
  if (Math.abs(days) < 7) return rtf.format(Math.round(days), "day");
  const weeks = days / 7;
  if (Math.abs(weeks) < 4) return rtf.format(Math.round(weeks), "week");
  const months = days / 30;
  if (Math.abs(months) < 12) return rtf.format(Math.round(months), "month");
  const years = days / 365;
  return rtf.format(Math.round(years), "year");
}

function buildFeelingText({ feelingType, feelingValue, feelingEmoji }: { feelingType?: string; feelingValue?: string; feelingEmoji?: string }) {
  if (!feelingType && !feelingValue) return "";
  const emoji = feelingEmoji ? `${feelingEmoji} ` : "";
  const type = (feelingType || "feeling").trim().toLowerCase();
  const value = (feelingValue || "").trim();

  if (type === "feeling") return `is feeling ${emoji}${value}`;
  // some types naturally include a preposition
  return `is ${type} ${emoji}${value}`;
}

function totalReactions(counts: Record<string, number | undefined>) {
  return Object.values(counts).reduce((a, b) => a + (b || 0), 0);
}

function topReactions(counts: Record<string, number | undefined>) {
  const entries = Object.entries(counts) as [string, number | undefined][];
  return entries
    .filter(([, v]) => (v || 0) > 0)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 3)
    .map(([k]) => k);
}

function getReactionEmoji(type: string) {
  switch (type) {
    case 'like': return '👍';
    case 'love': return '❤️';
    case 'care': return '🤗';
    case 'haha': return '😂';
    case 'wow': return '😮';
    case 'sad': return '😢';
    case 'angry': return '😡';
    default: return '👍';
  }
}

function reactionEmojiUI(type: string) {
  switch (type) {
    case 'like': return '👍';
    case 'love': return '❤️';
    case 'care': return '🤗';
    case 'haha': return '😂';
    case 'wow': return '😮';
    case 'sad': return '😢';
    case 'angry': return '😡';
    default: return '👍';
  }
}

function reactionEmojiSafe(type: string) {
  switch (type) {
    case 'like': return '👍';
    case 'love': return '❤️';
    case 'care': return '🤗';
    case 'haha': return '😂';
    case 'wow': return '😮';
    case 'sad': return '😢';
    case 'angry': return '😡';
    default: return '👍';
  }
}

function reactionEmojiFixed(type: string) {
  switch (type) {
    case 'like': return '👍';
    case 'love': return '❤️';
    case 'care': return '🤗';
    case 'haha': return '😂';
    case 'wow': return '😮';
    case 'sad': return '😢';
    case 'angry': return '😡';
    default: return '👍';
  }
}

function reactionEmoji(type: string) {
  switch (type) {
    case 'like': return '👍';
    case 'love': return '❤️';
    case 'care': return '🤗';
    case 'haha': return '😂';
    case 'wow': return '😮';
    case 'sad': return '😢';
    case 'angry': return '😡';
    default: return '👍';
  }
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

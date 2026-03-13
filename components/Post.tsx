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
  meAvatar?: string | null;
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

type Reply = { _id?: string; email: string; name?: string; text: string; createdAt: string; likes?: number; avatarUrl?: string | null; mediaUrls?: string[] };
type Comment = { _id?: string; email: string; name?: string; text: string; createdAt: string; likes?: number; avatarUrl?: string | null; replies?: Reply[]; mediaUrls?: string[]; linkUrl?: string | null };
type OGPreview = { url: string; title?: string | null; description?: string | null; image?: string | null; siteName?: string | null };

const URL_REGEX = /https?:\/\/[^\s]+/;

function LinkPreviewCard({ url, compact = false }: { url: string; compact?: boolean }) {
  const [preview, setPreview] = React.useState<OGPreview | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/og-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && !d.error) setPreview(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 mt-1.5 bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2 animate-pulse">
        <div className="w-10 h-10 bg-gray-700 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2 bg-gray-700 rounded w-1/2" />
          <div className="h-2 bg-gray-700 rounded w-3/4" />
        </div>
      </div>
    );
  }
  if (!preview?.title) return null;
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex gap-2 mt-1.5 bg-gray-800/60 border border-gray-700 hover:border-violet-500/40 rounded-xl overflow-hidden transition-colors ${compact ? 'max-h-14' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <div className={`flex-shrink-0 bg-gray-700 ${compact ? 'w-14 h-14' : 'w-16 h-16'}`}>
          <img src={preview.image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 min-w-0 px-2.5 py-2">
        {preview.siteName && <p className="text-[10px] text-gray-500 uppercase tracking-wide truncate">{preview.siteName}</p>}
        <p className="text-xs font-semibold text-gray-200 line-clamp-1 leading-tight mt-0.5">{preview.title}</p>
        {!compact && preview.description && (
          <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{preview.description}</p>
        )}
      </div>
    </a>
  );
}

const Post: React.FC<PostProps> = ({ id, name, message, email, images, videoUrl, postImage, profileImage, feelingType, feelingValue, feelingEmoji, timestamp, reactionCounts = {}, currentUserReaction = null, initialCommentCount = 0, shareCount = 0, sharedFrom, meAvatar: meAvatarProp = null }) => {
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
  const meAvatar = meAvatarProp;
  const [commentFiles, setCommentFiles] = React.useState<File[]>([]);
  const [replyFiles, setReplyFiles] = React.useState<File[]>([]);
  const commentFileRef = React.useRef<HTMLInputElement>(null);
  const commentGifRef = React.useRef<HTMLInputElement>(null);
  const replyFileRef = React.useRef<HTMLInputElement>(null);
  const replyGifRef = React.useRef<HTMLInputElement>(null);
  const [commentLinkUrl, setCommentLinkUrl] = React.useState<string | null>(null);

  // Detect URL in comment input for link preview
  React.useEffect(() => {
    const match = commentInput.match(URL_REGEX);
    const url = match?.[0] ?? null;
    if (url === commentLinkUrl) return;
    const timer = setTimeout(() => setCommentLinkUrl(url), 600);
    return () => clearTimeout(timer);
  }, [commentInput]);

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
    <div className="bg-gray-900 border border-gray-800 rounded-2xl mt-4 overflow-hidden">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          {profileImage ? (
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-gray-700 flex-shrink-0">
              <Image src={profileImage} alt={name} width={40} height={40} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center font-semibold flex-shrink-0">
              {name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">
              {name}
              {feelingText && (
                <span className="text-gray-400 font-normal"> {feelingText}</span>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{formattedDate}</p>
          </div>
          <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        </div>

        {/* Post Message */}
        {message && (
          <p className="mt-3 text-gray-100 text-sm leading-relaxed">{message}</p>
        )}
      </div>

      {/* ── Media ── */}
      {videoUrl ? (
        <div className="bg-black">
          <video className="w-full max-h-[480px]" src={videoUrl} controls />
        </div>
      ) : images && images.length > 0 ? (
        images.length === 1 ? (
          <div className="relative h-72 md:h-96 cursor-zoom-in" onClick={() => openLightbox(images, 0)}>
            <Image src={images[0]} alt="Post Image" fill style={{ objectFit: "cover" }} />
          </div>
        ) : (
          <div className={`grid gap-0.5 ${images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
            {images.slice(0, 4).map((src, idx) => (
              <div
                key={idx}
                className={`relative cursor-zoom-in ${images.length === 3 && idx === 0 ? 'col-span-2' : ''} h-44 md:h-56`}
                onClick={() => openLightbox(images, idx)}
              >
                <Image src={src} alt={`Post Image ${idx + 1}`} fill style={{ objectFit: "cover" }} />
                {idx === 3 && images.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">+{images.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : postImage ? (
        <div className="relative h-72 md:h-96 cursor-zoom-in" onClick={() => openLightbox([postImage], 0)}>
          <Image src={postImage} alt="Post Image" fill style={{ objectFit: "cover" }} />
        </div>
      ) : null}

      {/* ── Shared original content ── */}
      {sharedFrom && (
        <div className="mx-4 mt-3 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {(sharedFrom.name || sharedFrom.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-200">{sharedFrom.name || sharedFrom.email.split('@')[0]}</span>
              <span className="ml-2 text-xs text-gray-500">{formatRelativeTime(new Date(sharedFrom.createdAt))}</span>
            </div>
          </div>
          {sharedFrom.text && <div className="px-4 py-2 text-sm text-gray-300">{sharedFrom.text}</div>}
          {sharedFrom.videoUrl ? (
            <video className="w-full max-h-[320px]" src={sharedFrom.videoUrl} controls />
          ) : sharedFrom.imageUrls && sharedFrom.imageUrls.length > 0 ? (
            <div className="relative h-48 cursor-zoom-in" onClick={() => openLightbox(sharedFrom.imageUrls || [], 0)}>
              <Image src={sharedFrom.imageUrls[0]} alt="Shared" fill style={{ objectFit: "cover" }} />
              {sharedFrom.imageUrls.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                  +{sharedFrom.imageUrls.length - 1} more
                </div>
              )}
            </div>
          ) : sharedFrom.imageUrl ? (
            <div className="relative h-48 cursor-zoom-in" onClick={() => openLightbox([sharedFrom.imageUrl!], 0)}>
              <Image src={sharedFrom.imageUrl} alt="Shared" fill style={{ objectFit: "cover" }} />
            </div>
          ) : null}
        </div>
      )}

      {/* ── Reactions & counts bar ── */}
      {(totalReactions(counts) > 0 || shareTotal > 0 || commentCount > 0) && (
        <div className="px-4 py-2 flex items-center gap-2 border-t border-gray-800">
          {totalReactions(counts) > 0 && (
            <div className="flex items-center gap-1 flex-1">
              <div className="flex -space-x-0.5">
                {topReactions(counts).map((k) => (
                  <span key={k} className="text-base leading-none">{getReactionEmoji(k)}</span>
                ))}
              </div>
              <span className="text-xs text-gray-500 ml-1">{totalReactions(counts)}</span>
            </div>
          )}
          <div className="flex items-center gap-3 ml-auto text-xs text-gray-500">
            {commentCount > 0 && (
              <button
                onClick={() => { setShowComments(v => !v); if (!showComments && comments === null) void fetchComments(); }}
                className="hover:text-gray-300 transition-colors"
              >
                {commentCount} comment{commentCount > 1 ? 's' : ''}
              </button>
            )}
            {shareTotal > 0 && <span>{shareTotal} share{shareTotal > 1 ? 's' : ''}</span>}
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div
        className="relative flex items-center border-t border-gray-800"
        onMouseLeave={() => scheduleClosePicker()}
      >
        <button
          onClick={() => (myReaction ? setReaction(null) : setReaction('like'))}
          onMouseEnter={() => openPicker()}
          onMouseLeave={() => scheduleClosePicker()}
          className={`flex items-center gap-1.5 flex-1 justify-center py-2.5 text-sm font-medium rounded-bl-xl transition-colors
            ${myReaction
              ? 'text-violet-400 hover:bg-gray-800'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
        >
          <span className="text-base leading-none">{myReaction ? getReactionEmoji(myReaction) : '👍'}</span>
          <span>{myReaction ? capitalize(myReaction) : 'Like'}</span>
        </button>

        <button
          onClick={() => { const next = !showComments; setShowComments(next); if (next && comments === null) void fetchComments(); }}
          className="flex items-center gap-1.5 flex-1 justify-center py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ChatIcon style={{ fontSize: 18 }} />
          <span>Comment</span>
        </button>

        <button
          onClick={() => setShareOpen((v) => !v)}
          className="flex items-center gap-1.5 flex-1 justify-center py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-br-xl transition-colors"
        >
          <ShareIcon style={{ fontSize: 18 }} />
          <span>Share</span>
        </button>

        {/* Reaction picker */}
        {pickerOpen && (
          <div
            onMouseEnter={() => openPicker()}
            onMouseLeave={() => scheduleClosePicker()}
            className="absolute bottom-full mb-2 left-3 bg-gray-800 border border-gray-700 rounded-2xl shadow-xl shadow-black/40 px-3 py-2 flex gap-2"
          >
            {['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'].map((k) => (
              <button
                key={k}
                onClick={() => setReaction(k)}
                className="text-2xl hover:scale-125 transition-transform duration-150"
                title={capitalize(k)}
              >
                {getReactionEmoji(k)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Share composer ── */}
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
          className="px-4 py-3 border-t border-gray-800 flex items-center gap-2"
        >
          <input
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
            placeholder="Say something about this..."
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
          />
          <button
            disabled={shareBusy}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed transition-colors"
          >
            {shareBusy ? 'Sharing...' : 'Share'}
          </button>
        </form>
      )}

      {/* ── Comments ── */}
      {showComments && (
        <div className="px-4 py-3 border-t border-gray-800 space-y-3">
          {commentsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start gap-2 animate-pulse">
                  <div className="w-8 h-8 bg-gray-800 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-gray-800 rounded w-1/4" />
                    <div className="h-2 bg-gray-800 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (comments?.length || 0) === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-3">
              {comments!.map((c, idx) => (
                <div key={(c._id as any) || idx} className="flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    {c.avatarUrl ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-gray-700 flex-shrink-0">
                        <Image src={c.avatarUrl} alt={c.name || c.email} width={32} height={32} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {(c.name || c.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-800 rounded-2xl px-3 py-2">
                        <p className="text-xs font-semibold text-gray-200">{c.name || c.email.split('@')[0]}</p>
                        {c.text && <p className="text-sm text-gray-300 mt-0.5">{c.text}</p>}
                        {c.mediaUrls && c.mediaUrls.length > 0 && (
                          <div className={`mt-2 grid gap-1 ${c.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {c.mediaUrls.map((url, mi) => (
                              url.match(/\.(mp4|mov|webm|ogg)$/i) ? (
                                <video key={mi} src={url} controls className="w-full rounded-xl max-h-40 bg-black" />
                              ) : (
                                <img key={mi} src={url} alt="comment media" className="w-full rounded-xl object-cover max-h-40 cursor-zoom-in" onClick={() => openLightbox(c.mediaUrls!, mi)} />
                              )
                            ))}
                          </div>
                        )}
                        {c.linkUrl && <LinkPreviewCard url={c.linkUrl} compact />}
                      </div>
                      <div className="flex items-center gap-3 mt-1 pl-2 text-xs text-gray-500">
                        <span>{formatRelativeTime(new Date(c.createdAt))}</span>
                        <button
                          type="button"
                          className="font-semibold hover:text-violet-400 transition-colors"
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/post/${id}/comment/${c._id}/like`, { method: 'POST' });
                              if (!res.ok) throw new Error('like failed');
                              const data = await res.json();
                              setComments((prev) =>
                                (prev || []).map((x) => (x._id === c._id ? { ...x, likes: data.likes } : x))
                              );
                            } catch (e) { console.error(e); }
                          }}
                        >
                          Like
                        </button>
                        <button
                          type="button"
                          className="font-semibold hover:text-violet-400 transition-colors"
                          onClick={() => { setReplyFor((c._id as any) || String(idx)); setReplyText(""); }}
                        >
                          Reply
                        </button>
                        {c.likes ? <span>{c.likes} 👍</span> : null}
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {c.replies && c.replies.length > 0 && (
                    <div className="ml-10 space-y-2 mt-1">
                      {c.replies.map((r, ridx) => (
                        <div key={(r._id as any) || ridx} className="flex items-start gap-2">
                          {r.avatarUrl ? (
                            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                              <Image src={r.avatarUrl} alt={r.name || r.email} width={28} height={28} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-700 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                              {(r.name || r.email).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="bg-gray-800 rounded-2xl px-3 py-2 flex-1">
                            <p className="text-xs font-semibold text-gray-200">{r.name || r.email.split('@')[0]}</p>
                            {r.text && <p className="text-sm text-gray-300 mt-0.5">{r.text}</p>}
                            {r.mediaUrls && r.mediaUrls.length > 0 && (
                              <div className={`mt-2 grid gap-1 ${r.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {r.mediaUrls.map((url, mi) => (
                                  url.match(/\.(mp4|mov|webm|ogg)$/i) ? (
                                    <video key={mi} src={url} controls className="w-full rounded-xl max-h-36 bg-black" />
                                  ) : (
                                    <img key={mi} src={url} alt="reply media" className="w-full rounded-xl object-cover max-h-36 cursor-zoom-in" onClick={() => openLightbox(r.mediaUrls!, mi)} />
                                  )
                                ))}
                              </div>
                            )}
                            <p className="text-[10px] text-gray-500 mt-1">{formatRelativeTime(new Date(r.createdAt))}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply input */}
                  {replyFor === (c._id ?? String(idx)) && (
                    <form
                      className="ml-10 flex flex-col gap-1.5 mt-1"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!replyText.trim() && replyFiles.length === 0) return;
                        try {
                          const fd = new FormData();
                          fd.append('text', replyText.trim());
                          replyFiles.forEach((f) => fd.append('files', f));
                          const res = await fetch(`/api/post/${id}/comment/${c._id}/reply`, { method: 'POST', body: fd });
                          if (!res.ok) throw new Error('reply failed');
                          const data = await res.json();
                          setComments((prev) =>
                            (prev || []).map((x) => (x._id === c._id ? { ...x, replies: [...(x.replies || []), data.reply] } : x))
                          );
                          setReplyText('');
                          setReplyFiles([]);
                          setReplyFor(null);
                        } catch (e) { console.error(e); }
                      }}
                    >
                      {replyFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-9">
                          {replyFiles.map((f, i) => (
                            <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                              {f.type.startsWith('image') ? (
                                <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                                  </svg>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setReplyFiles((prev) => prev.filter((_, j) => j !== i))}
                                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {meAvatar ? (
                          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                            <Image src={meAvatar} alt="Me" width={28} height={28} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-700 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {(session?.user?.name || session?.user?.email || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-violet-500 transition-all">
                          <input
                            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                            placeholder="Write a reply..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => replyFileRef.current?.click()}
                            className="p-1 text-gray-500 hover:text-green-400 transition-colors flex-shrink-0"
                            title="Attach image"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => replyGifRef.current?.click()}
                            className="px-1 text-gray-500 hover:text-yellow-400 transition-colors flex-shrink-0 text-[9px] font-bold leading-none border border-current rounded"
                            title="Attach GIF"
                          >
                            GIF
                          </button>
                        </div>
                        <button
                          className="text-xs px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:bg-violet-800 transition-colors flex-shrink-0"
                          disabled={!replyText.trim() && replyFiles.length === 0}
                        >
                          Reply
                        </button>
                      </div>
                      <input
                        ref={replyFileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) setReplyFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                          e.target.value = '';
                        }}
                      />
                      <input
                        ref={replyGifRef}
                        type="file"
                        accept="image/gif"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) setReplyFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                          e.target.value = '';
                        }}
                      />
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!commentInput.trim() && commentFiles.length === 0) return;
              setCommentBusy(true);
              try {
                const fd = new FormData();
                fd.append('text', commentInput.trim());
                commentFiles.forEach((f) => fd.append('files', f));
                const res = await fetch(`/api/post/${id}/comment`, { method: 'POST', body: fd });
                if (!res.ok) throw new Error('Failed to comment');
                const data = await res.json();
                setComments((prev) => (prev ? [...prev, data.comment] : [data.comment]));
                setCommentCount((n) => n + 1);
                setCommentInput('');
                setCommentFiles([]);
                setCommentLinkUrl(null);
              } catch (e) {
                console.error(e);
              } finally {
                setCommentBusy(false);
              }
            }}
            className="flex flex-col gap-2 pt-1"
          >
            {/* File previews */}
            {commentFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-10">
                {commentFiles.map((f, i) => (
                  <div key={i} className="relative group w-16 h-16 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
                    {f.type.startsWith('image') ? (
                      <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setCommentFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Link preview while composing */}
            {commentLinkUrl && (
              <div className="pl-10">
                <LinkPreviewCard url={commentLinkUrl} />
              </div>
            )}
            <div className="flex items-center gap-2">
              {meAvatar ? (
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                  <Image src={meAvatar} alt="Me" width={32} height={32} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {(session?.user?.name || session?.user?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-violet-500 transition-all">
                <input
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                  placeholder="Write a comment..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => commentFileRef.current?.click()}
                  className="p-1 text-gray-500 hover:text-green-400 transition-colors flex-shrink-0"
                  title="Attach image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => commentGifRef.current?.click()}
                  className="px-1 text-gray-500 hover:text-yellow-400 transition-colors flex-shrink-0 text-[10px] font-bold leading-none border border-current rounded"
                  title="Attach GIF"
                >
                  GIF
                </button>
              </div>
              <button
                disabled={(!commentInput.trim() && commentFiles.length === 0) || commentBusy}
                className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <input
              ref={commentFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) setCommentFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                e.target.value = '';
              }}
            />
            <input
              ref={commentGifRef}
              type="file"
              accept="image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) setCommentFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                e.target.value = '';
              }}
            />
          </form>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={closeLightbox}>
          <button
            aria-label="Close"
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-xl text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {lightboxImages.length > 1 && (
            <button
              className="absolute left-4 w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-xl text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); prevLightbox(); }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="relative w-full h-full max-w-5xl max-h-[90vh] px-16" onClick={(e) => e.stopPropagation()}>
            <Image src={lightboxImages[lightboxIndex]} alt="Full Image" fill style={{ objectFit: 'contain' }} />
          </div>
          {lightboxImages.length > 1 && (
            <button
              className="absolute right-4 w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-xl text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); nextLightbox(); }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          {lightboxImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {lightboxImages.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`w-2 h-2 rounded-full transition-colors ${i === lightboxIndex ? 'bg-white' : 'bg-gray-600'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(Post);

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

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

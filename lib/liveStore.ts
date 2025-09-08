type Candidate = RTCIceCandidateInit & { sdpMid?: string | null; sdpMLineIndex?: number | null };

export type LiveStream = {
  id: string;
  offer?: string; // SDP
  offerCandidates: Candidate[];
  answer?: string; // SDP (single-viewer MVP)
  answerCandidates: Candidate[];
  updatedAt: number;
};

type Store = {
  streams: Map<string, LiveStream>;
};

function createStore(): Store {
  return { streams: new Map() };
}

declare global {
  // eslint-disable-next-line no-var
  var __liveStore: Store | undefined;
}

const store: Store = global.__liveStore || (global.__liveStore = createStore());

export function getOrCreateStream(id: string): LiveStream {
  let s = store.streams.get(id);
  if (!s) {
    s = { id, offerCandidates: [], answerCandidates: [], updatedAt: Date.now() };
    store.streams.set(id, s);
  }
  s.updatedAt = Date.now();
  return s;
}

export function getStream(id: string): LiveStream | undefined {
  return store.streams.get(id);
}

export function setOffer(id: string, sdp: string) {
  const s = getOrCreateStream(id);
  s.offer = sdp;
  s.updatedAt = Date.now();
}

export function setAnswer(id: string, sdp: string) {
  const s = getOrCreateStream(id);
  s.answer = sdp;
  s.updatedAt = Date.now();
}

export function pushOfferCandidate(id: string, cand: Candidate) {
  const s = getOrCreateStream(id);
  s.offerCandidates.push(cand);
  s.updatedAt = Date.now();
}

export function drainOfferCandidates(id: string): Candidate[] {
  const s = getOrCreateStream(id);
  const out = [...s.offerCandidates];
  s.offerCandidates.length = 0;
  return out;
}

export function pushAnswerCandidate(id: string, cand: Candidate) {
  const s = getOrCreateStream(id);
  s.answerCandidates.push(cand);
  s.updatedAt = Date.now();
}

export function drainAnswerCandidates(id: string): Candidate[] {
  const s = getOrCreateStream(id);
  const out = [...s.answerCandidates];
  s.answerCandidates.length = 0;
  return out;
}

export function clearStream(id: string) {
  const s = store.streams.get(id);
  if (s) store.streams.delete(id);
}


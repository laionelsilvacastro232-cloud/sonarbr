"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { logPlayError, recordPlay, reportDuration } from "@/app/actions";
import type { TrackDTO } from "@/lib/queries";

export type RepeatMode = "off" | "all" | "one";
const isPlayable = (t: TrackDTO) => !!t.audioUrl && t.availability === "available";

type Ctx = {
  queue: TrackDTO[];
  index: number;
  current: TrackDTO | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  expanded: boolean;
  queueOpen: boolean;
  playTrack: (t: TrackDTO, list?: TrackDTO[]) => void;
  playList: (list: TrackDTO[], start?: number, shuffle?: boolean) => void;
  addToQueue: (t: TrackDTO) => void;
  playNext: (t: TrackDTO) => void;
  removeFromQueue: (i: number) => void;
  jumpTo: (i: number) => void;
  clearQueue: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setExpanded: (v: boolean) => void;
  setQueueOpen: (v: boolean) => void;
  patchTrack: (id: string, patch: Partial<TrackDTO>) => void;
  dismissError: () => void;
};

const PlayerCtx = createContext<Ctx | null>(null);
export const usePlayer = () => {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error("usePlayer fora do provider");
  return c;
};

function shuffled<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<TrackDTO[]>([]);
  const [original, setOriginal] = useState<TrackDTO[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [expanded, setExpanded] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  // refs espelham o estado para uso dentro dos listeners do <audio>
  const st = useRef({ queue, index, repeat, shuffle, original });
  st.current = { queue, index, repeat, shuffle, original };
  const listened = useRef({ id: "", sec: 0, last: 0, recorded: false });
  const failures = useRef(0);
  const restored = useRef(false);

  const current = index >= 0 ? (queue[index] ?? null) : null;

  /* ---------- carrega/persiste preferências ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("player:v1");
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.volume === "number") setVolumeState(s.volume);
        if (s.shuffle) setShuffle(true);
        if (["off", "all", "one"].includes(s.repeat)) setRepeat(s.repeat);
        if (Array.isArray(s.queue) && s.queue.length && typeof s.index === "number" && s.queue[s.index]) {
          setQueue(s.queue);
          setOriginal(s.original ?? s.queue);
          setIndex(s.index);
        }
      }
    } catch {}
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem("player:v1", JSON.stringify({ volume, shuffle, repeat, queue: queue.slice(0, 200), original: original.slice(0, 200), index }));
    } catch {}
  }, [volume, shuffle, repeat, queue, original, index]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  /* ---------- troca de faixa -> carrega source real ---------- */
  const loadedId = useRef<string | null>(null);
  const autoplay = useRef(false);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!current) {
      a.pause();
      a.removeAttribute("src");
      loadedId.current = null;
      return;
    }
    if (loadedId.current === current.id) return;
    loadedId.current = current.id;
    listened.current = { id: current.id, sec: 0, last: 0, recorded: false };
    setProgress(0);
    setDuration(current.durationSec || 0);
    if (!isPlayable(current)) {
      a.pause();
      a.removeAttribute("src");
      setPlaying(false);
      setLoading(false);
      setError("Esta faixa não está disponível para reprodução aqui. Use \"Abrir na fonte original\".");
      return;
    }
    setError(null);
    setLoading(true);
    a.src = current.audioUrl!;
    a.load();
    if (autoplay.current) {
      a.play().catch((e) => {
        if (e?.name !== "AbortError") setPlaying(false);
      });
    }
  }, [current]);

  /* ---------- navegação ---------- */
  const goTo = useCallback((i: number, play = true) => {
    autoplay.current = play;
    setIndex(i);
    const a = audioRef.current;
    // reinicia mesmo que seja a mesma faixa
    if (a && st.current.queue[i]?.id === loadedId.current) {
      a.currentTime = 0;
      if (play) a.play().catch(() => {});
    }
  }, []);

  const next = useCallback(() => {
    const { queue: q, index: i, repeat: r } = st.current;
    if (!q.length) return;
    if (i + 1 < q.length) goTo(i + 1);
    else if (r === "all") goTo(0);
    else {
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, [goTo]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    const { queue: q, index: i, repeat: r } = st.current;
    if (!q.length) return;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    if (i > 0) goTo(i - 1);
    else if (r === "all") goTo(q.length - 1);
    else if (a) a.currentTime = 0;
  }, [goTo]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (!isPlayable(current)) {
      setError("Esta faixa não está disponível para reprodução aqui.");
      return;
    }
    if (a.paused) {
      autoplay.current = true;
      a.play().catch((e) => {
        if (e?.name !== "AbortError") setError("O navegador bloqueou a reprodução. Toque em reproduzir novamente.");
      });
    } else a.pause();
  }, [current]);

  const start = useCallback((list: TrackDTO[], startIdx: number, doShuffle?: boolean) => {
    const playableList = list;
    if (!playableList.length) return;
    const useShuffle = doShuffle ?? st.current.shuffle;
    setOriginal(playableList);
    if (useShuffle) {
      const first = playableList[startIdx];
      const rest = shuffled(playableList.filter((_, i) => i !== startIdx));
      setQueue([first, ...rest]);
      setShuffle(true);
      autoplay.current = true;
      setIndex(0);
    } else {
      setQueue(playableList);
      autoplay.current = true;
      setIndex(startIdx);
    }
    failures.current = 0;
    // mesma faixa tocando de novo
    const a = audioRef.current;
    const target = useShuffle ? playableList[startIdx] : playableList[startIdx];
    if (a && target?.id === loadedId.current) {
      a.currentTime = 0;
      a.play().catch(() => {});
    }
  }, []);

  const playList = useCallback((list: TrackDTO[], startIdx = 0, doShuffle?: boolean) => {
    const pl = list.filter(isPlayable);
    if (!pl.length) {
      setError("Nenhuma faixa desta lista possui áudio disponível para reprodução.");
      return;
    }
    const target = list[startIdx];
    let idx = pl.findIndex((t) => t.id === target?.id);
    if (idx < 0) idx = 0;
    start(pl, doShuffle ? Math.floor(Math.random() * pl.length) : idx, doShuffle);
  }, [start]);

  const playTrack = useCallback((t: TrackDTO, list?: TrackDTO[]) => {
    if (!isPlayable(t)) {
      setQueue((q) => (q.length ? q : [t]));
      setError("Esta faixa não está disponível para reprodução aqui. Use \"Abrir na fonte original\".");
      return;
    }
    playList(list && list.length ? list : [t], (list ?? [t]).findIndex((x) => x.id === t.id));
  }, [playList]);

  const addToQueue = useCallback((t: TrackDTO) => {
    if (!isPlayable(t)) return;
    setQueue((q) => (q.length ? [...q, t] : [t]));
    setOriginal((o) => [...o, t]);
    setIndex((i) => (i < 0 ? 0 : i));
  }, []);

  const playNext = useCallback((t: TrackDTO) => {
    if (!isPlayable(t)) return;
    if (!st.current.queue.length) {
      start([t], 0);
      return;
    }
    setQueue((q) => {
      const copy = [...q];
      copy.splice(st.current.index + 1, 0, t);
      return copy;
    });
  }, [start]);

  const removeFromQueue = useCallback((i: number) => {
    const { index: cur, queue: q } = st.current;
    if (i === cur) return;
    setQueue(q.filter((_, k) => k !== i));
    if (i < cur) setIndex(cur - 1);
  }, []);

  const jumpTo = useCallback((i: number) => goTo(i), [goTo]);

  const clearQueue = useCallback(() => {
    const { queue: q, index: i } = st.current;
    if (i < 0) return;
    setQueue([q[i]]);
    setOriginal([q[i]]);
    setIndex(0);
  }, []);

  const seek = useCallback((sec: number) => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(sec)) return;
    a.currentTime = Math.max(0, Math.min(sec, a.duration || sec));
    setProgress(a.currentTime);
  }, []);

  const toggleShuffle = useCallback(() => {
    const { queue: q, index: i, original: o, shuffle: s } = st.current;
    if (!s) {
      if (q.length > 1 && i >= 0) {
        const cur = q[i];
        setQueue([...q.slice(0, i + 1).filter((_, k) => k <= i), ...shuffled(q.slice(i + 1))]);
        void cur;
      }
      setShuffle(true);
    } else {
      if (i >= 0 && o.length) {
        const cur = q[i];
        const idx = o.findIndex((t) => t.id === cur.id);
        setQueue(o);
        setIndex(idx >= 0 ? idx : 0);
      }
      setShuffle(false);
    }
  }, []);

  const cycleRepeat = useCallback(() => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")), []);
  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
    setMuted(false);
  }, []);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const patchTrack = useCallback((id: string, patch: Partial<TrackDTO>) => {
    setQueue((q) => q.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setOriginal((q) => q.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  /* ---------- eventos do <audio> ---------- */
  const onTime = () => {
    const a = audioRef.current!;
    setProgress(a.currentTime);
    const l = listened.current;
    const delta = a.currentTime - l.last;
    if (delta > 0 && delta < 1.5) l.sec += delta;
    l.last = a.currentTime;
    const cur = st.current.queue[st.current.index];
    const dur = a.duration || cur?.durationSec || 0;
    const threshold = Math.min(30, dur > 0 ? dur * 0.5 : 30);
    if (!l.recorded && cur && l.id === cur.id && l.sec >= Math.max(threshold, 10)) {
      l.recorded = true;
      recordPlay(cur.id, l.sec);
    }
  };

  const onEnded = () => {
    const { repeat: r } = st.current;
    const a = audioRef.current!;
    if (r === "one") {
      listened.current = { ...listened.current, sec: 0, last: 0, recorded: false };
      a.currentTime = 0;
      a.play().catch(() => {});
      return;
    }
    next();
  };

  const onError = () => {
    const cur = st.current.queue[st.current.index];
    if (!cur || !audioRef.current?.getAttribute("src")) return;
    setLoading(false);
    setPlaying(false);
    setError(`Não foi possível carregar "${cur.title}". A fonte de áudio falhou ou está indisponível.`);
    logPlayError(cur.id, `Falha ao carregar áudio (${cur.sourceType}): ${cur.audioUrl}`);
    failures.current++;
    if (failures.current < Math.min(3, st.current.queue.length) && st.current.index + 1 < st.current.queue.length) {
      setTimeout(() => next(), 1200);
    }
  };

  /* ---------- Media Session (reprodução em segundo plano/telas de bloqueio) ---------- */
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artistName,
      album: current.albumTitle ?? "",
      artwork: current.coverUrl ? [{ src: current.coverUrl, sizes: "512x512" }] : [],
    });
  }, [current]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => audioRef.current?.play().catch(() => {}));
    ms.setActionHandler("pause", () => audioRef.current?.pause());
    ms.setActionHandler("previoustrack", prev);
    ms.setActionHandler("nexttrack", next);
    ms.setActionHandler("seekto", (d) => d.seekTime != null && seek(d.seekTime));
    return () => {
      (["play", "pause", "previoustrack", "nexttrack", "seekto"] as const).forEach((k) => ms.setActionHandler(k, null));
    };
  }, [prev, next, seek]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  // atalhos de teclado
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.code === "Space" && current) {
        e.preventDefault();
        togglePlay();
      }
      if (e.code === "ArrowRight" && e.shiftKey) next();
      if (e.code === "ArrowLeft" && e.shiftKey) prev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [current, togglePlay, next, prev]);

  const value = useMemo<Ctx>(
    () => ({
      queue, index, current, playing, loading, error, progress, duration, volume, muted, shuffle, repeat, expanded, queueOpen,
      playTrack, playList, addToQueue, playNext, removeFromQueue, jumpTo, clearQueue, togglePlay, next, prev, seek, setVolume,
      toggleMute, toggleShuffle, cycleRepeat, setExpanded, setQueueOpen, patchTrack, dismissError: () => setError(null),
    }),
    [queue, index, current, playing, loading, error, progress, duration, volume, muted, shuffle, repeat, expanded, queueOpen, playTrack, playList, addToQueue, playNext, removeFromQueue, jumpTo, clearQueue, togglePlay, next, prev, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat, patchTrack],
  );

  return (
    <PlayerCtx.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        playsInline
        onTimeUpdate={onTime}
        onEnded={onEnded}
        onError={onError}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => {
          setLoading(false);
          failures.current = 0;
        }}
        onPlaying={() => {
          setLoading(false);
          setPlaying(true);
        }}
        onLoadedMetadata={() => {
          const a = audioRef.current!;
          if (Number.isFinite(a.duration)) {
            setDuration(a.duration);
            const cur = st.current.queue[st.current.index];
            if (cur && !cur.durationSec) reportDuration(cur.id, a.duration);
          }
        }}
      />
    </PlayerCtx.Provider>
  );
}

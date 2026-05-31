import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Position2D, Song } from '../data/audioDemo';

interface SpatialMetrics {
  distance: number;
  gain: number;
  pan: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const baseVolume = 0.52;
const ambientGainFactor = 0.5;
const ambientThreshold = 0.50;
const switchThreshold = 0.10;
const crossfadeDuration = 1.5;

// 真 3D / HRTF 相关
const PANNER_RADIUS = 1.2;     // 音源放在 listener 周围的固定半径（方向感由 HRTF 决定，音量由 gain 控制）
const POSITION_SMOOTH = 0.08;  // 位置平滑时间常数（秒），保证连续平滑转换

type AudioNodes = {
  context: AudioContext;
  gain: GainNode;
  panner: PannerNode;
  leftAnalyser: AnalyserNode;
  rightAnalyser: AnalyserNode;
  oscillator?: OscillatorNode;
  source?: AudioBufferSourceNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
};

export interface ActiveTrackDebug {
  songId: string;
  title: string;
  artist: string;
  color: string;
  role: 'main' | 'ambient' | 'fading';
  gainValue: number;
  panValue: number;
  leftRms: number;
  rightRms: number;
  leftPeak: number;
  rightPeak: number;
  sourceType: 'file' | 'synth';
}

function computeSpatialMetrics(song: Song | null, listener: Position2D): SpatialMetrics {
  if (!song) return { distance: 0, gain: 0, pan: 0 };
  const dx = song.position.x - listener.x;
  const dy = song.position.y - listener.y;
  const distance = Math.hypot(dx, dy);
  const innerRadius = 12;
  const outerRadius = 62;
  const falloff = distance <= innerRadius ? 1 : (outerRadius - distance) / (outerRadius - innerRadius);
  const gain = clamp(falloff, 0, 1) ** 2;
  const pan = clamp(dx / (outerRadius * 0.6), -1, 1);
  return { distance, gain, pan };
}

/**
 * 把 2D 地图方向映射到 listener 周围的 3D 单位方向：
 * X = 左右；Z = 前后（listener 默认朝 -Z，所以地图上方 = 前方）。
 * 音量交给 gain 节点，这里只负责"方位"，半径固定。
 */
function direction3D(song: Song | null, listener: Position2D) {
  if (!song) return { x: 0, y: 0, z: -PANNER_RADIUS };
  const dx = song.position.x - listener.x;
  const dy = song.position.y - listener.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: (dx / len) * PANNER_RADIUS,
    y: 0,
    z: (dy / len) * PANNER_RADIUS
  };
}

function setPannerPosition(
  panner: PannerNode,
  context: AudioContext,
  pos: { x: number; y: number; z: number },
  smooth = true
) {
  if (panner.positionX) {
    const t = context.currentTime;
    if (smooth) {
      panner.positionX.setTargetAtTime(pos.x, t, POSITION_SMOOTH);
      panner.positionY.setTargetAtTime(pos.y, t, POSITION_SMOOTH);
      panner.positionZ.setTargetAtTime(pos.z, t, POSITION_SMOOTH);
    } else {
      panner.positionX.value = pos.x;
      panner.positionY.value = pos.y;
      panner.positionZ.value = pos.z;
    }
  } else if ('setPosition' in panner) {
    // 老版本 Safari 回退
    (panner as { setPosition: (x: number, y: number, z: number) => void }).setPosition(pos.x, pos.y, pos.z);
  }
}

function setListenerOrientation(context: AudioContext | null | undefined, heading: number | null) {
  if (!context || heading === null) return;
  const radians = (heading * Math.PI) / 180;
  const forward = {
    x: Math.sin(radians),
    y: 0,
    z: -Math.cos(radians)
  };
  const listener = context.listener;

  if (listener.forwardX) {
    const t = context.currentTime;
    listener.forwardX.setTargetAtTime(forward.x, t, POSITION_SMOOTH);
    listener.forwardY.setTargetAtTime(forward.y, t, POSITION_SMOOTH);
    listener.forwardZ.setTargetAtTime(forward.z, t, POSITION_SMOOTH);
    listener.upX.setTargetAtTime(0, t, POSITION_SMOOTH);
    listener.upY.setTargetAtTime(1, t, POSITION_SMOOTH);
    listener.upZ.setTargetAtTime(0, t, POSITION_SMOOTH);
  } else if ('setOrientation' in listener) {
    (listener as { setOrientation: (x: number, y: number, z: number, xUp: number, yUp: number, zUp: number) => void })
      .setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
  }
}

function findClosestSong(songs: Song[], listener: Position2D, excludeId?: string): Song | null {
  let best: Song | null = null;
  let bestGain = -1;
  for (const song of songs) {
    if (excludeId && song.id === excludeId) continue;
    const m = computeSpatialMetrics(song, listener);
    if (m.gain > bestGain) { bestGain = m.gain; best = song; }
  }
  return best;
}

const audioBufferCache = new Map<string, AudioBuffer>();

function buildSpatialChain(context: AudioContext): {
  panner: PannerNode;
  splitter: ChannelSplitterNode;
  merger: ChannelMergerNode;
  leftAnalyser: AnalyserNode;
  rightAnalyser: AnalyserNode;
} {
  // 真 3D：HRTF 头相关传输函数，提供前后/左右/上下方位感
  const panner = context.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.maxDistance = 10000;
  panner.rolloffFactor = 0; // 距离不衰减——音量由 gain 节点统一控制，使 UI 增益% 与实际听感一致
  // listener 默认位于原点、朝向 -Z、头顶 +Y

  const splitter = context.createChannelSplitter(2);
  const merger = context.createChannelMerger(2);
  const leftAnalyser = context.createAnalyser();
  const rightAnalyser = context.createAnalyser();

  leftAnalyser.fftSize = 256;
  leftAnalyser.smoothingTimeConstant = 0.8;
  rightAnalyser.fftSize = 256;
  rightAnalyser.smoothingTimeConstant = 0.8;

  // panner(HRTF 立体声输出) → 分左右做电平表 → 合并 → 输出
  panner.connect(splitter);
  splitter.connect(leftAnalyser, 0);
  leftAnalyser.connect(merger, 0, 0);
  splitter.connect(rightAnalyser, 1);
  rightAnalyser.connect(merger, 0, 1);
  merger.connect(context.destination);

  return { panner, splitter, merger, leftAnalyser, rightAnalyser };
}

export function useSpatialAudio(songs: Song[], listener: Position2D, heading: number | null = null) {
  const [currentId, setCurrentId] = useState(songs[0]?.id ?? '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [ambientId, setAmbientId] = useState<string | null>(null);

  const audioRef = useRef<AudioNodes | null>(null);
  const ambientAudioRef = useRef<AudioNodes | null>(null);
  const dyingNodesRef = useRef<Set<{ nodes: AudioNodes; timer: number }>>(new Set());
  const listenerRef = useRef<Position2D>(listener);
  const headingRef = useRef<number | null>(heading);
  const songsRef = useRef<Song[]>(songs);
  const switchingRef = useRef(false);
  const generationRef = useRef(0);

  listenerRef.current = listener;
  headingRef.current = heading;
  songsRef.current = songs;

  const currentSong = useMemo(
    () => songs.find((song) => song.id === currentId) ?? songs[0] ?? null,
    [currentId, songs]
  );

  const ambientSong = useMemo(
    () => ambientId ? songs.find((song) => song.id === ambientId) ?? null : null,
    [ambientId, songs]
  );

  const metrics = useMemo(
    () => computeSpatialMetrics(currentSong, listener),
    [currentSong, listener]
  );

  const ambientMetrics = useMemo(
    () => computeSpatialMetrics(ambientSong, listener),
    [ambientSong, listener]
  );

  const killNodes = useCallback((nodes: AudioNodes) => {
    try { nodes.oscillator?.stop(); } catch {}
    try { nodes.source?.stop(); } catch {}
    try { nodes.lfo?.stop(); } catch {}
    void nodes.context.close();
  }, []);

  const scheduleDeath = useCallback((nodes: AudioNodes, fadeTime: number = 0.3) => {
    const now = nodes.context.currentTime;
    nodes.gain.gain.setTargetAtTime(0, now, fadeTime);
    const timer = window.setTimeout(() => {
      killNodes(nodes);
      dyingNodesRef.current.delete(entry);
    }, (fadeTime * 4) * 1000 + 300);
    const entry = { nodes, timer };
    dyingNodesRef.current.add(entry);
  }, [killNodes]);

  const killAllDying = useCallback(() => {
    for (const entry of dyingNodesRef.current) {
      clearTimeout(entry.timer);
      killNodes(entry.nodes);
    }
    dyingNodesRef.current.clear();
  }, [killNodes]);

  const killMain = useCallback(() => {
    if (audioRef.current) {
      scheduleDeath(audioRef.current, crossfadeDuration / 3);
      audioRef.current = null;
    }
  }, [scheduleDeath]);

  const killAmbient = useCallback(() => {
    if (ambientAudioRef.current) {
      scheduleDeath(ambientAudioRef.current, 0.3);
      ambientAudioRef.current = null;
      setAmbientId(null);
    }
  }, [scheduleDeath]);

  const createSynthSource = useCallback((context: AudioContext, song: Song, gain: GainNode) => {
    const oscillator = context.createOscillator();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();

    oscillator.type = song.waveform;
    oscillator.frequency.value = song.frequency;
    lfo.type = 'sine';
    lfo.frequency.value = 4.5;
    lfoGain.gain.value = 5;

    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);
    oscillator.connect(gain);
    oscillator.start();
    lfo.start();

    return { oscillator, lfo, lfoGain };
  }, []);

  const createFileSource = useCallback(async (context: AudioContext, song: Song, gain: GainNode) => {
    if (!song.audioUrl) return null;

    try {
      let buffer = audioBufferCache.get(song.audioUrl);
      if (!buffer) {
        const response = await fetch(song.audioUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        buffer = await context.decodeAudioData(arrayBuffer);
        audioBufferCache.set(song.audioUrl, buffer);
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start();
      return { source, duration: Math.round(buffer.duration) };
    } catch (error) {
      console.warn(`[spatial-audio] Cannot play ${song.audioUrl}; using synth fallback.`, error);
      return null;
    }
  }, []);

  const buildAudioNodes = useCallback(async (song: Song, initialGain: number): Promise<AudioNodes | null> => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    const gen = ++generationRef.current;

    const context = new AudioContextClass();
    const gain = context.createGain();
    const { panner, leftAnalyser, rightAnalyser } = buildSpatialChain(context);
    setListenerOrientation(context, headingRef.current);

    gain.gain.value = initialGain;
    gain.connect(panner);

    // 初始方位（不平滑，直接落位）
    setPannerPosition(panner, context, direction3D(song, listenerRef.current), false);

    const fileNode = await createFileSource(context, song, gain);
    if (gen !== generationRef.current) {
      try { fileNode?.source.stop(); } catch {}
      void context.close();
      return null;
    }

    const synthNodes = fileNode ? null : createSynthSource(context, song, gain);

    return {
      context,
      gain,
      panner,
      leftAnalyser,
      rightAnalyser,
      ...(fileNode ? { source: fileNode.source } : synthNodes)
    };
  }, [createFileSource, createSynthSource]);

  const startSong = useCallback(async (song: Song, fadeIn: boolean = false) => {
    killMain();
    killAmbient();
    killAllDying();
    switchingRef.current = false;

    const songMetrics = computeSpatialMetrics(song, listenerRef.current);
    const initialGain = fadeIn ? 0 : songMetrics.gain * baseVolume;
    const nodes = await buildAudioNodes(song, initialGain);
    if (!nodes) return;

    if (fadeIn) {
      nodes.gain.gain.setTargetAtTime(songMetrics.gain * baseVolume, nodes.context.currentTime, crossfadeDuration / 3);
    }

    audioRef.current = nodes;
    setCurrentId(song.id);
    setCurrentTime(0);
    setIsPlaying(true);
  }, [buildAudioNodes, killMain, killAmbient, killAllDying]);

  const startAmbient = useCallback(async (song: Song) => {
    if (ambientId === song.id && ambientAudioRef.current) return;

    killAmbient();

    const songMetrics = computeSpatialMetrics(song, listenerRef.current);
    const nodes = await buildAudioNodes(song, 0);
    if (!nodes) return;

    nodes.gain.gain.value = 0;
    nodes.gain.gain.setTargetAtTime(
      songMetrics.gain * ambientGainFactor * baseVolume,
      nodes.context.currentTime,
      0.4
    );

    ambientAudioRef.current = nodes;
    setAmbientId(song.id);
  }, [ambientId, buildAudioNodes, killAmbient]);

  const crossfadeTo = useCallback(async (targetSong: Song) => {
    const oldMain = audioRef.current;
    killAmbient();

    if (!oldMain) {
      await startSong(targetSong, true);
      return;
    }

    const songMetrics = computeSpatialMetrics(targetSong, listenerRef.current);
    const nodes = await buildAudioNodes(targetSong, 0);
    if (!nodes) return;

    nodes.gain.gain.setTargetAtTime(songMetrics.gain * baseVolume, nodes.context.currentTime, crossfadeDuration / 3);

    scheduleDeath(oldMain, crossfadeDuration / 3);
    audioRef.current = nodes;

    setCurrentId(targetSong.id);
    setCurrentTime(0);
    setIsPlaying(true);
  }, [buildAudioNodes, startSong, killAmbient, scheduleDeath]);

  const pause = useCallback(() => {
    if (audioRef.current) { killNodes(audioRef.current); audioRef.current = null; }
    if (ambientAudioRef.current) { killNodes(ambientAudioRef.current); ambientAudioRef.current = null; }
    killAllDying();
    setAmbientId(null);
    setIsPlaying(false);
  }, [killNodes, killAllDying]);

  const toggle = useCallback(() => {
    if (!currentSong) return;
    if (isPlaying) { pause(); } else { void startSong(currentSong); }
  }, [currentSong, isPlaying, pause, startSong]);

  const playById = useCallback((id: string) => {
    const next = songs.find((song) => song.id === id);
    if (next) void startSong(next);
  }, [songs, startSong]);

  const skip = useCallback((step: number) => {
    if (!songs.length) return;
    const index = Math.max(0, songs.findIndex((song) => song.id === currentId));
    const next = songs[(index + step + songs.length) % songs.length];
    void startSong(next);
  }, [currentId, songs, startSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    const now = audio.context.currentTime;
    audio.gain.gain.setTargetAtTime(metrics.gain * baseVolume, now, 0.08);
    // 平滑移动 3D 方位（HRTF），实现连续平滑转换
    setPannerPosition(audio.panner, audio.context, direction3D(currentSong, listenerRef.current), true);
    audio.oscillator?.frequency.setTargetAtTime(currentSong.frequency, now, 0.08);
  }, [currentSong, metrics.gain, metrics.pan]);

  useEffect(() => {
    setListenerOrientation(audioRef.current?.context, heading);
    setListenerOrientation(ambientAudioRef.current?.context, heading);
    for (const entry of dyingNodesRef.current) {
      setListenerOrientation(entry.nodes.context, heading);
    }
  }, [heading]);

  useEffect(() => {
    const ambient = ambientAudioRef.current;
    if (!ambient || !ambientSong) return;
    const now = ambient.context.currentTime;
    ambient.gain.gain.setTargetAtTime(
      ambientMetrics.gain * ambientGainFactor * baseVolume,
      now,
      0.08
    );
    setPannerPosition(ambient.panner, ambient.context, direction3D(ambientSong, listenerRef.current), true);
  }, [ambientSong, ambientMetrics.gain, ambientMetrics.pan]);

  useEffect(() => {
    if (!isPlaying || !currentSong) return;

    if (metrics.gain < switchThreshold) {
      const closest = findClosestSong(songsRef.current, listenerRef.current, currentSong.id);
      if (closest && !switchingRef.current) {
        switchingRef.current = true;
        void crossfadeTo(closest);
      }
      return;
    }

    switchingRef.current = false;

    if (metrics.gain < ambientThreshold) {
      const closest = findClosestSong(songsRef.current, listenerRef.current, currentSong.id);
      if (closest && closest.id !== ambientId) {
        void startAmbient(closest);
      }
    } else {
      if (ambientId) { killAmbient(); }
    }
  }, [currentSong, isPlaying, metrics.gain, ambientId, crossfadeTo, startAmbient, killAmbient]);

  useEffect(() => {
    if (!songs.length) { pause(); setCurrentId(''); return; }
    if (!songs.some((song) => song.id === currentId)) { setCurrentId(songs[0].id); setCurrentTime(0); }
  }, [currentId, pause, songs]);

  useEffect(() => {
    if (!isPlaying || !currentSong) return undefined;
    const timer = window.setInterval(() => {
      setCurrentTime((value) => {
        if (value + 1 >= currentSong.duration) { skip(1); return 0; }
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentSong, isPlaying, skip]);

  useEffect(() => {
    return () => {
      if (audioRef.current) { killNodes(audioRef.current); }
      if (ambientAudioRef.current) { killNodes(ambientAudioRef.current); }
      killAllDying();
    };
  }, [killNodes, killAllDying]);

  const getDebugInfo = useCallback((): ActiveTrackDebug[] => {
    const tracks: ActiveTrackDebug[] = [];

    const extractTrack = (
      nodes: AudioNodes | null,
      role: 'main' | 'ambient' | 'fading'
    ) => {
      if (!nodes) return;

      const leftData = new Float32Array(nodes.leftAnalyser.frequencyBinCount);
      const rightData = new Float32Array(nodes.rightAnalyser.frequencyBinCount);
      nodes.leftAnalyser.getFloatTimeDomainData(leftData);
      nodes.rightAnalyser.getFloatTimeDomainData(rightData);

      let leftRms = 0, rightRms = 0, leftPeak = 0, rightPeak = 0;
      for (let i = 0; i < leftData.length; i++) {
        leftRms += leftData[i] * leftData[i];
        rightRms += rightData[i] * rightData[i];
        const al = Math.abs(leftData[i]);
        const ar = Math.abs(rightData[i]);
        if (al > leftPeak) leftPeak = al;
        if (ar > rightPeak) rightPeak = ar;
      }
      leftRms = Math.sqrt(leftRms / leftData.length);
      rightRms = Math.sqrt(rightRms / rightData.length);

      let matchedSong: Song | undefined;
      if (role === 'main') {
        matchedSong = songsRef.current.find((s) => s.id === currentId);
      } else if (role === 'ambient') {
        matchedSong = songsRef.current.find((s) => s.id === ambientId);
      }
      if (!matchedSong) return;

      tracks.push({
        songId: matchedSong.id,
        title: matchedSong.title,
        artist: matchedSong.artist,
        color: matchedSong.color,
        role,
        gainValue: nodes.gain.gain.value,
        // PannerNode 无 .pan，用 X 方位（-radius..radius）归一化为 -1..1 给调试面板
        panValue: nodes.panner.positionX ? clamp(nodes.panner.positionX.value / PANNER_RADIUS, -1, 1) : 0,
        leftRms,
        rightRms,
        leftPeak,
        rightPeak,
        sourceType: nodes.source ? 'file' : 'synth'
      });
    };

    extractTrack(audioRef.current, 'main');
    extractTrack(ambientAudioRef.current, 'ambient');

    for (const entry of dyingNodesRef.current) {
      try {
        extractTrack(entry.nodes, 'fading');
      } catch {}
    }

    return tracks;
  }, [currentId, ambientId]);

  return {
    currentSong,
    currentId,
    isPlaying,
    currentTime,
    metrics,
    playById,
    toggle,
    pause,
    skip,
    getDebugInfo
  };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

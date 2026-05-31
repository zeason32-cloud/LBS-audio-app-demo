import { useCallback, useEffect, useRef, useState } from 'react';
import MapView from './components/MapView';
import PlayerView from './components/PlayerView';
import ExploreView from './components/ExploreView';
import ProfileView from './components/ProfileView';
import BottomNav from './components/BottomNav';
import DebugView from './components/DebugView';
import { demoSongs, type Position2D, type Song } from './data/audioDemo';
import { useSpatialAudio } from './hooks/useSpatialAudio';

type Tab = 'explore' | 'map' | 'profile';
type ViewMode = 'explore' | 'map' | 'player' | 'profile';
type CatalogStatus = 'loading' | 'backend' | 'demo' | 'error';
type CompassStatus = 'idle' | 'active' | 'denied' | 'unsupported';

function normalizeBackendSong(song: Song): Song {
  return {
    ...song,
    duration: Number.isFinite(song.duration) && song.duration > 0 ? song.duration : 240,
    frequency: song.frequency || 220,
    waveform: song.waveform || 'sine',
    position: song.position || { x: 50, y: 50 },
    color: song.color || '#F59E0B',
    note: song.note || '后端加载的校园音源'
  };
}

function normalizeHeading(value: number) {
  return ((value % 360) + 360) % 360;
}

function headingFromEvent(event: DeviceOrientationEvent) {
  if (typeof event.webkitCompassHeading === 'number') {
    return normalizeHeading(event.webkitCompassHeading);
  }
  if (typeof event.alpha === 'number') {
    return normalizeHeading(360 - event.alpha);
  }
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('explore');
  const [viewMode, setViewMode] = useState<ViewMode>('explore');
  const [previousView, setPreviousView] = useState<ViewMode>('explore');
  const [listener, setListener] = useState<Position2D>({ x: 50, y: 50 });
  const [gpsMode, setGpsMode] = useState<'simulated' | 'device'>('simulated');
  const [gpsStatus, setGpsStatus] = useState('模拟定位');
  const [heading, setHeading] = useState<number | null>(null);
  const [compassStatus, setCompassStatus] = useState<CompassStatus>('idle');
  const [songs, setSongs] = useState<Song[]>(demoSongs);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('loading');
  const [debugVisible, setDebugVisible] = useState(false);
  const [mapOnly, setMapOnly] = useState(false);
  const compassHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);
  const audio = useSpatialAudio(songs, listener, heading);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'z' || e.key === 'Z') {
        setDebugVisible((v) => !v);
      }
      if (e.key === 'm' || e.key === 'M') {
        setMapOnly((v) => {
          if (!v) setViewMode('map');
          return !v;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAudioSources() {
      if (import.meta.env.PROD) {
        setSongs(demoSongs);
        setCatalogStatus('demo');
        return;
      }

      try {
        const response = await fetch('/api/audio-sources', { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const backendSongs = Array.isArray(payload.sources)
          ? payload.sources.map(normalizeBackendSong)
          : [];

        if (backendSongs.length > 0) {
          setSongs(backendSongs);
          setCatalogStatus('backend');
        } else {
          setSongs(demoSongs);
          setCatalogStatus('demo');
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn('[audio-catalog] Cannot load backend sources; using demo songs.', error);
        setSongs(demoSongs);
        setCatalogStatus('error');
      }
    }

    void loadAudioSources();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (gpsMode !== 'simulated') return undefined;
    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      setListener({
        x: 50 + Math.sin(frame / 36) * 22 + Math.sin(frame / 17) * 6,
        y: 52 + Math.cos(frame / 42) * 18 + Math.sin(frame / 23) * 5
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [gpsMode]);

  const requestDeviceGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('浏览器不支持 GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setGpsMode('device');
        setGpsStatus(`真实 GPS · ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        setListener({
          x: ((lng + 180) / 360) * 100,
          y: ((90 - lat) / 180) * 100
        });
      },
      () => {
        setGpsStatus('GPS 授权失败，继续模拟');
        setGpsMode('simulated');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const requestCompass = useCallback(async () => {
    const OrientationEvent = window.DeviceOrientationEvent;
    if (!OrientationEvent) {
      setCompassStatus('unsupported');
      return;
    }

    try {
      if (typeof OrientationEvent.requestPermission === 'function') {
        const permission = await OrientationEvent.requestPermission();
        if (permission !== 'granted') {
          setCompassStatus('denied');
          return;
        }
      }

      if (compassHandlerRef.current) {
        setCompassStatus('active');
        return;
      }

      const handleOrientation = (event: DeviceOrientationEvent) => {
        const nextHeading = headingFromEvent(event);
        if (nextHeading !== null) {
          setHeading(nextHeading);
          setCompassStatus('active');
        }
      };

      compassHandlerRef.current = handleOrientation;
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
      setCompassStatus('active');
    } catch (error) {
      console.warn('[compass] Cannot enable device orientation.', error);
      setCompassStatus('denied');
    }
  }, []);

  const requestDeviceSensors = useCallback(() => {
    requestDeviceGps();
    void requestCompass();
  }, [requestCompass, requestDeviceGps]);

  useEffect(() => {
    return () => {
      if (!compassHandlerRef.current) return;
      window.removeEventListener('deviceorientationabsolute', compassHandlerRef.current, true);
      window.removeEventListener('deviceorientation', compassHandlerRef.current, true);
    };
  }, []);

  const handleSongSelect = (song: Song) => {
    audio.playById(song.id);
    setPreviousView(viewMode);
    setViewMode('player');
  };

  const handleNavigateToMap = () => {
    setViewMode('map');
    setActiveTab('map');
  };

  const handleBackFromMap = () => {
    setViewMode('explore');
    setActiveTab('explore');
  };

  const handleClosePlayer = () => {
    setViewMode(previousView);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setViewMode(tab as ViewMode);
  };

  return (
    <div className="h-full w-screen max-w-full overflow-hidden relative">
      {/* Main Content */}
      <div className="h-full">
        {viewMode === 'player' && audio.currentSong ? (
          <PlayerView
            song={audio.currentSong}
            songs={songs}
            isPlaying={audio.isPlaying}
            currentTime={audio.currentTime}
            spatialMetrics={audio.metrics}
            onClose={handleClosePlayer}
            onTogglePlay={audio.toggle}
            onSkip={audio.skip}
            onSelectSong={audio.playById}
          />
        ) : viewMode === 'map' ? (
          <MapView
            songs={songs}
            listener={listener}
            currentSongId={audio.currentId}
            isPlaying={audio.isPlaying}
            spatialMetrics={audio.metrics}
            gpsMode={gpsMode}
            gpsStatus={gpsStatus}
            heading={heading}
            compassStatus={compassStatus}
            minimal={mapOnly}
            onBack={mapOnly ? () => setMapOnly(false) : handleBackFromMap}
            onSongSelect={handleSongSelect}
            onMoveListener={(position) => {
              setGpsMode('device');
              setGpsStatus('手动模拟位置');
              setListener(position);
            }}
            onUseDeviceGps={requestDeviceSensors}
            onUseSimulatedGps={() => {
              setGpsMode('simulated');
              setGpsStatus('模拟定位巡航');
            }}
          />
        ) : viewMode === 'profile' ? (
          <ProfileView />
        ) : (
          <ExploreView
            songs={songs}
            catalogStatus={catalogStatus}
            currentSongId={audio.currentId}
            isPlaying={audio.isPlaying}
            onSongSelect={handleSongSelect}
            onNavigateToMap={handleNavigateToMap}
            onTogglePlay={audio.toggle}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      {viewMode !== 'player' && !mapOnly && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* Debug Overlay */}
      {debugVisible && (
        <DebugView
          getDebugInfo={audio.getDebugInfo}
          onClose={() => setDebugVisible(false)}
        />
      )}
    </div>
  );
}

declare global {
  interface DeviceOrientationEvent {
    webkitCompassHeading?: number;
  }

  interface DeviceOrientationEventConstructor {
    requestPermission?: () => Promise<PermissionState>;
  }
}

export interface Position2D {
  x: number;
  y: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface GeoOffsetMeters {
  east: number;
  north: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  location: string;
  distance: string;
  messages: number;
  color: string;
  position: Position2D;
  duration: number;
  frequency: number;
  waveform: 'sine' | 'triangle' | 'sawtooth';
  note: string;
  audioUrl?: string;
  geoOffset?: GeoOffsetMeters;
  source?: 'demo' | 'backend';
}

const musicUrl = (filename: string) => `${import.meta.env.BASE_URL}music/${encodeURIComponent(filename)}`;

export const demoSongs: Song[] = [
  {
    id: '1',
    title: 'E大调前奏曲',
    artist: '巴赫',
    location: '图书馆 · 中庭',
    distance: '0.3km',
    messages: 45,
    color: '#F59E0B',
    position: { x: 30, y: 40 },
    duration: 234,
    frequency: 196,
    waveform: 'sine',
    note: '巴赫的优雅前奏曲，适合安静的阅读空间。',
    audioUrl: musicUrl('群星-巴赫 - E大调前奏曲.mp3'),
    geoOffset: { east: -90, north: 120 },
    source: 'demo'
  },
  {
    id: '2',
    title: '爱之梦',
    artist: '李斯特',
    location: '湖畔 · 长廊',
    distance: '1.2km',
    messages: 28,
    color: '#FB923C',
    position: { x: 50, y: 60 },
    duration: 216,
    frequency: 247,
    waveform: 'triangle',
    note: '李斯特的浪漫梦境，湖畔漫步时最为动人。',
    audioUrl: musicUrl('群星-李斯特 - 爱之梦.mp3'),
    geoOffset: { east: 70, north: -80 },
    source: 'demo'
  },
  {
    id: '3',
    title: '蓝色多瑙河',
    artist: '约翰·施特劳斯',
    location: '操场 · 看台',
    distance: '2.1km',
    messages: 67,
    color: '#D4AF37',
    position: { x: 70, y: 30 },
    duration: 252,
    frequency: 220,
    waveform: 'sawtooth',
    note: '华尔兹的旋转旋律，开阔空间中感受圆舞曲的律动。',
    audioUrl: musicUrl('群星-约翰史特劳斯 - 蓝色多瑙河.mp3'),
    geoOffset: { east: 180, north: 90 },
    source: 'demo'
  },
  {
    id: '4',
    title: '悲怆奏鸣曲',
    artist: '贝多芬',
    location: '教学楼 · 天台',
    distance: '1.6km',
    messages: 34,
    color: '#10B981',
    position: { x: 42, y: 74 },
    duration: 228,
    frequency: 165,
    waveform: 'triangle',
    note: '贝多芬的深情独白，高处远望时最动人心弦。',
    audioUrl: musicUrl('群星-贝多芬 - 悲怆奏鸣曲.mp3'),
    geoOffset: { east: -40, north: -170 },
    source: 'demo'
  }
];

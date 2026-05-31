import { Compass, Map, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'explore' | 'map' | 'profile';
  onTabChange: (tab: 'explore' | 'map' | 'profile') => void;
}

const tabs = [
  { id: 'explore' as const, icon: Compass, label: '探索' },
  { id: 'map' as const, icon: Map, label: '地图' },
  { id: 'profile' as const, icon: User, label: '我的' }
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-safe">
      <div className="mx-auto w-[calc(100vw-32px)] max-w-[430px] mb-4 pointer-events-auto">
        <nav className="surface-3 r-sheet p-1.5 grid grid-cols-3 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                aria-current={active ? 'page' : undefined}
                className="pressable relative flex flex-col items-center justify-center gap-1 r-card py-2"
              >
                <span
                  className="flex items-center justify-center w-10 h-7 r-pill transition-colors duration-200"
                  style={{
                    background: active ? 'color-mix(in srgb, var(--location-500) 16%, transparent)' : 'transparent'
                  }}
                >
                  <Icon
                    className="w-5 h-5 transition-colors"
                    style={{ color: active ? 'var(--location-500)' : 'var(--text-2)' }}
                    strokeWidth={active ? 2.4 : 2}
                  />
                </span>
                <span
                  className="text-[11px] transition-colors"
                  style={{
                    color: active ? 'var(--text-1)' : 'var(--text-3)',
                    fontWeight: active ? 600 : 500
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

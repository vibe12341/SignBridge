import { BridgeConnectionStatus } from '../hooks/useBridgeSession';
import { WorkspaceTab } from '../types/bridge';
import SwitchButton from './SwitchButton';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  connectionStatus: BridgeConnectionStatus;
  onToggleBridge: () => void;
  turnCount: number;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'bridge', label: 'Live Bridge' },
  { id: 'phrases', label: 'Phraseboard' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'preferences', label: 'Preferences' },
];

export function TopBar({
  activeTab,
  onSelectTab,
  connectionStatus,
  onToggleBridge,
  turnCount,
  theme,
  onThemeChange,
}: TopBarProps) {
  const isLiveOrConnecting =
    connectionStatus === 'live' || connectionStatus === 'connecting';

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-6 lg:gap-8 lg:px-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('bridge');
          }}
          className="font-display text-lg font-bold tracking-tight text-stone-950 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 dark:text-white dark:focus-visible:outline-amber-300"
        >
          SignBridge
        </a>

        {/* Zone 2: 4 concise single-line navigation tabs */}
        <nav
          aria-label="Primary sections"
          className="hidden md:flex items-center gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const label =
              item.id === 'transcript' && turnCount > 0
                ? `${item.label} (${turnCount})`
                : item.label;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 dark:focus-visible:outline-amber-300 ${
                  isActive
                    ? 'text-blue-700 dark:text-amber-300'
                    : 'text-stone-600 hover:text-stone-950 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-3 h-0.5 bg-blue-700 dark:bg-amber-300"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme mode switch + primary action button */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <SwitchButton
            theme={theme}
            onThemeChange={onThemeChange}
            size="default"
            showLabel
          />
          <button
            type="button"
            onClick={onToggleBridge}
            disabled={connectionStatus === 'connecting'}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-amber-300 disabled:opacity-60 ${
              isLiveOrConnecting
                ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                : 'bg-blue-700 text-white hover:bg-blue-800 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200'
            }`}
          >
            {connectionStatus === 'connecting'
              ? 'Connecting...'
              : connectionStatus === 'live'
                ? 'End Live Bridge'
                : 'Start Live Bridge'}
          </button>
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Mobile sections"
        className="flex md:hidden items-center justify-between gap-2 border-t border-stone-200 px-4 py-2 overflow-x-auto dark:border-slate-800"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-amber-300'
                  : 'text-stone-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

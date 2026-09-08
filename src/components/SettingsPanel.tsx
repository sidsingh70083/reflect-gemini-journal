import React, { useEffect } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Volume1,
  Check,
  Bell,
  MapPin,
  MapPinOff,
} from 'lucide-react';
import {
  UserSettings,
  AmbientTexture,
  AMBIENT_TEXTURE_OPTIONS,
  UserProfile,
  CustomAvatarType,
} from '../types';
import { ambientSound } from '../lib/ambientSound';
import { UserAvatar, AVATAR_OPTIONS } from './UserAvatar';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  user?: UserProfile | null;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  user,
  onUpdateSettings,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle Theme Toggle
  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    onUpdateSettings({ theme: newTheme });
  };

  // Handle Avatar Selection
  const handleAvatarChange = (avatar: CustomAvatarType) => {
    onUpdateSettings({ customAvatar: avatar });
  };

  // Handle Ambient Sound Enabled Toggle
  const handleAmbientToggle = () => {
    const nextEnabled = !settings.ambientSoundEnabled;
    ambientSound.setEnabled(nextEnabled);
    onUpdateSettings({ ambientSoundEnabled: nextEnabled });
  };

  // Handle Interaction Sounds Toggle (Item 7)
  const handleInteractionSoundsToggle = () => {
    const nextEnabled = !settings.interactionSoundsEnabled;
    ambientSound.setInteractionSoundsEnabled(nextEnabled);
    onUpdateSettings({ interactionSoundsEnabled: nextEnabled });
  };

  // Handle Volume Change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVol = parseFloat(e.target.value);
    ambientSound.setVolume(nextVol);
    onUpdateSettings({ ambientSoundVolume: nextVol });
  };

  // Handle Sound Texture Change
  const handleTextureChange = (newTexture: AmbientTexture) => {
    ambientSound.setTexture(newTexture);
    onUpdateSettings({ ambientSoundTexture: newTexture });
  };

  // Handle Daily Check-ins Toggle
  const handleDailyCheckinsToggle = () => {
    const nextValue = !settings.dailyCheckinsEnabled;
    onUpdateSettings({ dailyCheckinsEnabled: nextValue });
  };

  // Handle Location Context Toggle (Item 4)
  const handleLocationToggle = () => {
    const nextValue = !settings.locationEnabled;
    try {
      localStorage.setItem('mindful_journal_location_enabled', String(nextValue));
    } catch {
      // Ignore
    }
    onUpdateSettings({ locationEnabled: nextValue });
  };

  return (
    <div
      id="settings-drawer-overlay"
      className={`fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
      aria-hidden={!isOpen}
    >
      {/* Drawer Container */}
      <aside
        id="settings-drawer-panel"
        className={`w-full sm:w-[460px] h-full bg-[#FAF9F5] dark:bg-[#1E1D18] border-l border-[#E6E4DD] dark:border-[#2E2C26] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } text-[#3A3A35] dark:text-[#EDEAE2]`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings panel"
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-[#E6E4DD] dark:border-[#2E2C26] flex items-center justify-between bg-[#F4F1E8] dark:bg-[#191814]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#EAE8E0] dark:bg-[#2A2823] flex items-center justify-center text-[#5A5A40] dark:text-[#D4D0C2]">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-[#3A3A35] dark:text-[#EDEAE2] leading-tight">
                Settings
              </h3>
              <p className="text-[11px] text-[#858376] dark:text-[#8E8C7F]">
                Preferences saved to your account
              </p>
            </div>
          </div>

          <button
            id="close-settings-drawer-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#858376] hover:text-[#3A3A35] dark:text-[#A6A498] dark:hover:text-[#EDEAE2] hover:bg-[#EAE8E0] dark:hover:bg-[#2A2823] transition-colors cursor-pointer"
            title="Close settings"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body / Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-7 font-sans">
          {/* SECTION 1: IDENTITY & AVATAR (Item 9) */}
          <section id="settings-section-avatar" className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#858376] dark:text-[#8E8C7F]">
              Profile Avatar
            </h4>

            <div className="p-4 rounded-xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#24231E] space-y-3">
              <div className="flex items-center gap-3">
                <UserAvatar user={user || null} customAvatar={settings.customAvatar} size="lg" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                    {AVATAR_OPTIONS.find((opt) => opt.id === settings.customAvatar)?.label || 'Avatar'}
                  </p>
                  <p className="text-xs text-[#757469] dark:text-[#A6A498]">
                    {AVATAR_OPTIONS.find((opt) => opt.id === settings.customAvatar)?.description ||
                      'Displayed on header and profile'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-[#EAE8E0] dark:border-[#2E2C26]">
                {AVATAR_OPTIONS.map((opt) => {
                  const isSelected = settings.customAvatar === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleAvatarChange(opt.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#5A5A40] dark:border-[#D4D0C2] bg-[#F4F1E8] dark:bg-[#2A2823] shadow-xs'
                          : 'border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FAF9F5] dark:bg-[#1E1D18] hover:border-[#D5D2C7] dark:hover:border-[#3E3C34]'
                      }`}
                    >
                      <UserAvatar user={user || null} customAvatar={opt.id} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[#3A3A35] dark:text-[#EDEAE2] leading-tight">
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-[#858376] dark:text-[#8E8C7F] line-clamp-1 sm:hidden">
                          {opt.description}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 2: APPEARANCE */}
          <section id="settings-section-appearance" className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#858376] dark:text-[#8E8C7F]">
              Appearance
            </h4>

            <div className="p-4 rounded-xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#24231E] flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                  Color theme
                </p>
                <p className="text-xs text-[#757469] dark:text-[#A6A498] mt-0.5">
                  Calm warm light or nighttime dark mode
                </p>
              </div>

              <div className="flex items-center p-1 rounded-lg bg-[#F4F1E8] dark:bg-[#1A1916] border border-[#E6E4DD] dark:border-[#2E2C26]">
                <button
                  id="settings-theme-light-btn"
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    settings.theme === 'light'
                      ? 'bg-[#FFFFFF] text-[#3A3A35] shadow-xs font-semibold'
                      : 'text-[#757469] hover:text-[#3A3A35]'
                  }`}
                  title="Switch to Light theme"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Light</span>
                </button>

                <button
                  id="settings-theme-dark-btn"
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    settings.theme === 'dark'
                      ? 'bg-[#2E2C26] text-[#EDEAE2] shadow-xs font-semibold'
                      : 'text-[#A6A498] hover:text-[#EDEAE2]'
                  }`}
                  title="Switch to Dark theme"
                >
                  <Moon className="w-3.5 h-3.5 text-amber-300" />
                  <span>Dark</span>
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 3: ATMOSPHERE & AUDIO (Items 7 & 8) */}
          <section id="settings-section-atmosphere" className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#858376] dark:text-[#8E8C7F]">
              Atmosphere & Audio
            </h4>

            <div className="rounded-xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#24231E] overflow-hidden divide-y divide-[#E6E4DD] dark:divide-[#2E2C26]">
              {/* Continuous Ambient Sound On / Off Toggle */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                      Continuous ambient sound
                    </p>
                    {settings.ambientSoundEnabled ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EAE8E0] text-[#757469] dark:bg-[#2A2823] dark:text-[#8E8C7F]">
                        Muted
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#757469] dark:text-[#A6A498]">
                    Soothing generative sound bed while reflecting
                  </p>
                </div>

                <button
                  id="settings-ambient-toggle-btn"
                  type="button"
                  onClick={handleAmbientToggle}
                  role="switch"
                  aria-checked={settings.ambientSoundEnabled}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.ambientSoundEnabled
                      ? 'bg-[#5A5A40] dark:bg-[#D4D0C2]'
                      : 'bg-[#D5D2C7] dark:bg-[#3E3C34]'
                  }`}
                  title={settings.ambientSoundEnabled ? 'Disable ambient sound' : 'Enable ambient sound'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#1A1916] shadow-sm ring-0 transition duration-200 ease-in-out ${
                      settings.ambientSoundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Volume Slider with Logarithmic Perception Scaling (Item 8) */}
              <div
                className={`p-4 space-y-2.5 transition-opacity ${
                  settings.ambientSoundEnabled ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#3A3A35] dark:text-[#EDEAE2] flex items-center gap-1.5">
                    {settings.ambientSoundEnabled && settings.ambientSoundVolume > 0.05 ? (
                      settings.ambientSoundVolume > 0.5 ? (
                        <Volume2 className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2]" />
                      ) : (
                        <Volume1 className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2]" />
                      )
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-[#858376]" />
                    )}
                    <span>Ambient volume</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#757469] dark:text-[#A6A498]">
                    {Math.round(settings.ambientSoundVolume * 100)}%
                  </span>
                </div>

                <div
                  className="py-1"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <input
                    id="settings-ambient-volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={settings.ambientSoundVolume}
                    onChange={handleVolumeChange}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    disabled={!settings.ambientSoundEnabled}
                    aria-label="Ambient sound volume slider"
                    className="w-full h-2 bg-[#E6E4DD] dark:bg-[#3E3C34] rounded-lg appearance-none cursor-pointer accent-[#5A5A40] dark:accent-[#D4D0C2] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Sound Texture Options */}
              <div className="p-4 space-y-2.5">
                <p className="text-xs font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                  Sound texture
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {AMBIENT_TEXTURE_OPTIONS.map((opt) => {
                    const isSelected = settings.ambientSoundTexture === opt.id;
                    return (
                      <button
                        key={opt.id}
                        id={`settings-texture-${opt.id}`}
                        type="button"
                        onClick={() => handleTextureChange(opt.id)}
                        disabled={!settings.ambientSoundEnabled}
                        className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-[#5A5A40] dark:border-[#D4D0C2] bg-[#F4F1E8] dark:bg-[#2A2823] shadow-xs'
                            : 'border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FAF9F5] dark:bg-[#1E1D18] hover:border-[#D5D2C7] dark:hover:border-[#3E3C34]'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div className="space-y-0.5 pr-2">
                          <p className="text-xs font-semibold text-[#3A3A35] dark:text-[#EDEAE2]">
                            {opt.name}
                          </p>
                          <p className="text-[11px] text-[#757469] dark:text-[#A6A498] leading-tight">
                            {opt.description}
                          </p>
                        </div>

                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-[#5A5A40] bg-[#5A5A40] text-white dark:border-[#D4D0C2] dark:bg-[#D4D0C2] dark:text-[#1A1916]'
                              : 'border-[#D5D2C7] dark:border-[#3E3C34]'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Independent Activity Completion / Interaction Sounds Toggle (Item 7) */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                      Activity completion sounds
                    </p>
                    {settings.interactionSoundsEnabled ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EAE8E0] text-[#757469] dark:bg-[#2A2823] dark:text-[#8E8C7F]">
                        Silent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#757469] dark:text-[#A6A498] leading-normal">
                    Gentle resolving chimes when completing Stillness activities (Untangle & Constellation), independent of ambient sound.
                  </p>
                </div>

                <button
                  id="settings-interaction-sounds-toggle"
                  type="button"
                  onClick={handleInteractionSoundsToggle}
                  role="switch"
                  aria-checked={settings.interactionSoundsEnabled}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.interactionSoundsEnabled
                      ? 'bg-[#5A5A40] dark:bg-[#D4D0C2]'
                      : 'bg-[#D5D2C7] dark:bg-[#3E3C34]'
                  }`}
                  title={settings.interactionSoundsEnabled ? 'Mute activity sounds' : 'Enable activity sounds'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#1A1916] shadow-sm ring-0 transition duration-200 ease-in-out ${
                      settings.interactionSoundsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 4: PRIVACY & REFLECTION (Items 4 & 7) */}
          <section id="settings-section-reflection" className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#858376] dark:text-[#8E8C7F]">
              Privacy & Reflection
            </h4>

            <div className="rounded-xl border border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FFFFFF] dark:bg-[#24231E] overflow-hidden divide-y divide-[#E6E4DD] dark:divide-[#2E2C26]">
              {/* Daily Check-ins Toggle */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                      Daily check-ins
                    </p>
                    {settings.dailyCheckinsEnabled ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EAE8E0] text-[#757469] dark:bg-[#2A2823] dark:text-[#8E8C7F]">
                        Off
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#757469] dark:text-[#A6A498] leading-normal">
                    After a session, Gemini suggests one small intention for tomorrow and asks how it went.
                  </p>
                </div>

                <button
                  id="settings-daily-checkins-toggle"
                  type="button"
                  onClick={handleDailyCheckinsToggle}
                  role="switch"
                  aria-checked={settings.dailyCheckinsEnabled}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.dailyCheckinsEnabled
                      ? 'bg-[#5A5A40] dark:bg-[#D4D0C2]'
                      : 'bg-[#D5D2C7] dark:bg-[#3E3C34]'
                  }`}
                  title={settings.dailyCheckinsEnabled ? 'Turn off daily check-ins' : 'Turn on daily check-ins'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#1A1916] shadow-sm ring-0 transition duration-200 ease-in-out ${
                      settings.dailyCheckinsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Location Context Toggle (Default: OFF for privacy, Item 4) */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#3A3A35] dark:text-[#EDEAE2]">
                      Attach location to reflections
                    </p>
                    {settings.locationEnabled ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EAE8E0] text-[#757469] dark:bg-[#2A2823] dark:text-[#8E8C7F]">
                        Off (Private)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#757469] dark:text-[#A6A498] leading-normal">
                    Attaches approximate city or area to your saved journal entries. Kept private to your account.
                  </p>
                </div>

                <button
                  id="settings-location-toggle"
                  type="button"
                  onClick={handleLocationToggle}
                  role="switch"
                  aria-checked={settings.locationEnabled}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.locationEnabled
                      ? 'bg-[#5A5A40] dark:bg-[#D4D0C2]'
                      : 'bg-[#D5D2C7] dark:bg-[#3E3C34]'
                  }`}
                  title={settings.locationEnabled ? 'Turn off location' : 'Turn on location'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#1A1916] shadow-sm ring-0 transition duration-200 ease-in-out ${
                      settings.locationEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-[#E6E4DD] dark:border-[#2E2C26] bg-[#F4F1E8]/50 dark:bg-[#191814]/50 text-center">
          <p className="text-[11px] text-[#858376] dark:text-[#8E8C7F]">
            Reflect · Mindful personal journaling
          </p>
        </div>
      </aside>
    </div>
  );
};

import React from 'react';
import { UserProfile, CustomAvatarType } from '../types';
import { Moon, Sun, Flower2, Mountain, Compass } from 'lucide-react';

interface UserAvatarProps {
  user: UserProfile | null;
  customAvatar?: CustomAvatarType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const AVATAR_OPTIONS: Array<{
  id: CustomAvatarType;
  label: string;
  description: string;
  icon?: React.FC<{ className?: string }>;
}> = [
  {
    id: 'default',
    label: 'Profile Photo',
    description: 'Use your connected Google profile picture',
  },
  {
    id: 'initials',
    label: 'Initials',
    description: 'Monogram with warm neutral background',
  },
  {
    id: 'crescent',
    label: 'Crescent Moon',
    description: 'Quiet night & evening stillness',
    icon: Moon,
  },
  {
    id: 'sun',
    label: 'Morning Sun',
    description: 'Warm dawn & gentle clarity',
    icon: Sun,
  },
  {
    id: 'lotus',
    label: 'Zen Lotus',
    description: 'Tranquility & emotional blooming',
    icon: Flower2,
  },
  {
    id: 'mountain',
    label: 'Silent Peak',
    description: 'Groundedness & steadfast presence',
    icon: Mountain,
  },
  {
    id: 'compass',
    label: 'Inner Compass',
    description: 'Intentional direction & self-guidance',
    icon: Compass,
  },
];

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  customAvatar = 'default',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 sm:w-9 sm:h-9 text-sm',
    lg: 'w-10 h-10 text-base',
    xl: 'w-14 h-14 text-xl',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-7 h-7',
  }[size];

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  // 1. Illustrated / Thematic Avatars
  if (customAvatar === 'crescent') {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-[#363A48] text-[#E0E5F5] dark:bg-[#252834] dark:text-[#C5D0EE] flex items-center justify-center flex-shrink-0 shadow-2xs border border-[#484E62] dark:border-[#383C4E] ${className}`}
        title="Crescent Moon Avatar"
        aria-label="Crescent Moon Avatar"
      >
        <Moon className={iconSizes} />
      </div>
    );
  }

  if (customAvatar === 'sun') {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-[#EAD7BA] text-[#784E1A] dark:bg-[#423321] dark:text-[#F3D7A4] flex items-center justify-center flex-shrink-0 shadow-2xs border border-[#D5BE9E] dark:border-[#59442C] ${className}`}
        title="Morning Sun Avatar"
        aria-label="Morning Sun Avatar"
      >
        <Sun className={iconSizes} />
      </div>
    );
  }

  if (customAvatar === 'lotus') {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-[#E8DDD8] text-[#7A4B4B] dark:bg-[#3D2C2C] dark:text-[#E8BEBE] flex items-center justify-center flex-shrink-0 shadow-2xs border border-[#D3C3BD] dark:border-[#543D3D] ${className}`}
        title="Zen Lotus Avatar"
        aria-label="Zen Lotus Avatar"
      >
        <Flower2 className={iconSizes} />
      </div>
    );
  }

  if (customAvatar === 'mountain') {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-[#DCE2DC] text-[#3D5245] dark:bg-[#27362E] dark:text-[#BAD0C2] flex items-center justify-center flex-shrink-0 shadow-2xs border border-[#C5CDC5] dark:border-[#3B4D42] ${className}`}
        title="Silent Peak Avatar"
        aria-label="Silent Peak Avatar"
      >
        <Mountain className={iconSizes} />
      </div>
    );
  }

  if (customAvatar === 'compass') {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-[#E4E3D8] text-[#4A4B3A] dark:bg-[#2D2E24] dark:text-[#D1CFB8] flex items-center justify-center flex-shrink-0 shadow-2xs border border-[#CFCDBE] dark:border-[#424434] ${className}`}
        title="Inner Compass Avatar"
        aria-label="Inner Compass Avatar"
      >
        <Compass className={iconSizes} />
      </div>
    );
  }

  // 2. Explicit Initials Choice
  if (customAvatar === 'initials') {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-[#EAE8E0] dark:bg-[#32302A] text-[#5A5A40] dark:text-[#D4D0C2] font-serif font-medium flex items-center justify-center flex-shrink-0 shadow-2xs border border-[#D5D2C7] dark:border-[#3E3C34] ${className}`}
        title={`User: ${user?.displayName || 'User'}`}
        aria-label={`Initials avatar: ${initials}`}
      >
        {initials}
      </div>
    );
  }

  // 3. Default: User's connected Google photo, falling back to initials if none exists
  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName || 'User profile'}
        className={`${sizeClasses} rounded-full object-cover shadow-2xs border border-[#D5D2C7] dark:border-[#3E3C34] ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-[#EAE8E0] dark:bg-[#32302A] text-[#5A5A40] dark:text-[#D4D0C2] font-serif font-medium flex items-center justify-center flex-shrink-0 shadow-2xs border border-[#D5D2C7] dark:border-[#3E3C34] ${className}`}
      title={`User: ${user?.displayName || 'User'}`}
      aria-label={`Initials avatar: ${initials}`}
    >
      {initials}
    </div>
  );
};

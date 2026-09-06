import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Sparkles, UserCheck } from 'lucide-react';
import {
  JournalCategory,
  JOURNAL_CATEGORIES,
  CATEGORY_CONFIG,
} from '../types';

interface CategoryChipProps {
  currentCategory: JournalCategory;
  aiCategory?: JournalCategory;
  onSelectCategory: (category: JournalCategory) => void;
  disabled?: boolean;
}

export const CategoryChip: React.FC<CategoryChipProps> = ({
  currentCategory,
  aiCategory,
  onSelectCategory,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const config = CATEGORY_CONFIG[currentCategory] || CATEGORY_CONFIG.Reflection;
  const isOverridden = aiCategory && currentCategory !== aiCategory;

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        id={`category-chip-btn-${currentCategory.toLowerCase()}`}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer select-none ${config.bgLight} ${config.bgDark} ${config.textLight} ${config.textDark} ${config.borderLight} ${config.borderDark} hover:opacity-90 active:scale-95`}
        title={`Mood tag: ${currentCategory}${isOverridden ? ` (Overridden from AI: ${aiCategory})` : ' (AI assigned)'} — Click to change`}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: config.color }}
        />
        <span>{currentCategory}</span>
        {isOverridden ? (
          <UserCheck className="w-3 h-3 opacity-70" title="User adjusted" />
        ) : (
          <Sparkles className="w-3 h-3 opacity-60" title="AI detected" />
        )}
        {!disabled && <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />}
      </button>

      {isOpen && (
        <div
          id="category-dropdown-menu"
          className="absolute left-0 mt-1.5 w-52 bg-[#FAF9F5] dark:bg-[#252420] border border-[#D5D2C7] dark:border-[#423F36] rounded-xl shadow-lg z-50 py-1.5 animate-in fade-in zoom-in-95 duration-200 ease-out font-sans origin-top-left"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-[#E6E4DD] dark:border-[#2E2C26]">
            <p className="text-[11px] font-medium text-[#757469] dark:text-[#A6A498]">
              Select Emotion or Theme
            </p>
            {aiCategory && (
              <p className="text-[10px] text-[#858376] dark:text-[#8E8C7F] mt-0.5 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> AI original: {aiCategory}
              </p>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {JOURNAL_CATEGORIES.map((category) => {
              const itemConfig = CATEGORY_CONFIG[category];
              const isSelected = category === currentCategory;
              return (
                <button
                  key={category}
                  type="button"
                  id={`category-opt-${category.toLowerCase()}`}
                  onClick={() => {
                    onSelectCategory(category);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors hover:bg-[#EAE8E0] dark:hover:bg-[#2E2C26] ${
                    isSelected
                      ? 'font-semibold text-[#3A3A35] dark:text-[#EDEAE2] bg-[#E2DFD6] dark:bg-[#34322C]'
                      : 'text-[#5A5A40] dark:text-[#C5C2B6]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: itemConfig.color }}
                    />
                    <div>
                      <div>{category}</div>
                      <div className="text-[10px] text-[#757469] dark:text-[#8E8C7F] font-normal leading-tight">
                        {itemConfig.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#3A3A35] dark:text-[#EDEAE2] flex-shrink-0 ml-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

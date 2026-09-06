import React, { useState, useMemo } from 'react';
import {
  Printer,
  X,
  CheckSquare,
  Square,
  FileDown,
  Calendar,
  MapPin,
  Sparkles,
  Layers,
  Search,
  Check,
  Filter,
} from 'lucide-react';
import { JournalEntry, UserProfile, JournalCategory, JOURNAL_CATEGORIES } from '../types';
import { formatLocalDate, formatLocalTime } from '../lib/dateUtils';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  user?: UserProfile;
  userDisplayName?: string;
  initialSelectedEntryIds?: string[];
  initialSelectedIds?: string[];
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  entries,
  user,
  userDisplayName,
  initialSelectedEntryIds,
  initialSelectedIds,
}) => {
  const authorName = user?.displayName || userDisplayName || 'Friend';
  const effectiveInitialIds = initialSelectedEntryIds || initialSelectedIds;

  // Selected IDs state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (effectiveInitialIds && effectiveInitialIds.length > 0) {
      return new Set(effectiveInitialIds);
    }
    return new Set(entries.map((e) => e.id));
  });

  // Search & Filter in export modal
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<JournalCategory | 'ALL'>('ALL');
  const [includePrompts, setIncludePrompts] = useState(true);
  const [includeGeotag, setIncludeGeotag] = useState(true);
  const [includeCommitments, setIncludeCommitments] = useState(true);

  // Sync initial selections when opened
  React.useEffect(() => {
    if (isOpen) {
      if (effectiveInitialIds && effectiveInitialIds.length > 0) {
        setSelectedIds(new Set(effectiveInitialIds));
      } else if (selectedIds.size === 0) {
        setSelectedIds(new Set(entries.map((e) => e.id)));
      }
    }
  }, [isOpen, effectiveInitialIds]);

  // Filtered entries for the selection checklist
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesCategory =
        selectedCategory === 'ALL' ||
        (entry.userCategory || entry.aiCategory) === selectedCategory;

      const matchesSearch =
        !searchQuery.trim() ||
        entry.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.messages.some((m) =>
          m.text.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        (entry.location?.placeName &&
          entry.location.placeName.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [entries, selectedCategory, searchQuery]);

  // Selected entries sorted chronologically (oldest to newest for physical journals)
  const entriesToExport = useMemo(() => {
    return entries
      .filter((e) => selectedIds.has(e.id))
      .sort((a, b) => (a.createdAtMillis || 0) - (b.createdAtMillis || 0));
  }, [entries, selectedIds]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const toggleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectPreset = (preset: 'all' | 'last7' | 'last30') => {
    const now = Date.now();
    if (preset === 'all') {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    } else if (preset === 'last7') {
      const cutoff = now - 7 * 24 * 60 * 60 * 1000;
      setSelectedIds(new Set(entries.filter((e) => (e.createdAtMillis || 0) >= cutoff).map((e) => e.id)));
    } else if (preset === 'last30') {
      const cutoff = now - 30 * 24 * 60 * 60 * 1000;
      setSelectedIds(new Set(entries.filter((e) => (e.createdAtMillis || 0) >= cutoff).map((e) => e.id)));
    }
  };

  // Dedicated Print-Ready Document Trigger
  const handlePrint = () => {
    const exportDateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const entriesHtml = entriesToExport
      .map((entry, index) => {
        const dateStr = formatLocalDate(entry.createdAtMillis);
        const timeStr = formatLocalTime(entry.createdAtMillis);
        const category = entry.userCategory || entry.aiCategory || 'Reflection';
        const locationText =
          includeGeotag && entry.location?.placeName
            ? `📍 ${entry.location.placeName}`
            : '';

        const messagesHtml = entry.messages
          .map((m) => {
            const isUser = m.role === 'user';
            if (!includePrompts && !isUser) return '';
            return `
              <div class="message ${isUser ? 'user-message' : 'prompt-message'}">
                <div class="message-role">${isUser ? 'Reflection' : 'Mindful Prompt'}</div>
                <div class="message-text">${m.text.replace(/\n/g, '<br/>')}</div>
              </div>
            `;
          })
          .join('');

        const commitmentHtml =
          includeCommitments && entry.nextDayCommitment
            ? `
            <div class="commitment-box">
              <strong>Next-Day Intention:</strong> "${entry.nextDayCommitment}"
              ${
                entry.commitmentCheckin
                  ? ` <span class="checkin-tag">(${
                      entry.commitmentCheckin.status === 'yes'
                        ? 'Completed'
                        : entry.commitmentCheckin.status === 'not_yet'
                        ? 'In Progress'
                        : 'Skipped'
                    })</span>`
                  : ''
              }
            </div>
          `
            : '';

        return `
          <article class="entry-card">
            <header class="entry-header">
              <div class="entry-meta-left">
                <span class="entry-number">#${index + 1}</span>
                <span class="entry-date">${dateStr} · ${timeStr}</span>
                ${locationText ? `<span class="entry-location">${locationText}</span>` : ''}
              </div>
              <div class="entry-category">[ ${category.toUpperCase()} ]</div>
            </header>

            <div class="entry-summary">
              "${entry.summary}"
            </div>

            <div class="entry-messages">
              ${messagesHtml}
            </div>

            ${commitmentHtml}
          </article>
        `;
      })
      .join('');

    const documentHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Reflect Archive — ${authorName}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 18mm 16mm 20mm 16mm;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .no-print {
                display: none !important;
              }
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 24px;
              color: #1a1916;
              background-color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 13px;
              line-height: 1.6;
            }
            .archive-cover {
              border-bottom: 2px solid #1a1916;
              padding-bottom: 24px;
              margin-bottom: 32px;
              page-break-after: avoid;
            }
            .archive-super {
              font-size: 11px;
              letter-spacing: 2px;
              text-transform: uppercase;
              color: #66635a;
              margin-bottom: 6px;
            }
            .archive-title {
              font-family: "Newsreader", Georgia, Cambria, serif;
              font-size: 32px;
              font-weight: 500;
              margin: 0 0 10px 0;
              letter-spacing: -0.5px;
            }
            .archive-meta {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              color: #555249;
              flex-wrap: wrap;
              gap: 8px;
            }
            .entry-card {
              border-bottom: 1px solid #d5d2c7;
              padding-top: 18px;
              padding-bottom: 28px;
              page-break-inside: avoid;
            }
            .entry-header {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              margin-bottom: 12px;
              font-size: 12px;
              border-bottom: 1px dashed #e6e4dd;
              padding-bottom: 6px;
            }
            .entry-number {
              font-family: monospace;
              font-weight: bold;
              margin-right: 8px;
              color: #555249;
            }
            .entry-date {
              font-weight: 600;
              color: #1a1916;
            }
            .entry-location {
              margin-left: 10px;
              color: #555249;
              font-style: italic;
            }
            .entry-category {
              font-family: monospace;
              font-size: 11px;
              letter-spacing: 1px;
              color: #44423b;
              font-weight: bold;
            }
            .entry-summary {
              font-family: "Newsreader", Georgia, Cambria, serif;
              font-size: 16px;
              font-style: italic;
              color: #2b2923;
              line-height: 1.5;
              margin-bottom: 16px;
              padding-left: 12px;
              border-left: 2px solid #5a5a40;
            }
            .message {
              margin-bottom: 12px;
            }
            .user-message {
              padding-left: 4px;
            }
            .user-message .message-text {
              font-family: "Newsreader", Georgia, Cambria, serif;
              font-size: 14px;
              line-height: 1.6;
              color: #1a1916;
            }
            .prompt-message {
              background: #f8f7f4;
              border-left: 1px solid #c7c4b7;
              padding: 8px 12px;
              margin: 10px 0;
            }
            .message-role {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #777468;
              margin-bottom: 3px;
              font-weight: 600;
            }
            .commitment-box {
              margin-top: 14px;
              padding: 8px 12px;
              background-color: #faf9f6;
              border: 1px solid #e6e4dd;
              border-radius: 4px;
              font-size: 12px;
              color: #3e3c35;
            }
            .checkin-tag {
              font-style: italic;
              color: #5a5a40;
              font-weight: 500;
            }
            .archive-footer {
              text-align: center;
              font-size: 11px;
              color: #88857a;
              margin-top: 40px;
              border-top: 1px solid #d5d2c7;
              padding-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; padding: 14px; background: #faf9f5; border: 1px solid #d5d2c7; display: flex; justify-content: space-between; align-items: center; border-radius: 8px;">
            <div>
              <strong>Print Archive Ready</strong> — Press the button below or press <code>Ctrl/Cmd + P</code> to Save as PDF or print.
            </div>
            <button onclick="window.print()" style="background: #1a1916; color: #ffffff; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">
              Print / Save as PDF
            </button>
          </div>

          <header class="archive-cover">
            <div class="archive-super">REFLECT · PHYSICAL ARCHIVE EDITION</div>
            <h1 class="archive-title">${authorName} Journal</h1>
            <div class="archive-meta">
              <span><strong>Author:</strong> ${authorName}</span>
              <span><strong>Total Reflections:</strong> ${entriesToExport.length}</span>
              <span><strong>Archived On:</strong> ${exportDateStr}</span>
            </div>
          </header>

          <main>
            ${entriesHtml}
          </main>

          <footer class="archive-footer">
            Reflect Mindful Journaling Archive · Printed privately from personal collection · End of Document
          </footer>

          <script>
            // Auto open print dialog after fonts settle
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `;

    // Try popup window first
    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank', 'width=900,height=1000');
    } catch {
      printWindow = null;
    }

    if (printWindow && printWindow.document) {
      try {
        printWindow.document.open();
        printWindow.document.write(documentHtml);
        printWindow.document.close();
        return;
      } catch (e) {
        console.warn('Direct popup print write failed, using iframe fallback:', e);
      }
    }

    // Hidden iframe fallback that works reliably even inside sandboxed iframes
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(documentHtml);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error('Iframe print error:', err);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1500);
        }
      }, 500);
    } else {
      window.print();
    }
  };

  return (
    <div
      id="pdf-export-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="pdf-export-modal-dialog"
        className="w-full max-w-4xl max-h-[90vh] bg-[#FAF9F5] dark:bg-[#1E1D18] border border-[#D5D2C7] dark:border-[#3E3C34] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#3A3A35] dark:text-[#EDEAE2]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E6E4DD] dark:border-[#2E2C26] bg-[#F4F1E8] dark:bg-[#191814] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FFFFFF] dark:bg-[#25231D] border border-[#D5D2C7] dark:border-[#3E3C34] text-[#5A5A40] dark:text-[#D4D0C2]">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#3A3A35] dark:text-[#EDEAE2]">
                Export Physical Archive (PDF)
              </h2>
              <p className="text-xs text-[#757469] dark:text-[#A6A498]">
                Minimalist, high-contrast, print-ready document formatted for binders, paper archives, or PDF storage.
              </p>
            </div>
          </div>

          <button
            id="close-pdf-export-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#858376] hover:text-[#3A3A35] dark:hover:text-[#EDEAE2] hover:bg-[#EAE8E0] dark:hover:bg-[#2A2823] transition-colors cursor-pointer"
            title="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two-column layout (Left: Select entries & options, Right: Clean print preview) */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Column: Selection Controls & Options */}
          <div className="w-full md:w-[380px] border-b md:border-b-0 md:border-r border-[#E6E4DD] dark:border-[#2E2C26] flex flex-col bg-[#FAF9F5] dark:bg-[#1E1D18]">
            {/* Quick Presets & Select All */}
            <div className="p-4 border-b border-[#E6E4DD] dark:border-[#2E2C26] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#5A5A40] dark:text-[#A6A498] uppercase tracking-wider">
                  Select Entries ({selectedIds.size} of {entries.length})
                </span>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-medium text-[#5A5A40] dark:text-[#D4D0C2] hover:underline cursor-pointer"
                >
                  {selectedIds.size === entries.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Presets */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => selectPreset('all')}
                  className="flex-1 py-1 px-2 text-[11px] rounded-md font-medium border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#25231D] hover:border-[#5A5A40] transition-colors cursor-pointer text-center"
                >
                  All time
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset('last30')}
                  className="flex-1 py-1 px-2 text-[11px] rounded-md font-medium border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#25231D] hover:border-[#5A5A40] transition-colors cursor-pointer text-center"
                >
                  Last 30 days
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset('last7')}
                  className="flex-1 py-1 px-2 text-[11px] rounded-md font-medium border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#25231D] hover:border-[#5A5A40] transition-colors cursor-pointer text-center"
                >
                  Last 7 days
                </button>
              </div>

              {/* Search within reflections */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#858376]" />
                <input
                  type="text"
                  placeholder="Filter by keyword or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FFFFFF] dark:bg-[#25231D] border border-[#D5D2C7] dark:border-[#3E3C34] rounded-lg focus:outline-none focus:border-[#5A5A40] dark:focus:border-[#D4D0C2]"
                />
              </div>

              {/* Minimalist Print Options */}
              <div className="pt-2 border-t border-[#E6E4DD] dark:border-[#2E2C26] space-y-1.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#555249] dark:text-[#C5C2B6]">
                  <input
                    type="checkbox"
                    checked={includeGeotag}
                    onChange={(e) => setIncludeGeotag(e.target.checked)}
                    className="rounded text-[#5A5A40] focus:ring-0 cursor-pointer"
                  />
                  <span>Include Geotag location badges</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#555249] dark:text-[#C5C2B6]">
                  <input
                    type="checkbox"
                    checked={includePrompts}
                    onChange={(e) => setIncludePrompts(e.target.checked)}
                    className="rounded text-[#5A5A40] focus:ring-0 cursor-pointer"
                  />
                  <span>Include AI conversational prompts</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#555249] dark:text-[#C5C2B6]">
                  <input
                    type="checkbox"
                    checked={includeCommitments}
                    onChange={(e) => setIncludeCommitments(e.target.checked)}
                    className="rounded text-[#5A5A40] focus:ring-0 cursor-pointer"
                  />
                  <span>Include micro-commitment check-ins</span>
                </label>
              </div>
            </div>

            {/* Scrollable Entry Checklist */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredEntries.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#858376]">
                  No matching reflections found.
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const isChecked = selectedIds.has(entry.id);
                  const dateStr = formatLocalDate(entry.createdAtMillis);
                  const category = entry.userCategory || entry.aiCategory;

                  return (
                    <div
                      key={entry.id}
                      onClick={() => toggleEntry(entry.id)}
                      className={`p-2.5 rounded-xl border transition-colors cursor-pointer select-none flex items-start gap-2.5 ${
                        isChecked
                          ? 'bg-[#FFFFFF] dark:bg-[#25231D] border-[#5A5A40] dark:border-[#D4D0C2] shadow-2xs'
                          : 'bg-[#F4F1E8]/50 dark:bg-[#191814]/50 border-[#E6E4DD] dark:border-[#2E2C26] opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="mt-0.5 text-[#5A5A40] dark:text-[#D4D0C2]">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-[#858376]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px] text-[#757469] dark:text-[#A6A498] mb-0.5">
                          <span>{dateStr}</span>
                          <span className="font-mono text-[10px] uppercase font-semibold">
                            {category}
                          </span>
                        </div>
                        <p className="font-serif text-xs font-medium text-[#3A3A35] dark:text-[#EDEAE2] line-clamp-2 leading-snug">
                          {entry.summary}
                        </p>
                        {entry.location?.placeName && (
                          <div className="flex items-center gap-1 text-[10px] text-[#858376] dark:text-[#A6A498] mt-1 truncate">
                            <MapPin className="w-3 h-3 text-[#5A5A40] shrink-0" />
                            <span className="truncate">{entry.location.placeName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Clean Minimalist Print Document Preview */}
          <div className="flex-1 flex flex-col bg-[#EFECE6] dark:bg-[#141310] p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-3 text-xs text-[#757469] dark:text-[#A6A498]">
              <span className="font-medium">
                Print Layout Preview ({entriesToExport.length} {entriesToExport.length === 1 ? 'entry' : 'entries'} selected)
              </span>
              <span className="text-[11px] italic">
                Optimized for standard Letter / A4 paper
              </span>
            </div>

            {/* Paper Sheet Preview Container */}
            <div className="flex-1 overflow-y-auto rounded-xl bg-white shadow-md border border-[#D5D2C7] p-8 text-[#1A1916] font-sans">
              {entriesToExport.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#858376]">
                  <Printer className="w-10 h-10 mb-2 opacity-40" />
                  <p className="font-serif text-base font-medium text-[#3A3A35] mb-1">
                    No reflections selected
                  </p>
                  <p className="text-xs max-w-xs">
                    Please check one or more journal reflections on the left to include them in this print archive.
                  </p>
                </div>
              ) : (
                <div className="space-y-8 max-w-2xl mx-auto">
                  {/* Document Masthead */}
                  <div className="border-b-2 border-[#1A1916] pb-4">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-[#66635A] mb-1">
                      REFLECT · PHYSICAL ARCHIVE
                    </div>
                    <h1 className="font-serif text-2xl font-normal text-[#1A1916] tracking-tight mb-2">
                      {authorName} Journal
                    </h1>
                    <div className="flex justify-between text-xs text-[#555249] flex-wrap gap-2">
                      <span>Author: {authorName || user?.email || 'Mindful Author'}</span>
                      <span>Total Reflections: {entriesToExport.length}</span>
                      <span>Exported: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Render Entry Previews */}
                  <div className="space-y-8">
                    {entriesToExport.map((entry, index) => {
                      const dateStr = formatLocalDate(entry.createdAtMillis);
                      const timeStr = formatLocalTime(entry.createdAtMillis);
                      const category = entry.userCategory || entry.aiCategory || 'Reflection';

                      return (
                        <div key={entry.id} className="border-b border-[#D5D2C7] pb-6 space-y-3">
                          <div className="flex items-baseline justify-between border-b border-dashed border-[#E6E4DD] pb-1.5 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#555249]">#{index + 1}</span>
                              <span className="font-semibold text-[#1A1916]">{dateStr} · {timeStr}</span>
                              {includeGeotag && entry.location?.placeName && (
                                <span className="text-[#555249] italic">📍 {entry.location.placeName}</span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] font-bold tracking-wider text-[#44423B]">
                              [ {category.toUpperCase()} ]
                            </span>
                          </div>

                          <div className="font-serif text-base italic text-[#2B2923] pl-3 border-l-2 border-[#5A5A40]">
                            "{entry.summary}"
                          </div>

                          <div className="space-y-2 text-xs">
                            {entry.messages.map((m) => {
                              const isUser = m.role === 'user';
                              if (!includePrompts && !isUser) return null;
                              return (
                                <div
                                  key={m.id}
                                  className={
                                    isUser
                                      ? 'pl-1 font-serif text-[13px] text-[#1A1916] leading-relaxed'
                                      : 'p-2 bg-[#F8F7F4] border-l border-[#C7C4B7] text-[#555249] italic text-[12px]'
                                  }
                                >
                                  <div className="text-[9px] uppercase tracking-wider font-bold text-[#88857A] mb-0.5">
                                    {isUser ? 'Reflection' : 'Mindful Prompt'}
                                  </div>
                                  <div className="whitespace-pre-wrap">{m.text}</div>
                                </div>
                              );
                            })}
                          </div>

                          {includeCommitments && entry.nextDayCommitment && (
                            <div className="p-2 bg-[#FAF9F6] border border-[#E6E4DD] rounded text-xs text-[#3E3C35]">
                              <strong>Next-Day Intention:</strong> "{entry.nextDayCommitment}"
                              {entry.commitmentCheckin && (
                                <span className="italic text-[#5A5A40] ml-2">
                                  ({entry.commitmentCheckin.status === 'yes' ? 'Completed' : 'In progress'})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#E6E4DD] dark:border-[#2E2C26] bg-[#F4F1E8] dark:bg-[#191814] flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-[#757469] dark:text-[#A6A498]">
            {selectedIds.size > 0 ? (
              <span>Ready to print <strong>{selectedIds.size}</strong> reflections</span>
            ) : (
              <span>Select at least one reflection to print</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#757469] hover:text-[#3A3A35] dark:text-[#A6A498] dark:hover:text-[#EDEAE2] hover:bg-[#EAE8E0] dark:hover:bg-[#2A2823] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="confirm-print-pdf-btn"
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handlePrint}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                selectedIds.size === 0
                  ? 'opacity-40 cursor-not-allowed bg-[#5A5A40] text-white'
                  : 'bg-[#5A5A40] hover:bg-[#484833] dark:bg-[#D4D0C2] dark:hover:bg-[#EDEAE2] text-[#FAF9F5] dark:text-[#1E1D18]'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

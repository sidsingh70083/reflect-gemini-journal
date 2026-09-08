import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  RotateCcw,
  Trash2,
  HelpCircle,
  Check,
  Compass,
  Feather,
  ChevronDown,
  Info,
  BookOpen,
} from 'lucide-react';
import {
  REAL_CONSTELLATIONS,
  ConstellationPattern,
  ConstellationStar,
} from '../../lib/constellationData';
import { ambientSound } from '../../lib/ambientSound';

type ConstellationMode = 'trace' | 'free';

interface FreeStar {
  id: string;
  x: number;
  y: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  pulsePhase: number;
  pulseSpeed: number;
}

interface FreeLine {
  id: string;
  fromId: string;
  toId: string;
}

interface FadingLine {
  fromId: string;
  toId: string;
  startTime: number;
  duration: number; // in ms
}

type ActionHistoryItem =
  | { type: 'star'; star: FreeStar }
  | { type: 'line'; line: FreeLine };

export const ConstellationActivity: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active Mode: 'trace' (primary guided mode) or 'free' (freeform canvas)
  const [mode, setMode] = useState<ConstellationMode>('trace');

  // ==================== TRACE THE SKY STATE ====================
  // Pick random starting constellation
  const [currentConstellationIndex, setCurrentConstellationIndex] = useState(() =>
    Math.floor(Math.random() * REAL_CONSTELLATIONS.length)
  );
  const currentConstellation = REAL_CONSTELLATIONS[currentConstellationIndex];

  // Traced correct lines: array of sorted pairs `['starA', 'starB']`
  const [tracedLines, setTracedLines] = useState<[string, string][]>([]);
  // Lines that dissolve gently after incorrect attempt
  const [fadingLines, setFadingLines] = useState<FadingLine[]>([]);
  // Active hint
  const [activeHint, setActiveHint] = useState<{
    line: [string, string];
    startTime: number;
  } | null>(null);

  // Gemini / Fallback Lore
  const [lore, setLore] = useState<string | null>(null);
  const [isLoadingLore, setIsLoadingLore] = useState(false);

  // Hovered / Tapped star for details in Trace mode
  const [hoveredStarId, setHoveredStarId] = useState<string | null>(null);

  // Dropdown for switching constellations
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // ==================== FREE SKY STATE ====================
  const [freeStars, setFreeStars] = useState<FreeStar[]>([]);
  const [freeLines, setFreeLines] = useState<FreeLine[]>([]);
  const [freeHistory, setFreeHistory] = useState<ActionHistoryItem[]>([]);

  // ==================== INTERACTION POINTER STATE ====================
  const [dragStartStarId, setDragStartStarId] = useState<string | null>(null);
  const [currentPointer, setCurrentPointer] = useState<{ x: number; y: number } | null>(null);
  const [selectedStarId, setSelectedStarId] = useState<string | null>(null);

  // Helper to test if two star IDs match a pair regardless of order
  const isSameLine = (pair1: [string, string], pair2: [string, string]) => {
    return (
      (pair1[0] === pair2[0] && pair1[1] === pair2[1]) ||
      (pair1[0] === pair2[1] && pair1[1] === pair2[0])
    );
  };

  const isLineTraced = useCallback(
    (starA: string, starB: string) => {
      return tracedLines.some((tl) => isSameLine(tl, [starA, starB]));
    },
    [tracedLines]
  );

  const isComplete =
    mode === 'trace' &&
    currentConstellation.lines.length > 0 &&
    tracedLines.length >= currentConstellation.lines.length;

  const hasPlayedCompletionRef = useRef(false);

  // Click outside to close constellation selector
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setIsSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Fetch Gemini Lore and play gentle celestial completion chime when constellation is completed
  useEffect(() => {
    if (!isComplete) {
      hasPlayedCompletionRef.current = false;
      return;
    }

    if (!hasPlayedCompletionRef.current) {
      hasPlayedCompletionRef.current = true;
      ambientSound.playCompletionSound('constellation');
    }

    let isMounted = true;
    setIsLoadingLore(true);
    setLore(null);

    const fetchLore = async () => {
      try {
        const res = await fetch('/api/constellation/lore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: currentConstellation.name,
            commonName: currentConstellation.commonName,
            notableStars: currentConstellation.notableStars,
            season: currentConstellation.season,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.lore && isMounted) {
            setLore(data.lore);
            return;
          }
        }
        throw new Error('Fallback to handwritten description');
      } catch {
        if (isMounted) {
          setLore(currentConstellation.handwrittenDescription);
        }
      } finally {
        if (isMounted) {
          setIsLoadingLore(false);
        }
      }
    };

    fetchLore();

    return () => {
      isMounted = false;
    };
  }, [isComplete, currentConstellation]);

  // Switch constellation
  const selectConstellation = (index: number) => {
    hasPlayedCompletionRef.current = false;
    setCurrentConstellationIndex(index);
    setTracedLines([]);
    setFadingLines([]);
    setActiveHint(null);
    setLore(null);
    setSelectedStarId(null);
    setDragStartStarId(null);
    setCurrentPointer(null);
    setIsSelectorOpen(false);
  };

  const handleNextConstellation = () => {
    const nextIdx = (currentConstellationIndex + 1) % REAL_CONSTELLATIONS.length;
    selectConstellation(nextIdx);
  };

  const handleResetCurrent = () => {
    hasPlayedCompletionRef.current = false;
    setTracedLines([]);
    setFadingLines([]);
    setActiveHint(null);
    setLore(null);
    setSelectedStarId(null);
    setDragStartStarId(null);
    setCurrentPointer(null);
  };

  // Subtle Hint handler
  const handleTriggerHint = () => {
    if (mode !== 'trace' || isComplete) return;

    // Find the first untraced line
    const untraced = currentConstellation.lines.find(
      (line) => !isLineTraced(line[0], line[1])
    );

    if (untraced) {
      setActiveHint({
        line: untraced,
        startTime: performance.now(),
      });
    }
  };

  // Resize canvas to container
  const updateCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width);
    const height = Math.min(Math.max(Math.floor(rect.width * 0.65), 380), 520);

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
  }, []);

  useEffect(() => {
    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, [updateCanvasDimensions]);

  // Canvas Coordinate Mapping for Trace mode
  const getTraceStarPixelPos = useCallback(
    (star: ConstellationStar, width: number, height: number) => {
      // Add safe internal margins so stars don't touch canvas edges
      const marginX = width * 0.12;
      const marginY = height * 0.14;
      const innerW = width - marginX * 2;
      const innerH = height - marginY * 2;

      return {
        x: marginX + star.x * innerW,
        y: marginY + star.y * innerH,
      };
    },
    []
  );

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const now = performance.now();

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Deep celestial night sky gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0c0f17');
      grad.addColorStop(0.5, '#111522');
      grad.addColorStop(1, '#090c12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Subtle background starfield dust for depth
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      const dustSeed = 53;
      for (let i = 0; i < 40; i++) {
        const dx = (i * 137 + dustSeed) % width;
        const dy = (i * 223 + dustSeed) % height;
        ctx.beginPath();
        ctx.arc(dx, dy, i % 4 === 0 ? 0.9 : 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // ----------------------------------------------------
      // MODE 1: TRACE THE SKY
      // ----------------------------------------------------
      if (mode === 'trace') {
        const starMap = new Map<string, { x: number; y: number; star: ConstellationStar }>();
        currentConstellation.stars.forEach((s) => {
          const pos = getTraceStarPixelPos(s, width, height);
          starMap.set(s.id, { ...pos, star: s });
        });

        // 1. Draw Correct Traced Lines
        tracedLines.forEach(([sAId, sBId]) => {
          const sA = starMap.get(sAId);
          const sB = starMap.get(sBId);
          if (!sA || !sB) return;

          ctx.save();
          if (isComplete) {
            // Radiant golden/cyan completed glow
            ctx.strokeStyle = 'rgba(224, 231, 255, 0.85)';
            ctx.lineWidth = 2.0;
            ctx.shadowColor = 'rgba(165, 180, 252, 0.8)';
            ctx.shadowBlur = 12;
          } else {
            // Calm glowing thread
            ctx.strokeStyle = 'rgba(216, 226, 248, 0.65)';
            ctx.lineWidth = 1.6;
            ctx.shadowColor = 'rgba(199, 210, 254, 0.45)';
            ctx.shadowBlur = 8;
          }
          ctx.beginPath();
          ctx.moveTo(sA.x, sA.y);
          ctx.lineTo(sB.x, sB.y);
          ctx.stroke();
          ctx.restore();
        });

        // 2. Draw Gentle Fading Lines (Incorrect attempts softly dissolving)
        fadingLines.forEach((fl) => {
          const sA = starMap.get(fl.fromId);
          const sB = starMap.get(fl.toId);
          if (!sA || !sB) return;

          const elapsed = now - fl.startTime;
          const progress = Math.min(elapsed / fl.duration, 1);
          const alpha = (1 - progress) * 0.45;

          if (alpha > 0.01) {
            ctx.save();
            ctx.strokeStyle = `rgba(180, 190, 215, ${alpha})`;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(sA.x, sA.y);
            ctx.lineTo(sB.x, sB.y);
            ctx.stroke();
            ctx.restore();
          }
        });

        // 3. Draw Active Hint (Subtle golden guide thread)
        if (activeHint) {
          const elapsed = now - activeHint.startTime;
          if (elapsed < 3000) {
            const sA = starMap.get(activeHint.line[0]);
            const sB = starMap.get(activeHint.line[1]);
            if (sA && sB) {
              const hintPulse = 0.5 + 0.4 * Math.sin(now * 0.005);
              ctx.save();
              ctx.strokeStyle = `rgba(251, 191, 36, ${hintPulse * 0.7})`;
              ctx.lineWidth = 1.6;
              ctx.setLineDash([4, 4]);
              ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.moveTo(sA.x, sA.y);
              ctx.lineTo(sB.x, sB.y);
              ctx.stroke();
              ctx.restore();
            }
          }
        }

        // 4. Draw Active Dragging Line
        const activeSourceId = dragStartStarId || selectedStarId;
        if (activeSourceId && currentPointer) {
          const sourceStar = starMap.get(activeSourceId);
          if (sourceStar) {
            ctx.save();
            ctx.strokeStyle = 'rgba(199, 210, 254, 0.75)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([4, 4]);
            ctx.shadowColor = 'rgba(199, 210, 254, 0.6)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(sourceStar.x, sourceStar.y);
            ctx.lineTo(currentPointer.x, currentPointer.y);
            ctx.stroke();
            ctx.restore();
          }
        }

        // 5. Draw Stars
        currentConstellation.stars.forEach((s) => {
          const pos = starMap.get(s.id);
          if (!pos) return;

          // Check if this star is part of any correctly traced line
          const hasTracedConnection = tracedLines.some(
            (tl) => tl[0] === s.id || tl[1] === s.id
          );
          const isSelected = s.id === selectedStarId || s.id === dragStartStarId;
          const isHinted =
            activeHint &&
            (activeHint.line[0] === s.id || activeHint.line[1] === s.id);

          const baseRadius = (s.brightness || 2) * 1.6;
          const slowPulse = Math.sin(now * 0.002 + (s.x * 10));
          const alpha = isComplete
            ? 0.95 + 0.05 * slowPulse
            : hasTracedConnection
            ? 0.85 + 0.15 * slowPulse
            : 0.45 + 0.15 * slowPulse;

          // Outer Glow Aura
          const glowRadius = baseRadius * (isSelected || isHinted ? 4.8 : 3.2);
          const glowGrad = ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            glowRadius
          );
          const glowColor = isHinted
            ? 'rgba(251, 191, 36, '
            : isComplete
            ? 'rgba(224, 231, 255, '
            : 'rgba(165, 180, 252, ';

          glowGrad.addColorStop(0, `${glowColor}${alpha * 0.7})`);
          glowGrad.addColorStop(0.5, `${glowColor}${alpha * 0.2})`);
          glowGrad.addColorStop(1, `${glowColor}0)`);

          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          // Star Core
          ctx.save();
          ctx.fillStyle = isHinted
            ? `rgba(254, 240, 138, ${alpha})`
            : `rgba(255, 255, 255, ${alpha})`;
          ctx.shadowColor = isHinted
            ? 'rgba(251, 191, 36, 0.9)'
            : 'rgba(224, 231, 255, 0.8)';
          ctx.shadowBlur = isSelected ? 12 : 6;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, isSelected ? baseRadius + 1.2 : baseRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Selection Ring
          if (isSelected) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, baseRadius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Star Name Label (shown faintly if named star or hovered)
          const showLabel = s.name && (s.id === hoveredStarId || isComplete || (s.brightness && s.brightness >= 3));
          if (showLabel && s.name) {
            ctx.save();
            ctx.font = '10px sans-serif';
            ctx.fillStyle = isComplete
              ? 'rgba(224, 231, 255, 0.75)'
              : 'rgba(199, 210, 254, 0.55)';
            ctx.textAlign = 'center';
            ctx.fillText(s.name, pos.x, pos.y + baseRadius + 12);
            ctx.restore();
          }
        });
      }

      // ----------------------------------------------------
      // MODE 2: FREE SKY
      // ----------------------------------------------------
      if (mode === 'free') {
        // Draw lines
        freeLines.forEach((line) => {
          const starA = freeStars.find((s) => s.id === line.fromId);
          const starB = freeStars.find((s) => s.id === line.toId);
          if (!starA || !starB) return;

          ctx.save();
          ctx.strokeStyle = 'rgba(216, 226, 240, 0.5)';
          ctx.lineWidth = 1.3;
          ctx.shadowColor = 'rgba(165, 180, 252, 0.4)';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(starA.x, starA.y);
          ctx.lineTo(starB.x, starB.y);
          ctx.stroke();
          ctx.restore();
        });

        // Dragging line
        const activeSourceId = dragStartStarId || selectedStarId;
        if (activeSourceId && currentPointer) {
          const sourceStar = freeStars.find((s) => s.id === activeSourceId);
          if (sourceStar) {
            ctx.save();
            ctx.strokeStyle = 'rgba(199, 210, 254, 0.7)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(sourceStar.x, sourceStar.y);
            ctx.lineTo(currentPointer.x, currentPointer.y);
            ctx.stroke();
            ctx.restore();
          }
        }

        // Draw stars
        freeStars.forEach((star) => {
          const pulse = Math.sin(now * 0.0015 * star.pulseSpeed + star.pulsePhase);
          const currentAlpha = Math.min(star.alpha, 1) * (0.8 + 0.2 * pulse);
          const isSelected = star.id === selectedStarId || star.id === dragStartStarId;

          const glowRadius = star.size * (isSelected ? 5.2 : 3.8);
          const glowGrad = ctx.createRadialGradient(
            star.x,
            star.y,
            0,
            star.x,
            star.y,
            glowRadius
          );
          glowGrad.addColorStop(0, `rgba(224, 231, 255, ${currentAlpha * 0.6})`);
          glowGrad.addColorStop(0.5, `rgba(165, 180, 252, ${currentAlpha * 0.2})`);
          glowGrad.addColorStop(1, 'rgba(165, 180, 252, 0)');

          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(star.x, star.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          if (isSelected) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size + 4, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.save();
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
          ctx.shadowColor = 'rgba(224, 231, 255, 0.85)';
          ctx.shadowBlur = isSelected ? 12 : 7;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // Fade in new free stars
        setFreeStars((prev) => {
          let changed = false;
          const updated = prev.map((s) => {
            if (s.alpha < s.targetAlpha) {
              changed = true;
              return { ...s, alpha: Math.min(s.alpha + 0.05, s.targetAlpha) };
            }
            return s;
          });
          return changed ? updated : prev;
        });
      }

      ctx.restore();

      // Clean up completed fading lines after duration
      setFadingLines((prev) =>
        prev.filter((fl) => now - fl.startTime < fl.duration)
      );

      // Clean up hint if expired
      if (activeHint && now - activeHint.startTime >= 3000) {
        setActiveHint(null);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    mode,
    currentConstellation,
    tracedLines,
    fadingLines,
    activeHint,
    freeStars,
    freeLines,
    dragStartStarId,
    selectedStarId,
    currentPointer,
    hoveredStarId,
    isComplete,
    getTraceStarPixelPos,
  ]);

  // Pointer position relative to canvas
  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Find star near pointer
  const getStarAt = (x: number, y: number, radius = 24) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    if (mode === 'trace') {
      for (const s of currentConstellation.stars) {
        const pos = getTraceStarPixelPos(s, width, height);
        if (Math.hypot(pos.x - x, pos.y - y) <= radius) {
          return { id: s.id, x: pos.x, y: pos.y, star: s };
        }
      }
      return null;
    } else {
      for (let i = freeStars.length - 1; i >= 0; i--) {
        const s = freeStars[i];
        if (Math.hypot(s.x - x, s.y - y) <= radius) {
          return { id: s.id, x: s.x, y: s.y };
        }
      }
      return null;
    }
  };

  // Pointer Interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getPointerPos(e);
    const star = getStarAt(pos.x, pos.y);

    if (star) {
      setDragStartStarId(star.id);
      setCurrentPointer(pos);

      if (selectedStarId && selectedStarId !== star.id) {
        attemptConnect(selectedStarId, star.id);
        setSelectedStarId(null);
        setDragStartStarId(null);
        setCurrentPointer(null);
      } else {
        setSelectedStarId(star.id);
      }
    } else {
      if (selectedStarId) {
        setSelectedStarId(null);
        setDragStartStarId(null);
        setCurrentPointer(null);
      } else if (mode === 'free') {
        // Place new freeform star
        const newStar: FreeStar = {
          id: `star_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          x: pos.x,
          y: pos.y,
          size: 2.2 + Math.random() * 1.8,
          alpha: 0.05,
          targetAlpha: 0.95,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.8 + Math.random() * 0.6,
        };
        setFreeStars((prev) => [...prev, newStar]);
        setFreeHistory((prev) => [...prev, { type: 'star', star: newStar }]);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getPointerPos(e);
    if (dragStartStarId || selectedStarId) {
      setCurrentPointer(pos);
    }

    if (mode === 'trace') {
      const star = getStarAt(pos.x, pos.y, 18);
      setHoveredStarId(star ? star.id : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getPointerPos(e);

    if (dragStartStarId) {
      const targetStar = getStarAt(pos.x, pos.y);
      if (targetStar && targetStar.id !== dragStartStarId) {
        attemptConnect(dragStartStarId, targetStar.id);
        setSelectedStarId(null);
      }
      setDragStartStarId(null);
      setCurrentPointer(null);
    }
  };

  // Connect attempt logic
  const attemptConnect = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    if (mode === 'trace') {
      // Check if this pair is part of real constellation
      const isRealPair = currentConstellation.lines.some((line) =>
        isSameLine(line, [fromId, toId])
      );

      if (isRealPair) {
        // Check if already traced
        if (!isLineTraced(fromId, toId)) {
          setTracedLines((prev) => [...prev, [fromId, toId]]);
        }
      } else {
        // Incorrect pair: gracefully dissolves over 1200ms. No error sound, no red flash!
        setFadingLines((prev) => [
          ...prev,
          {
            fromId,
            toId,
            startTime: performance.now(),
            duration: 1200,
          },
        ]);
      }
    } else {
      // Free Sky mode connection
      const exists = freeLines.some(
        (l) =>
          (l.fromId === fromId && l.toId === toId) ||
          (l.fromId === toId && l.toId === fromId)
      );
      if (exists) return;

      const newLine: FreeLine = {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        fromId,
        toId,
      };
      setFreeLines((prev) => [...prev, newLine]);
      setFreeHistory((prev) => [...prev, { type: 'line', line: newLine }]);
    }
  };

  // Undo in Free Sky
  const handleFreeUndo = () => {
    if (freeHistory.length === 0) return;
    const last = freeHistory[freeHistory.length - 1];
    setFreeHistory((prev) => prev.slice(0, -1));

    if (last.type === 'line') {
      setFreeLines((prev) => prev.filter((l) => l.id !== last.line.id));
    } else if (last.type === 'star') {
      setFreeStars((prev) => prev.filter((s) => s.id !== last.star.id));
      setFreeLines((prev) =>
        prev.filter((l) => l.fromId !== last.star.id && l.toId !== last.star.id)
      );
    }
  };

  // Clear in Free Sky
  const handleFreeClear = () => {
    setFreeStars([]);
    setFreeLines([]);
    setFreeHistory([]);
    setSelectedStarId(null);
    setDragStartStarId(null);
    setCurrentPointer(null);
  };

  return (
    <div id="constellation-activity" className="space-y-4">
      {/* 1. Mode Switcher & Activity Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6E4DD] dark:border-[#2E2C26] pb-3">
        {/* Mode Selector Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-[#F0EFEA] dark:bg-[#1D1C18] border border-[#E6E4DD] dark:border-[#2E2C26]">
          <button
            type="button"
            id="mode-trace-the-sky-btn"
            onClick={() => setMode('trace')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
              mode === 'trace'
                ? 'bg-[#FFFFFF] dark:bg-[#282620] text-[#20201D] dark:text-[#F2EFE9] shadow-2xs font-semibold'
                : 'text-[#757469] dark:text-[#A6A498] hover:text-[#20201D] dark:hover:text-[#EDEAE2]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Trace the Sky</span>
          </button>

          <button
            type="button"
            id="mode-free-sky-btn"
            onClick={() => setMode('free')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
              mode === 'free'
                ? 'bg-[#FFFFFF] dark:bg-[#282620] text-[#20201D] dark:text-[#F2EFE9] shadow-2xs font-semibold'
                : 'text-[#757469] dark:text-[#A6A498] hover:text-[#20201D] dark:hover:text-[#EDEAE2]'
            }`}
          >
            <Feather className="w-3.5 h-3.5" />
            <span>Free Sky</span>
          </button>
        </div>

        {/* Mode Specific Controls */}
        {mode === 'trace' ? (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Constellation Picker Dropdown */}
            <div ref={selectorRef} className="relative">
              <button
                type="button"
                id="constellation-picker-btn"
                onClick={() => setIsSelectorOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#22211C] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#3A3A35] dark:text-[#EDEAE2] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
              >
                <span>{currentConstellation.name}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {isSelectorOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-64 max-h-72 overflow-y-auto rounded-xl border border-[#E6E4DD] dark:border-[#33312B] bg-[#FFFFFF] dark:bg-[#22211C] shadow-lg p-1.5 divide-y divide-[#E6E4DD]/50 dark:divide-[#2E2C26]">
                  {REAL_CONSTELLATIONS.map((c, idx) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectConstellation(idx)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer flex flex-col ${
                        idx === currentConstellationIndex
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-medium'
                          : 'text-[#3A3A35] dark:text-[#EDEAE2] hover:bg-[#FAF9F5] dark:hover:bg-[#2A2823]'
                      }`}
                    >
                      <span className="font-serif text-sm">{c.name}</span>
                      <span className="text-[11px] text-[#757469] dark:text-[#A6A498]">
                        {c.commonName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Subtle Hint Button */}
            {!isComplete && (
              <button
                type="button"
                id="constellation-hint-btn"
                onClick={handleTriggerHint}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FAF9F5] dark:bg-[#1D1C18] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#5A5A40] dark:text-[#D4D0C2] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                title="Gently illuminate the next untraced star thread"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Subtle Hint</span>
              </button>
            )}

            {/* Reset Threads Button */}
            {tracedLines.length > 0 && !isComplete && (
              <button
                type="button"
                onClick={handleResetCurrent}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FAF9F5] dark:bg-[#1D1C18] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#757469] dark:text-[#A6A498] text-xs font-medium transition-colors cursor-pointer"
                title="Reset threads on this constellation"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        ) : (
          /* Free Sky Mode Controls */
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFreeUndo}
              disabled={freeHistory.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#22211C] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#3A3A35] dark:text-[#EDEAE2] text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Undo last star or thread"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={handleFreeClear}
              disabled={freeStars.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#22211C] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#757469] hover:text-rose-700 dark:text-[#A6A498] dark:hover:text-rose-400 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Clear sky"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Sky</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Mode Sub-Bar / Instructions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#757469] dark:text-[#A6A498]">
        {mode === 'trace' ? (
          <>
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2] flex-shrink-0" />
              <span>
                Connect the dim stars to trace {currentConstellation.name}. Incorrect threads dissolve gently.
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#5A5A40] dark:text-[#D4D0C2]">
              {isComplete
                ? 'All threads traced'
                : `${tracedLines.length} of ${currentConstellation.lines.length} threads traced`}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2] flex-shrink-0" />
            <span>Tap anywhere to place stars, drag between them to weave threads. Free drawing without evaluation.</span>
          </div>
        )}
      </div>

      {/* 3. Interactive Sky Canvas */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden border border-[#2E3345] shadow-inner bg-[#0B0E14] touch-none select-none cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="block w-full"
        />

        {/* Free Sky Empty Placeholder */}
        {mode === 'free' && freeStars.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
            <Sparkles className="w-6 h-6 text-indigo-300/40 mb-2 animate-pulse" />
            <p className="font-serif italic text-sm text-indigo-200/50">
              The sky is clear and quiet. Tap anywhere to place your first star.
            </p>
          </div>
        )}

        {/* Trace Mode Active Completion Overlay Badge */}
        {mode === 'trace' && isComplete && (
          <div className="absolute top-3 left-3 bg-[#0B0E14]/80 backdrop-blur-sm border border-indigo-300/30 rounded-lg px-3 py-1.5 flex items-center gap-2 pointer-events-none">
            <Check className="w-3.5 h-3.5 text-indigo-300" />
            <span className="text-xs font-serif text-indigo-100">
              {currentConstellation.name} Complete
            </span>
          </div>
        )}
      </div>

      {/* 4. Lore & Completion Card (Guided Trace Mode) */}
      {mode === 'trace' && isComplete && (
        <div
          id="constellation-lore-card"
          className="p-5 sm:p-6 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/50 bg-[#F6F7FB] dark:bg-[#161824] shadow-xs animate-in fade-in duration-300 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 font-sans">
                  Celestial Lore
                </span>
              </div>
              <h4 className="font-serif text-xl font-medium text-[#20222D] dark:text-[#EDEAE2]">
                {currentConstellation.name}
                <span className="text-sm font-sans font-normal text-[#6B7280] dark:text-[#9CA3AF] ml-2">
                  ({currentConstellation.commonName})
                </span>
              </h4>
            </div>

            <button
              type="button"
              id="trace-another-btn"
              onClick={handleNextConstellation}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-[#FFFFFF] dark:bg-[#20222E] hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100 text-xs font-medium transition-all shadow-2xs cursor-pointer self-start sm:self-auto"
            >
              <span>Trace another constellation</span>
              <span>→</span>
            </button>
          </div>

          <div className="text-sm text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed font-serif">
            {isLoadingLore ? (
              <div className="flex items-center gap-2 text-xs font-sans text-indigo-600 dark:text-indigo-400 py-1">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Unfolding the story of {currentConstellation.name}...</span>
              </div>
            ) : (
              <p className="text-[#374151] dark:text-[#E5E7EB] leading-relaxed italic">
                "{lore || currentConstellation.handwrittenDescription}"
              </p>
            )}
          </div>

          {/* Quick Astronomical Context Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
            <span className="px-2.5 py-1 rounded-md bg-white/70 dark:bg-[#1E202E] border border-indigo-100 dark:border-indigo-900/30">
              {currentConstellation.season}
            </span>
            {currentConstellation.notableStars.length > 0 && (
              <span className="px-2.5 py-1 rounded-md bg-white/70 dark:bg-[#1E202E] border border-indigo-100 dark:border-indigo-900/30">
                Stars: {currentConstellation.notableStars.slice(0, 4).join(', ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

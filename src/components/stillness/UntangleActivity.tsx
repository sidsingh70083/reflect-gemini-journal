import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, CheckCircle2, Sliders, Info } from 'lucide-react';
import { ambientSound } from '../../lib/ambientSound';

interface NodePoint {
  id: string;
  x: number;
  y: number;
  label?: string;
}

interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

type Difficulty = 'gentle' | 'spacious' | 'deep';

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; nodeCount: number; chords: [number, number][] }> = {
  gentle: {
    label: 'Gentle (5)',
    nodeCount: 5,
    chords: [[0, 2]],
  },
  spacious: {
    label: 'Spacious (6)',
    nodeCount: 6,
    chords: [
      [0, 2],
      [2, 4],
    ],
  },
  deep: {
    label: 'Deep (8)',
    nodeCount: 8,
    chords: [
      [0, 2],
      [2, 4],
      [4, 6],
      [0, 4],
    ],
  },
};

// Line-segment intersection mathematics
function ccw(A: { x: number; y: number }, B: { x: number; y: number }, C: { x: number; y: number }): boolean {
  return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
}

function segmentsIntersect(
  A: { x: number; y: number },
  B: { x: number; y: number },
  C: { x: number; y: number },
  D: { x: number; y: number }
): boolean {
  return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
}

export const UntangleActivity: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [difficulty, setDifficulty] = useState<Difficulty>('gentle');
  const [dimensions, setDimensions] = useState({ width: 600, height: 420 });

  const [nodes, setNodes] = useState<NodePoint[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [crossedEdgeIds, setCrossedEdgeIds] = useState<Set<string>>(new Set());
  const [isUntangled, setIsUntangled] = useState(false);
  const wasUntangledRef = useRef(false);

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Update container dimensions
  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = Math.max(Math.floor(rect.width), 320);
    const h = Math.min(Math.max(Math.floor(rect.width * 0.65), 360), 480);
    setDimensions({ width: w, height: h });
  }, []);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  // Generate a solvable puzzle
  const generatePuzzle = useCallback(
    (diff: Difficulty = difficulty, width = dimensions.width, height = dimensions.height) => {
      const config = DIFFICULTY_CONFIG[diff];
      const N = config.nodeCount;

      // 1. Define edges based on planar cycle + non-crossing chords
      const newEdges: GraphEdge[] = [];
      wasUntangledRef.current = false;

      // Perimeter cycle (never intersects itself in circle)
      for (let i = 0; i < N; i++) {
        const next = (i + 1) % N;
        newEdges.push({
          id: `e_${i}_${next}`,
          sourceId: `n_${i}`,
          targetId: `n_${next}`,
        });
      }

      // Non-crossing chords
      config.chords.forEach(([from, to]) => {
        if (from < N && to < N) {
          newEdges.push({
            id: `e_${from}_${to}`,
            sourceId: `n_${from}`,
            targetId: `n_${to}`,
          });
        }
      });

      // 2. Scramble node positions within safe bounds
      const padX = 45;
      const padY = 45;
      const arenaW = width - padX * 2;
      const arenaH = height - padY * 2;

      let bestScramble: NodePoint[] = [];
      let bestCrossings = 0;

      // Try a few scrambles to ensure at least 2-4 lines cross initially
      for (let attempt = 0; attempt < 25; attempt++) {
        const candidateNodes: NodePoint[] = [];
        for (let i = 0; i < N; i++) {
          candidateNodes.push({
            id: `n_${i}`,
            x: padX + Math.random() * arenaW,
            y: padY + Math.random() * arenaH,
          });
        }

        // Test intersections in this candidate layout
        let crossings = 0;
        for (let i = 0; i < newEdges.length; i++) {
          for (let j = i + 1; j < newEdges.length; j++) {
            const e1 = newEdges[i];
            const e2 = newEdges[j];
            if (
              e1.sourceId === e2.sourceId ||
              e1.sourceId === e2.targetId ||
              e1.targetId === e2.sourceId ||
              e1.targetId === e2.targetId
            ) {
              continue;
            }
            const p1 = candidateNodes.find((n) => n.id === e1.sourceId)!;
            const p2 = candidateNodes.find((n) => n.id === e1.targetId)!;
            const p3 = candidateNodes.find((n) => n.id === e2.sourceId)!;
            const p4 = candidateNodes.find((n) => n.id === e2.targetId)!;
            if (segmentsIntersect(p1, p2, p3, p4)) {
              crossings++;
            }
          }
        }

        if (crossings >= 2) {
          bestScramble = candidateNodes;
          bestCrossings = crossings;
          break;
        } else if (crossings > bestCrossings) {
          bestScramble = candidateNodes;
          bestCrossings = crossings;
        }
      }

      // Fallback if bestCrossings was still low: swap random nodes
      if (bestScramble.length === 0) {
        bestScramble = [];
        for (let i = 0; i < N; i++) {
          bestScramble.push({
            id: `n_${i}`,
            x: padX + ((i * 137) % arenaW),
            y: padY + ((i * 193) % arenaH),
          });
        }
      }

      setEdges(newEdges);
      setNodes(bestScramble);
      setIsUntangled(false);
    },
    [difficulty, dimensions]
  );

  // Initialize on mount or when dimensions ready
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      generatePuzzle(difficulty, dimensions.width, dimensions.height);
    }
  }, [difficulty]);

  // Recalculate intersections whenever nodes change
  useEffect(() => {
    if (nodes.length === 0 || edges.length === 0) return;

    const nodeMap = new Map<string, NodePoint>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    const crossed = new Set<string>();

    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const e1 = edges[i];
        const e2 = edges[j];

        // Shared vertices do not count as crossing
        if (
          e1.sourceId === e2.sourceId ||
          e1.sourceId === e2.targetId ||
          e1.targetId === e2.sourceId ||
          e1.targetId === e2.targetId
        ) {
          continue;
        }

        const p1 = nodeMap.get(e1.sourceId);
        const p2 = nodeMap.get(e1.targetId);
        const p3 = nodeMap.get(e2.sourceId);
        const p4 = nodeMap.get(e2.targetId);

        if (p1 && p2 && p3 && p4) {
          if (segmentsIntersect(p1, p2, p3, p4)) {
            crossed.add(e1.id);
            crossed.add(e2.id);
          }
        }
      }
    }

    setCrossedEdgeIds(crossed);

    if (crossed.size === 0 && edges.length > 0) {
      if (!wasUntangledRef.current) {
        wasUntangledRef.current = true;
        ambientSound.playCompletionSound('untangle');
      }
      setIsUntangled(true);
    } else {
      wasUntangledRef.current = false;
      setIsUntangled(false);
    }
  }, [nodes, edges]);

  // Handle pointer drag on a node
  const handlePointerDownNode = (
    e: React.PointerEvent<SVGCircleElement>,
    nodeId: string
  ) => {
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setDraggingNodeId(nodeId);
    dragOffsetRef.current = {
      x: e.clientX - node.x,
      y: e.clientY - node.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingNodeId || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    // Clamp coordinates safely within canvas
    const pad = 25;
    const clampedX = Math.max(pad, Math.min(dimensions.width - pad, rawX));
    const clampedY = Math.max(pad, Math.min(dimensions.height - pad, rawY));

    setNodes((prev) =>
      prev.map((n) => (n.id === draggingNodeId ? { ...n, x: clampedX, y: clampedY } : n))
    );
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
  };

  return (
    <div id="untangle-activity" className="space-y-4">
      {/* Header controls & difficulty */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#757469] dark:text-[#A6A498]">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#D4D0C2] flex-shrink-0" />
          <span>Drag nodes to reposition them until none of the threads cross each other.</span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {/* Difficulty selector */}
          <div className="flex items-center rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#22211C] p-0.5 shadow-2xs">
            {(['gentle', 'spacious', 'deep'] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDifficulty(d);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  difficulty === d
                    ? 'bg-[#EAE8E0] dark:bg-[#322F26] text-[#3A3A35] dark:text-[#EDEAE2] shadow-xs'
                    : 'text-[#757469] dark:text-[#A6A498] hover:text-[#3A3A35] dark:hover:text-[#EDEAE2]'
                }`}
              >
                {d === 'gentle' ? 'Gentle' : d === 'spacious' ? 'Spacious' : 'Deep'}
              </button>
            ))}
          </div>

          {/* New Tangle Button */}
          <button
            type="button"
            onClick={() => generatePuzzle(difficulty)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D5D2C7] dark:border-[#3E3C34] bg-[#FFFFFF] dark:bg-[#22211C] hover:bg-[#F4F1E8] dark:hover:bg-[#2E2C26] text-[#3A3A35] dark:text-[#EDEAE2] font-medium transition-colors cursor-pointer shadow-2xs active:scale-98"
            title="Generate a new tangle puzzle"
          >
            <RefreshCw className="w-3 h-3" />
            <span>New Tangle</span>
          </button>
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-2xl overflow-hidden border transition-colors duration-500 select-none touch-none ${
          isUntangled
            ? 'border-emerald-300 dark:border-emerald-800/80 bg-[#F4F9F5] dark:bg-[#141C18]'
            : 'border-[#E6E4DD] dark:border-[#2E2C26] bg-[#FAF9F5] dark:bg-[#1A1916]'
        }`}
        style={{ height: `${dimensions.height}px` }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full block"
        >
          {/* Connecting Edges */}
          {edges.map((edge) => {
            const p1 = nodes.find((n) => n.id === edge.sourceId);
            const p2 = nodes.find((n) => n.id === edge.targetId);
            if (!p1 || !p2) return null;

            const isCrossed = crossedEdgeIds.has(edge.id);

            return (
              <line
                key={edge.id}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={
                  isUntangled
                    ? '#059669' // Peaceful emerald when completed
                    : isCrossed
                    ? '#D97706' // Warm subtle amber when crossing
                    : '#78827B' // Cool serene sage when resolved
                }
                strokeWidth={isUntangled ? 2.2 : isCrossed ? 1.6 : 2.0}
                strokeOpacity={isUntangled ? 0.9 : isCrossed ? 0.65 : 0.85}
                strokeDasharray={isCrossed ? '3 3' : undefined}
                className="transition-all duration-300"
              />
            );
          })}

          {/* Draggable Nodes */}
          {nodes.map((node) => {
            const isDragging = node.id === draggingNodeId;

            return (
              <g key={node.id} className="cursor-grab active:cursor-grabbing">
                {/* Outer touch target and halo */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={22}
                  fill="transparent"
                  onPointerDown={(e) => handlePointerDownNode(e, node.id)}
                />

                {/* Outer gentle bloom ring */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isDragging ? 18 : 14}
                  fill={isUntangled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(90, 90, 64, 0.12)'}
                  className="transition-all duration-200 pointer-events-none"
                />

                {/* Solid Core Circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isDragging ? 10 : 8}
                  fill={
                    isUntangled
                      ? '#10B981'
                      : isDragging
                      ? '#4A4A38'
                      : '#6B6A5B'
                  }
                  stroke={isUntangled ? '#ECFDF5' : '#FFFFFF'}
                  strokeWidth={2}
                  className="transition-all duration-150 pointer-events-none drop-shadow-xs"
                />
              </g>
            );
          })}
        </svg>

        {/* Quiet Understated Completion Overlay */}
        {isUntangled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-emerald-950/10 backdrop-blur-[2px] animate-in fade-in duration-500 text-center px-4">
            <div className="p-4 rounded-2xl bg-[#FFFFFF]/90 dark:bg-[#1C2620]/90 border border-emerald-300 dark:border-emerald-700/60 shadow-sm max-w-xs space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-serif text-base font-medium">Untangled.</span>
              </div>
              <p className="text-xs font-serif italic text-[#55584A] dark:text-[#A7BAAE]">
                Every thread has found its clear space.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer subtle state indicator */}
      <div className="flex items-center justify-between text-xs text-[#858376] dark:text-[#8E8C7F] pt-1">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#78827B]" />
          <span>Clear threads</span>
          <span className="mx-1">·</span>
          <span className="inline-block w-2 h-2 rounded-full bg-[#D97706]" />
          <span>Crossed threads</span>
        </div>

        {isUntangled ? (
          <span className="text-emerald-700 dark:text-emerald-400 font-medium font-serif italic">
            Peaceful clarity reached
          </span>
        ) : (
          <span className="text-xs">
            {crossedEdgeIds.size > 0
              ? 'Repositioning nodes...'
              : 'Gently dragging...'}
          </span>
        )}
      </div>
    </div>
  );
};

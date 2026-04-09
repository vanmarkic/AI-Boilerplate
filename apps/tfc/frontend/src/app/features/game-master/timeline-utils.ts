import type { InjectSnapshot, DefectSnapshot } from '../../core/engine-api.service';

export interface TimelineItem {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
  lifecycle: string;
  kind: 'inject' | 'defect';
  lane: number;
}

export interface TimeScale {
  totalMs: number;
  pxPerMs: number;
}

/** Map an InjectSnapshot to a TimelineItem (lane assigned later). */
function injectToItem(e: InjectSnapshot, playTimeMs: number): TimelineItem {
  const startMs = e.started_at_pt_ms ?? e.scheduled_pt_ms;
  let endMs: number;
  if (e.completed_at_pt_ms != null) {
    endMs = e.completed_at_pt_ms;
  } else if (e.duration_ms != null) {
    endMs = startMs + e.duration_ms;
  } else {
    endMs = e.lifecycle === 'running' ? playTimeMs : startMs + 30_000;
  }
  return { id: e.id, label: e.title, startMs, endMs, lifecycle: e.lifecycle, kind: 'inject', lane: 0 };
}

/** Map a DefectSnapshot to a TimelineItem (lane assigned later). */
function defectToItem(i: DefectSnapshot, playTimeMs: number): TimelineItem | null {
  if (i.activated_at_pt_ms == null) return null;
  const startMs = i.activated_at_pt_ms;
  let endMs: number;
  if (i.resolved_at_pt_ms != null) {
    endMs = i.resolved_at_pt_ms;
  } else if (i.auto_resolve_pt_ms > 0) {
    endMs = startMs + i.auto_resolve_pt_ms;
  } else {
    endMs = i.lifecycle === 'active' || i.lifecycle === 'mitigated' ? playTimeMs : startMs + 30_000;
  }
  return { id: i.id, label: i.title, startMs, endMs, lifecycle: i.lifecycle, kind: 'defect', lane: 0 };
}

/** Greedily assign lanes so overlapping items stack vertically. */
export function assignLanes(items: TimelineItem[]): TimelineItem[] {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs);
  const laneEnds: number[] = [];
  return sorted.map((item) => {
    let assigned = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= item.startMs) {
        assigned = i;
        break;
      }
    }
    if (assigned === -1) {
      assigned = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[assigned] = item.endMs;
    return { ...item, lane: assigned };
  });
}

/** Convert snapshots into positioned timeline items. */
export function computeTimelineItems(
  injects: InjectSnapshot[],
  defects: DefectSnapshot[],
  playTimeMs: number,
): { injectItems: TimelineItem[]; defectItems: TimelineItem[] } {
  const rawInjects = injects.map((e) => injectToItem(e, playTimeMs));
  const rawDefects = defects.map((i) => defectToItem(i, playTimeMs)).filter(Boolean) as TimelineItem[];
  return {
    injectItems: assignLanes(rawInjects),
    defectItems: assignLanes(rawDefects),
  };
}

/** Compute the time scale for a given set of items and container width. */
export function computeTimeScale(
  items: TimelineItem[],
  playTimeMs: number,
  containerWidthPx: number,
): TimeScale {
  if (items.length === 0) {
    return { totalMs: Math.max(playTimeMs, 60_000), pxPerMs: containerWidthPx / Math.max(playTimeMs, 60_000) };
  }
  const maxEnd = Math.max(...items.map((i) => i.endMs), playTimeMs);
  const totalMs = maxEnd * 1.1;
  return { totalMs, pxPerMs: containerWidthPx / totalMs };
}

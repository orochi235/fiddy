import { type Frame, forward, level, pitch, roll, tidy, yaw } from '../frame.js';
import type { Bud, TreeNode } from '../skeleton.js';
import type { Module } from './types.js';

export interface TurtleOptions {
  /** δ, in radians. */
  delta: number;
  step: number;
  /** Radius the turtle starts at. */
  width: number;
  /** What `!` multiplies the radius by. */
  thin: number;
  /** The stage id written on every node. */
  stage: string;
  /** Throws past this many nodes. */
  cap: number;
  /** Written on every node as `bud`, when the stage derives a string per bud. */
  bud?: number;
}

interface State {
  frame: Frame;
  /** The node the next segment hangs from. */
  at: number;
  order: number;
  width: number;
  /** Arc length from where the stage began. */
  dist: number;
}

const RAD = Math.PI / 180;

/** How often a long run of turns re-orthonormalizes the frame. */
const TIDY_EVERY = 64;

/**
 * Walks `modules` from `bud`, appending a node to `nodes` for each `F`, with ids continuing from
 * `nodes.length`. Returns a bud at each node it made that ends a branch.
 */
export function interpret(modules: readonly Module[], bud: Bud, nodes: TreeNode[], o: TurtleOptions): Bud[] {
  const firstNew = nodes.length;
  const frames = new Map<number, { frame: Frame; order: number }>();
  const hasChild = new Set<number>();
  const stack: State[] = [];
  let s: State = { frame: bud.frame, at: bud.node, order: bud.order, width: o.width, dist: 0 };
  let turns = 0;

  const place = (parent: number | null, module: number) => {
    const id = nodes.length;
    if (id - firstNew >= o.cap) throw new Error(`the turtle passed ${o.cap.toLocaleString('en-US')} nodes`);
    const node: TreeNode = { id, parent, pos: s.frame.pos, radius: s.width, order: s.order, stage: o.stage, born: s.dist, module };
    if (o.bud !== undefined) node.bud = o.bud;
    nodes.push(node);
    if (parent !== null) hasChild.add(parent);
    frames.set(id, { frame: s.frame, order: s.order });
    s = { ...s, at: id };
  };

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!;
    // A parameter sets the step (as a multiple of `step`), the angle in degrees, or the width.
    const p = m.params?.[0];
    const turn = p === undefined ? o.delta : p * RAD;
    switch (m.symbol) {
      case 'F': {
        const step = p === undefined ? o.step : p * o.step;
        s = { ...s, frame: forward(s.frame, step), dist: s.dist + step };
        place(s.at, i);
        break;
      }
      case 'f': {
        // An anchor with no parent, so no segment is drawn into it; the next F draws from here.
        const step = p === undefined ? o.step : p * o.step;
        s = { ...s, frame: forward(s.frame, step), dist: s.dist + step };
        place(null, i);
        break;
      }
      case '+': s = { ...s, frame: yaw(s.frame, turn) }; turns++; break;
      case '-': s = { ...s, frame: yaw(s.frame, -turn) }; turns++; break;
      case '&': s = { ...s, frame: pitch(s.frame, turn) }; turns++; break;
      case '^': s = { ...s, frame: pitch(s.frame, -turn) }; turns++; break;
      case '\\': s = { ...s, frame: roll(s.frame, turn) }; turns++; break;
      case '/': s = { ...s, frame: roll(s.frame, -turn) }; turns++; break;
      case '|': s = { ...s, frame: yaw(s.frame, Math.PI) }; break;
      case '$': s = { ...s, frame: level(s.frame) }; break;
      case '!': s = { ...s, width: p === undefined ? s.width * o.thin : p * o.width }; break;
      case '[': stack.push(s); s = { ...s, order: s.order + 1 }; break;
      case ']': s = stack.pop() ?? s; break;
    }
    if (turns >= TIDY_EVERY) {
      s = { ...s, frame: tidy(s.frame) };
      turns = 0;
    }
  }

  const buds: Bud[] = [];
  for (let id = firstNew; id < nodes.length; id++) {
    if (hasChild.has(id)) continue;
    const f = frames.get(id)!;
    buds.push({ node: id, frame: f.frame, order: f.order, vigor: 1 });
  }
  return buds;
}

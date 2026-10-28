import type { Expr } from './expr.js';

/** One symbol of an L-system string, with its parameters when it has any. */
export interface Module {
  symbol: string;
  params?: readonly number[];
}

/** A successor module as written: its parameters are expressions over the rule's formals. */
export interface ModuleTemplate {
  symbol: string;
  args?: readonly Expr[];
}

/** A module in a predecessor or a context: its symbol and the names its parameters bind to. */
export interface Pattern {
  symbol: string;
  params: readonly string[];
}

export interface Rule {
  pred: Pattern;
  /** Context-sensitive rules: the modules that must stand before and after the predecessor. A
   *  right context may hold brackets. */
  left?: readonly Pattern[];
  right?: readonly Pattern[];
  condition?: Expr;
  /** The successors one predecessor can rewrite to. With more than one, or any written
   *  probability, the rule is stochastic and every alternative carries `prob`; whatever they
   *  leave short of 1 is the chance the module stays as it is. */
  succ: { prob?: number; body: readonly ModuleTemplate[] }[];
  /** The rule's left side as written, for display. */
  lhs: string;
  /** Where the rule was first written, 1-based. */
  line: number;
}

export interface Grammar {
  axiom: Module[];
  /** By predecessor symbol, in the order written: the first whose context and condition hold
   *  rewrites a module. Lines with the same left side are one rule's alternatives. */
  rules: Record<string, Rule[]>;
  /** `#define name value` lines, which expressions read by name. */
  constants: Record<string, number>;
  /** `#ignore` symbols, which contexts skip over. */
  ignore: ReadonlySet<string>;
  /** `n = …` and `δ = …` lines, as ABOP prints them beside a grammar. δ is in degrees. */
  defines: { n?: number; delta?: number };
  /** Whether any rule draws from the random stream when it rewrites. */
  stochastic: boolean;
  /** Whether any rule has a context, so rewriting has to look at a module's neighbors. */
  contextual: boolean;
}

export class ParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly col: number,
  ) {
    super(`${line}:${col}: ${message}`);
    this.name = 'ParseError';
  }
}

export class ModuleCapError extends Error {
  constructor(
    readonly cap: number,
    readonly generation: number,
  ) {
    super(`generation ${generation} passes ${cap.toLocaleString('en-US')} modules`);
    this.name = 'ModuleCapError';
  }
}

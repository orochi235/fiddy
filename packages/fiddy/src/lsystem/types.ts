/** One symbol of an L-system string. Parametric modules (piece 4) will carry `params`. */
export interface Module {
  symbol: string;
}

/** A successor as written, before rewriting fills it in. Parametric templates (piece 4) will
 *  carry expressions here; for now it is the module itself. */
export type ModuleTemplate = Module;

export interface Rule {
  pred: { symbol: string; params?: string[] };
  /** Context-sensitive rules (piece 5). */
  left?: Module[];
  right?: Module[];
  /** Parametric conditions (piece 4). */
  condition?: string;
  /** More than one alternative makes the rule stochastic (piece 3). */
  succ: { prob?: number; body: ModuleTemplate[] }[];
  /** Where the rule was written, 1-based. */
  line: number;
}

export interface Grammar {
  axiom: Module[];
  /** By predecessor symbol. */
  rules: Record<string, Rule>;
  /** `n = …` and `δ = …` lines, as ABOP prints them beside a grammar. δ is in degrees. */
  defines: { n?: number; delta?: number };
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

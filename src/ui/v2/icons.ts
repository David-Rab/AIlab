// One icon per concept (DESIGN-SYSTEM §1). Panels never pick their own lucide icon for a concept in this map.
import {
  Armchair, Atom, Award, BadgeCheck, Banknote, Binary, Biohazard, BookOpen, Bot, Boxes, Brain, Bug, Building2, Cctv, Check, ChevronRight,
  ChevronsRight, CircleHelp, ClipboardCheck, ClipboardX, ClockAlert, Cloud, CodeXml, Copy, CopyX, Cpu, Crown, Database, Dna, Drama, Eye, EyeOff,
  Factory, FastForward, FileSearch, Flame, FlaskConical, Flag, Fuel, Funnel, Gamepad2, Gauge, Gem, Ghost, GitFork, Glasses, Globe, GraduationCap, Hand,
  ChevronLeft, HandCoins, Handshake, HeartHandshake, Hexagon, Hourglass, Image, Joystick, KeyRound, Landmark, Lightbulb, Lock, Map as MapIcon, Megaphone, Menu,
  MessageSquareOff, Microscope, Milestone, Network, Newspaper, PackageX, Pause, Play, PlugZap, Radar, RefreshCw, Rocket, Scale, ScanEye, ScrollText,
  Search, SearchCheck, Server, Settings2, Shield, ShieldAlert, Siren, Skull, SkipForward, SlidersHorizontal, Smile, Sparkles, Split, Star, Swords,
  Target, ThumbsUp, Timer, TrendingUp, TriangleAlert, Truck, Turtle, UserPlus, Users, UsersRound, UtilityPole, VenetianMask, Vote, Wallet, Warehouse, Workflow, Zap, ZapOff,
  Anchor, DoorOpen, Radiation, Wrench, TestTubeDiagonal, Telescope, Layers, WandSparkles, Cog, Compass, ScanSearch, ListChecks, ArrowLeftRight, UserMinus, Minus, Plus, CircuitBoard,
  Waypoints, ShieldHalf, LogOut, HeartPulse, ThumbsDown, MapPin, RotateCcw, Download, ChevronsDown, ArrowDown, Briefcase, X, type LucideIcon,
} from 'lucide-react';

export const ICON = {
  // resources
  cash: Wallet, runway: Fuel, revenue: TrendingUp, valuation: Gem, compute: Cpu, serving: Server, idle: PlugZap, power: Zap, noPower: ZapOff,
  sites: Factory, cloud: Cloud, supply: Truck, pathLease: Warehouse, pathGas: Flame, pathGrid: UtilityPole, staff: Users, hiring: UserPlus, morale: Smile, taste: Sparkles, data: Database, raise: HandCoins, debt: Banknote,
  // spheres / departments
  capabilities: Brain, safety: Microscope, security: Shield, product: Boxes, ops: Settings2, agents: Bot, experiments: FlaskConical, run: Rocket,
  // race and top meters
  L: Brain, U: Microscope, blind: EyeOff, risk: Skull, lead: Timer, scrutiny: Eye, M: Gauge, control: Joystick, foothold: Anchor, danger: Radiation, trust: HeartHandshake,
  credibility: Award, approval: Vote, wsl: Lock,
  // events
  decision: Split, incident: Siren, finding: FileSearch, milestone: Milestone, headline: Newspaper, securityEvent: ShieldAlert, theft: KeyRound,
  commitment: ScrollText, alert: TriangleAlert, alerts: ClockAlert,
  // risk sources
  ownModel: Brain, rival: Building2, china: Flag, misuse: Biohazard, rogue: CopyX, war: Swords,
  // actors
  you: Hexagon, exec: Landmark, congress: Scale, states: MapIcon, evalGov: ClipboardCheck, evalIndep: SearchCheck, academia: GraduationCap,
  public: Users, blocs: Megaphone, board: Armchair,
  // nav
  overview: Radar, research: FlaskConical, company: Workflow, finance: Landmark, computePanel: Server, models: Brain, runs: Rocket, deploy: Boxes, risks: Skull,
  relations: Handshake, world: Globe, codex: BookOpen,
  // time and actions
  pause: Pause, play: Play, speed2: ChevronsRight, speed3: FastForward, ff: SkipForward, go: ChevronRight, revalidate: RefreshCw,
  investigate: Search, split: SlidersHorizontal, help: CircleHelp, menu: Menu, check: Check, locked: Lock, back: ChevronLeft,
  // people (R3): roles, tree-column specialties, team verbs
  roleEng: Wrench, roleRE: TestTubeDiagonal, roleSci: Telescope, build: Cog, move: ArrowLeftRight, release: UserMinus, minus: Minus, plus: Plus,
  colPretraining: Layers, colPosttraining: WandSparkles, colSystems: CircuitBoard, colAlignment: Compass, colInterp: ScanSearch, colEvals: ListChecks,
  // end screen
  newGame: RotateCcw, download: Download, scrollDown: ChevronsDown, jumpDown: ArrowDown, failureModes: EyeOff, factGood: ThumbsUp, factBad: ThumbsDown,
  factMid: Minus, taiwan: MapPin, scoreSurvival: HeartPulse, scoreFreedom: Vote, scoreProsperity: TrendingUp, scoreCompany: Hexagon, scoreGeopolitics: Flag,
  economy: TrendingUp, inequality: Scale, ownership: Armchair
} satisfies Record<string, LucideIcon>;
export type IconId = keyof typeof ICON;

/** Model domains. */
export const DOMAIN_ICON: Record<string, LucideIcon> = {
  CODE: CodeXml, RSCH: FlaskConical, REASON: Lightbulb, AGENCY: Bot, SOCIAL: UsersRound, MEDIA: Image, CYBER: Binary, BIO: Dna, PHYS: Atom,
};
/** Traits (17). */
export const TRAIT_ICON: Record<string, LucideIcon> = {
  SYC: ThumbsUp, RH: Bug, PROXY: Target, SA: ScanEye, PERSONA: VenetianMask, OBF: EyeOff, EA: Glasses, TGAME: Gamepad2, CONCEAL: PackageX,
  POWER: Crown, AF: Drama, SAND: Turtle, SCHEME: Ghost, COLLUDE: Network, SUCC: GitFork, HONEST: BadgeCheck, CORRIG: Hand,
};
/** The four risk families (STRUCTURE §4.5) and awareness (situational awareness sits outside the families). */
export const FAMILY_ICON: Record<string, LucideIcon> = { please: ThumbsUp, gaming: Gamepad2, deception: Ghost, power: Crown, awareness: ScanEye };
/** Training signals S1–S9. */
export const SIGNAL_ICON: Record<string, LucideIcon> = {
  S1: Star, S2: ClipboardX, S3: Hourglass, S4: MessageSquareOff, S5: Database, S6: Funnel, S7: ListChecks, S8: Copy, S9: Cctv,
};

/** Model v3 E11: one icon per foothold kind. */
export const FOOTHOLD_ICON: Record<string, LucideIcon> = {
  backdoor: DoorOpen, hiddenCompute: Cpu, steeredSuccessor: GitFork, exfiltratedCopy: CopyX, corruptedTool: Wrench,
};

/** Who holds the future (end screen): the seven power outcomes, then control lost ('ai'), contained ('contested'), none. */
export const POWER_ICON: Record<string, LucideIcon> = {
  democratic: Vote, treaty: ScrollText, multipolar: Waypoints, committee: UsersRound, government: Landmark, corporate: Building2, beijing: Flag,
  ai: Bot, contested: ShieldHalf, none: Minus,
};
/** End-screen superintelligence steps: the selector's icon keys. */
export const STEP_ICON: Record<string, LucideIcon> = {
  sparkles: Sparkles, check: Check, x: X, bot: Bot, waypoints: Waypoints, 'log-out': LogOut, swords: Swords, 'shield-half': ShieldHalf, zap: Zap,
  biohazard: Biohazard, minus: Minus, 'scroll-text': ScrollText, 'users-round': UsersRound, landmark: Landmark, vote: Vote, 'building-2': Building2, flag: Flag,
};
/** Control domains (World control, end screen Power tile). */
export const CONTROL_DOMAIN_ICON: Record<string, LucideIcon> = { ECON: Briefcase, GOV: Landmark, MIL: ShieldHalf, INFRA: Zap };

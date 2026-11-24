import type { AnalysisLayerId, AnalysisTimeframe } from './analysis';

type Prompt = { id: string; label: string; purpose: string };
type LayerQuestions = { question?: Pick<Prompt, 'label' | 'purpose'>; purpose: string; prompts: readonly Prompt[] };

// The Weekly walkthrough supplies S1–S7. S8 uses the approved External Data list.
// Timeframe names and prices in the walkthrough were specific to the chart being read.
export const notebookQuestions: Record<AnalysisLayerId, LayerQuestions> = {
  S1: {
    question: {
      label: 'What are the swing points on the {timeframe}?',
      purpose: "Identify the important highs and lows that define the market's structure.",
    },
    purpose: 'Establish the structural framework and prevailing trend.',
    prompts: [
      { id: 'external', label: 'External', purpose: 'The high and low that frame the current {timeframe} leg, i.e. the extremes that produced a BOS.' },
      { id: 'internal', label: 'Internal', purpose: 'The microstructural swings inside the external leg.' },
    ],
  },
  S2: {
    purpose: 'Understand what has happened to market structure.',
    prompts: [
      { id: 'trend', label: 'From the last external BOS, what is the {timeframe} trend: bullish, bearish, transition or range?', purpose: 'Establish the prevailing trend from the last break of external structure.' },
      { id: 'breaks', label: 'Where are your BOS, iBOS and CHoCH, and which are internal and which external?', purpose: 'Distinguish moves inside the range from breaks of the swings that define it.' },
    ],
  },
  S3: {
    purpose: 'Locate price within the external and internal dealing ranges.',
    prompts: [
      { id: 'equilibrium', label: 'Where is EQ?', purpose: 'Mark the midpoint of the range so you can separate premium from discount.' },
      { id: 'location', label: 'Is price in premium or discount?', purpose: 'Identify which half of the external range price is trading in.' },
      { id: 'internal-location', label: 'And for the internal range, where does price sit?', purpose: 'Check whether the smaller range gives the same location as the external range.' },
    ],
  },
  S4: {
    purpose: 'Understand the quality of price delivery.',
    prompts: [
      { id: 'leg-types', label: 'In this range, which legs are impulses and which are corrections?', purpose: 'Identify which legs drove the move and which pulled back against it.' },
      { id: 'strength', label: 'Is the current leg strong or weak?', purpose: 'Judge whether price is delivering decisively or losing momentum.' },
      { id: 'retracements', label: 'How deep did the previous {timeframe} retracements go, as a % of their leg?', purpose: 'Use previous pullbacks as a comparison for the depth of the current retracement.' },
    ],
  },
  S5: {
    purpose: 'Establish potential destinations for price.',
    prompts: [
      { id: 'external-pools', label: 'Where are the external pools?', purpose: 'Mark liquidity outside the active range that could draw price.' },
      { id: 'internal-pools', label: 'What internal liquidity is there?', purpose: 'Mark the pools price might reach on its way through the range.' },
      { id: 'inducement', label: 'Where’s the inducement?', purpose: 'Identify the liquidity that may be taken before price reaches the area you are watching.' },
      { id: 'sweeps', label: 'What’s been swept and what’s still outstanding?', purpose: 'Separate liquidity that price has already taken from pools it can still target.' },
    ],
  },
  S6: {
    purpose: 'Identify where price could react.',
    prompts: [
      { id: 'unmitigated', label: 'Which FVGs, OBs and breakers are unmitigated?', purpose: 'Identify reaction zones that price has yet to revisit.' },
      { id: 'direction', label: 'Is each one bullish or bearish?', purpose: 'Identify the direction of the reaction you would look for at each zone.' },
      { id: 'equilibrium-side', label: 'Which side of EQ is it on?', purpose: 'Check whether each zone is in premium, in discount, or across the range midpoint.' },
      { id: 'used', label: 'Which are already used?', purpose: 'Separate zones that have already been tested from those still waiting for a first visit.' },
    ],
  },
  S7: {
    purpose: 'Understand range development and participation.',
    prompts: [
      { id: 'selling-climax', label: 'What is the SC?', purpose: 'Locate the selling climax that may anchor the lower boundary of the range.' },
      { id: 'events', label: 'What other events have printed?', purpose: 'Place observed events such as the automatic rally and secondary test in the order they occurred.' },
      { id: 'schematic', label: 'Is this accumulation, distribution or undetermined?', purpose: 'State what the observed range development supports so far.' },
      { id: 'confirmation', label: 'Is the schematic confirmed?', purpose: 'Separate a possible phase from one confirmed by later price and volume evidence.' },
    ],
  },
  S8: {
    purpose: 'Understand forces influencing the market.',
    prompts: [
      { id: 'factors', label: 'What external factors are currently relevant?', purpose: 'Identify the releases, events or flows that matter to this market.' },
      { id: 'changes', label: 'What has changed since the previous analysis?', purpose: 'Isolate new information that could alter the previous read.' },
      { id: 'participation', label: 'What does the data suggest about market participation?', purpose: 'Assess what the data says about who is taking part and whether their activity has changed.' },
      { id: 'narrative', label: 'How does it relate to our existing narrative?', purpose: 'Record whether the new evidence supports, challenges or leaves your prior read unchanged.' },
    ],
  },
};

export const formatNotebookText = (text: string, timeframe: string) => text.replaceAll('{timeframe}', timeframe);
export const NOTEBOOK_TIMEFRAME_LABELS: Record<AnalysisTimeframe, string> = { MONTHLY: 'Monthly', WEEKLY: 'Weekly', DAILY: 'Daily' };

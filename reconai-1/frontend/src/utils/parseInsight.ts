/*  utils/parseInsight.ts
    Robustly split LLM-generated insight Markdown into
    { metrics, summary, insights }                               */
export interface InsightParsed {
  metrics:   Record<string, string | number>;
  summary:   string;        // markdown text (paragraphs)
  insights:  string[];      // bullet points, plain text
}

/** regex helpers */
const FENCE_RX = /^-{3,}$/m;               // --- line
const YamlKV_RX = /^\s*([^:]+):\s*(.+)$/;  // key: value

export function parseInsightMarkdown(md: string): InsightParsed {
  /* ── 1. split on “## Key Metrics” and the YAML fence -------------- */
  const keyMetricsIdx = md.indexOf('## Key Metrics');
  if (keyMetricsIdx === -1) throw new Error('No “Key Metrics” section');

  const mdAfterHeader = md.slice(keyMetricsIdx + '## Key Metrics'.length);

  /** Expect something like:
      ---
      total: 123
      ---
   */
  const fence1 = mdAfterHeader.search(FENCE_RX);
  if (fence1 === -1) throw new Error('No opening --- fence');

  const restAfterFence1 = mdAfterHeader.slice(fence1).replace(FENCE_RX, '');
  const fence2Idx       = restAfterFence1.search(FENCE_RX);
  if (fence2Idx === -1) throw new Error('No closing --- fence');

  const yamlBlock = restAfterFence1.slice(0, fence2Idx).trim();
  const afterYaml = restAfterFence1.slice(fence2Idx).replace(FENCE_RX, '').trimStart();

  /* ── 2. parse YAML kv pairs --------------------------------------- */
  const metrics: Record<string, string | number> = {};
  yamlBlock.split(/\r?\n/).forEach(line => {
    const m = line.match(YamlKV_RX);
    if (m) {
      const key = m[1].trim();
      let val: string | number = m[2].trim();
      const num = Number(val.replace(/,/g, ''));
      if (!isNaN(num)) val = num;
      metrics[key] = val;
    }
  });

  /* ── 3. split remaining Markdown into summary & bullet list ------- */
  const execIdx = afterYaml.indexOf('## Executive Summary');
  const insightIdx = afterYaml.indexOf('## Actionable Insights');

  const summary = execIdx !== -1 && insightIdx !== -1
    ? afterYaml.slice(execIdx + '## Executive Summary'.length, insightIdx).trim()
    : '';

  const bulletsRaw = insightIdx !== -1
    ? afterYaml.slice(insightIdx + '## Actionable Insights'.length).trim()
    : '';

  const insights: string[] = bulletsRaw
    .split(/\r?\n/)
    .map(l => l.replace(/^[*-]\s*/, '').trim())
    .filter(Boolean);

  return { metrics, summary, insights };
}
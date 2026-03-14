/*  components/results/AISummaryBox.tsx  */
'use client';

import Image           from 'next/image';
import ReactMarkdown   from 'react-markdown';
import { parseInsightMarkdown } from '@/utils/parseInsight';

interface Props {
  markdown?: string;          // undefined ⇒ not yet requested
  isLoading: boolean;
  error?: string | null;
}

export default function AISummaryBox({ markdown, isLoading, error }: Props) {
  let metrics: Record<string, string | number> = {};
  let summary = '';
  let insights: string[] = [];

  if (markdown && !error) {
    try {
      const parsed = parseInsightMarkdown(markdown);
      metrics  = parsed.metrics ?? {};
      summary  = parsed.summary ?? '';
      insights = parsed.insights ?? [];
    } catch (e) {
      // fallback: treat whole markdown as free-form if parser fails
      console.warn('Insight-parse error → fallback to raw md', e);
    }
  }

  return (
    <aside className="border border-[#059DC0] bg-[#E0F7FA]
                       rounded-md p-6 w-full mt-12">
      {/* header row */}
      <div className="flex items-center mb-4">
        <Image
          src="/assets/summary-vector.png"
          alt="AI icon"
          width={48}
          height={48}
          className="mr-3"
        />
        <h2 className="text-xl font-bold text-[#047299]">AI&nbsp;Insights</h2>
      </div>

      {/* states */}
      {isLoading && (
        <p className="text-sm text-gray-600">Generating insights…</p>
      )}

      {error && (
        <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
      )}

      {markdown && !isLoading && !error && (
        <div className="space-y-6">
          {/* Key Metrics */}
          {Object.keys(metrics).length > 0 && (
            <section>
              <h3 className="font-semibold mb-2">Key Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(metrics).map(([k, v]) => (
                  <div key={k}
                       className="bg-white rounded border border-gray-300
                                  text-center px-2 py-1">
                    <p className="text-xs text-gray-600 capitalize">{k.replace(/_/g,' ')}</p>
                    <p className="font-semibold text-sm">{v}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Executive Summary */}
          {summary && (
            <section>
              <h3 className="font-semibold mb-2">Executive&nbsp;Summary</h3>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>
                  {summary}
                </ReactMarkdown>
              </div>
            </section>
          )}

          {/* Actionable Insights */}
          {insights.length > 0 && (
            <section>
              <h3 className="font-semibold mb-2">Actionable&nbsp;Insights</h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                {insights.map((txt, i) => (
                  <li key={i}>{txt}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface Point { week: string; count: number }

export default function RunsPerWeek({ data }: { data: Point[] }) {
  return (
    <div className="w-full h-56">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="week" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" strokeWidth={2}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

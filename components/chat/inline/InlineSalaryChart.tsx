"use client";

interface SalaryData {
  role: string;
  level: string;
  location: string;
  p25: number;
  p50: number;
  p75: number;
  currency?: string;
  note?: string;
}

interface InlineSalaryChartProps {
  data: SalaryData;
}

function formatK(n: number): string {
  return `$${Math.round(n / 1000)}k`;
}

export function InlineSalaryChart({ data }: InlineSalaryChartProps) {
  const max = data.p75 * 1.1;

  const bars = [
    { label: "25th %ile", value: data.p25, color: "bg-amber-200" },
    { label: "Median", value: data.p50, color: "bg-amber-500" },
    { label: "75th %ile", value: data.p75, color: "bg-amber-700" },
  ];

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-4 my-2 max-w-xs">
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-900">
          {data.level} {data.role}
        </p>
        <p className="text-xs text-gray-500">{data.location}</p>
      </div>

      <div className="flex flex-col gap-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16 flex-shrink-0">
              {bar.label}
            </span>
            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${bar.color} rounded-full`}
                style={{ width: `${(bar.value / max) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-900 w-10 text-right flex-shrink-0">
              {formatK(bar.value)}
            </span>
          </div>
        ))}
      </div>

      {data.note && (
        <p className="text-xs text-gray-400 mt-3 leading-relaxed">{data.note}</p>
      )}
    </div>
  );
}

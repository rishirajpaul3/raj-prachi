"use client";

interface InlineJobCardProps {
  title: string;
  companyName: string;
  location?: string;
  salary?: string;
  skills?: string[];
  rajReason?: string;
  roleId?: string;
}

export function InlineJobCard({
  title,
  companyName,
  location,
  salary,
  skills,
  rajReason,
  roleId,
}: InlineJobCardProps) {
  return (
    <div className="bg-white border border-amber-200 rounded-xl p-4 my-2 max-w-xs">
      <p className="font-semibold text-gray-900 text-sm">{title}</p>
      <p className="text-xs text-amber-700 mb-2">{companyName}</p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {location && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            📍 {location}
          </span>
        )}
        {salary && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            💰 {salary}
          </span>
        )}
      </div>

      {skills && skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {skills.slice(0, 3).map((s) => (
            <span
              key={s}
              className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {rajReason && (
        <p className="text-xs italic text-amber-600 mt-1 leading-relaxed">
          &ldquo;{rajReason}&rdquo;
        </p>
      )}

      {roleId && (
        <a
          href="/jobs"
          className="mt-3 block text-center text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg py-1.5 transition-colors"
        >
          See in Jobs →
        </a>
      )}
    </div>
  );
}

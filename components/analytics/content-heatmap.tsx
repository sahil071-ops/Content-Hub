'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface HeatmapProps {
  products: string[];
  contentTypes: string[];
  // map of product -> contentType -> count
  matrix: Record<string, Record<string, number>>;
}

export function ContentHeatmap({ products, contentTypes, matrix }: HeatmapProps) {
  const router = useRouter();

  function handleCellClick(product: string, type: string, count: number) {
    if (count === 0) return; // Gaps are not clickable (nothing to show)
    const params = new URLSearchParams({ product, type });
    router.push(`/library?${params.toString()}`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full min-w-max">
        <thead>
          <tr>
            <th className="text-left pr-3 pb-2 font-medium text-muted-foreground w-32 min-w-32">Product</th>
            {contentTypes.map((t) => (
              <th key={t} className="pb-2 font-medium text-muted-foreground text-center px-1 min-w-16">
                <span className="block" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 64 }}>
                  {t}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product} className="border-t border-border/50">
              <td className="pr-3 py-1 font-medium truncate max-w-32">{product}</td>
              {contentTypes.map((type) => {
                const count = matrix[product]?.[type] ?? 0;
                return (
                  <td key={type} className="py-1 px-1 text-center">
                    <button
                      onClick={() => handleCellClick(product, type, count)}
                      className={cn(
                        'w-10 h-8 rounded text-xs font-medium transition-transform hover:scale-110',
                        count === 0
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 cursor-default'
                          : count >= 5
                            ? 'bg-[#2323A3] text-white cursor-pointer'
                            : count >= 2
                              ? 'bg-blue-300 dark:bg-blue-600 text-white cursor-pointer'
                              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 cursor-pointer'
                      )}
                      title={count === 0 ? `Gap: no ${type} for ${product}` : `${count} items`}
                    >
                      {count === 0 ? '—' : count}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 inline-block" /> Gap (0)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/40 inline-block" /> 1</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-300 dark:bg-blue-600 inline-block" /> 2–4</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#2323A3] inline-block" /> 5+</span>
      </div>
    </div>
  );
}

interface EarningsWidgetProps {
  today?: number;
  week?: number;
  allTime?: number;
}

export default function EarningsWidget({ today = 0, week = 0, allTime = 0 }: EarningsWidgetProps) {
  const periods = [
    { label: 'Today', value: today },
    { label: 'This Week', value: week },
    { label: 'All Time', value: allTime },
  ];

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Earnings</h3>
      <div className="grid grid-cols-3 gap-4">
        {periods.map((p) => (
          <div key={p.label} className="text-center">
            <p className="text-2xl font-bold text-cyan-400">
              {p.value.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">{p.label}</p>
            <p className="text-[10px] text-slate-600">FUS</p>
          </div>
        ))}
      </div>
    </div>
  );
}

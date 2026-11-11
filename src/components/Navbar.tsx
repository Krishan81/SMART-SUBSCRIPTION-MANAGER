type Props = { mockMode?: boolean };

export default function Navbar({ mockMode = false }: Props) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            S
          </div>
          <span className="font-semibold text-slate-900">
            Smart Subscription Manager
          </span>
        </div>
        {mockMode && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            Demo data
          </span>
        )}
      </div>
    </header>
  );
}

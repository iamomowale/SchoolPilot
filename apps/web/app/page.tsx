export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-sky-600">
          SchoolPilot
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Welcome to your monorepo starter</h1>
        <p className="mt-3 text-base text-slate-600">
          The web app is ready for the next phase of SchoolPilot development.
        </p>
      </div>
    </main>
  );
}

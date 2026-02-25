import Link from "next/link";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; ssn?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 md:py-14">
      <div className="panel border-slate-200 bg-gradient-to-b from-white via-slate-50/70 to-white">
        <p className="mb-2 inline-flex rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Order placed
        </p>
        <h1 className="mb-3 text-3xl font-bold">Mock confirmation</h1>
        <div className="mb-6 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 md:grid-cols-2">
          <p>Order ID: {params.orderId ?? "N/A"}</p>
          <p>SSN: {params.ssn ?? "N/A"}</p>
        </div>
        <p className="mb-6 text-slate-600">
          This is a local-only prototype confirmation. No backend call has been made.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="button-primary">
            Back to landing
          </Link>
          <Link href="/flow?mode=start" className="button-secondary">
            Start new flow
          </Link>
        </div>
      </div>
    </main>
  );
}

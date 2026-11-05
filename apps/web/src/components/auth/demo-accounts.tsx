"use client";

// Shown only when NEXT_PUBLIC_DEMO_MODE=true, so a real deployment never advertises logins.
const DEMO_PASSWORD = "MedCoreDev2026!";

const ACCOUNTS = [
  { role: "Receptionist", email: "reception@medcore.test" },
  { role: "Doctor", email: "doctor@medcore.test" },
  { role: "Nurse", email: "nurse@medcore.test" },
  { role: "Pharmacist", email: "pharmacist@medcore.test" },
  { role: "Accountant", email: "accountant@medcore.test" },
  { role: "Hospital admin", email: "admin@medcore.test" },
];

export function DemoAccounts({
  onPick,
}: {
  onPick: (email: string, password: string) => void;
}) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Try the demo as
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onPick(account.email, DEMO_PASSWORD)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-red-300 hover:text-red-700"
          >
            {account.role}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Fills in the form. Every demo account uses the same password.
      </p>
    </div>
  );
}

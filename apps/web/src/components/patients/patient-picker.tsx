"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";

export type PatientOption = {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
};

type PatientPickerProps<T extends PatientOption> = {
  hospitalId: string;
  value: T | null;
  onChange: (patient: T | null) => void;
  /** Defaults to the full patient search. Billing passes its own identity-only search. */
  searchPath?: (term: string) => string;
};

export function PatientPicker<T extends PatientOption>({
  hospitalId,
  value,
  onChange,
  searchPath = (term) =>
    `/hospitals/${hospitalId}/patients?limit=8&q=${encodeURIComponent(term)}`,
}: PatientPickerProps<T>) {
  const { authRequest } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setIsSearching(true);
      authRequest<{ items: T[] }>(searchPath(term))
        .then((data) => !cancelled && setResults(data.items))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setIsSearching(false));
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // searchPath is usually an inline function, so it is left out to avoid refetching every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, hospitalId, authRequest]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {value.firstName} {value.lastName}
          </p>
          <p className="font-mono text-xs text-slate-500">
            {value.patientNumber}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Change patient"
          className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute left-4 top-3.5 text-slate-400"
      />
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search patient by name, number or phone"
        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
      />

      {search.trim().length >= 2 && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {isSearching && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              No patients found
            </p>
          ) : (
            results.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => {
                  onChange(patient);
                  setSearch("");
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="text-sm text-slate-900">
                  {patient.firstName} {patient.lastName}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {patient.patientNumber}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

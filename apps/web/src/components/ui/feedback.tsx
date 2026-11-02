type FeedbackProps = {
  title: string;
  message: string;
};

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function ErrorState({ title, message }: FeedbackProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <h3 className="font-semibold text-red-800">{title}</h3>
      <p className="mt-2 text-sm text-red-700">{message}</p>
    </div>
  );
}

export function EmptyState({ title, message }: FeedbackProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
    </div>
  );
}

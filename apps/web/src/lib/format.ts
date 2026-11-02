export function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function calculateAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const birthdayPassed =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());

  if (!birthdayPassed) age -= 1;
  return age;
}

export function humanize(value?: string | null) {
  if (!value) return "Not recorded";
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Form inputs send "" for empty fields, but the API validators reject "".
export function stripEmpty<T extends Record<string, unknown>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => !(typeof value === "string" && value.trim() === ""),
    ),
  ) as Partial<T>;
}

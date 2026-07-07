import type { ValidationErrorItem } from "@/lib/api-errors";
import { fieldLabel } from "@/lib/api-errors";

interface ApiErrorAlertProps {
  error?: string;
  validationErrors?: ValidationErrorItem[];
}

export default function ApiErrorAlert({ error, validationErrors }: ApiErrorAlertProps) {
  if (!error && !validationErrors?.length) return null;

  return (
    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
      {error && <p className="font-medium">{error}</p>}
      {validationErrors && validationErrors.length > 0 && (
        <ul className={`list-inside list-disc space-y-1 ${error ? "mt-2" : ""}`}>
          {validationErrors.map((item) => (
            <li key={`${item.field}-${item.message}`}>
              <span className="font-medium">{fieldLabel(item.field)}:</span> {item.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

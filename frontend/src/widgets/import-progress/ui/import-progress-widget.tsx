import { ImportDetails, ImportProgress } from "@/entities/import";
import { Panel, Progress } from "@/shared/ui";

type ImportProgressWidgetProps = {
  progress: ImportProgress | null;
  details: ImportDetails | null;
};

export const ImportProgressWidget = ({ progress, details }: ImportProgressWidgetProps) => {
  const totalRows = details?.totalRows ?? 0;
  const processedRows = details?.processedRows ?? 0;
  const progressValue = totalRows > 0 ? Math.min(100, (processedRows / totalRows) * 100) : 0;

  return (
    <Panel className="min-h-44 bg-amber-300" contentClassName="py-6">
      <Progress value={progressValue} label={progress?.status ?? "queued"} />
      <p className="mt-3 text-sm text-slate-800">
        bytes: {progress?.processedBytes ?? 0} | valid: {progress?.validRows ?? 0} | invalid:{" "}
        {progress?.invalidRows ?? 0}
      </p>
    </Panel>
  );
};

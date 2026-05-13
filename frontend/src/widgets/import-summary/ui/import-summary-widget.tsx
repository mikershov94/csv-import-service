import { ImportDetails } from "@/entities/import";
import { Panel } from "@/shared/ui";

type ImportSummaryWidgetProps = {
  details: ImportDetails | null;
};

export const ImportSummaryWidget = ({ details }: ImportSummaryWidgetProps) => {
  return (
    <Panel className="min-h-44 bg-emerald-300">
      <div className="text-sm text-slate-900">
        <p>status: {details?.status ?? "n/a"}</p>
        <p>total: {details?.totalRows ?? 0}</p>
        <p>valid: {details?.successRows ?? 0}</p>
        <p>invalid: {details?.failedRows ?? 0}</p>
      </div>
    </Panel>
  );
};

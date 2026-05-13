import { ImportDetails } from "@/entities/import";
import { Panel } from "@/shared/ui";

type ImportSummaryWidgetProps = {
  details: ImportDetails | null;
};

export const ImportSummaryWidget = ({ details }: ImportSummaryWidgetProps) => {
  return (
    <Panel className="min-h-44 bg-emerald-300">
      <div className="text-sm text-slate-900">
        <p>статус: {details?.status ?? "нет данных"}</p>
        <p>всего строк: {details?.totalRows ?? 0}</p>
        <p>валидных: {details?.successRows ?? 0}</p>
        <p>невалидных: {details?.failedRows ?? 0}</p>
      </div>
    </Panel>
  );
};

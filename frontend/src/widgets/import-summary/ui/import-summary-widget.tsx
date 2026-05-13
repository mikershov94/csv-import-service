import { ImportDetails } from "@/entities/import";
import { Panel } from "@/shared/ui";

type ImportSummaryWidgetProps = {
  details: ImportDetails | null;
};

export const ImportSummaryWidget = ({ details }: ImportSummaryWidgetProps) => {
  const topErrors = (details?.topErrors ?? []).slice(0, 10);

  return (
    <Panel className="min-h-44 bg-emerald-300">
      <div className="text-sm text-slate-900">
        <p>статус: {details?.status ?? "нет данных"}</p>
        <p>всего строк: {details?.totalRows ?? 0}</p>
        <p>валидных: {details?.successRows ?? 0}</p>
        <p>невалидных: {details?.failedRows ?? 0}</p>
        <p className="mt-2 font-medium">Топ-10 ошибок:</p>
        {topErrors.length === 0 ? (
          <p>Нет ошибок</p>
        ) : (
          topErrors.map((errorItem) => (
            <p key={`${errorItem.code}-${errorItem.message}`}>
              {errorItem.code}: {errorItem.message} ({errorItem.count})
            </p>
          ))
        )}
      </div>
    </Panel>
  );
};

import { RecentImports } from "@/entities/import";
import { Panel } from "@/shared/ui";

type ImportHistoryWidgetProps = {
  history: RecentImports;
};

export const ImportHistoryWidget = ({ history }: ImportHistoryWidgetProps) => {
  return (
    <Panel className="min-h-56 bg-sky-300">
      <div className="text-sm text-slate-900">
        <p className="mb-2 font-medium">Последние 20 импортов</p>
        {history.items.length === 0 ? (
          <p>Нет данных</p>
        ) : (
          history.items.slice(0, 20).map((item) => (
            <p key={item.jobId}>
              {item.createdAt} | {item.status} | {item.fileName}
            </p>
          ))
        )}
      </div>
    </Panel>
  );
};

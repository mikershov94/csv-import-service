import { UploadCsvForm } from '@/features/upload-csv';
import { Panel } from '@/shared/ui';

type UploadZoneWidgetProps = {
  onImportCreated?: (jobId: string) => void;
};

export const UploadZoneWidget = ({ onImportCreated }: UploadZoneWidgetProps) => {
  return (
    <Panel className="bg-rose-300">
      <UploadCsvForm onImportCreated={onImportCreated} />
    </Panel>
  );
};

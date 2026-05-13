import { UploadCsvForm } from '@/features/upload-csv';
import { Panel } from '@/shared/ui';

type UploadZoneWidgetProps = {
  onStartImport?: (file: File) => void;
};

export const UploadZoneWidget = ({ onStartImport }: UploadZoneWidgetProps) => {
  return (
    <Panel className="bg-rose-300">
      <UploadCsvForm onStartImport={onStartImport} />
    </Panel>
  );
};

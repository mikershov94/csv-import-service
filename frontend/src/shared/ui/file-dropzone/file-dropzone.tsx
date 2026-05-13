import { ChangeEventHandler } from "react";

import { Button } from "@/shared/ui/button";
import { FileInput } from "@/shared/ui/file-input";
import { Label } from "@/shared/ui/label";
import { Panel } from "@/shared/ui/panel";

type FileDropzoneProps = {
  inputId: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  className?: string;
};

export const FileDropzone = ({ inputId, onChange, className }: FileDropzoneProps) => {
  return (
    <Panel className={className}>
      <div className="flex min-h-32 flex-col items-start justify-center gap-3">
        <Label htmlFor={inputId}>Select CSV file</Label>
        <FileInput id={inputId} onChange={onChange} />
        <Button type="button" variant="secondary">
          Browse
        </Button>
      </div>
    </Panel>
  );
};

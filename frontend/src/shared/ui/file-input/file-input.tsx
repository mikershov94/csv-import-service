import { ChangeEventHandler } from "react";

import { Input } from "@/shared/ui/input";

type FileInputProps = {
  id: string;
  accept?: string;
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  className?: string;
};

export const FileInput = ({ id, accept = ".csv,text/csv", disabled, onChange, className }: FileInputProps) => {
  return (
    <Input
      id={id}
      type="file"
      accept={accept}
      disabled={disabled}
      onChange={onChange}
      className={className}
    />
  );
};

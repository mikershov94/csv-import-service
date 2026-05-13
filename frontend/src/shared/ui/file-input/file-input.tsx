import { ChangeEventHandler } from "react";

import { Input } from "@/shared/ui/input";

type FileInputProps = {
  id: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  className?: string;
};

export const FileInput = ({ id, onChange, className }: FileInputProps) => {
  return (
    <Input
      id={id}
      type="file"
      accept=".csv,text/csv"
      onChange={onChange}
      className={className}
    />
  );
};

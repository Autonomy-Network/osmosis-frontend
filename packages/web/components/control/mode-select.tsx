import React, { FunctionComponent } from "react";
import { IconDropdown } from "./icon-dropdown/icon-dropdown";

export type ModSelectProps = {
  selectedMod: string;
  onChange: any;
};

const options = [
  {
    value: "Swap",
    display: "Swap",
  },
  {
    value: "Limit",
    display: "Limit",
  },
  {
    value: "StopLoss",
    display: "Stop",
  },
];

export const ModSelect: FunctionComponent<ModSelectProps> = ({
  selectedMod,
  onChange,
}: ModSelectProps) => {
  const currentOption = options.find((option) => option.value === selectedMod);
  return (
    <IconDropdown
      onSelect={onChange}
      options={options.filter((option) => option.value !== selectedMod)}
      currentOption={currentOption ?? options[0]}
      title={"Type"}
    />
  );
};

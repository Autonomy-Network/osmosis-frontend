import Image from "next/image";
import { FunctionComponent } from "react";
import classNames from "classnames";
import { InputProps, Disableable, CustomClasses } from "../types";

interface Props extends InputProps<string>, Disableable, CustomClasses {
  state?: "error";
}

export const SearchBox: FunctionComponent<Props> = ({
  currentValue,
  onChange,
  placeholder,
  state = "enabled",
  disabled = false,
  className,
}) => (
  <div
    className={classNames(
      "flex flex-nowrap gap-3 justify-between w-max h-8 rounded-xl pr-1 pl-2 text-white-high border text-sm border-secondary-200",
      {
        "border-missionError": state === "error",
        "opacity-50": disabled,
      },
      className
    )}
  >
    <div className="shrink-0 my-auto">
      <Image
        alt="search"
        src="/icons/search-hollow.svg"
        height={14}
        width={14}
      />
    </div>
    <label className="grow shrink h-full" htmlFor="text-search">
      <input
        id="text-search"
        className="h-full appearance-none bg-transparent"
        value={currentValue}
        placeholder={placeholder}
        autoComplete="off"
        onInput={(e: any) => onChange(e.target.value)}
        onClick={(e: any) => e.target.select()}
        disabled={disabled}
      />
    </label>
  </div>
);

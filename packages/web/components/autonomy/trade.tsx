import { FunctionComponent, useEffect, useRef, useState, useMemo } from "react";
import { WalletStatus } from "@keplr-wallet/stores";
import { Currency } from "@keplr-wallet/types";
import { CoinPretty, Dec, DecUtils } from "@keplr-wallet/unit";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Pool } from "@osmosis-labs/pools";
import { Buffer } from "buffer";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import Image from "next/image";
import { EventName } from "../../config";
import { REGISTRY_ADDRESSES, WRAPPER_ADDRESSES } from "../../config";
import {
  useBooleanWithWindowEvent,
  useOrderTokenInConfig,
  useSlippageConfig,
  useTokenSwapQueryParams,
  useWindowSize,
  useAmplitudeAnalytics,
} from "../../hooks";
import { useStore } from "../../stores";
import { BorderButton, Button } from "../buttons";
import { TokenSelect } from "../control/token-select";
import { InputBox } from "../input";
import { InfoTooltip } from "../tooltip";
import { useTranslation } from "react-multi-lang";
import { ModSelect } from "../control/mode-select";
import TradeRoute from "../trade-clipboard/trade-route";

const IS_TESTNET = process.env.NEXT_PUBLIC_IS_TESTNET === "false";

export const TradeClipboard: FunctionComponent<{
  // IMPORTANT: Pools should be memoized!!
  pools: Pool[];
  type: "Limit" | "StopLoss";
  containerClassName?: string;
  isInModal?: boolean;
  tradeType: string;
  setTradeType: any;
}> = observer(
  ({
    containerClassName,
    pools,
    isInModal,
    type = "Limit",
    tradeType,
    setTradeType,
  }) => {
    const {
      chainStore,
      accountStore,
      queriesStore,
      assetsStore: { nativeBalances, ibcBalances },
      priceStore,
    } = useStore();
    const t = useTranslation();
    const { chainId } = chainStore.osmosis;
    const { isMobile } = useWindowSize();
    const { logEvent } = useAmplitudeAnalytics();

    const allTokenBalances = nativeBalances.concat(ibcBalances);

    const account = accountStore.getAccount(chainId);
    const queries = queriesStore.get(chainId);

    const [isSettingOpen, setIsSettingOpen] = useBooleanWithWindowEvent(false);
    const manualSlippageInputRef = useRef<HTMLInputElement | null>(null);

    const slippageConfig = useSlippageConfig();
    const orderToeknInConfig = useOrderTokenInConfig(
      chainStore,
      chainId,
      account.bech32Address,
      queriesStore,
      pools
    );

    // show details
    const [showEstimateDetails, setShowEstimateDetails] = useState(false);
    const isEstimateDetailRelevant = !(
      orderToeknInConfig.amount === "" || orderToeknInConfig.amount === "0"
    );
    useEffect(() => {
      // auto collapse on input clear
      if (!isEstimateDetailRelevant) setShowEstimateDetails(false);
    }, [isEstimateDetailRelevant]);

    const [feeAmount, setFeeAmount] = useState("300000");

    // useEffect(() => {
    //   const queryFeeAmount = async () => {
    //     const client = await CosmWasmClient.connect(
    //       IS_TESTNET
    //         ? "https://rpc.testnet.osmosis.zone/"
    //         : "https://rpc-osmosis.keplr.app/"
    //     );

    //     const config = await client.queryContractSmart(
    //       REGISTRY_ADDRESSES[chainId],
    //       {
    //         config: {},
    //       }
    //     );
    //     setFeeAmount(config.fee_amount);
    //   };
    //   queryFeeAmount();
    // }, []);

    // auto focus from amount on token switch
    const fromAmountInput = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
      fromAmountInput.current?.focus();
    }, [orderToeknInConfig.sendCurrency]);

    useTokenSwapQueryParams(orderToeknInConfig, allTokenBalances, isInModal);

    const showPriceImpactWarning = useMemo(
      () =>
        orderToeknInConfig.expectedSwapResult.priceImpact
          .toDec()
          .gt(new Dec(0.1)),
      [orderToeknInConfig.expectedSwapResult.priceImpact]
    );

    useEffect(() => {
      if (isSettingOpen && slippageConfig.isManualSlippage) {
        // Whenever the setting opened, give a focus to the input if the manual slippage setting mode is on.
        manualSlippageInputRef.current?.focus();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSettingOpen]);

    // token select dropdown
    const [showFromTokenSelectDropdown, setFromTokenSelectDropdownLocal] =
      useBooleanWithWindowEvent(false);
    const [showToTokenSelectDropdown, setToTokenSelectDropdownLocal] =
      useBooleanWithWindowEvent(false);
    const setOneTokenSelectOpen = (dropdown: "to" | "from") => {
      if (dropdown === "to") {
        setToTokenSelectDropdownLocal(true);
        setFromTokenSelectDropdownLocal(false);
      } else {
        setFromTokenSelectDropdownLocal(true);
        setToTokenSelectDropdownLocal(false);
      }
    };
    const closeTokenSelectDropdowns = () => {
      setFromTokenSelectDropdownLocal(false);
      setToTokenSelectDropdownLocal(false);
    };

    const minOutAmountLessSlippage = useMemo(
      () =>
        orderToeknInConfig.expectedSwapResult.amount
          .toDec()
          .mul(new Dec(1).sub(slippageConfig.slippage.toDec())),
      [orderToeknInConfig.expectedSwapResult.amount, slippageConfig.slippage]
    );

    const spotPrice = useMemo(
      () =>
        orderToeknInConfig.beforeSpotPriceWithoutSwapFeeOutOverIn
          .trim(true)
          .maxDecimals(orderToeknInConfig.outCurrency.coinDecimals),
      [
        orderToeknInConfig.beforeSpotPriceWithoutSwapFeeOutOverIn,
        orderToeknInConfig.outCurrency,
      ]
    );

    const [isHoveringSwitchButton, setHoveringSwitchButton] = useState(false);
    // to & from box switch animation
    const [isAnimatingSwitch, setIsAnimatingSwitch] = useState(false);
    const [switchOutBack, setSwitchOutBack] = useState(false);
    useEffect(() => {
      let timeout: NodeJS.Timeout | undefined;
      let timeout2: NodeJS.Timeout | undefined;
      const duration = 300;
      if (isAnimatingSwitch) {
        timeout = setTimeout(() => {
          setIsAnimatingSwitch(false);
          setSwitchOutBack(false);
        }, duration);
        timeout2 = setTimeout(() => {
          orderToeknInConfig.switchInAndOut();
          setSwitchOutBack(true);
        }, duration / 3);
      }
      return () => {
        if (timeout) clearTimeout(timeout);
        if (timeout2) clearTimeout(timeout2);
      };
    }, [isAnimatingSwitch, orderToeknInConfig]);

    const inAmountValue =
      orderToeknInConfig.amount !== "" &&
      new Dec(orderToeknInConfig.amount).gt(new Dec(0))
        ? priceStore.calculatePrice(
            new CoinPretty(
              orderToeknInConfig.sendCurrency,
              new Dec(orderToeknInConfig.amount).mul(
                DecUtils.getTenExponentNInPrecisionRange(
                  orderToeknInConfig.sendCurrency.coinDecimals
                )
              )
            )
          )
        : undefined;
    const outAmountValue =
      (!orderToeknInConfig.realOutputAmount.toDec().isZero() &&
        priceStore.calculatePrice(
          new CoinPretty(
            orderToeknInConfig.expectedSwapResult.amount.currency,
            orderToeknInConfig.realOutputAmount
          )
          // orderToeknInConfig.expectedSwapResult.amount
        )) ||
      undefined;

    return (
      <div
        className={classNames(
          "relative rounded-[18px] flex flex-col gap-8 bg-osmoverse-800 px-5 md:px-3 pt-12 md:pt-4 pb-7 md:pb-4",
          containerClassName
        )}
      >
        <div className="relative flex items-center justify-end w-full">
          <div className="absolute left-0 ">
            <ModSelect
              onChange={(e: any) => setTradeType(e.value)}
              selectedMod={tradeType}
            />
          </div>
          <h6 className="w-full text-center">
            {type === "Limit" ? "Limit Order" : "Stop Loss"}
          </h6>
          <button
            className="absolute right-3 top-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsSettingOpen(!isSettingOpen);
              closeTokenSelectDropdowns();
            }}
          >
            <Image
              width={isMobile ? 20 : 28}
              height={isMobile ? 20 : 28}
              src={
                isSettingOpen
                  ? "/icons/setting-white.svg"
                  : "/icons/setting.svg"
              }
              alt="setting icon"
            />
          </button>
          {isSettingOpen && (
            <div
              className="absolute bottom-[-0.5rem] right-0 translate-y-full bg-osmoverse-800 rounded-2xl p-[1.875rem] md:p-5 z-40 w-full max-w-[23.875rem]"
              onClick={(e) => e.stopPropagation()}
            >
              <h6>{t("swap.settings.title")}</h6>
              <div className="flex items-center mt-2.5">
                <div className="subtitle1 text-osmoverse-200 mr-2">
                  {t("swap.settings.slippage")}
                </div>
                <InfoTooltip content={t("swap.settings.slippageInfo")} />
              </div>

              <ul className="flex gap-x-3 w-full mt-3">
                {slippageConfig.selectableSlippages.map((slippage) => {
                  return (
                    <li
                      key={slippage.index}
                      className={classNames(
                        "flex items-center justify-center w-full h-8 cursor-pointer rounded-lg bg-osmoverse-700",
                        { "border-2 border-wosmongton-200": slippage.selected }
                      )}
                      onClick={(e) => {
                        e.preventDefault();

                        slippageConfig.select(slippage.index);

                        logEvent([
                          EventName.Swap.slippageToleranceSet,
                          {
                            percentage: slippageConfig.slippage.toString(),
                          },
                        ]);
                      }}
                    >
                      <button>{slippage.slippage.toString()}</button>
                    </li>
                  );
                })}
                <li
                  className={classNames(
                    "flex items-center justify-center w-full h-8 cursor-pointer rounded-lg",
                    slippageConfig.isManualSlippage
                      ? "border-2 border-wosmongton-200 text-white-high"
                      : "text-osmoverse-500",
                    slippageConfig.isManualSlippage
                      ? slippageConfig.manualSlippageError
                        ? "bg-missionError"
                        : "bg-osmoverse-900"
                      : "bg-osmoverse-900"
                  )}
                  onClick={(e) => {
                    e.preventDefault();

                    if (manualSlippageInputRef.current) {
                      manualSlippageInputRef.current.focus();
                    }
                  }}
                >
                  <InputBox
                    type="number"
                    className="bg-transparent px-0 w-fit"
                    inputClassName={`bg-transparent text-center ${
                      !slippageConfig.isManualSlippage
                        ? "text-osmoverse-500"
                        : "text-white-high"
                    }`}
                    style="no-border"
                    currentValue={slippageConfig.manualSlippageStr}
                    onInput={(value) => {
                      slippageConfig.setManualSlippage(value);

                      logEvent([
                        EventName.Swap.slippageToleranceSet,
                        {
                          fromToken: orderToeknInConfig.sendCurrency.coinDenom,
                          toToken: orderToeknInConfig.outCurrency.coinDenom,
                          isOnHome: !isInModal,
                          percentage: slippageConfig.slippage.toString(),
                        },
                      ]);
                    }}
                    onFocus={() => slippageConfig.setIsManualSlippage(true)}
                    inputRef={manualSlippageInputRef}
                    isAutosize
                  />
                  <span
                    className={classNames("shrink-0", {
                      "text-osmoverse-500": !slippageConfig.isManualSlippage,
                    })}
                  >
                    %
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="relative flex flex-col gap-3">
          <div
            className={classNames(
              "bg-osmoverse-900 rounded-xl md:rounded-xl px-4 md:px-3 py-[22px] md:py-2.5 transition-all",
              !switchOutBack ? "ease-outBack" : "ease-inBack",
              {
                "opacity-30": isAnimatingSwitch,
              }
            )}
            style={
              isAnimatingSwitch
                ? {
                    transform: "translateY(60px)",
                  }
                : undefined
            }
          >
            <div
              className={classNames(
                "flex items-center place-content-between transition-opacity",
                {
                  "opacity-0": isAnimatingSwitch,
                }
              )}
            >
              <div className="flex">
                <span className="caption text-sm md:text-xs text-white-full">
                  {t("swap.available")}
                </span>
                <span className="caption text-sm md:text-xs text-wosmongton-300 ml-1.5">
                  {queries.queryBalances
                    .getQueryBech32Address(account.bech32Address)
                    .getBalanceFromCurrency(orderToeknInConfig.sendCurrency)
                    .trim(true)
                    .hideDenom(true)
                    .maxDecimals(orderToeknInConfig.sendCurrency.coinDecimals)
                    .toString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <BorderButton
                  className={classNames(
                    "text-xs py-1 px-1.5",
                    orderToeknInConfig.fraction === 1
                      ? "bg-wosmongton-100/40"
                      : "bg-transparent"
                  )}
                  onClick={() => {
                    if (orderToeknInConfig.fraction !== 1) {
                      logEvent([
                        EventName.Swap.maxClicked,
                        {
                          fromToken: orderToeknInConfig.sendCurrency.coinDenom,
                          toToken: orderToeknInConfig.outCurrency.coinDenom,
                          isOnHome: !isInModal,
                        },
                      ]);
                      orderToeknInConfig.setFraction(1);
                    } else {
                      orderToeknInConfig.setFraction(undefined);
                    }
                  }}
                >
                  {t("swap.MAX")}
                </BorderButton>
                <BorderButton
                  className={classNames(
                    "text-xs py-1 px-1.5",
                    orderToeknInConfig.fraction === 0.5
                      ? "bg-wosmongton-100/40"
                      : "bg-transparent"
                  )}
                  onClick={() => {
                    if (orderToeknInConfig.fraction !== 0.5) {
                      logEvent([
                        EventName.Swap.halfClicked,
                        {
                          fromToken: orderToeknInConfig.sendCurrency.coinDenom,
                          toToken: orderToeknInConfig.outCurrency.coinDenom,
                          isOnHome: !isInModal,
                        },
                      ]);
                      orderToeknInConfig.setFraction(0.5);
                    } else {
                      orderToeknInConfig.setFraction(undefined);
                    }
                  }}
                >
                  {t("swap.HALF")}
                </BorderButton>
              </div>
            </div>
            <div className="flex items-center place-content-between mt-3">
              <TokenSelect
                sortByBalances
                dropdownOpen={showFromTokenSelectDropdown}
                setDropdownState={(isOpen) => {
                  if (isOpen) {
                    setOneTokenSelectOpen("from");
                  } else {
                    closeTokenSelectDropdowns();
                  }
                }}
                tokens={allTokenBalances
                  .filter(
                    (tokenBalance) =>
                      tokenBalance.balance.currency.coinDenom !==
                      orderToeknInConfig.outCurrency.coinDenom
                  )
                  .filter((tokenBalance) =>
                    orderToeknInConfig.sendableCurrencies.some(
                      (sendableCurrency) =>
                        sendableCurrency.coinDenom ===
                        tokenBalance.balance.currency.coinDenom
                    )
                  )
                  .map((tokenBalance) => tokenBalance.balance)}
                selectedTokenDenom={orderToeknInConfig.sendCurrency.coinDenom}
                onSelect={(tokenDenom: string) => {
                  const tokenInBalance = allTokenBalances.find(
                    (tokenBalance) =>
                      tokenBalance.balance.currency.coinDenom === tokenDenom
                  );
                  if (tokenInBalance) {
                    orderToeknInConfig.setSendCurrency(
                      tokenInBalance.balance.currency
                    );
                  }
                  closeTokenSelectDropdowns();
                }}
              />
              <div className="flex flex-col items-end">
                <input
                  ref={fromAmountInput}
                  type="number"
                  className={classNames(
                    "md:text-subtitle1 text-white-full bg-transparent text-right focus:outline-none w-full placeholder:text-white-disabled",
                    orderToeknInConfig.amount.length >= 14
                      ? "caption"
                      : "font-h5 md:font-subtitle1 text-h5"
                  )}
                  placeholder="0"
                  onChange={(e) => {
                    e.preventDefault();
                    if (
                      Number(e.target.value) <= Number.MAX_SAFE_INTEGER &&
                      e.target.value.length <= (isMobile ? 19 : 26)
                    ) {
                      logEvent([
                        EventName.Swap.inputEntered,
                        {
                          fromToken: orderToeknInConfig.sendCurrency.coinDenom,
                          toToken: orderToeknInConfig.outCurrency.coinDenom,
                          isOnHome: !isInModal,
                        },
                      ]);
                      orderToeknInConfig.setAmount(e.target.value);
                    }
                  }}
                  value={orderToeknInConfig.amount}
                />
                <div
                  className={classNames(
                    "subtitle1 md:caption text-osmoverse-300 transition-opacity",
                    inAmountValue ? "opacity-100" : "opacity-0"
                  )}
                >{`≈ ${inAmountValue || "0"}`}</div>
              </div>
            </div>
          </div>

          <button
            className={classNames(
              "absolute flex items-center left-[45%] top-[124px] md:top-[94px] transition-all duration-500 ease-bounce z-30",
              {
                "w-10 md:w-8 h-10 md:h-8": !isHoveringSwitchButton,
                "w-11 md:w-9 h-11 md:h-9 -translate-x-[2px]":
                  isHoveringSwitchButton,
              }
            )}
            onMouseEnter={() => {
              if (!isMobile) setHoveringSwitchButton(true);
            }}
            onMouseLeave={() => {
              if (!isMobile) setHoveringSwitchButton(false);
            }}
            onClick={() => {
              logEvent([
                EventName.Swap.switchClicked,
                {
                  fromToken: orderToeknInConfig.sendCurrency.coinDenom,
                  toToken: orderToeknInConfig.outCurrency.coinDenom,
                  isOnHome: !isInModal,
                },
              ]);
              setIsAnimatingSwitch(true);
            }}
          >
            <div
              className={classNames(
                "w-full h-full rounded-full flex items-center",
                {
                  "bg-osmoverse-700": !isHoveringSwitchButton,
                  "bg-[#4E477C]": isHoveringSwitchButton,
                }
              )}
            >
              <div className="relative w-full h-full">
                <div
                  className={classNames(
                    "absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/3 transition-all duration-500 ease-bounce",
                    {
                      "opacity-0 rotate-180": isHoveringSwitchButton,
                    }
                  )}
                >
                  <Image
                    width={isMobile ? 16 : 20}
                    height={isMobile ? 16 : 20}
                    src={"/icons/down-arrow.svg"}
                    alt="switch"
                  />
                </div>
                <div
                  className={classNames(
                    "absolute left-[12px] top-1.5 md:left-[10px] md:top-[4px] transition-all duration-500 ease-bounce",
                    {
                      "opacity-100 rotate-180": isHoveringSwitchButton,
                      "opacity-0": !isHoveringSwitchButton,
                    }
                  )}
                >
                  <Image
                    width={isMobile ? 16 : 20}
                    height={isMobile ? 16 : 20}
                    src={"/icons/swap.svg"}
                    alt="switch"
                  />
                </div>
              </div>
            </div>
          </button>

          <div
            className={classNames(
              "bg-osmoverse-900 rounded-xl md:rounded-xl px-4 md:px-3 py-[22px] md:py-2.5 transition-all",
              {
                "opacity-30": isAnimatingSwitch,
              }
            )}
          >
            <div className="flex justify-between items-center">
              <span className="caption text-sm md:text-xs text-white-full mb-1">
                Rate
              </span>
            </div>
            {orderToeknInConfig && (
              <div className="flex items-center">
                <BorderButton
                  className="text-xs py-1 px-1.5"
                  onClick={() => orderToeknInConfig.setCurrentPrice()}
                >
                  <span className="text-caption">Current</span>
                </BorderButton>
                <input
                  type="number"
                  className="font-h5 md:font-subtitle1 text-h5 md:text-subtitle1 text-white-full bg-transparent text-right focus:outline-none w-full"
                  placeholder="0"
                  onChange={(e) => {
                    e.preventDefault();
                    if (Number(e.target.value) <= Number.MAX_SAFE_INTEGER) {
                      orderToeknInConfig.setPrice(e.target.value);
                    }
                  }}
                  value={orderToeknInConfig.price}
                />
              </div>
            )}
          </div>

          <div
            className={classNames(
              "bg-osmoverse-900 rounded-xl md:rounded-xl px-4 md:px-3 py-[22px] md:py-2.5 transition-all",
              !switchOutBack ? "ease-outBack" : "ease-inBack",
              {
                "opacity-30": isAnimatingSwitch,
              }
            )}
            style={
              isAnimatingSwitch
                ? {
                    transform: "translateY(-53px) scaleY(1.4)",
                  }
                : undefined
            }
          >
            <div
              className="flex items-center place-content-between transition-transform"
              style={
                isAnimatingSwitch
                  ? {
                      transform: "scaleY(0.6)",
                    }
                  : undefined
              }
            >
              <TokenSelect
                dropdownOpen={showToTokenSelectDropdown}
                setDropdownState={(isOpen) => {
                  if (isOpen) {
                    setOneTokenSelectOpen("to");
                  } else {
                    closeTokenSelectDropdowns();
                  }
                }}
                sortByBalances
                tokens={allTokenBalances
                  .filter(
                    (tokenBalance) =>
                      tokenBalance.balance.currency.coinDenom !==
                      orderToeknInConfig.sendCurrency.coinDenom
                  )
                  .filter((tokenBalance) =>
                    orderToeknInConfig.sendableCurrencies.some(
                      (sendableCurrency) =>
                        sendableCurrency.coinDenom ===
                        tokenBalance.balance.currency.coinDenom
                    )
                  )
                  .map((tokenBalance) => tokenBalance.balance)}
                selectedTokenDenom={orderToeknInConfig.outCurrency.coinDenom}
                onSelect={(tokenDenom: string) => {
                  const tokenOutBalance = allTokenBalances.find(
                    (tokenBalance) =>
                      tokenBalance.balance.currency.coinDenom === tokenDenom
                  );
                  if (tokenOutBalance) {
                    orderToeknInConfig.setOutCurrency(
                      tokenOutBalance.balance.currency
                    );
                  }
                  closeTokenSelectDropdowns();
                }}
              />
              <div className="flex flex-col items-end w-full">
                <h5
                  className={classNames(
                    "text-right md:subtitle1",
                    orderToeknInConfig.expectedSwapResult.amount
                      .toDec()
                      .isPositive()
                      ? "text-white-full"
                      : "text-white-disabled"
                  )}
                >{`≈ ${
                  orderToeknInConfig.expectedSwapResult.amount.denom !==
                  "UNKNOWN"
                    ? orderToeknInConfig.realOutputAmount
                        .trim(true)
                        .shrink(true)
                        .maxDecimals(
                          Math.min(
                            orderToeknInConfig.expectedSwapResult.amount
                              .currency.coinDecimals,
                            8
                          )
                        )
                        .toString()
                    : "0"
                }`}</h5>
                <div
                  className={classNames(
                    "subtitle1 md:caption text-osmoverse-300 transition-opacity",
                    outAmountValue ? "opacity-100" : "opacity-0"
                  )}
                >
                  {`≈ ${outAmountValue || "0"}`}
                </div>
              </div>
            </div>
          </div>

          <div
            className={classNames(
              "relative rounded-lg bg-osmoverse-900 px-4 md:px-3 transition-all ease-inOutBack duration-300 overflow-hidden",
              showEstimateDetails ? "h-56 py-6" : "h-11 py-[10px]"
            )}
          >
            <button
              className={classNames(
                "w-full flex items-center place-content-between",
                {
                  "cursor-pointer": isEstimateDetailRelevant,
                }
              )}
              onClick={() => {
                if (isEstimateDetailRelevant)
                  setShowEstimateDetails(!showEstimateDetails);
              }}
            >
              <div
                className={classNames("subtitle2 transition-all", {
                  "text-osmoverse-600": !isEstimateDetailRelevant,
                })}
              >
                {`1 ${
                  orderToeknInConfig.sendCurrency.coinDenom !== "UNKNOWN"
                    ? orderToeknInConfig.sendCurrency.coinDenom
                    : ""
                } ≈ ${
                  spotPrice.toDec().lt(new Dec(1))
                    ? spotPrice.toString()
                    : spotPrice.maxDecimals(6).toString()
                } ${
                  orderToeknInConfig.outCurrency.coinDenom !== "UNKNOWN"
                    ? orderToeknInConfig.outCurrency.coinDenom
                    : ""
                }`}
              </div>
              <div className="flex items-center gap-2">
                <Image
                  className={classNames(
                    "transition-opacity",
                    showPriceImpactWarning ? "opacity-100" : "opacity-0"
                  )}
                  alt="alert circle"
                  src="/icons/alert-circle.svg"
                  height={24}
                  width={24}
                />
                <Image
                  className={classNames(
                    "transition-all",
                    showEstimateDetails ? "rotate-180" : "rotate-0",
                    isEstimateDetailRelevant ? "opacity-100" : "opacity-0"
                  )}
                  alt="show estimates"
                  src="/icons/chevron-down.svg"
                  height={isMobile ? 14 : 18}
                  width={isMobile ? 14 : 18}
                />
              </div>
            </button>
            <div
              className={classNames(
                "absolute flex flex-col gap-4 pt-5",
                isInModal ? "w-[94%]" : "w-[358px] md:w-[94%]"
              )}
            >
              <div
                className={classNames("flex justify-between", {
                  "text-error": showPriceImpactWarning,
                })}
              >
                <div className="caption">{t("swap.priceImpact")}</div>
                <div
                  className={classNames(
                    "caption",
                    showPriceImpactWarning ? "text-error" : "text-osmoverse-200"
                  )}
                >
                  {`-${orderToeknInConfig.expectedSwapResult.priceImpact.toString()}`}
                </div>
              </div>
              <div className="flex justify-between">
                <div className="caption">
                  {t("swap.fee", {
                    fee: orderToeknInConfig.expectedSwapResult.swapFee.toString(),
                  })}
                </div>
                <div className="caption text-osmoverse-200">
                  {`≈ ${
                    priceStore.calculatePrice(
                      orderToeknInConfig.expectedSwapResult.tokenInFeeAmount
                    ) ?? "0"
                  } `}
                </div>
              </div>
              <hr className="text-white-faint" />
              <div className="flex justify-between">
                <div className="caption">{t("swap.expectedOutput")}</div>
                <div className="caption text-osmoverse-200 whitespace-nowrap">
                  {`≈ ${orderToeknInConfig.expectedSwapResult.amount.toString()} `}
                </div>
              </div>
              <div className="flex justify-between">
                <div className="caption">
                  {t("swap.minimumSlippage", {
                    slippage: slippageConfig.slippage.trim(true).toString(),
                  })}
                </div>
                <div
                  className={classNames(
                    "caption flex flex-col text-right gap-0.5 text-osmoverse-200"
                  )}
                >
                  <span className="whitespace-nowrap">
                    {new CoinPretty(
                      orderToeknInConfig.outCurrency,
                      minOutAmountLessSlippage.mul(
                        DecUtils.getTenExponentNInPrecisionRange(
                          orderToeknInConfig.outCurrency.coinDecimals
                        )
                      )
                    ).toString()}
                  </span>
                  <span>
                    {`≈ ${
                      priceStore.calculatePrice(
                        new CoinPretty(
                          orderToeknInConfig.outCurrency,
                          minOutAmountLessSlippage.mul(
                            DecUtils.getTenExponentNInPrecisionRange(
                              orderToeknInConfig.outCurrency.coinDecimals
                            )
                          )
                        )
                      ) || "0"
                    }`}
                  </span>
                </div>
              </div>
              {!isInModal &&
                orderToeknInConfig.optimizedRoutePaths
                  .slice(0, 1)
                  .map((route, index) => (
                    <TradeRoute
                      key={index}
                      sendCurrency={orderToeknInConfig.sendCurrency}
                      outCurrency={orderToeknInConfig.outCurrency}
                      route={route}
                      isMultihopOsmoFeeDiscount={
                        orderToeknInConfig.expectedSwapResult
                          .isMultihopOsmoFeeDiscount
                      }
                    />
                  ))}
            </div>
          </div>
        </div>
        {/* <Button
          color={
            showPriceImpactWarning &&
            account.walletStatus === WalletStatus.Loaded
              ? "primary-warning"
              : "primary"
          }
          disabled={
            account.walletStatus === WalletStatus.Loaded &&
            (orderToeknInConfig.error !== undefined ||
              orderToeknInConfig.optimizedRoutePaths.length === 0 ||
              account.txTypeInProgress !== "")
          }
          // className="flex justify-center items-center w-full h-[3.75rem] rounded-lg text-h6 md:text-button font-h6 md:font-button text-white-full shadow-elevation-04dp"
          onClick={async () => {
            if (account.walletStatus !== WalletStatus.Loaded) {
              return account.init();
            }

            if (orderToeknInConfig.optimizedRoutePaths.length > 0) {
              const routes: {
                poolId: string;
                tokenOutCurrency: Currency;
              }[] = [];

              for (
                let i = 0;
                i < orderToeknInConfig.optimizedRoutePaths[0].pools.length;
                i++
              ) {
                const pool = orderToeknInConfig.optimizedRoutePaths[0].pools[i];
                console.log("pool", pool);
                const tokenOutCurrency =
                  chainStore.osmosisObservable.currencies.find(
                    (cur) =>
                      cur.coinMinimalDenom ===
                      orderToeknInConfig.optimizedRoutePaths[0].tokenOutDenoms[
                        i
                      ]
                  );

                if (!tokenOutCurrency) {
                  orderToeknInConfig.setError(
                    new Error(
                      t("swap.error.findCurrency", {
                        currency:
                          orderToeknInConfig.optimizedRoutePaths[0]
                            .tokenOutDenoms[i],
                      })
                    )
                  );
                  return;
                }

                routes.push({
                  poolId: pool.id,
                  tokenOutCurrency,
                });
              }

              const tokenInCurrency =
                chainStore.osmosisObservable.currencies.find(
                  (cur) =>
                    cur.coinMinimalDenom ===
                    orderToeknInConfig.optimizedRoutePaths[0].tokenInDenom
                );

              if (!tokenInCurrency) {
                orderToeknInConfig.setError(
                  new Error(
                    `Failed to find currency ${orderToeknInConfig.optimizedRoutePaths[0].tokenInDenom}`
                  )
                );
                return;
              }

              const tokenInUAmount = new Dec(orderToeknInConfig.amount)
                .mul(
                  DecUtils.getTenExponentNInPrecisionRange(
                    tokenInCurrency.coinDecimals
                  )
                )
                .truncate();

              const { tokenOutCurrency } = routes[routes.length - 1];
              const tokenOutUAmount = orderToeknInConfig.realOutputAmount
                .toDec()
                .mul(
                  DecUtils.getTenExponentNInPrecisionRange(
                    tokenOutCurrency.coinDecimals
                  )
                )
                .truncate();

              try {
                const copyRoute = [...routes];
                const first = copyRoute.shift();
                const swap = {
                  user: account.bech32Address,
                  route: routes.map((route) => ({
                    pool_id: route.poolId,
                    token_out_denom: route.tokenOutCurrency.coinMinimalDenom,
                  })),
                  denom_in: tokenInCurrency.coinMinimalDenom,
                  amount_in: tokenInUAmount.toString(),
                  min_output:
                    type === "Limit"
                      ? tokenOutUAmount.toString()
                      : (Number(tokenOutUAmount) * 0.8).toFixed(0).toString(),
                  max_output:
                    type === "Limit"
                      ? "18446744073709551615"
                      : tokenOutUAmount.toString(),
                  denom_out: first!.tokenOutCurrency.coinMinimalDenom,
                } as any;
                const msg = Buffer.from(JSON.stringify({ swap })).toString(
                  "base64"
                );
                console.log("@@@@", swap);
                console.log("@@@@", msg);
                const isNative =
                  tokenInCurrency.coinMinimalDenom.startsWith("u") ||
                  tokenInCurrency.coinMinimalDenom.startsWith("ibc/");

                if (!isNative) {
                  await account.cosmwasm.sendExecuteContractMsg(
                    "executeWasm",
                    tokenInCurrency.coinMinimalDenom,
                    {
                      increase_allowance: {
                        spender: REGISTRY_ADDRESSES[chainId],
                        amount: tokenInUAmount.toString(),
                        expires: undefined,
                      },
                    },
                    [],
                    "",
                    { gas: "350000" }
                  );
                }

                const input_asset = isNative
                  ? {
                      info: {
                        native_token: {
                          denom: tokenInCurrency.coinMinimalDenom,
                        },
                      },
                      amount: tokenInUAmount.toString(),
                    }
                  : {
                      info: {
                        token: {
                          contract_addr: tokenInCurrency.coinMinimalDenom,
                        },
                      },
                      amount: tokenInUAmount.toString(),
                    };

                const funds = [];
                if (tokenInCurrency.coinMinimalDenom !== "uosmo") {
                  funds.push({
                    denom: tokenInCurrency.coinMinimalDenom,
                    amount: tokenInUAmount.toString(),
                  });
                  funds.push({ denom: "uosmo", amount: feeAmount }); // fee amount in usomo
                } else {
                  funds.push({
                    denom: "uosmo",
                    amount: new Dec(orderToeknInConfig.amount)
                      .mul(
                        DecUtils.getTenExponentNInPrecisionRange(
                          tokenInCurrency.coinDecimals
                        )
                      )
                      .add(new Dec(feeAmount))
                      .truncate()
                      .toString(),
                  });
                }

                await account.cosmwasm.sendExecuteContractMsg(
                  "executeWasm",
                  REGISTRY_ADDRESSES[chainId],
                  {
                    create_request: {
                      request_info: {
                        target: WRAPPER_ADDRESSES[chainId],
                        msg,
                        input_asset,
                        is_recurring: false,
                      },
                    },
                  },
                  funds,
                  "",
                  { gas: "350000" },
                  undefined,
                  (e) => console.log(e)
                );
                console.log("@@@@", chainId);
                console.log("@@@@@@", input_asset);
                orderToeknInConfig.setAmount("");
                orderToeknInConfig.setFraction(undefined);
              } catch (e) {
                console.error(e);
              }
            }
          }}
        >
          {account.walletStatus === WalletStatus.Loaded ? (
            orderToeknInConfig.error ? (
              orderToeknInConfig.error.message
            ) : showPriceImpactWarning ? (
              "Place Order Anyway"
            ) : (
              "Place Order"
            )
          ) : (
            <h6 className="flex items-center gap-3">
              <Image
                alt="wallet"
                src="/icons/wallet.svg"
                height={24}
                width={24}
              />
              <span>Connect Wallet</span>
            </h6>
          )}
        </Button> */}
      </div>
    );
  }
);

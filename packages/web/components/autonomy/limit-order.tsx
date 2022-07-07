import { WalletStatus } from "@keplr-wallet/stores";
import { Currency } from "@keplr-wallet/types";
import { CoinPretty, Dec, DecUtils } from "@keplr-wallet/unit";
import { Pool } from "@osmosis-labs/pools";
import { Buffer } from "buffer";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import Image from "next/image";
import React, { FunctionComponent, useEffect, useRef, useMemo } from "react";
import {
  IS_FRONTIER,
  REGISTRY_ADDRESSES,
  WRAPPER_ADDRESSES,
} from "../../config";
import {
  useBooleanWithWindowEvent,
  useOrderTokenInConfig,
  useSlippageConfig,
  useTokenSwapQueryParams,
  useWindowSize,
} from "../../hooks";
import { useStore } from "../../stores";
import { Error as ErrorBox } from "../alert";
import { Button } from "../buttons";
import { TokenSelect } from "../control/token-select";
import { InputBox } from "../input";
import { InfoTooltip } from "../tooltip";

export const LimitOrder: FunctionComponent<{
  // IMPORTANT: Pools should be memoized!!
  pools: Pool[];

  containerClassName?: string;
  isInModal?: boolean;
}> = observer(({ containerClassName, pools, isInModal }) => {
  const {
    chainStore,
    accountStore,
    queriesStore,
    assetsStore: { nativeBalances, ibcBalances },
    priceStore,
  } = useStore();
  const { chainId } = chainStore.osmosis;
  const { isMobile } = useWindowSize();

  const allTokenBalances = nativeBalances.concat(ibcBalances);

  const account = accountStore.getAccount(chainId);
  const queries = queriesStore.get(chainId);

  const [isSettingOpen, setIsSettingOpen] = useBooleanWithWindowEvent(false);
  const manualSlippageInputRef = useRef<HTMLInputElement | null>(null);

  const slippageConfig = useSlippageConfig();
  const orderTokenInConfig = useOrderTokenInConfig(
    chainStore,
    chainId,
    account.bech32Address,
    queriesStore,
    pools
  );

  // auto focus from amount on token switch
  const fromAmountInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    fromAmountInput.current?.focus();
  }, [orderTokenInConfig.sendCurrency]);

  useTokenSwapQueryParams(orderTokenInConfig, allTokenBalances, isInModal);

  const showWarningSlippage = useMemo(
    () =>
      slippageConfig.slippage
        .toDec()
        .lt(orderTokenInConfig.expectedSwapResult.slippage.toDec()) ||
      orderTokenInConfig.expectedSwapResult.slippage.toDec().gt(new Dec(0.1)),
    [slippageConfig.slippage, orderTokenInConfig.expectedSwapResult.slippage]
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

  return (
    <div
      className={classNames(
        "relative rounded-2xl bg-card border-2 md:border-0 border-cardInner p-2.5 md:p-0 shadow-elevation-08dp",
        containerClassName
      )}
    >
      <div className="rounded-xl bg-cardInner px-5 md:px-3 pt-5 md:pt-4 pb-6 md:pb-4">
        {!isInModal && (
          <div className="absolute -top-2 inset-x-1/2 -translate-x-1/2 w-[10rem] md:w-[7.875rem] h-[3.75rem] md:h-[2.8125rem] z-10 bg-gradients-clip rounded-md">
            <div className="absolute bottom-0 rounded-b-md w-full h-5 bg-gradients-clipInner" />
            {!IS_FRONTIER && (
              <div className="absolute inset-x-1/2 -translate-x-1/2 bottom-2 w-12 md:w-9 h-[1.875rem] md:h-[1.4rem] bg-[rgba(91,83,147,0.12)] rounded-md shadow-[rgba(0,0,0,0.25)_1px_1px_1px_inset]" />
            )}
            {IS_FRONTIER && (
              <div className="absolute left-0 right-0 top-[20%] mx-auto h-[40px] w-[40px] md:h-[30px] md:w-[30px]">
                <img alt="badge" src="/icons/frontier-osmo-badge.svg" />
              </div>
            )}
          </div>
        )}

        <div className="relative flex justify-end w-full h-11 md:h-[38px] mb-[1.125rem] md:mb-2">
          <button
            className="relative h-11 md:h-[38px]"
            onClick={(e) => {
              e.stopPropagation();
              setIsSettingOpen(!isSettingOpen);
              closeTokenSelectDropdowns();
            }}
          >
            <Image
              width={isMobile ? 36 : 44}
              height={isMobile ? 36 : 44}
              src={
                IS_FRONTIER
                  ? "/icons/hexagon-border-card.svg"
                  : `/icons/hexagon-border${
                      isSettingOpen ? "-selected" : ""
                    }.svg`
              }
              alt="hexagon border icon"
            />
            <div className="w-5 h-5 absolute inset-1/2 -translate-x-1/2 -translate-y-1/2">
              <Image
                width={isMobile ? 18 : 20}
                height={isMobile ? 18 : 20}
                src={
                  IS_FRONTIER
                    ? "/icons/setting-white.svg"
                    : `/icons/setting${isSettingOpen ? "-selected" : ""}.svg`
                }
                alt="setting icon"
              />
            </div>
          </button>
          {isSettingOpen && (
            <div
              className="absolute bottom-[-0.5rem] right-0 translate-y-full bg-card border border-white-faint rounded-2xl p-[1.875rem] md:p-5 z-50 w-full max-w-[23.875rem]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="subtitle1 text-white-emphasis">
                Transaction Settings
              </div>
              <div className="flex items-center mt-2.5">
                <div className="body2 text-white-disabled mr-2">
                  Slippage tolerance
                </div>
                <InfoTooltip content="Your transaction will revert if the price changes unfavorably by more than this percentage." />
              </div>

              <ul className="flex gap-x-3 w-full mt-3">
                {slippageConfig.selectableSlippages.map((slippage) => {
                  return (
                    <li
                      key={slippage.index}
                      className={classNames(
                        "flex items-center justify-center w-full h-8 cursor-pointer rounded-full text-white-high",
                        slippage.selected ? "bg-primary-200" : "bg-background"
                      )}
                      onClick={(e) => {
                        e.preventDefault();

                        slippageConfig.select(slippage.index);
                      }}
                    >
                      <button>{slippage.slippage.toString()}</button>
                    </li>
                  );
                })}
                <li
                  className={classNames(
                    "flex items-center justify-center w-full h-8 cursor-pointer rounded-full",
                    slippageConfig.isManualSlippage
                      ? "text-white-high"
                      : "text-white-faint",
                    slippageConfig.isManualSlippage
                      ? slippageConfig.getManualSlippageError()
                        ? "bg-missionError"
                        : "bg-primary-200"
                      : "bg-background"
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
                        ? "text-white-faint"
                        : "text-white-high"
                    }`}
                    style="no-border"
                    currentValue={slippageConfig.manualSlippageStr}
                    onInput={(value) => slippageConfig.setManualSlippage(value)}
                    onFocus={() => slippageConfig.setIsManualSlippage(true)}
                    inputRef={manualSlippageInputRef}
                    isAutosize
                  />
                  <span className="shrink-0">%</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="bg-surface rounded-2xl md:rounded-xl px-4 md:px-3 pt-3 md:pt-2.5 pb-4 md:pb-2.5 relative">
            <div className="flex justify-between items-center">
              <span className="subtitle1 md:subtitle2 text-white-full">
                From
              </span>
              <div className="flex items-center">
                <span className="caption text-sm md:text-xs text-white-full">
                  Available
                </span>
                <span className="caption text-sm md:text-xs text-primary-50 ml-1.5">
                  {queries.queryBalances
                    .getQueryBech32Address(account.bech32Address)
                    .getBalanceFromCurrency(orderTokenInConfig.sendCurrency)
                    .trim(true)
                    .hideDenom(true)
                    .maxDecimals(orderTokenInConfig.sendCurrency.coinDecimals)
                    .toString()}
                </span>
                <button
                  type="button"
                  className={classNames(
                    "button text-white-full text-xs py-1 px-1.5 rounded-md ml-2",
                    orderTokenInConfig && orderTokenInConfig.fraction === 1
                      ? "bg-primary-200"
                      : "bg-white-faint"
                  )}
                  onClick={(e) => {
                    e.preventDefault();

                    if (!orderTokenInConfig) {
                      return;
                    }

                    if (orderTokenInConfig.fraction !== 1) {
                      orderTokenInConfig.setFraction(1);
                    } else {
                      orderTokenInConfig.setFraction(undefined);
                    }
                  }}
                >
                  MAX
                </button>
                <button
                  type="button"
                  className={classNames(
                    "button text-white-full text-xs py-1 px-1.5 rounded-md ml-1",
                    orderTokenInConfig && orderTokenInConfig.fraction === 0.5
                      ? "bg-primary-200"
                      : "bg-white-faint"
                  )}
                  onClick={(e) => {
                    e.preventDefault();

                    if (!orderTokenInConfig) {
                      return;
                    }

                    if (orderTokenInConfig.fraction !== 0.5) {
                      orderTokenInConfig.setFraction(0.5);
                    } else {
                      orderTokenInConfig.setFraction(undefined);
                    }
                  }}
                >
                  HALF
                </button>
              </div>
            </div>
            <div className="flex items-center mt-3">
              {orderTokenInConfig && (
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
                        orderTokenInConfig.outCurrency.coinDenom
                    )
                    .filter((tokenBalance) =>
                      orderTokenInConfig.sendableCurrencies.some(
                        (sendableCurrency) =>
                          sendableCurrency.coinDenom ===
                          tokenBalance.balance.currency.coinDenom
                      )
                    )
                    .map((tokenBalance) => tokenBalance.balance)}
                  selectedTokenDenom={orderTokenInConfig.sendCurrency.coinDenom}
                  onSelect={(tokenDenom: string) => {
                    const tokenInBalance = allTokenBalances.find(
                      (tokenBalance) =>
                        tokenBalance.balance.currency.coinDenom === tokenDenom
                    );
                    if (tokenInBalance) {
                      orderTokenInConfig.setSendCurrency(
                        tokenInBalance.balance.currency
                      );
                    }
                    closeTokenSelectDropdowns();
                  }}
                  isMobile={isMobile}
                />
              )}
              <div className="flex-1" />
              {orderTokenInConfig && (
                <div className="flex flex-col items-end">
                  <input
                    ref={fromAmountInput}
                    type="number"
                    className="font-h5 md:font-subtitle1 text-h5 md:text-subtitle1 text-white-full bg-transparent text-right focus:outline-none w-full"
                    placeholder="0"
                    onChange={(e) => {
                      e.preventDefault();
                      if (Number(e.target.value) <= Number.MAX_SAFE_INTEGER) {
                        orderTokenInConfig.setAmount(e.target.value);
                      }
                    }}
                    value={orderTokenInConfig.amount}
                  />
                  <div className="subtitle2 md:font-caption md:text-caption text-white-disabled">{`≈ ${
                    orderTokenInConfig.amount &&
                    new Dec(orderTokenInConfig.amount).gt(new Dec(0))
                      ? priceStore.calculatePrice(
                          new CoinPretty(
                            orderTokenInConfig.sendCurrency,
                            new Dec(orderTokenInConfig.amount).mul(
                              DecUtils.getTenExponentNInPrecisionRange(
                                orderTokenInConfig.sendCurrency.coinDecimals
                              )
                            )
                          )
                        )
                      : "0"
                  }`}</div>
                </div>
              )}
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-12 md:w-9 h-12 md:h-9 z-[1] md:mt-0.5"
              onClick={(e) => {
                e.preventDefault();

                orderTokenInConfig && orderTokenInConfig.switchInAndOut();
              }}
            >
              <Image
                width={isMobile ? 36 : 48}
                height={isMobile ? 36 : 48}
                src={
                  IS_FRONTIER
                    ? "/icons/hexagon-border-card.svg"
                    : "/icons/hexagon-border.svg"
                }
                alt="hexagon border icon"
              />
              <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-6 md:w-[1.125rem] h-6 md:h-[1.125rem]">
                <Image
                  width={isMobile ? 18 : 24}
                  height={isMobile ? 18 : 24}
                  src={
                    IS_FRONTIER
                      ? "/icons/switch-white.svg"
                      : "/icons/switch.svg"
                  }
                  alt="switch icon"
                />
              </div>
            </button>
          </div>
          <div className="bg-surface rounded-2xl md:rounded-xl px-4 md:px-3 pt-3 md:pt-2.5 pb-4 md:pb-2.5 mt-[1.125rem] md:mt-3 relative">
            <div className="flex justify-between items-center">
              <span className="subtitle1 md:subtitle2 text-white-full">
                Rate
              </span>
            </div>
            {orderTokenInConfig && (
              <div className="flex items-center mt-3">
                <button
                  className="button h-[1.375rem] border-2 border-primary-200 rounded-lg bg-primary-200/30 select-none hover:bg-primary-200/60"
                  onClick={() => orderTokenInConfig.setCurrentPrice()}
                >
                  <span className="mx-2 text-caption">Current</span>
                </button>
                <input
                  type="number"
                  className="font-h5 md:font-subtitle1 text-h5 md:text-subtitle1 text-white-full bg-transparent text-right focus:outline-none w-full"
                  placeholder="0"
                  onChange={(e) => {
                    e.preventDefault();
                    if (Number(e.target.value) <= Number.MAX_SAFE_INTEGER) {
                      orderTokenInConfig.setPrice(e.target.value);
                    }
                  }}
                  value={orderTokenInConfig.price}
                />
              </div>
            )}
          </div>
          <div className="bg-surface rounded-2xl md:rounded-xl px-4 md:px-3 pt-3 md:pt-2.5 pb-4 md:pb-2.5 mt-[1.125rem] md:mt-3 relative">
            <div className="flex justify-between items-center">
              <span className="subtitle1 md:subtitle2 text-white-full">To</span>
            </div>
            <div className="flex items-center mt-3">
              {orderTokenInConfig && (
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
                        orderTokenInConfig.sendCurrency.coinDenom
                    )
                    .filter((tokenBalance) =>
                      orderTokenInConfig.sendableCurrencies.some(
                        (sendableCurrency) =>
                          sendableCurrency.coinDenom ===
                          tokenBalance.balance.currency.coinDenom
                      )
                    )
                    .map((tokenBalance) => tokenBalance.balance)}
                  selectedTokenDenom={orderTokenInConfig.outCurrency.coinDenom}
                  onSelect={(tokenDenom: string) => {
                    const tokenOutBalance = allTokenBalances.find(
                      (tokenBalance) =>
                        tokenBalance.balance.currency.coinDenom === tokenDenom
                    );
                    if (tokenOutBalance) {
                      orderTokenInConfig.setOutCurrency(
                        tokenOutBalance.balance.currency
                      );
                    }
                    closeTokenSelectDropdowns();
                  }}
                  isMobile={isMobile}
                />
              )}
              <div className="flex-1" />
              {orderTokenInConfig && (
                <div className="flex flex-col items-end">
                  <h5
                    className={classNames(
                      "text-right md:subtitle1",
                      orderTokenInConfig.expectedSwapResult.amount
                        .toDec()
                        .isPositive()
                        ? "text-white-full"
                        : "text-white-disabled"
                    )}
                  >{`${
                    orderTokenInConfig.expectedSwapResult.amount.denom !==
                    "UNKNOWN"
                      ? orderTokenInConfig.realOutputAmount
                          .trim(true)
                          .shrink(true)
                          .maxDecimals(
                            Math.min(
                              orderTokenInConfig.expectedSwapResult.amount
                                .currency.coinDecimals,
                              6
                            )
                          )
                          .toString()
                      : "0"
                  }`}</h5>
                </div>
              )}
            </div>
          </div>
        </div>

        {orderTokenInConfig && (
          <div className="mt-[1.125rem] rounded-lg bg-card py-3 px-4 md:px-3">
            <div className="flex justify-between">
              <div className="subtitle2 md:caption text-wireframes-lightGrey">
                Rate
              </div>
              <div className="flex flex-col gap-y-1.5 text-right">
                <div className="subtitle2 md:caption text-wireframes-lightGrey">
                  {`1 ${
                    orderTokenInConfig.sendCurrency.coinDenom !== "UNKNOWN"
                      ? orderTokenInConfig.sendCurrency.coinDenom
                      : ""
                  } = ${orderTokenInConfig.expectedSwapResult.beforeSpotPriceWithoutSwapFeeOutOverIn
                    .trim(true)
                    .maxDecimals(3)
                    .toString()} ${
                    orderTokenInConfig.outCurrency.coinDenom !== "UNKNOWN"
                      ? orderTokenInConfig.outCurrency.coinDenom
                      : ""
                  }`}
                </div>
                <div className="caption text-white-disabled">
                  {`1 ${
                    orderTokenInConfig.outCurrency.coinDenom !== "UNKNOWN"
                      ? orderTokenInConfig.outCurrency.coinDenom
                      : ""
                  } = ${orderTokenInConfig.expectedSwapResult.beforeSpotPriceWithoutSwapFeeInOverOut
                    .trim(true)
                    .maxDecimals(3)
                    .toString()} ${
                    orderTokenInConfig.sendCurrency.coinDenom !== "UNKNOWN"
                      ? orderTokenInConfig.sendCurrency.coinDenom
                      : ""
                  }`}
                </div>
              </div>
            </div>
            <div
              className={`flex justify-end mt-1 ${
                orderTokenInConfig.priceChangePercentage >= 0
                  ? "text-success"
                  : "text-error"
              }`}
            >
              {Math.abs(orderTokenInConfig.priceChangePercentage).toFixed(2)}%{" "}
              {orderTokenInConfig.priceChangePercentage >= 0
                ? "above "
                : "below "}
              market value
            </div>
            {/* <div className="flex justify-between mt-2.5">
              <div className="subtitle2 md:caption text-wireframes-lightGrey">
                Swap Fee
              </div>
              <div className="flex flex-col gap-y-1.5 text-right">
                <div className="subtitle2 md:caption text-wireframes-lightGrey">
                  {orderTokenInConfig.expectedSwapResult.swapFee.isReady
                    ? orderTokenInConfig.expectedSwapResult.swapFee.toString()
                    : orderTokenInConfig.amount === ""
                    ? "0"
                    : "--"}
                </div>
                <div className="caption text-white-disabled">
                  {`~${
                    priceStore.calculatePrice(
                      orderTokenInConfig.expectedSwapResult.tokenInFeeAmount
                    ) ?? "0"
                  } (${
                    orderTokenInConfig.expectedSwapResult.tokenInFeeAmount
                      .denom !== "UNKNOWN"
                      ? orderTokenInConfig.expectedSwapResult.tokenInFeeAmount
                          .trim(true)
                          .toString()
                      : "0"
                  })`}
                </div>
              </div>
            </div> */}
            {/* <div className="flex justify-between pt-4 mt-4 border-t border-white-faint">
              <div className="subtitle2 md:caption text-white-high md:text-wireframes-lightGrey">
                Estimated Slippage
              </div>
              <div
                className={classNames(
                  "subtitle2 md:caption md:text-wireframes-lightGrey",
                  {
                    "text-white-high": !showWarningSlippage,
                    "text-error": showWarningSlippage,
                  }
                )}
              >
                {orderTokenInConfig.expectedSwapResult.slippage.isReady
                  ? orderTokenInConfig.expectedSwapResult.slippage.toString()
                  : orderTokenInConfig.amount === ""
                  ? "0"
                  : "--"}
              </div>
            </div> */}
          </div>
        )}
        {orderTokenInConfig && orderTokenInConfig.error && (
          <ErrorBox
            className="!w-full flex !justify-center items-center mt-4"
            iconSize={isMobile ? "sm" : "md"}
            message={orderTokenInConfig.error?.message ?? ""}
          />
        )}
        {orderTokenInConfig && (
          <Button
            color={showWarningSlippage ? "error" : "primary"}
            className="mt-[1.125rem] flex justify-center items-center w-full h-[3.75rem] rounded-lg text-h6 md:text-button font-h6 md:font-button text-white-full shadow-elevation-04dp"
            disabled={
              account.walletStatus === WalletStatus.Loaded &&
              (orderTokenInConfig.error !== undefined ||
                orderTokenInConfig.optimizedRoutePaths.length === 0 ||
                account.txTypeInProgress !== "" ||
                orderTokenInConfig.priceChangePercentage < 0)
            }
            loading={account.txTypeInProgress !== ""}
            onClick={async () => {
              if (account.walletStatus !== WalletStatus.Loaded) {
                return account.init();
              }

              if (orderTokenInConfig.optimizedRoutePaths.length > 0) {
                const routes: {
                  poolId: string;
                  tokenOutCurrency: Currency;
                }[] = [];

                for (
                  let i = 0;
                  i < orderTokenInConfig.optimizedRoutePaths[0].pools.length;
                  i++
                ) {
                  const pool =
                    orderTokenInConfig.optimizedRoutePaths[0].pools[i];
                  const tokenOutCurrency =
                    chainStore.osmosisObservable.currencies.find(
                      (cur) =>
                        cur.coinMinimalDenom ===
                        orderTokenInConfig.optimizedRoutePaths[0]
                          .tokenOutDenoms[i]
                    );

                  if (!tokenOutCurrency) {
                    orderTokenInConfig.setError(
                      new Error(
                        `Failed to find currency ${orderTokenInConfig.optimizedRoutePaths[0].tokenOutDenoms[i]}`
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
                      orderTokenInConfig.optimizedRoutePaths[0].tokenInDenom
                  );

                if (!tokenInCurrency) {
                  orderTokenInConfig.setError(
                    new Error(
                      `Failed to find currency ${orderTokenInConfig.optimizedRoutePaths[0].tokenInDenom}`
                    )
                  );
                  return;
                }

                const tokenInUAmount = new Dec(orderTokenInConfig.amount)
                  .mul(
                    DecUtils.getTenExponentNInPrecisionRange(
                      tokenInCurrency.coinDecimals
                    )
                  )
                  .truncate();

                const { tokenOutCurrency } = routes[routes.length - 1];
                const tokenOutUAmount = orderTokenInConfig.realOutputAmount
                  .toDec()
                  .mul(
                    DecUtils.getTenExponentNInPrecisionRange(
                      tokenOutCurrency.coinDecimals
                    )
                  )
                  .truncate();

                try {
                  const first = routes.shift();
                  const swap = {
                    user: account.bech32Address,
                    amount: tokenInUAmount.toString(),
                    min_output: tokenOutUAmount.toString(),
                    max_output: "18446744073709551615",
                    first: {
                      pool_id: first!.poolId,
                      denom_in: tokenInCurrency.coinMinimalDenom,
                      denom_out: first!.tokenOutCurrency.coinMinimalDenom,
                    },
                    route: [],
                  } as any;
                  swap.route = routes.map((route) => ({
                    pool_id: route.poolId,
                    denom_out: route.tokenOutCurrency.coinMinimalDenom,
                  }));
                  const msg = Buffer.from(JSON.stringify({ swap })).toString(
                    "base64"
                  );

                  const input_asset =
                    tokenInCurrency.coinMinimalDenom.startsWith("u") ||
                    tokenInCurrency.coinMinimalDenom.startsWith("ibc/")
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
                    funds.push({ denom: "uosmo", amount: "1000" }); // fee amount in usomo
                  } else {
                    funds.push({
                      denom: "uosmo",
                      amount: new Dec(orderTokenInConfig.amount)
                        .add(new Dec("0.001"))
                        .mul(
                          DecUtils.getTenExponentNInPrecisionRange(
                            tokenInCurrency.coinDecimals
                          )
                        )
                        .truncate()
                        .toString(),
                    });
                  }

                  await account.cosmwasm.sendExecuteContractMsg(
                    "executeWasm",
                    REGISTRY_ADDRESSES[chainId],
                    {
                      create_request: {
                        target: WRAPPER_ADDRESSES[chainId],
                        msg,
                        input_asset,
                      },
                    },
                    funds,
                    "",
                    { gas: "350000" },
                    undefined,
                    (e) => console.log(e)
                  );
                  orderTokenInConfig.setAmount("");
                  orderTokenInConfig.setFraction(undefined);
                } catch (e) {
                  console.error(e);
                }
              }
            }}
          >
            {account.walletStatus === WalletStatus.Loaded ? (
              showWarningSlippage ? (
                "Place Order Anyway"
              ) : (
                "Place Order"
              )
            ) : (
              <div className="flex items-center gap-1">
                <Image
                  alt="wallet"
                  src="/icons/wallet.svg"
                  height={24}
                  width={24}
                />
                <span>Connect Wallet</span>
              </div>
            )}
          </Button>
        )}
      </div>
    </div>
  );
});

import { CoinPrimitive } from "@keplr-wallet/stores";
import { CoinPretty } from "@keplr-wallet/unit";
import dayjs from "dayjs";
import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import classNames from "classnames";
import { request, gql } from "graphql-request";

import {
  REGISTRY_ADDRESSES,
  SUBQUERY_BACKUP_ENDPOINTS,
  SUBQUERY_ENDPOINTS,
} from "../../config";
import { useWindowSize } from "../../hooks";
import { useStore } from "../../stores";
import { TabBox } from "../control";
import { Button } from "../buttons";

interface Order {
  id: number;
  type: "Limit" | "StopLoss";
  status: string;
  createdAt: number;
  inputToken: CoinPrimitive;
  outputToken: CoinPrimitive;
}

interface Request {
  id: string;
  registerId: string;
  txHash: string;
  target: string;
  msg: string;
  assets: string;
  status: string;
  createdAt: string;
  executedOrCancelledAt: string;
}

const OrderRow = ({ order }: { order: Order }) => {
  const {
    accountStore,
    chainStore,
    assetsStore: { nativeBalances, ibcBalances },
  } = useStore();
  const { chainId } = chainStore.osmosis;
  const { isMobile } = useWindowSize();
  const account = accountStore.getAccount(chainId);
  const allTokenBalances = nativeBalances.concat(ibcBalances);

  const inputCurrency = allTokenBalances.find(
    (tb) =>
      typeof order.inputToken.denom === "string" &&
      tb.balance.currency.coinMinimalDenom.toLowerCase() ===
        order.inputToken.denom.toLowerCase()
  )?.balance.currency;

  const outputCurrency = allTokenBalances.find(
    (tb) =>
      typeof order.outputToken.denom === "string" &&
      tb.balance.currency.coinMinimalDenom.toLowerCase() ===
        order.outputToken.denom.toLowerCase()
  )?.balance.currency;

  const handleCancelOrder = useCallback(async () => {
    try {
      await account.cosmwasm.sendExecuteContractMsg(
        "executeWasm",
        REGISTRY_ADDRESSES[chainId],
        { cancel_request: { id: order.id } },
        [],
        "",
        { gas: "350000" },
        undefined,
        (e) => console.log(e)
      );
    } catch (err) {
      console.log(err);
    }
  }, [order, chainId, account]);

  if (!inputCurrency || !outputCurrency) return null;

  const inputCoin = new CoinPretty(inputCurrency, order.inputToken.amount);
  const outputCoin = new CoinPretty(outputCurrency, order.outputToken.amount);

  return (
    <div
      key={order.id}
      className="mb-4 w-full rounded-2xl bg-osmoverse-900 p-px text-left hover:bg-none"
    >
      <div className="bg-card flex h-full w-full cursor-pointer flex-col place-content-between rounded-2x linset p-4">
        <div className="flex items-center justify-between flex-row md:flex-col">
          <div className="flex items-center">
            <div className="flex items-center">
              <div className="h-8 w-8 overflow-hidden rounded-full md:h-5 md:w-5">
                {inputCurrency.coinImageUrl && (
                  <Image
                    src={inputCurrency.coinImageUrl}
                    alt="token icon"
                    className="rounded-full"
                    width={isMobile ? 20 : 32}
                    height={isMobile ? 20 : 32}
                  />
                )}
              </div>
              <h6 className="ml-1">{inputCurrency.coinDenom}</h6>
            </div>
            <div className="mx-3 whitespace-nowrap">{"->"}</div>
            <div className="flex items-center">
              <div className="h-8 w-8 overflow-hidden rounded-full md:h-5 md:w-5">
                {outputCurrency.coinImageUrl && (
                  <Image
                    src={outputCurrency.coinImageUrl}
                    alt="token icon"
                    className="rounded-full"
                    width={isMobile ? 20 : 32}
                    height={isMobile ? 20 : 32}
                  />
                )}
              </div>
              <h6 className="ml-1">{outputCurrency.coinDenom}</h6>
            </div>
          </div>
          {order.status === "created" && (
            <Button
              mode="primary-warning"
              className="ml-4 md:mt-4 md:w-1/2"
              disabled={account.txTypeInProgress !== ""}
              onClick={handleCancelOrder}
              size="sm"
            >
              Cancel
            </Button>
          )}
        </div>
        <p className="mt-2 font-bold">
          Sell {inputCoin.trim(true).toString()} for{" "}
          {outputCoin.trim(true).toString()}
        </p>
        <p className="subtitle2 md:caption text-wireframes-lightGrey">
          Created At:{" "}
          {dayjs(order.createdAt * 1000)
            .utc()
            .toString()}
        </p>
      </div>
    </div>
  );
};
const OrderRows = ({ orders }: { orders: Order[] }) => {
  return (
    <div className="max-h-[450px] overflow-y-auto">
      {orders.map((order) => (
        <OrderRow key={order.id} order={order} />
      ))}
    </div>
  );
};

export default function OrderHistory({
  orderType,
  containerClassName,
}: {
  orderType: "Limit" | "StopLoss" | "Swap";
  containerClassName?: string;
}) {
  const { chainStore, accountStore } = useStore();
  const { chainId, rpc } = chainStore.osmosis;
  const account = accountStore.getAccount(chainId);
  let accountChecker = Object.create(account);
  const [orders, setOrders] = useState<Order[]>([]);

  const orderByStatus = (status: string) =>
    orders.filter(
      (order) => order.type === orderType && order.status === status
    );

  useEffect(() => {
    const fetchHistory = async () => {
      if (accountChecker.hasInited) {
        // const keplr = await account.getKeplr();
        // if (!keplr) return;

        const query = gql`
        query {
          requests(
            filter: {
              registerId: {
                like: "${account.bech32Address.toString()}"
              }
            }
          ) {
            nodes {
              id
              registerId
              target
              msg
              assets
              status
              createdAt
              txHash
              executedOrCancelledAt
            }
          }
        }
      `;
        let nodes = [];
        try {
          const { requests } = await request(
            SUBQUERY_ENDPOINTS[chainId],
            query
          );
          nodes = requests.nodes;
        } catch (e) {
          try {
            const { requests } = await request(
              SUBQUERY_BACKUP_ENDPOINTS[chainId],
              query
            );
            nodes = requests.nodes;
          } catch (e) {
            console.log(e);
          }
        }

        const allOrders: Order[] = [];
        (nodes as Request[]).map((request) => {
          const msg = JSON.parse(Buffer.from(request.msg, "base64").toString());
          const { swap } = msg;
          if (!swap || !swap.route) return;
          allOrders.push({
            id: Number(request.id),
            type:
              swap.min_output ===
              (Number(swap.max_output) * 0.8).toFixed(0).toString()
                ? "StopLoss"
                : "Limit",
            status: request.status,
            createdAt: Math.floor(new Date(request.createdAt).getTime() / 1000),
            inputToken: { denom: swap.denom_in, amount: swap.amount_in },
            outputToken: {
              denom:
                swap.route.length > 0
                  ? swap.route[swap.route.length - 1].token_out_denom
                  : swap.denom_out,
              amount:
                swap.min_output ===
                (Number(swap.max_output) * 0.8).toFixed(0).toString()
                  ? swap.max_output
                  : swap.min_output,
            },
          });
        });
        setOrders(allOrders.sort((a, b) => b.id - a.id));
      } else if (!accountChecker.hasInited) {
        setOrders([]);
      }
    };

    const interval = setInterval(fetchHistory, 4000);
    return () => clearInterval(interval);
  }, [rpc, account.bech32Address, chainId]);

  if (orderType === "Swap") {
    return <></>;
  }
  // console.log(account.bech32Address);
  if (!account.bech32Address) return <></>;

  return (
    <div
      className={classNames(
        "relative rounded-[18px] my-4 flex flex-col gap-8 bg-osmoverse-800 px-5 md:px-3 pt-4 md:pt-4 pb-4 md:pb-4",
        containerClassName
      )}
    >
      <TabBox
        tabs={[
          {
            title: "Open",
            content: <OrderRows orders={orderByStatus("created")} />,
          },
          {
            title: "Executed",
            content: <OrderRows orders={orderByStatus("executed")} />,
          },
          {
            title: "Cancelled",
            content: <OrderRows orders={orderByStatus("cancelled")} />,
          },
        ]}
      />
    </div>
  );
}

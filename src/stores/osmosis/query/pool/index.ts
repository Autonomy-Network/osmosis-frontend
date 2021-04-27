import { GAMMPoolData } from "../../pool/types";
import { GAMMPool } from "../../pool";
import { ChainGetter, MsgOpt } from "@keplr-wallet/stores";
import {
  CoinPretty,
  DecUtils,
  IntPretty,
  Int,
  Coin,
  Dec
} from "@keplr-wallet/unit";
import { computed, makeObservable, observable } from "mobx";
import { Currency } from "@keplr-wallet/types";
import { Msg } from "@cosmjs/launchpad";

export class ObservablePool {
  @observable.ref
  protected readonly pool: GAMMPool;

  constructor(
    protected readonly chainId: string,
    protected readonly chainGetter: ChainGetter,
    data: GAMMPoolData
  ) {
    this.pool = new GAMMPool(data);

    makeObservable(this);
  }

  get id(): string {
    return this.pool.id;
  }

  estimateSwapExactAmountIn(
    tokenIn: { currency: Currency; amount: string },
    tokenOutCurrency: Currency
  ): {
    tokenOut: CoinPretty;
    spotPriceAfter: IntPretty;
    slippage: IntPretty;
  } {
    const amount = new Dec(tokenIn.amount)
      .mul(DecUtils.getPrecisionDec(tokenIn.currency.coinDecimals))
      .truncate();
    const coin = new Coin(tokenIn.currency.coinMinimalDenom, amount);

    const estimated = this.pool.estimateSwapExactAmountIn(
      coin,
      tokenOutCurrency.coinMinimalDenom
    );

    const tokenOut = new CoinPretty(tokenOutCurrency, estimated.tokenOutAmount);
    // XXX: IntPretty에서 0.5같이 정수부가 0인 Dec이 들어가면 precision이 제대로 설정되지않는 버그가 있기 때문에
    // 임시로 5를 곱하고 precision을 3으로 낮춰서 10^2가 곱해진 효과를 낸다.
    const spotPriceAfter = new IntPretty(
      estimated.spotPriceAfter.mul(DecUtils.getPrecisionDec(5))
    )
      .precision(3)
      .maxDecimals(4)
      .trim(true);

    const slippage = new IntPretty(
      estimated.slippage.mul(DecUtils.getPrecisionDec(5))
    )
      .precision(3)
      .maxDecimals(4)
      .trim(true);

    return {
      tokenOut,
      spotPriceAfter,
      slippage
    };
  }

  makeSwapExactAmountInMsg(
    msgOpt: Pick<MsgOpt, "type">,
    sender: string,
    tokenIn: { currency: Currency; amount: string },
    tokenOutCurrency: Currency,
    maxSlippage: string = "0"
  ): Msg {
    const estimated = this.estimateSwapExactAmountIn(tokenIn, tokenOutCurrency);

    const maxSlippageDec = new Dec(maxSlippage).quo(
      DecUtils.getPrecisionDec(2)
    );
    // TODO: Compare the computed slippage and wanted max slippage?

    const amount = new Dec(tokenIn.amount)
      .mul(DecUtils.getPrecisionDec(tokenIn.currency.coinDecimals))
      .truncate();
    const coin = new Coin(tokenIn.currency.coinMinimalDenom, amount);

    return {
      type: msgOpt.type,
      value: {
        sender,
        routes: [
          {
            poolId: this.id,
            tokenOutDenom: tokenOutCurrency.coinMinimalDenom
          }
        ],
        tokenIn: {
          denom: coin.denom,
          amount: coin.amount.toString()
        },
        tokenOutMinAmount: maxSlippageDec.equals(new Dec(0))
          ? "1"
          : estimated.tokenOut
              .toDec()
              .mul(DecUtils.getPrecisionDec(tokenOutCurrency.coinDecimals))
              .mul(new Dec(1).sub(maxSlippageDec))
              .truncate()
              .toString()
      }
    };
  }

  @computed
  get swapFee(): IntPretty {
    let dec = this.pool.swapFee;
    dec = dec.mul(DecUtils.getPrecisionDec(5));

    // XXX: IntPretty에서 0.5같이 정수부가 0인 Dec이 들어가면 precision이 제대로 설정되지않는 버그가 있기 때문에
    // 임시로 5를 곱하고 precision을 3으로 낮춰서 10^2가 곱해진 효과를 낸다.
    return new IntPretty(dec)
      .precision(3)
      .maxDecimals(4)
      .trim(true);
  }

  @computed
  get poolAssets(): {
    weight: IntPretty;
    amount: CoinPretty;
  }[] {
    const primitives = this.pool.poolAssets;

    return primitives.map(primitive => {
      const coinPrimitive = primitive.token;
      const currency = this.chainGetter
        .getChain(this.chainId)
        .currencies.find(cur => cur.coinMinimalDenom === coinPrimitive.denom);
      if (!currency) {
        throw new Error("Unknown currency");
      }

      return {
        weight: new IntPretty(new Int(primitive.weight)),
        amount: new CoinPretty(currency, new Int(coinPrimitive.amount))
      };
    });
  }
}

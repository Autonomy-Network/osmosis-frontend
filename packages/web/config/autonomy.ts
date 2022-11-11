export const SUBQUERY_ENDPOINTS: { [chainId: string]: string } = {
  "osmosis-1": "",
  "osmo-test-4":
    "https://api.subquery.network/sq/0xlook/autonomy-omosis-subquery",
};

export const REGISTRY_ADDRESSES: { [chainId: string]: string } = {
  "osmosis-1": "",
  "osmo-test-4":
    "osmo1ulqdnqjkm6v6kdehh37md4a6fs4ppyrv9jqr0ypcud9p8efygzmsstn2sy",
};

export const WRAPPER_ADDRESSES: { [chainId: string]: string } = {
  "osmosis-1": "",
  "osmo-test-4":
    "osmo1dwpdh2clk7c8csf9ql2xj36336xsryyg4j7622jhaert9htp48gsh8u9ve",
};
export const ENABLE_AUTONOMY =
  process.env.NEXT_PUBLIC_ENABLE_AUTONOMY === "enabled";

export const calculatePriceInUsd = ({
  priceMicroStx,
  stxPriceFloat,
}: {
  priceMicroStx: number;
  stxPriceFloat: number;
}) => {
  if (priceMicroStx === 0) {
    return 0;
  }
  return (priceMicroStx / 10 ** 6) * stxPriceFloat;
};
export const calculatePriceInSats = ({ priceInUsd, btcPriceFloat }: { priceInUsd: number; btcPriceFloat: number }) => {
  if (priceInUsd === 0) {
    return 0;
  }
  return priceInUsd / btcPriceFloat;
};
export const calculatePriceInBtc = ({ priceInUsd, btcPriceFloat }: { priceInUsd: number; btcPriceFloat: number }) => {
  if (priceInUsd === 0) {
    return 0;
  }
  return priceInUsd / btcPriceFloat;
};

import useSWR from "swr";
const fetcher = (url) => fetch(url).then(r => r.json());

export default function useLowStockCount() {
  const { data: stock, error } = useSWR("/api/stock", fetcher);

  // tant qu'on n'a pas de tableau, on renvoie 0
  if (error || !Array.isArray(stock)) {
    return 0;
  }

  // On compte les lignes où Qte stock + En Commande < Qte mini
  return stock.filter(item => {
    const dispo =
      Number(item["Qte stock"] || 0) +
      Number(item["En Commande"]  || 0);
    return dispo < Number(item["Qte mini"] || 0);
  }).length;
}

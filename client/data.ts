import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { qoderConfigSetRpc, qoderQuotaGetRpc, qoderQuotaRefreshRpc, qoderSdkInstallRpc } from "../shared/quota";

export function useQuotaState() {
  const call = useRpc(qoderQuotaGetRpc);
  return useQuery({
    queryKey: ["qoder-quota"],
    queryFn: () => call({}),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useQuotaActions() {
  const refresh = useRpc(qoderQuotaRefreshRpc);
  const setIntervalMinutes = useRpc(qoderConfigSetRpc);
  const installSdk = useRpc(qoderSdkInstallRpc);
  return { refresh, setIntervalMinutes, installSdk };
}

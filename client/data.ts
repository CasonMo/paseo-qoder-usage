import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { qoderConfigSetRpc, qoderQuotaGetRpc, qoderQuotaRefreshRpc, qoderSdkInstallRpc, qoderUpdateCheckRpc } from "../shared/quota";

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

export function useUpdateCheck() {
  const call = useRpc(qoderUpdateCheckRpc);
  return useQuery({
    queryKey: ["qoder-usage", "update-check"],
    queryFn: () => call({}),
    staleTime: 3_600_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

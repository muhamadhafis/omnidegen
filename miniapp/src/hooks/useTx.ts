import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

export function useTx() {
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  return { hash, error, isPending, isSuccess, writeContract };
}

export type TxHandle = ReturnType<typeof useTx>;

import { useState } from "react";
import { ExternalLinkIcon, RefreshCcwIcon, LoaderIcon, RotateCcwIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { Hint } from "@/components/hint";
import { Fragment } from "@/generated/prisma";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

const SANDBOX_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface Props {
  data: Fragment;
};

export function FragmentWeb({ data }: Props) {
  const isInitiallyExpired =
    Date.now() - new Date(data.updatedAt).getTime() > SANDBOX_TTL_MS;

  const [copied, setCopied] = useState(false);
  const [fragmentKey, setFragmentKey] = useState(0);
  const [sandboxUrl, setSandboxUrl] = useState(data.sandboxUrl);
  const [sandboxExpired, setSandboxExpired] = useState(isInitiallyExpired);

  const trpc = useTRPC();

  const revive = useMutation(trpc.messages.revive.mutationOptions({
    onSuccess: (result) => {
      setSandboxUrl(result.sandboxUrl);
      setSandboxExpired(false);
      setFragmentKey((prev) => prev + 1);
    },
  }));

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sandboxUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevive = () => {
    revive.mutate({ fragmentId: data.id });
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
        <Hint text="Refresh" side="bottom" align="start">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCcwIcon />
          </Button>
        </Hint>
        <Hint text="Click to copy" side="bottom">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            disabled={!sandboxUrl || copied}
            className="flex-1 justify-start text-start font-normal"
          >
            <span className="truncate">
              {sandboxUrl}
            </span>
          </Button>
        </Hint>
        <Hint text="Open in a new tab" side="bottom" align="start">
          <Button
            size="sm"
            disabled={!sandboxUrl}
            variant="outline"
            onClick={() => {
              if (!sandboxUrl) return;
              window.open(sandboxUrl, "_blank");
            }}
          >
            <ExternalLinkIcon />
          </Button>
        </Hint>
        <Hint text="Revive sandbox" side="bottom" align="end">
          <Button
            size="sm"
            variant="outline"
            disabled={revive.isPending}
            onClick={handleRevive}
          >
            {revive.isPending ? (
              <LoaderIcon className="animate-spin" />
            ) : (
              <RotateCcwIcon />
            )}
          </Button>
        </Hint>
      </div>
      <div className="relative h-full w-full">
        {!sandboxExpired && !revive.isPending && (
          <iframe
            key={fragmentKey}
            className="h-full w-full"
            sandbox="allow-forms allow-scripts allow-same-origin"
            loading="lazy"
            src={sandboxUrl}
          />
        )}
        {(sandboxExpired || revive.isPending) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background gap-4">
            {revive.isPending ? (
              <>
                <LoaderIcon className="size-10 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Reviving sandbox...</p>
              </>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Sandbox Expired</p>
                  <p className="text-sm text-muted-foreground">
                    This sandbox has timed out. Revive it to restore your preview.
                  </p>
                </div>
                <Button onClick={handleRevive} className="gap-2">
                  <RotateCcwIcon className="size-4" />
                  Revive Preview
                </Button>
                {revive.isError && (
                  <p className="text-sm text-destructive">
                    Failed to revive sandbox. Please try again.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
};

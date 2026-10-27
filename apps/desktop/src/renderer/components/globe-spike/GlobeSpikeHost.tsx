import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";

import { GLOBE_SPIKE_FAIL_HASH, GLOBE_SPIKE_HASH } from "./globe-spike-flag.js";

declare const __GLOBE_SPIKE__: boolean;

const GLOBE_SPIKE = typeof __GLOBE_SPIKE__ !== "undefined" && __GLOBE_SPIKE__;

const LazyGlobeSpike = GLOBE_SPIKE
  ? lazy(() => import("./GlobeSpike.js").then((module) => ({ default: module.GlobeSpike })))
  : null;

declare global {
  interface Window {
    __globeSpikeViolations?: string[];
    __globeSpikeFailures?: string[];
    __globeSpikePosture?: { readonly evalBlocked: boolean };
  }
}

interface BoundaryProps {
  readonly onFail: (reason: string) => void;
  readonly children: ReactNode;
}

class SpikeBoundary extends Component<BoundaryProps> {
  override componentDidCatch(error: Error): void {
    this.props.onFail(error.message);
  }

  override render(): ReactNode {
    return this.props.children;
  }
}

function spikeRequested(): boolean {
  return (
    window.location.hash === GLOBE_SPIKE_HASH || window.location.hash === GLOBE_SPIKE_FAIL_HASH
  );
}

function SpikeOverlay() {
  const [failed, setFailed] = useState(false);
  const leave = useCallback((reason: string) => {
    window.__globeSpikeFailures = [...(window.__globeSpikeFailures ?? []), reason];
    setFailed(true);
    window.location.hash = "";
  }, []);
  if (failed || LazyGlobeSpike === null) return null;
  return (
    <SpikeBoundary onFail={leave}>
      <Suspense fallback={null}>
        <LazyGlobeSpike onFail={leave} />
      </Suspense>
    </SpikeBoundary>
  );
}

export function GlobeSpikeHost({ children }: { readonly children: ReactNode }) {
  const [requested, setRequested] = useState(spikeRequested);

  useEffect(() => {
    if (!GLOBE_SPIKE) return;
    window.__globeSpikeViolations = [];
    let probing = true;
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      if (probing) return;
      window.__globeSpikeViolations?.push(`${event.violatedDirective} ${event.blockedURI}`);
    };
    document.addEventListener("securitypolicyviolation", onViolation);
    let evalBlocked = false;
    try {
      const compile: unknown = Reflect.get(globalThis, "Function");
      if (typeof compile === "function") {
        const made: unknown = Reflect.construct(compile, ["return 1"]);
        if (typeof made === "function") made();
      }
    } catch {
      evalBlocked = true;
    }
    window.__globeSpikePosture = { evalBlocked };
    const settleProbe = window.setTimeout(() => {
      probing = false;
    }, 100);
    const onHash = () => setRequested(spikeRequested());
    window.addEventListener("hashchange", onHash);
    return () => {
      window.clearTimeout(settleProbe);
      document.removeEventListener("securitypolicyviolation", onViolation);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  return (
    <>
      {children}
      {GLOBE_SPIKE && requested ? <SpikeOverlay key={window.location.hash} /> : null}
    </>
  );
}

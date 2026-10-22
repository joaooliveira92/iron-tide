import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";

interface ShipViewBoundaryProps {
  readonly resetKey: unknown;
  readonly children: ReactNode;
}

interface ShipViewBoundaryState {
  readonly failedKey: unknown;
  readonly failed: boolean;
}

export class ShipViewBoundary extends Component<ShipViewBoundaryProps, ShipViewBoundaryState> {
  override state: ShipViewBoundaryState = { failedKey: undefined, failed: false };

  static getDerivedStateFromError(): Partial<ShipViewBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: ShipViewBoundaryProps,
    state: ShipViewBoundaryState,
  ): Partial<ShipViewBoundaryState> | null {
    if (!state.failed) return { failedKey: props.resetKey };
    return state.failedKey === props.resetKey ? null : { failed: false, failedKey: props.resetKey };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("Ship view failed to draw", { error, componentStack: info.componentStack });
  }

  private readonly retry = (): void => this.setState({ failed: false });

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <Alert variant="destructive" className="space-y-2">
        <p>The ship drawing could not be shown for this design. Your design is unchanged.</p>
        <Button variant="outline" size="sm" onClick={this.retry}>
          Redraw ship
        </Button>
      </Alert>
    );
  }
}

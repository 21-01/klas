import { describe, it, expect, vi } from "vitest";
import { screen, act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "../../app/components/Toast";
import React from "react";

type ToastApi = ReturnType<typeof useToast>;

function ToastTrigger({ toastRef }: { toastRef: React.MutableRefObject<ToastApi | null> }) {
  const toast = useToast();
  toastRef.current = toast;
  return <div>Toast consumer</div>;
}

function createToastRef(): React.MutableRefObject<ToastApi | null> {
  return { current: null };
}

describe("Toast", () => {
  it("shows a success toast", async () => {
    const toastRef = createToastRef();
    render(
      <ToastProvider>
        <ToastTrigger toastRef={toastRef} />
      </ToastProvider>
    );

    act(() => {
      toastRef.current!.success("Operation completed");
    });

    expect(screen.getByText("Operation completed")).toBeInTheDocument();
  });

  it("shows an error toast", async () => {
    const toastRef = createToastRef();
    render(
      <ToastProvider>
        <ToastTrigger toastRef={toastRef} />
      </ToastProvider>
    );

    act(() => {
      toastRef.current!.error("Something went wrong");
    });

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows an info toast", async () => {
    const toastRef = createToastRef();
    render(
      <ToastProvider>
        <ToastTrigger toastRef={toastRef} />
      </ToastProvider>
    );

    act(() => {
      toastRef.current!.info("Here is some info");
    });

    expect(screen.getByText("Here is some info")).toBeInTheDocument();
  });

  it("shows a warning toast", async () => {
    const toastRef = createToastRef();
    render(
      <ToastProvider>
        <ToastTrigger toastRef={toastRef} />
      </ToastProvider>
    );

    act(() => {
      toastRef.current!.warning("Be careful");
    });

    expect(screen.getByText("Be careful")).toBeInTheDocument();
  });

  it("dismisses toast on close button click", async () => {
    const user = userEvent.setup();
    const toastRef = createToastRef();
    render(
      <ToastProvider>
        <ToastTrigger toastRef={toastRef} />
      </ToastProvider>
    );

    act(() => {
      toastRef.current!.success("Dismiss me", { duration: 60000 });
    });

    const closeBtn = screen.getByLabelText("Close notification");
    await user.click(closeBtn);

    // Wait for exit animation (300ms)
    await new Promise((r) => setTimeout(r, 400));

    expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument();
  });

  it("renders multiple toasts", async () => {
    const toastRef = createToastRef();
    render(
      <ToastProvider>
        <ToastTrigger toastRef={toastRef} />
      </ToastProvider>
    );

    act(() => {
      toastRef.current!.success("First toast");
      toastRef.current!.error("Second toast");
    });

    expect(screen.getByText("First toast")).toBeInTheDocument();
    expect(screen.getByText("Second toast")).toBeInTheDocument();
  });

  it("renders title when provided", async () => {
    const toastRef = createToastRef();
    render(
      <ToastProvider>
        <ToastTrigger toastRef={toastRef} />
      </ToastProvider>
    );

    act(() => {
      toastRef.current!.success("Details here", { title: "Success" });
    });

    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("Details here")).toBeInTheDocument();
  });

  it("renders action button when provided", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const toastRef = createToastRef();
    render(
      <ToastProvider>
        <ToastTrigger toastRef={toastRef} />
      </ToastProvider>
    );

    act(() => {
      toastRef.current!.success("Record deleted", { duration: 60000, action: { label: "Undo", onClick } });
    });

    const actionBtn = screen.getByText("Undo");
    expect(actionBtn).toBeInTheDocument();
    await user.click(actionBtn);
    expect(onClick).toHaveBeenCalled();
  });

  it("auto-dismisses after duration", async () => {
    vi.useFakeTimers();
    const toastRef = createToastRef();
    render(
      <ToastProvider>
        <ToastTrigger toastRef={toastRef} />
      </ToastProvider>
    );

    act(() => {
      toastRef.current!.success("Auto dismiss", { duration: 1000 });
    });

    expect(screen.getByText("Auto dismiss")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1000); });
    // After duration + exit animation (300ms)
    act(() => { vi.advanceTimersByTime(300); });

    expect(screen.queryByText("Auto dismiss")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

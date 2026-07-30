import { View } from '@tarojs/components';
import { Component, PropsWithChildren, useSyncExternalStore } from 'react';
import { CircleAlert, Copy, RefreshCw, X } from 'lucide-react-taro';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Portal } from '@/components/ui/portal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { IS_H5_ENV } from './env';

type ErrorState = {
  error: Error | null;
};

type ErrorBoundaryProps = PropsWithChildren;

type ErrorReportOptions = {
  componentStack?: string;
  source?: string;
};

type OverlayStore = {
  error: Error | null;
  report: string;
  source: string;
  visible: boolean;
  open: boolean;
  timestamp: string;
};

const EMPTY_STORE: OverlayStore = {
  error: null,
  report: '',
  source: '',
  visible: false,
  open: false,
  timestamp: '',
};

const ERROR_ACCENT_COLOR = 'hsl(360, 100%, 45%)';

let handlersInstalled = false;
let overlayStore: OverlayStore = EMPTY_STORE;
const listeners = new Set<() => void>();

const emitChange = () => {
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => overlayStore;

const setOverlayStore = (nextStore: OverlayStore) => {
  overlayStore = nextStore;
  emitChange();
};

const copyText = async (text: string) => {
  if (typeof window === 'undefined') return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn('[H5ErrorBoundary] Clipboard API copy failed:', error);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch (error) {
    console.warn('[H5ErrorBoundary] Fallback copy failed:', error);
    return false;
  }
};

const normalizeError = (value: unknown) => {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === 'string') {
    return new Error(value);
  }

  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
};

const buildErrorReport = (error: Error, options: ErrorReportOptions = {}) => {
  const lines = [
    '[H5 Runtime Error]',
    `Time: ${new Date().toISOString()}`,
    options.source ? `Source: ${options.source}` : '',
    `Name: ${error.name}`,
    `Message: ${error.message}`,
    error.stack ? `Stack:\n${error.stack}` : '',
    options.componentStack ? `Component Stack:\n${options.componentStack}` : '',
    typeof navigator !== 'undefined'
      ? `User Agent: ${navigator.userAgent}`
      : '',
  ].filter(Boolean);

  return lines.join('\n\n');
};

const setPanelOpen = (open: boolean) => {
  if (!overlayStore.visible) return;

  setOverlayStore({
    ...overlayStore,
    open,
  });
};

export const showH5ErrorOverlay = (
  input: unknown,
  options: ErrorReportOptions = {},
) => {
  if (typeof window === 'undefined') {
    return;
  }

  const error = normalizeError(input);
  const report = buildErrorReport(error, options);
  const timestamp = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  setOverlayStore({
    error,
    report,
    source: options.source || 'runtime',
    timestamp,
    visible: true,
    open: false,
  });

  console.error('[H5ErrorOverlay] Showing error overlay:', error, options);
};

const handleWindowError = (event: ErrorEvent) => {
  const error =
    event.error || new Error(event.message || 'Unknown H5 runtime error');
  showH5ErrorOverlay(error, { source: 'window.error' });
};

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  showH5ErrorOverlay(event.reason, { source: 'window.unhandledrejection' });
};

export const initializeH5ErrorHandling = () => {
  if (!IS_H5_ENV || typeof window === 'undefined' || handlersInstalled) {
    return;
  }

  handlersInstalled = true;
  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
};

const H5ErrorOverlayHost = () => {
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (!IS_H5_ENV || !store.visible) {
    return null;
  }

  const errorName = store.error?.name || 'Error';

  return (
    <Portal>
      <View className="pointer-events-none fixed inset-0 z-[2147483646]">
        <View className="pointer-events-auto fixed bottom-5 left-5">
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-11 w-11 rounded-full shadow-md transition-transform',
            )}
            style={{
              backgroundColor: 'hsl(359, 100%, 97%)',
              borderColor: 'hsl(359, 100%, 94%)',
              color: ERROR_ACCENT_COLOR,
            }}
            onClick={() => setPanelOpen(!store.open)}
          >
            <CircleAlert size={22} color={ERROR_ACCENT_COLOR} />
          </Button>
        </View>

        {store.open && (
          <View className="pointer-events-none fixed inset-0 bg-white bg-opacity-15 supports-[backdrop-filter]:backdrop-blur-md">
            <View className="absolute inset-0 flex items-center justify-center px-4 py-4">
              <View
                className="w-full max-w-md"
                style={{
                  width:
                    'min(calc(100vw - 32px), var(--h5-phone-width, 390px))',
                  height: 'min(calc(100vh - 32px), 900px)',
                }}
              >
                <Card
                  className={cn(
                    'pointer-events-auto h-full rounded-2xl border border-border bg-background text-foreground shadow-2xl',
                  )}
                >
                  <View className="relative flex h-full flex-col">
                    <CardHeader className="gap-2 p-4 pb-2">
                      <View className="flex items-start justify-between gap-3">
                        <View className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="destructive"
                            className="border-none bg-red-500 px-3 py-1 text-xs font-medium text-white"
                          >
                            Runtime Error
                          </Badge>
                          <Badge
                            variant="outline"
                            className="px-3 py-1 text-xs"
                          >
                            {store.source}
                          </Badge>
                        </View>

                        <View className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => window.location.reload()}
                          >
                            <RefreshCw size={15} color="inherit" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => setPanelOpen(false)}
                          >
                            <X size={17} color="inherit" />
                          </Button>
                        </View>
                      </View>

                      <View className="flex items-center justify-between gap-3">
                        <CardTitle className="text-left text-lg">
                          {errorName}
                        </CardTitle>

                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 rounded-lg"
                          onClick={async () => {
                            const copied = await copyText(store.report);
                            if (copied) {
                              toast.success('已复制错误信息', {
                                description: '可发送给 Agent 进行自动修复',
                                position: 'top-center',
                              });
                              return;
                            }

                            toast.warning('复制失败', {
                              description: '请直接选中文本后手动复制。',
                              position: 'top-center',
                            });
                          }}
                        >
                          <Copy size={15} color="inherit" />
                          <View>复制错误</View>
                        </Button>
                      </View>
                    </CardHeader>

                    <CardContent className="min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-2">
                      <View className="flex h-full min-h-0 flex-col gap-2">
                        <View className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border px-3 py-2 text-sm">
                          <View className="flex items-center gap-2">
                            <View className="text-muted-foreground">Error</View>
                            <View className="font-medium text-foreground">
                              {store.error?.name || 'Error'}
                            </View>
                          </View>
                          <View className="h-4 w-px bg-border" />
                          <View className="flex items-center gap-2">
                            <View className="text-muted-foreground">
                              Source
                            </View>
                            <View className="font-medium text-foreground">
                              {store.source}
                            </View>
                          </View>
                        </View>

                        <View className="min-h-0 flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-black text-white">
                          <View className="flex items-center justify-between border-b border-white border-opacity-10 px-3 py-3">
                            <View className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                              Full Report
                            </View>
                            <Badge
                              variant="outline"
                              className="border-zinc-700 bg-transparent px-2 py-1 text-xs text-zinc-400"
                            >
                              {store.timestamp}
                            </Badge>
                          </View>

                          <ScrollArea
                            className="min-h-0 flex-1 w-full"
                            orientation="both"
                          >
                            <View className="inline-block min-w-full whitespace-pre px-3 py-3 pb-8 font-mono text-xs leading-6 text-zinc-200">
                              {store.report}
                            </View>
                          </ScrollArea>
                        </View>
                      </View>
                    </CardContent>
                  </View>
                </Card>
              </View>
            </View>
          </View>
        )}
      </View>
    </Portal>
  );
};

class H5ErrorBoundaryInner extends Component<ErrorBoundaryProps, ErrorState> {
  static getDerivedStateFromError(error: Error): Partial<ErrorState> {
    return { error };
  }

  state: ErrorState = {
    error: null,
  };

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.children !== this.props.children) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    showH5ErrorOverlay(error, {
      source: 'React Error Boundary',
      componentStack: info.componentStack || '',
    });
  }

  render() {
    return (
      <>
        <H5ErrorOverlayHost />
        {this.state.error ? null : this.props.children}
      </>
    );
  }
}

export const H5ErrorBoundary = ({ children }: PropsWithChildren) => {
  if (!IS_H5_ENV) {
    return <>{children}</>;
  }

  return <H5ErrorBoundaryInner>{children}</H5ErrorBoundaryInner>;
};

import { useLaunch } from '@tarojs/taro';
import { PropsWithChildren } from 'react';
import { injectH5Styles } from './h5-styles';
import { devDebug } from './dev-debug';
import { H5Container } from './h5-container';
import {
  H5ErrorBoundary,
  initializeH5ErrorHandling,
} from './h5-error-boundary';
import { IS_H5_ENV } from './env';

export const Preset = ({ children }: PropsWithChildren) => {
  if (IS_H5_ENV) {
    initializeH5ErrorHandling();
  }

  useLaunch(() => {
    devDebug();
    injectH5Styles();
  });

  if (IS_H5_ENV) {
    return (
      <H5ErrorBoundary>
        <H5Container>{children}</H5Container>
      </H5ErrorBoundary>
    );
  }

  return <>{children}</>;
};

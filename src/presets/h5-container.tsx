import { PropsWithChildren } from 'react';
import { IS_H5_ENV } from './env';
import { H5NavBar } from './h5-navbar';

export const H5Container = ({ children }: PropsWithChildren) => {
  if (!IS_H5_ENV) {
    return <>{children}</>;
  }

  return (
    <>
      <H5NavBar />
      {children}
    </>
  );
};

import React from 'react';
import { useChartUrl } from '../lib/chartStorage';

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string };

/** <img> for chart screenshots: resolves storage references to signed URLs. */
export const ChartImage: React.FC<Props> = ({ src, alt = 'Chart screenshot', className, ...rest }) => {
  const { url, error } = useChartUrl(src);
  if (!src) return null;
  if (!url) {
    return (
      <div className={`${className ?? ''} flex items-center justify-center bg-slate-900/60 text-[10px] font-mono text-slate-500`} title={error}>
        {error ? 'Chart unavailable' : 'Loading chart…'}
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} {...rest} />;
};

/** <a> that opens a stored chart in a new tab. */
export const ChartLink: React.FC<Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { src?: string }> = ({ src, children, ...rest }) => {
  const { url } = useChartUrl(src);
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer" {...rest}>{children}</a>;
};
